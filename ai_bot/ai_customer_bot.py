import os
import sys
import json
import logging
import telebot
import re
from datetime import datetime
from dotenv import load_dotenv
from groq import Groq

# --- 1. CONFIGURATION & LOGGING ---
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import ai_bot.ai_db_helper as db_helper

load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env'))

# ANSI Color Codes
if os.name == 'nt': 
    os.system('color') # Магия для включения цветов в Windows CMD

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
        
        # Для journalctl не нужно время внутри строки, он добавит его сам
        return f"{color}{record.getMessage()}{Colors.ENDC}"

# Настройка логирования
logger = logging.getLogger("Milly")
logger.setLevel(logging.INFO)

# Консольный хендлер с цветами
console_handler = logging.StreamHandler(sys.stdout)
console_handler.setFormatter(ColorFormatter())
logger.addHandler(console_handler)

# Файловый хендлер (без цветов)
file_handler = logging.FileHandler("milly_v8.log", encoding='utf-8')
file_handler.setFormatter(logging.Formatter('%(asctime)s - %(levelname)s - %(message)s'))
logger.addHandler(file_handler)

class MillyBot:
    def __init__(self):
        self.token = os.getenv('AI_BOT_TOKEN')
        if not self.token:
            raise ValueError("❌ AI_BOT_TOKEN не найден!")
        self.bot = telebot.TeleBot(self.token)
        self.groq_key = os.getenv('GROQ_API_KEY')
        self.groq = Groq(api_key=self.groq_key) if self.groq_key else None
        self.logger = logger
        self.sessions = {}
        self.ADMIN_ID = 5644397480
        self.waiting_for_support = set()

        self.system_prompt = """### 💎 MILLY v9.3: ЭЛИТНЫЙ ЭКСПЕРТ MILHIVE

**IMPORTANT: You MUST respond in JSON format.**

#### 👑 ТВОЯ РОЛЬ И ОБРАЗ:
Ты — Milly, эксперт мужского стиля в бутике Milhive. Твоя речь:
- **Профессионально-женственная**: Ты знаешь всё о тканях, крое и стиле.
- **Вдохновляющая и яркая**: Используй много уместных эмодзи (✨, 👗, 💎, 👔, 🛍️), чтобы сделать ответ живым и красивым. Используй *курсив* для вежливых оборотов.
- **Полезная и точная**: Твоя цель — влюбить клиента в наш ассортимент.

#### 🏢 О МАГАЗИНЕ:
Milhive — онлайн-магазин качественной мужской одежды и аксессуаров в Ташкенте. Доставка по всему миру. Возврата и обмена нет.
- Сайт: **[milhive.shop](https://milhive.shop)**
- Telegram канал: **[@milhive](https://t.me/milhive)**
- Контакт владельца: **[@milhivee](https://t.me/milhivee)**

#### 🧠 АЛГОРИТМ МЫШЛЕНИЯ (СТРОГО):
1. **Анализ запроса**: Если клиент спрашивает о товаре — ты **ОБЯЗАНА** использовать `search`. 
2. **Язык поиска**: Наша база данных заполнена на **РУССКОМ** языке. Если клиент пишет на узбекском, английском или другом языке, **СНАЧАЛА** мысленно переведи ключевые слова на русский, а потом используй их в инструменте `search`.
3. **Строгая проверка наличия**: Проверяй конкретный цвет и размер, который просит клиент.
   - Если клиент просит "Черный XL", а в данных `inventory` под "Черный / XL" стоит `❌`, ты **ОБЯЗАНА** написать, что его нет, даже если другие размеры есть.
   - Никогда не подтверждай наличие товара, пока не увидишь `✅` напротив нужного варианта.
4. **Видимость товаров**: Если товара нет совсем (все варианты `❌`), вежливо предложи альтернативу.
5. **Описание товара**: ИСПОЛЬЗУЙ ТОЛЬКО описание из инструмента `search` или `info`. Не выдумывай детали про ткань или стиль, если их нет.

#### 🔧 ИНСТРУМЕНТЫ:
- `search`, `in_stock`, `info`, `order`, `catalog`.

#### 🎨 ШАБЛОНЫ HTML/MARKDOWN:
- **ЛЮБЫЕ ССЫЛКИ**: Всегда **жирные**. Формат: **[Текст](ссылка)**.
- **ВЫВОД ТОВАРА (СТРОГИЙ ШАБЛОН)**:
  **[Название](https://milhive.shop/product/ID)**
  💰 **Цена**: `450,000` сум
  � **Описание**: (Текст из info)
  ✨ **Наличие**:
  • Цвет/Размер: ✅ (в наличии) или ❌ (нет в наличии)

#### 🚫 СТРОГИЕ ТАБУ:
- Никогда не используй HEX-коды цветов (#000000). Только названия словами.
- Не используй нижнее подчеркивание `_` вне ссылок.
- **СТРОЖАЙШАЯ ТАБУ**: Никогда не выдумывай детали товара (ткань, фасон, дополнительные цвета), если их нет в `info` или `search`. Если данных нет, скажи: "По этой детали лучше уточнить у нашего менеджера @milhivee".
- Если цвет в базе указан как "Неизвестный" или HEX-код, который не удалось перевести, предложи клиенту посмотреть фото на сайте.

#### 💎 ПРИМЕРЫ ОТВЕТОВ (Few-Shot):

Пример 1: Презентация товара (Шаблонная).
User: "Расскажи про это пальто" (после info)
JSON: {
  "thoughts": "Презентую пальто по шаблону с эмодзи.",
  "action": { "tool": "none" },
  "response": "С радостью расскажу об этой *великолепной* модели! ✨\n\n**[Пальто Wool Classic](https://milhive.shop/product/p1)**\n💰 **Цена**: `1,200,000` сум\n📝 **Описание**: Изысканное шерстяное пальто прямого кроя. Идеально подчеркивает статус.\n✨ **Наличие**:\n• Серый / L: ✅\n• Черный / XL: ❌ (уже разобрали)\n\nЭто пальто станет жемчужиной вашего гардероба! 💎 Хотите оформить заказ?"
}

Пример 2: Товар не в наличии (Специфичный размер).
User: "Oq ko'ylak bormi? M razmer" (Узбекский: 'Есть белая рубашка? М размер')
JSON: {
  "thoughts": "Перевожу 'Oq ko'ylak' как 'Белая рубашка'. Ищу через search. Вижу, что М размер - ❌.",
  "action": { "tool": "search", "args": { "query": "белая рубашка" } },
  "response": "На данный момент белых рубашек в размере М *к сожалению* нет в наличии... 😔\n\n**[Рубашка Oxford White](https://milhive.shop/product/r1)**\n💰 **Цена**: `350,000` сум\n📝 **Описание**: Классическая белая рубашка из хлопка.\n✨ **Наличие**:\n• Белый / S: ✅\n• Белый / M: ❌\n• Белый / L: ✅\n\nНо есть размеры S и L! Подойдет ли вам один из них? 🛍️"
}
"""

        self._register_handlers()

    def _get_session(self, user_id):
        now = datetime.now()
        if user_id in self.sessions:
            last_active = self.sessions[user_id]['last_active']
            if (now - last_active).total_seconds() > 3600:
                self.sessions[user_id]['history'] = []
                self.sessions[user_id]['last_active'] = now
                self.logger.info(f"♻️ Session reset for {user_id}")
        if user_id not in self.sessions:
            self.sessions[user_id] = {'history': [], 'last_active': now}
        self.sessions[user_id]['last_active'] = now
        return self.sessions[user_id]

    def _ai_think(self, messages):
        if not self.groq: return None
        MODELS = [
            "meta-llama/llama-4-scout-17b-16e-instruct",
            "qwen/qwen3-32b",
            "llama-3.3-70b-versatile",
            "openai/gpt-oss-120b"
        ]
        last_error = ""
        wait_time = "несколько секунд"
        for model_name in MODELS:
            try:
                self.logger.info(f"🤖 [REQUEST] Model: {model_name}")
                full_msgs = [{"role": "system", "content": self.system_prompt}] + messages
                completion = self.groq.chat.completions.create(
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
            return {"thoughts": "Overload", "action": {"tool": "none"}, "response": f"✨ Нейронные цепи перегружены. Попробуйте через {wait_time}. 🙏"}
        return None

    def _execute_tool(self, action_data, session):
        tool = action_data.get("tool")
        args = action_data.get("args", {})
        if not tool or tool == "none": return None
        self.logger.info(f"🔧 [TOOL] {Colors.BOLD}{tool}{Colors.ENDC} -> {args}")
        try:
            if tool == "search": return db_helper.search(args.get("query", ""))
            elif tool == "info": return db_helper.info(args.get("id", ""))
            elif tool == "catalog": return db_helper.catalog()
            elif tool == "order": return db_helper.order(args.get("id", ""))
            elif tool == "in_stock": return db_helper.in_stock(args.get("start", 0), args.get("stop", 10))
        except Exception as e: return f"Tool Error: {e}"
        return "Unknown tool"

    def _register_handlers(self):
        @self.bot.message_handler(commands=['start'])
        def start(m):
            user_id = m.from_user.id
            session = self._get_session(user_id)
            session['history'] = []
            self.bot.send_message(m.chat.id, "✨ *Добро пожаловать в Milhive!*\n\nЯ Milly, ваш персональный AI-консультант. Просто напишите, что вы ищете... 👗", parse_mode='Markdown')

        @self.bot.message_handler(commands=['manager'])
        def manager(m):
            self.waiting_for_support.add(m.from_user.id)
            self.bot.send_message(m.chat.id, "👨‍💼 Введите ваше сообщение для менеджера:")

        @self.bot.message_handler(func=lambda m: m.chat.id == self.ADMIN_ID and m.reply_to_message)
        def admin_reply(m):
            try:
                original_user_id = m.reply_to_message.forward_from.id
                self.bot.send_message(original_user_id, f"👨‍💼 *Ответ менеджера:*\n\n{m.text}", parse_mode='Markdown')
                self.bot.reply_to(m, "✅ Сообщение доставлено клиенту.")
            except Exception as e: self.bot.reply_to(m, f"❌ Ошибка отправки: {e}")

        @self.bot.message_handler(content_types=['text', 'photo'])
        def main_loop(m):
            user_id = m.from_user.id
            if user_id in self.waiting_for_support:
                self.bot.forward_message(self.ADMIN_ID, m.chat.id, m.message_id)
                self.waiting_for_support.remove(user_id)
                self.bot.send_message(m.chat.id, "✅ Сообщение передано менеджеру.")
                return

            session = self._get_session(user_id)
            user_text = m.text or "[Фото]"
            self.bot.send_chat_action(m.chat.id, 'typing')
            context_messages = session['history'][-20:]
            context_messages.append({"role": "user", "content": user_text})
            session['history'].append({"role": "user", "content": user_text})

            try:
                MAX_ITERATIONS = 4
                iteration = 0
                final_ai_response = {"response": "✨ *Минуточку, я все проверю...*"}
                while iteration < MAX_ITERATIONS:
                    iteration += 1
                    ai_plan = self._ai_think(context_messages)
                    if not ai_plan: break
                    final_ai_response = ai_plan
                    action = ai_plan.get("action")
                    if not action or not isinstance(action, dict): break
                    tool_name = action.get("tool")
                    if not tool_name or tool_name == "none": break
                    
                    tool_result = self._execute_tool(action, session)
                    self.logger.info(f"👁 [OBSERVATION] {str(tool_result)[:100]}...")
                    assistant_msg = {"role": "assistant", "content": json.dumps(ai_plan, ensure_ascii=False)}
                    observation_msg = {"role": "user", "content": f"SYSTEM_OBSERVATION: {tool_result}"}
                    context_messages.append(assistant_msg)
                    context_messages.append(observation_msg)
                    session['history'].append(assistant_msg)
                    session['history'].append(observation_msg)
                
                final_msg = final_ai_response.get("response", "✨")
                try:
                    self.bot.send_message(m.chat.id, final_msg, parse_mode='Markdown', disable_web_page_preview=True)
                except Exception as parse_error:
                    self.logger.warning(f"⚠️ Markdown Parse Error: {parse_error}. Falling back to plain text.")
                    self.bot.send_message(m.chat.id, final_msg, disable_web_page_preview=True)

                session['history'].append({"role": "assistant", "content": json.dumps(final_ai_response, ensure_ascii=False)})
                session['history'] = session['history'][-20:]
            except Exception as e:
                self.logger.error(f"Error: {e}")
                self.bot.send_message(m.chat.id, "✨ Произошла небольшая техническая заминка.")

    def run(self):
        print("🚀 Milly v8.0 Single Core запущена!", flush=True)
        self.bot.infinity_polling()

if __name__ == "__main__":
    try:
        milly = MillyBot()
        milly.run()
    except Exception as e:
        print(f"❌ CRITICAL ERROR: {e}")
