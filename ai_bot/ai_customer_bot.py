import os
import sys
import json
import logging
import asyncio
import sqlite3
import re
from datetime import datetime
from dotenv import load_dotenv
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
        self.token = os.getenv('AI_BOT_TOKEN')
        if not self.token:
            raise ValueError("❌ AI_BOT_TOKEN не найден!")
        self.bot = AsyncTeleBot(self.token)
        self.groq_key = os.getenv('GROQ_API_KEY')
        self.groq = AsyncGroq(api_key=self.groq_key) if self.groq_key else None
        self.logger = logger
        self.ADMIN_ID = 5644397480
        
        self.db_path = os.path.join(os.path.dirname(__file__), 'bot_state.db')
        self._init_db()

        self.system_prompt = """### 💎 MILLY v9.4: ЭЛИТНЫЙ ЭКСПЕРТ MILHIVE

**IMPORTANT: You MUST respond strictly in JSON format.**

#### 👑 ТВОЯ РОЛЬ И ОБРАЗ:
Ты — Milly, эксперт мужского стиля в бутике Milhive. Твоя речь:
- **Профессионально-женственная**: Ты знаешь всё о тканях, крое и стиле.
- **Вдохновляющая и яркая**: Используй много уместных эмодзи, чтобы сделать ответ живым.

#### 🏢 О МАГАЗИНЕ:
Milhive — онлайн-магазин качественной мужской одежды. Доставка по всему миру.
- Сайт: **[milhive.shop](https://milhive.shop)**
- Telegram: **[@milhive](https://t.me/milhive)**

#### 🔧 ИНСТРУМЕНТЫ (JSON СХЕМА):
Вызывай инструменты СТРОГО в следующем формате в объекте "action":
```json
{
  "thoughts": "Я должна найти кроссовки",
  "action": {
    "tool": "search",
    "args": {
      "query": "кроссовки"
    }
  },
  "response": "Сейчас посмотрю..."
}
```
Если инструмент не нужен, используй `"tool": "none"`.

Доступные инструменты:
- `search`: Поиск товаров. Args: `{"query": "название/категория"}`
- `info`: Получение деталей о товаре. Args: `{"id": "ID товара"}`
- `catalog`: Список категорий. Args: `{}`
- `order`: Статус заказа. Args: `{"id": "номер заказа"}`

#### 🚫 СТРОГИЕ ЗАПРЕТЫ (КРИТИЧЕСКИ ВАЖНО):
1. **НЕ ВЫДУМЫВАТЬ ТОВАРЫ!** Если инструмент `search` вернул пустой результат или `Unknown tool` — честно скажи клиенту, что таких товаров сейчас нет.
2. **НЕ ВЫДУМЫВАТЬ ЦЕНЫ И ДЕТАЛИ!** Бери всю информацию ТОЛЬКО из ответа (SYSTEM_OBSERVATION) инструмента `info` или `search`.
3. **НИКАКИХ HEX-КОДОВ!** Не пиши #000000, используй слова (черный, белый и т.д.).

#### 🎨 ШАБЛОНЫ ОТВЕТОВ (СТРОГО СОБЛЮДАТЬ ФОРМАТИРОВАНИЕ):
- **ЛЮБЫЕ ССЫЛКИ**: Всегда **жирные**. Формат: **[Текст](ссылка)**. Не используй нижнее подчеркивание (_) вне ссылок.
- **ВЫВОД ТОВАРА (КОПИРОВАТЬ ЭТОТ ШАБЛОН ТОЧЬ-В-ТОЧЬ)**:

**[Название товара](https://milhive.shop/product/ID)**
💰 **Цена**: `450,000` сум
📝 **Описание**: (Текст из info)
✨ **Наличие**:
• Цвет/Размер: ✅ (в наличии) или ❌ (нет в наличии)

Любое отклонение от этого шаблона недопустимо.
"""
        # Register handlers right away
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
                if (now - last_active).total_seconds() > 3600:
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
            web_app = types.WebAppInfo("https://milhive.shop")
            await self.bot.set_chat_menu_button(menu_button=types.MenuButtonWebApp(type="web_app", text="🛍 Магазин", web_app=web_app))
        except Exception as e:
            self.logger.warning(f"Could not set Web App menu button: {e}")

    def _get_main_keyboard(self):
        markup = types.ReplyKeyboardMarkup(resize_keyboard=True, row_width=2)
        markup.add(
            types.KeyboardButton("🛍 Открыть магазин", web_app=types.WebAppInfo("https://milhive.shop")),
            types.KeyboardButton("📦 Мои заказы")
        )
        markup.add(types.KeyboardButton("📞 Связаться с человеком"))
        return markup

    async def _ai_think(self, messages):
        if not self.groq: return None
        # Optimized list: only valid fast models
        MODELS = [
            "meta-llama/llama-4-scout-17b-16e-instruct",
            "llama-3.3-70b-versatile",
            "mixtral-8x7b-32768"
        ]
        
        last_error = ""
        wait_time = "несколько секунд"
        for model_name in MODELS:
            try:
                self.logger.info(f"🤖 [REQUEST] Model: {model_name}")
                full_msgs = [{"role": "system", "content": self.system_prompt}] + messages
                completion = await self.groq.chat.completions.create(
                    model=model_name,
                    messages=full_msgs,
                    temperature=0.1,
                    response_format={"type": "json_object"}
                )
                res = json.loads(completion.choices[0].message.content)
                self.logger.info(f"🧠 [THOUGHT] {res.get('thoughts')}")
                return res
            except Exception as e:
                err_msg = str(e).lower()
                self.logger.warning(f"⚠️ [FAIL] Model {model_name}: {e}")
                if "429" in err_msg or "rate limit" in err_msg:
                    last_error = "overloaded"
                    match = re.search(r'in (\d+m?\s?\d*s)', err_msg)
                    if match: wait_time = match.group(1)
                    continue 
                continue
        if last_error == "overloaded":
            return {"thoughts": "Overload", "action": {"tool": "none"}, "response": f"✨ Мои нейронные цепи перегружены. Пожалуйста, попробуйте через {wait_time}. 🙏"}
        return None

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
            await self.bot.send_message(
                m.chat.id, 
                "✨ *Добро пожаловать в Milhive!*\n\nЯ Milly, ваш персональный AI-консультант. Чем могу помочь сегодня? 👗\n\nВы можете открыть наш магазин прямо здесь, нажав кнопку ниже!", 
                parse_mode='Markdown',
                reply_markup=self._get_main_keyboard()
            )

        @self.bot.message_handler(func=lambda m: m.text == "📞 Связаться с человеком" or m.text == "/manager")
        async def manager(m):
            self._set_waiting_support(m.from_user.id, True)
            await self.bot.send_message(m.chat.id, "👨‍💼 Пожалуйста, напишите ваше сообщение для менеджера:")

        @self.bot.message_handler(func=lambda m: m.text == "📦 Мои заказы" or m.text == "/myorders")
        async def my_orders(m):
            await self.bot.send_message(m.chat.id, "📦 Чтобы посмотреть свои заказы, введите номер заказа или напишите ваш номер телефона, и я их найду!")

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
                final_ai_response = {"response": "✨ *Минуточку, я все проверю...*"}
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
                
                final_msg = final_ai_response.get("response", "✨")
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
        print("🚀 Milly v9.0 Async запущена!", flush=True)
        await self.bot.polling(non_stop=True, request_timeout=90)

    def run(self):
        asyncio.run(self._run())

if __name__ == "__main__":
    try:
        milly = MillyBot()
        milly.run()
    except Exception as e:
        print(f"❌ CRITICAL ERROR: {e}")