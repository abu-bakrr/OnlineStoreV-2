"""
Telegram бот для управления товарами в магазине
Использует pyTelegramBotAPI и ООП структуру
"""

import os
import json
import telebot
from telebot import types
import cloudinary
import cloudinary.uploader
import requests
from io import BytesIO
from db_operations import (
    add_product, 
    delete_product, 
    get_all_products,
    get_product_by_id,
    get_categories_from_config,
    find_products_by_name,
    update_order_status
)
from bot_locales import get_bot_translation


class ProductBot:
    """Класс для управления Telegram ботом товаров"""
    
    # 20 популярных цветов с названиями и HEX кодами
    POPULAR_COLORS = [
        ("Красный", "#FF0000"), ("Синий", "#0000FF"), ("Зелёный", "#00FF00"),
        ("Жёлтый", "#FFFF00"), ("Чёрный", "#000000"), ("Белый", "#FFFFFF"),
        ("Серый", "#808080"), ("Розовый", "#FFC0CB"), ("Оранжевый", "#FFA500"),
        ("Фиолетовый", "#800080"), ("Коричневый", "#A52A2A"), ("Бежевый", "#F5F5DC"),
        ("Голубой", "#87CEEB"), ("Тёмно-синий", "#00008B"), ("Салатовый", "#90EE90"),
        ("Бордовый", "#800000"), ("Золотой", "#FFD700"), ("Серебряный", "#C0C0C0"),
        ("Бирюзовый", "#40E0D0"), ("Лиловый", "#DA70D6")
    ]
    
    def __init__(self, token):
        """
        Инициализация бота
        
        Args:
            token (str): Telegram Bot API токен
        """
        self.bot = telebot.TeleBot(token)
        self.authorized_users = self._load_authorized_users()
        self.language = self._load_language()  # Загрузка языка из конфига
        self.user_states = {}  # Хранение состояний пользователей
        self.temp_data = {}    # Временные данные для создания товаров
        
        # Настройка Cloudinary
        self._setup_cloudinary()
        
        # Регистрация обработчиков
        self._register_handlers()
    
    def _setup_cloudinary(self):
        """Настраивает Cloudinary используя переменные окружения"""
        try:
            cloudinary.config(
                cloud_name=os.getenv('CLOUDINARY_CLOUD_NAME'),
                api_key=os.getenv('CLOUDINARY_API_KEY'),
                api_secret=os.getenv('CLOUDINARY_API_SECRET')
            )
            print("✅ Cloudinary настроен успешно")
        except Exception as e:
            print(f"⚠️ Ошибка настройки Cloudinary: {e}")
    
    def _upload_photo_to_cloudinary(self, file_id):
        """
        Загружает фото из Telegram в Cloudinary
        
        Args:
            file_id (str): Telegram file ID
            
        Returns:
            str: URL загруженного изображения или None при ошибке
        """
        try:
            # Получаем информацию о файле
            file_info = self.bot.get_file(file_id)
            file_url = f"https://api.telegram.org/file/bot{self.bot.token}/{file_info.file_path}"
            
            # Скачиваем файл
            response = requests.get(file_url)
            if response.status_code != 200:
                print(f"❌ Ошибка скачивания фото: {response.status_code}")
                return None
            
            # Загружаем в Cloudinary
            upload_result = cloudinary.uploader.upload(
                BytesIO(response.content),
                folder="telegram_shop_products"
            )
            
            return upload_result.get('secure_url')
        except Exception as e:
            print(f"❌ Ошибка загрузки в Cloudinary: {e}")
            return None
    
    def _load_authorized_users(self):
        """Загружает список авторизованных пользователей из settingsbot.json"""
        try:
            config_path = os.path.join(os.path.dirname(__file__), 'settingsbot.json')
            with open(config_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                return set(data.get('authorized_users', []))
        except FileNotFoundError:
            print("⚠️ Файл settingsbot.json не найден. Создайте его с списком авторизованных пользователей.")
            return set()
        except Exception as e:
            print(f"❌ Ошибка загрузки авторизованных пользователей: {e}")
            return set()
    
    def _load_language(self):
        """Загружает язык из settingsbot.json"""
        try:
            config_path = os.path.join(os.path.dirname(__file__), 'settingsbot.json')
            with open(config_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                return data.get('language', 'ru')
        except Exception as e:
            print(f"⚠️ Ошибка загрузки языка: {e}. Используется русский по умолчанию.")
            return 'ru'
    
    def t(self, key: str, **kwargs) -> str:
        """Получить перевод по ключу"""
        return get_bot_translation(key, self.language, **kwargs)
    
    def _is_authorized(self, user_id):
        """
        Проверяет, авторизован ли пользователь
        
        Args:
            user_id (int): Telegram ID пользователя
            
        Returns:
            bool: True если авторизован
        """
        return user_id in self.authorized_users
    
    def _create_main_menu(self):
        """Создает главное меню с кнопками"""
        markup = types.ReplyKeyboardMarkup(resize_keyboard=True, row_width=2)
        btn_add = types.KeyboardButton(self.t("btn_add_product"))
        btn_delete = types.KeyboardButton(self.t("btn_delete_product"))
        btn_list = types.KeyboardButton(self.t("btn_list_products"))
        btn_categories = types.KeyboardButton(self.t("btn_categories"))
        markup.add(btn_add, btn_delete)
        markup.add(btn_list, btn_categories)
        return markup
    
    def _register_handlers(self):
        """Регистрирует все обработчики команд и сообщений"""
        
        @self.bot.message_handler(commands=["start"])
        def handle_start(message):
            self.bot.send_message(
                message.chat.id,
                "Бот находится в стадии обновления. Функции управления временно отключены."
            )
            
    def run(self):
        """Запускает бота в режиме polling"""
        print("🤖 Бот запущен и готов к работе...")
        print(f"👥 Авторизованных пользователей: {len(self.authorized_users)}")
        if self.authorized_users:
            print(f"   IDs: {list(self.authorized_users)}")
        else:
            print("   ⚠️ ВНИМАНИЕ: Список авторизованных пользователей пуст!")
            print("   Добавьте Telegram ID в файл settingsbot.json")
        
        self.bot.infinity_polling()


def main():
    """Главная функция запуска бота"""
    # Получаем токен из переменных окружения
    bot_token = os.getenv('TELEGRAM_BOT_TOKEN')
    
    if not bot_token:
        print("❌ ОШИБКА: TELEGRAM_BOT_TOKEN не найден в переменных окружения!")
        print("Установите переменную окружения TELEGRAM_BOT_TOKEN с токеном вашего бота.")
        return
    
    # Создаем и запускаем бота
    try:
        bot = ProductBot(bot_token)
        bot.run()
    except Exception as e:
        print(f"❌ Критическая ошибка: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()
