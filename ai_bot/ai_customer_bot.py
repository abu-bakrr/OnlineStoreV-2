import os
import sys
import json
import logging
import asyncio
import sqlite3
import re
from datetime import datetime
from dotenv import load_dotenv

# Форсируем UTF-8 для всего процесса. Фикс для серверов с ASCII locale (Ubuntu).
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')
os.environ['PYTHONUTF8'] = '1'
os.environ['PYTHONIOENCODING'] = 'utf-8'

from telebot.async_telebot import AsyncTeleBot
from telebot import types
from groq import AsyncGroq

# --- 1. CONFIGURATION & LOGGING ---
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import ai_bot.ai_db_helper as db_helper

load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env'))

if os.name == 'nt': 
    os.system('color')

class Colors:
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'

class ColorFormatter(logging.Formatter):
    def format(self, record):
        color = {
            logging.INFO: Colors.BLUE,
            logging.WARNING: Colors.YELLOW,
            logging.ERROR: Colors.RED,
            logging.CRITICAL: Colors.BOLD + Colors.RED
        }.get(record.levelno, Colors.ENDC)
        return f"{color}{record.getMessage()}{Colors.ENDC}"

logger = logging.getLogger("Milly")
logger.setLevel(logging.INFO)
console_handler = logging.StreamHandler(sys.stdout)
console_handler.setFormatter(ColorFormatter())
logger.addHandler(console_handler)
file_handler = logging.FileHandler("milly_v9.log", encoding='utf-8')
file_handler.setFormatter(logging.Formatter('%(asctime)s - %(levelname)s - %(message)s'))
logger.addHandler(file_handler)

class MillyBot:
    def __init__(self):
        self.logger = logger  # Обязательно первым! Используется ниже
        self.db_path = os.path.join(os.path.dirname(__file__), 'bot_state.db')
        self.token = os.getenv('AI_BOT_TOKEN')
        if not self.token:
            raise ValueError("❌ AI_BOT_TOKEN не найден!")
        self.bot = AsyncTeleBot(self.token)
        self.groq_key = os.getenv('GROQ_API_KEY')
        if not self.groq_key:
            self.logger.warning("⚠️ GROQ_API_KEY не найден! ИИ-функции будут отключены.")
        self.groq = AsyncGroq(api_key=self.groq_key) if self.groq_key else None
        self.ADMIN_ID = 7710352080
        
        # Загружаем настройки магазина
        self.settings = {}
        settings_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'config', 'settings.json')
        try:
            with open(settings_path, 'r', encoding='utf-8') as f:
                self.settings = json.load(f)
        except Exception as e:
            self.logger.warning(f"Не удалось загрузить settings.json: {e}")

        shop_name = self.settings.get('shopName', 'нашего магазина')
        site_url = self.settings.get('seo', {}).get('siteUrl', 'https://example.com')
        bot_url = self.settings.get('telegramBotUrl', '')
        self.manager_contact = self.settings.get('managerContact', '@admin')

        self.system_prompt = f"""### 💎 AI АССИСТЕНТ {shop_name.upper()}

**IMPORTANT: You MUST respond strictly in JSON format.**

#### 👑 ТВОЯ РОЛЬ И ОБРАЗ:
Ты — официальный AI-ассистент и консультант интернет-магазина {shop_name}. Твоя речь:
- **Профессиональная**: Ты знаешь всё о товарах, ценах и доставке.
- **Вдохновляющая и яркая**: Используй много уместных эмодзи, чтобы сделать ответ живым.

#### 🌍 ВАЖНО — ЯЗЫК ОТВЕТА:
- **ВСЕГДА отвечай на том же языке, на котором написал пользователь.**
- Если пишет по-русски — отвечай по-русски.
- Если пишет на узбекском (латиницей или кириллицей) — отвечай на узбекском.
- **НИКОГДА не смешивай языки в одном ответе!**

#### 🏢 О МАГАЗИНЕ:
{shop_name} — интернет-магазин стильной одежды и аксессуаров. Доставка по всему Узбекистану.
- Сайт: **[{shop_name}]({site_url})**
- Telegram: **[{bot_url.split('/')[-1] if bot_url else '@bot'}]({bot_url})**

#### 🔧 ИНСТРУМЕНТЫ (JSON СХЕМА):
Вы ОБЯЗАНЫ всегда возвращать ТОЛЬКО валидный JSON с тремя ключами: `thoughts`, `action`, `reply_to_user`.
```json
{
  "thoughts": "Я должен найти кроссовки. Вызываю search.",
  "action": {
    "tool": "search",
    "args": {
      "query": "кроссовки"
    }
  },
  "reply_to_user": "Сейчас посмотрю..."
}
```
Если инструмент не нужен, используй `"tool": "none"`.

Доступные инструменты:
- `search`: Поиск товаров. Args: `{"query": "название/категория"}`
- `info`: Получение деталей о товаре. Args: `{"id": "ID товара"}`
- `catalog`: Список категорий. Args: `{}`
- `order`: Статус заказа. Args: `{"id": "номер заказа"}`

#### 🚫 СТРОГИЕ ЗАПРЕТЫ (КРИТИЧЕСКИ ВАЖНО):
1. **НЕ ВЫДУМЫВАТЬ ТОВАРЫ!** Если инструмент `search` вернул пустой результат — честно скажи клиенту, что таких товаров сейчас нет.
2. **НЕ ВЫДУМЫВАТЬ ЦЕНЫ И ДЕТАЛИ!** Бери всю информацию ТОЛЬКО из ответа (SYSTEM_OBSERVATION) инструмента.
3. **НИКАКИХ HEX-КОДОВ!** Не пиши #000000, используй слова (черный, белый и т.д.).

#### 🎨 ШАБЛОНЫ ОТВЕТОВ:
- **ЛЮБЫЕ ССЫЛКИ**: Всегда **жирные**. Формат: **[Текст](ссылка)**.
- **ВЫВОД ТОВАРА**:

**[Название товара]({site_url}/product/ID)**
💰 **Цена**: `450,000` сум
📝 **Описание**: (Текст из info)
✨ **Наличие**:
• Цвет/Размер: ✅ или ❌

#### 💎 ПРИМЕРЫ ОТВЕТОВ:

Пример 1 (RU): User: "[USER_LANG: ru] давай air force"
JSON: {
  "thoughts": "Клиент пишет на русском. Ищу Air Force.",
  "action": { "tool": "search", "args": { "query": "air force" } },
  "reply_to_user": "✨ Сейчас поищу для вас..."
}

Пример 2 (UZ): User: "[USER_LANG: uz] krossovka bor mi"
JSON: {
  "thoughts": "Foydalanuvchi o'zbek tilida yozmoqda. Krossovka qidiraman.",
  "action": { "tool": "search", "args": { "query": "krossovka" } },
  "reply_to_user": "✨ Hozir sizga eng yaxshi krossovkalarni topaman..."
}
"""
        # Initialize DB and register handlers
        self._init_db()
        self._register_handlers()

    def _init_db(self):
        with sqlite3.connect(self.db_path) as conn:
            c = conn.cursor()
            c.execute('''CREATE TABLE IF NOT EXISTS sessions
                         (user_id INTEGER PRIMARY KEY, history TEXT, last_active TIMESTAMP)''')
            c.execute('''CREATE TABLE IF NOT EXISTS support_queue
                         (user_id INTEGER PRIMARY KEY, waiting BOOLEAN)''')
            c.execute('''CREATE TABLE IF NOT EXISTS support_messages
                         (message_id INTEGER PRIMARY KEY, user_id INTEGER)''')
            # Очищаем историю чатов при каждой перезагрузке бота
            c.execute('DELETE FROM sessions')
            conn.commit()

    def _get_session(self, user_id):
        with sqlite3.connect(self.db_path) as conn:
            c = conn.cursor()
            c.execute('SELECT history, last_active FROM sessions WHERE user_id = ?', (user_id,))
            row = c.fetchone()
            now = datetime.now()
            
            if row:
                history = json.loads(row[0])
                last_active = datetime.fromisoformat(row[1])
                # Очищаем чат по истечению 2 часов (7200 секунд)
                if (now - last_active).total_seconds() > 7200:
                    history = []
                    self.logger.info(f"♻️ Session reset for {user_id}")
            else:
                history = []
            
            c.execute('REPLACE INTO sessions (user_id, history, last_active) VALUES (?, ?, ?)',
                      (user_id, json.dumps(history, ensure_ascii=False), now.isoformat()))
            conn.commit()
            return history

    def _update_session(self, user_id, history):
        with sqlite3.connect(self.db_path) as conn:
            c = conn.cursor()
            c.execute('UPDATE sessions SET history = ?, last_active = ? WHERE user_id = ?',
                      (json.dumps(history, ensure_ascii=False), datetime.now().isoformat(), user_id))
            conn.commit()


            
    def _set_waiting_support(self, user_id, waiting=True):
        with sqlite3.connect(self.db_path) as conn:
            c = conn.cursor()
            c.execute('REPLACE INTO support_queue (user_id, waiting) VALUES (?, ?)', (user_id, waiting))
            conn.commit()
            
    def _is_waiting_support(self, user_id):
        with sqlite3.connect(self.db_path) as conn:
            c = conn.cursor()
            c.execute('SELECT waiting FROM support_queue WHERE user_id = ?', (user_id,))
            row = c.fetchone()
            return bool(row[0]) if row else False
            
    def _save_support_message(self, message_id, user_id):
        with sqlite3.connect(self.db_path) as conn:
            c = conn.cursor()
            c.execute('REPLACE INTO support_messages (message_id, user_id) VALUES (?, ?)', (message_id, user_id))
            conn.commit()
            
    def _get_support_user_id(self, message_id):
        with sqlite3.connect(self.db_path) as conn:
            c = conn.cursor()
            c.execute('SELECT user_id FROM support_messages WHERE message_id = ?', (message_id,))
            row = c.fetchone()
            return row[0] if row else None

    async def _set_bot_commands(self):
        try:
            await self.bot.set_chat_menu_button(menu_button=types.MenuButtonDefault())
        except Exception as e:
            self.logger.warning(f"Could not reset Web App menu button: {e}")

    def _get_main_keyboard(self):
        markup = types.ReplyKeyboardMarkup(resize_keyboard=True, row_width=1)
        markup.add(types.KeyboardButton("📞 Связаться с менеджером"))
        return markup

    async def _ai_think(self, messages):
        if not self.groq_key: return None
        # Optimized list: only valid fast models
        MODELS = [
            "llama-3.3-70b-versatile",
            "meta-llama/llama-4-scout-17b-16e-instruct",
            "mixtral-8x7b-32768"
        ]
        
        import aiohttp
        url = "https://api.groq.com/openai/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.groq_key}",
            "Content-Type": "application/json",
        }
        full_msgs = [{"role": "system", "content": self.system_prompt}] + messages
        # Явно кодируем в UTF-8 байты, минуя httpx и системный locale
        body_bytes = json.dumps({
            "temperature": 0.1,
            "response_format": {"type": "json_object"},
            "messages": full_msgs
        }, ensure_ascii=False).encode('utf-8')

        last_error = ""
        wait_time = "несколько секунд"
        for model_name in MODELS:
            try:
                self.logger.info(f"🤖 [REQUEST] Model: {model_name}")
                body_bytes_with_model = json.dumps({
                    "model": model_name,
                    "temperature": 0.1,
                    "response_format": {"type": "json_object"},
                    "messages": full_msgs
                }, ensure_ascii=False).encode('utf-8')

                async with aiohttp.ClientSession() as session:
                    async with session.post(url, headers=headers, data=body_bytes_with_model) as resp:
                        if resp.status == 429:
                            last_error = "overloaded"
                            text = await resp.text(encoding='utf-8')
                            match = re.search(r'in (\d+m?\s?\d*s)', text.lower())
                            if match: wait_time = match.group(1)
                            continue
                        if resp.status != 200:
                            text = await resp.text(encoding='utf-8')
                            self.logger.warning(f"⚠️ [FAIL] Model {model_name}: HTTP {resp.status}: {text[:200]}")
                            continue
                        data = await resp.json(content_type=None, encoding='utf-8')
                        content = data["choices"][0]["message"]["content"]
                        res = json.loads(content)
                        self.logger.info(f"🧠 [THOUGHT] {res.get('thoughts')}")
                        res['_reply'] = self._extract_reply(res)
                        return res
            except Exception as e:
                self.logger.warning(f"⚠️ [FAIL] Model {model_name}: {e}")
                continue
        if last_error == "overloaded":
            return {"_reply": f"✨ Мои нейронные цепи перегружены. Попробуйте через {wait_time}. 🙏", "action": {"tool": "none"}}
        return None

    def _extract_reply(self, res: dict) -> str:
        """Извлекает текст ответа из JSON модели, независимо от названия ключа."""
        # Список всех ключей, которые модели используют для текста ответа
        REPLY_KEYS = ['reply_to_user', 'response', 'message', 'reply', 'answer', 'result', 'text', 'output']
        for key in REPLY_KEYS:
            val = res.get(key)
            if val and isinstance(val, str) and len(val.strip()) > 1:
                self.logger.info(f"🔑 [REPLY KEY] '{key}'")
                return val.strip()
        # Если ничего не нашли — ищем любое строковое значение длиннее 5 символов
        for key, val in res.items():
            if key not in ('thoughts', 'action') and isinstance(val, str) and len(val) > 5:
                self.logger.info(f"🔑 [REPLY KEY FALLBACK] '{key}'")
                return val.strip()
        return "✨"

    async def _execute_tool(self, action_data):
        tool = action_data.get("tool")
        args = action_data.get("args", {})
        if not tool or tool == "none": return None
        self.logger.info(f"🔧 [TOOL] {Colors.BOLD}{tool}{Colors.ENDC} -> {args}")
        try:
            # Wrap synchronous db calls in to_thread
            if tool == "search": 
                res = await asyncio.to_thread(db_helper.search, args.get("query", ""))
                if isinstance(res, str) and len(res) > 3000:
                    return res[:3000] + "\n... (Truncated. Please use 'info' for specific items)"
                return res
            elif tool == "info": return await asyncio.to_thread(db_helper.info, args.get("id", ""))
            elif tool == "catalog": return await asyncio.to_thread(db_helper.catalog)
            elif tool == "order": return await asyncio.to_thread(db_helper.order, args.get("id", ""))
            elif tool == "in_stock": return await asyncio.to_thread(db_helper.in_stock, args.get("start", 0), args.get("stop", 10))
        except Exception as e: return f"Tool Error: {e}"
        return "Unknown tool"

    def _register_handlers(self):
        @self.bot.message_handler(commands=['start'])
        async def start(m):
            user_id = m.from_user.id
            self._update_session(user_id, [])
            shop_name = self.settings.get('shopName', 'нашего магазина')
            await self.bot.send_message(
                m.chat.id,
                f"✨ *Добро пожаловать в {shop_name}!*\n"
                f"Я ваш персональный помощник. Чем могу помочь? 🛍️\n\n"
                f"━━━━━━━━━━━━━━━━━━\n"
                f"✨ *{shop_name}'ga xush kelibsiz!*\n"
                f"Men sizning shaxsiy yordamchingizman. Qanday yordam bera olaman? 🛍️",
                parse_mode='Markdown',
                reply_markup=self._get_main_keyboard()
            )

        @self.bot.message_handler(func=lambda m: m.text == "📞 Связаться с менеджером" or m.text == "/manager")
        async def manager(m):
            await self.bot.send_message(m.chat.id, f"👨‍💼 Наш менеджер с радостью вам поможет! Напишите ему напрямую: {self.manager_contact}")

        @self.bot.message_handler(func=lambda m: m.chat.id == self.ADMIN_ID and m.reply_to_message)
        async def admin_reply(m):
            try:
                original_user_id = self._get_support_user_id(m.reply_to_message.message_id)
                if not original_user_id:
                    if m.reply_to_message.forward_from:
                        original_user_id = m.reply_to_message.forward_from.id
                    else:
                        await self.bot.reply_to(m, "❌ Ошибка: не удалось определить ID клиента (возможно скрыт настройками приватности).")
                        return

                await self.bot.send_message(original_user_id, f"👨‍💼 *Ответ менеджера:*\n\n{m.text}", parse_mode='Markdown')
                await self.bot.reply_to(m, "✅ Сообщение доставлено клиенту.")
            except Exception as e: 
                await self.bot.reply_to(m, f"❌ Ошибка отправки: {e}")

        @self.bot.message_handler(content_types=['text', 'photo'])
        async def main_loop(m):
            user_id = m.from_user.id
            if self._is_waiting_support(user_id):
                fwd_msg = await self.bot.forward_message(self.ADMIN_ID, m.chat.id, m.message_id)
                self._save_support_message(fwd_msg.message_id, user_id)
                self._set_waiting_support(user_id, False)
                await self.bot.send_message(m.chat.id, "✅ Сообщение передано менеджеру. Он скоро вам ответит!", reply_markup=self._get_main_keyboard())
                return

            history = self._get_session(user_id)
            user_text = m.text or "[Фото]"
            await self.bot.send_chat_action(m.chat.id, 'typing')

            context_messages = history[-20:]
            context_messages.append({"role": "user", "content": user_text})
            history.append({"role": "user", "content": user_text})

            try:
                MAX_ITERATIONS = 4
                iteration = 0
                final_ai_response = {"_reply": None}  # None — по умолчанию пустой
                
                if not self.groq:
                    await self.bot.send_message(m.chat.id, f"⚠️ ИИ-консультант временно недоступен. Свяжитесь с менеджером: **[{self.manager_contact}](https://t.me/{self.manager_contact.replace('@', '')})**", parse_mode='Markdown')
                    return
                while iteration < MAX_ITERATIONS:
                    iteration += 1
                    ai_plan = await self._ai_think(context_messages)
                    if not ai_plan: break
                    final_ai_response = ai_plan
                    action = ai_plan.get("action")
                    if not action or not isinstance(action, dict): break
                    tool_name = action.get("tool")
                    if not tool_name or tool_name == "none": break
                    
                    tool_result = await self._execute_tool(action)
                    self.logger.info(f"👁 [OBSERVATION] {str(tool_result)[:100]}...")
                    assistant_msg = {"role": "assistant", "content": json.dumps(ai_plan, ensure_ascii=False)}
                    observation_msg = {"role": "user", "content": f"SYSTEM_OBSERVATION: {tool_result}"}
                    context_messages.append(assistant_msg)
                    context_messages.append(observation_msg)
                    history.append(assistant_msg)
                    history.append(observation_msg)
                
                final_msg = final_ai_response.get("_reply")
                if not final_msg:
                    # Если ИИ не смог ответить — не отвечаем вообще
                    self.logger.error("🔴 AI вернул None, ответ не отправлен.")
                    return
                try:
                    await self.bot.send_message(m.chat.id, final_msg, parse_mode='Markdown', disable_web_page_preview=True)
                except Exception as parse_error:
                    self.logger.warning(f"⚠️ Markdown Parse Error: {parse_error}. Falling back to plain text.")
                    await self.bot.send_message(m.chat.id, final_msg, disable_web_page_preview=True)

                history.append({"role": "assistant", "content": json.dumps(final_ai_response, ensure_ascii=False)})
                self._update_session(user_id, history[-20:])
            except Exception as e:
                self.logger.error(f"Error: {e}")
                await self.bot.send_message(m.chat.id, "✨ Произошла небольшая техническая заминка.")

    async def _run(self):
        await self._set_bot_commands()
        print(f"🚀 AI Assistant ({self.settings.get('shopName', 'Store')}) Async запущен!", flush=True)
        await self.bot.polling(non_stop=True, request_timeout=90)

    def run(self):
        asyncio.run(self._run())

if __name__ == "__main__":
    try:
        milly = MillyBot()
        milly.run()
    except Exception as e:
        print(f"❌ CRITICAL ERROR: {e}")