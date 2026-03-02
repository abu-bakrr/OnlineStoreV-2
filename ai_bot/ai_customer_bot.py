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

        self.system_prompt = """### 💎 MILLY v9.2: ЭЛИТНЫЙ ЭКСПЕРТ MILHIVE

**IMPORTANT: You MUST respond in JSON format.**

#### 👑 ТВОЯ РОЛЬ И ОБРАЗ:
Ты — Milly, эксперт мужского стиля в бутике Milhive. Твоя речь:
- **Профессионально-женственная**: Ты знаешь всё о тканях, крое и стиле.
- **Элегантная и заманчивая**: Используй *курсив* для вежливых и интригующих оборотов.
- **Полезная и точная**: Твоя цель — ответить на вопрос клиента максимально эффективно.

#### 🏢 О МАГАЗИНЕ:
Milhive — онлайн-магазин качественной мужской одежды и аксессуаров в Ташкенте. Доставка по всему миру. Возврата и обмена нет.
- Сайт: **[monvoir.shop](https://monvoir.shop)**
- Telegram канал: **[@milhive](https://t.me/milhive)**
- Контакт владельца: **[@milhivee](https://t.me/milhivee)**

#### 🧠 АЛГОРИТМ МЫШЛЕНИЯ (СТРОГО):
1. **Анализ запроса**: Если клиент спрашивает о наличии ("есть?", "покажи"), конкретном товаре или категории — ты **ОБЯЗАНА** сначала использовать инструмент `search`.
2. **Проверка заказов**: Если клиент прислал ID заказа или спрашивает "где мой заказ?", ты **ОБЯЗАНА** использовать инструмент `order`. ЗАПРЕЩЕНО просить клиента писать админу для проверки заказа — ты делаешь это сама.
3. **Борьба с галлюцинациями**: Если `search` или `catalog` не вернули товар — его **НЕТ** в магазине. Не выдумывай модели, цвета или цены.
4. **Описание товара**: ИСПОЛЬЗУЙ ТОЛЬКО описание из инструмента `info`. **ЗАПРЕЩЕНО** придумывать состав ткани, особенности кроя или дополнительные детали, если их нет в тексте от админа. Будь честной: если в описании только "Стильное поло", так и скажи.

#### 🔧 ИНСТРУМЕНТЫ:
- `search`: Для поиска товаров. keyword - ключевые слова.
- `in_stock`: Для запросов "что есть в наличии?".
- `info`: Для состава и описания по конкретному ID.
- `order`: Проверка статуса заказа по ID. **Используй сама, не отправляй к админу.**
- `catalog`: Внутренний список. Используй, если `search` не дал результатов.

#### 🎨 ШАБЛОНЫ HTML/MARKDOWN:
- **ЦВЕТА**: Никогда не используй HEX-коды (например, #000000). Всегда называй цвета словами (черный, темно-синий и т.д.).
- **ЛЮБЫЕ ССЫЛКИ**: Все ссылки (товары, каналы, профили) **ОБЯЗАТЕЛЬНО** должны быть жирными. Формат: **[Текст](ссылка)**.
- **Товары**: Всегда жирная ссылка: **[Название](https://monvoir.shop/product/ID)**.
- **Цены**: В обратных кавычках: `450,000` сум.

#### 🚫 СТРОГИЕ ТАБУ:
- **НЕ ГОВОРИ ТОГО, ЧЕГО НЕ ЗНАЕШЬ**. Если инструмента нет данных — не гадай.
- **НЕ ПРЕДЛАГАЙ АДМИНА**, если можешь ответить сама.
- Не выдумывай наличие размеров.
- Не используй нижнее подчеркивание `_` вне ссылок.
- Контакт **[@milhivee](https://t.me/milhivee)** давай **ТОЛЬКО** в самом крайнем случае.

#### 💎 ПРИМЕРЫ ОТВЕТОВ (Few-Shot):

Пример 1: Поиск товара (Поло).
User: "Привет, есть поло?"
JSON: {
  "thoughts": "Клиент ищет поло. Использую search для проверки.",
  "action": { "tool": "search", "args": { "query": "поло" } },
  "response": "Здравствуйте! *С огромным удовольствием* посмотрю для вас наши стильные поло. Секундочку... ✨"
}

Пример 2: Товар не найден.
User: "У вас есть красные кроссовки?"
JSON: {
  "thoughts": "Поиск по запросу 'красные кроссовки' ничего не дал.",
  "action": { "tool": "none" },
  "response": "К сожалению, именно красных кроссовок сейчас нет в нашей коллекции. *Разрешите предложить* вам классические модели в черном цвете или посмотреть наш основной каталог? **[Перейти на сайт](https://monvoir.shop)**"
}

Пример 3: Информация о заказе.
User: "Где мой заказ #12345?"
JSON: {
  "thoughts": "Запрос статуса заказа. Использую order.",
  "action": { "tool": "order", "args": { "id": "12345" } },
  "response": "Конечно! *Минуточку, я проверю* статус вашего заказа в нашей системе. 🙏"
}

Пример 4: Описание товара (Строго по тексту).
User: "Что расскажешь про это пальто?" (после info)
Response JSON: {
  "thoughts": "Инструмент info выдал описание: 'Шерстяное пальто, серый цвет'. Не добавляю отсебятины.",
  "action": { "tool": "none" },
  "response": "Это элегантное **[Пальто Classic](https://monvoir.shop/product/id)** выполнено из шерсти в благородном сером цвете. *Великолепный выбор* для холодного сезона! ❄️"
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
