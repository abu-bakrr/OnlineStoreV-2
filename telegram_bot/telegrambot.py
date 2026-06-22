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
        
        @self.bot.message_handler(commands=['start'])
        def handle_start(message):
            user_id = message.from_user.id
            
            if not self._is_authorized(user_id):
                self.bot.send_message(
                    message.chat.id,
                    self.t("access_denied", user_id=user_id)
                )
                return
            
            username = message.from_user.username or message.from_user.first_name
            self.bot.send_message(
                message.chat.id,
                self.t("welcome", username=username),
                reply_markup=self._create_main_menu()
            )
        
        @self.bot.message_handler(func=lambda message: message.text == self.t("btn_add_product"))
        def handle_add_product(message):
            if not self._is_authorized(message.from_user.id):
                self.bot.send_message(message.chat.id, self.t("access_forbidden"))
                return
            
            self.user_states[message.from_user.id] = "awaiting_product_name"
            self.temp_data[message.from_user.id] = {}
            
            markup = types.ReplyKeyboardMarkup(resize_keyboard=True)
            markup.add(types.KeyboardButton(self.t("btn_cancel")))
            
            self.bot.send_message(
                message.chat.id,
                self.t("enter_product_name"),
                reply_markup=markup
            )
        
        @self.bot.message_handler(func=lambda message: message.text == self.t("btn_delete_product"))
        def handle_delete_product_menu(message):
            if not self._is_authorized(message.from_user.id):
                self.bot.send_message(message.chat.id, self.t("access_forbidden"))
                return
            
            # Получаем все товары
            products = get_all_products()
            
            if not products:
                self.bot.send_message(
                    message.chat.id,
                    self.t("no_products"),
                    reply_markup=self._create_main_menu()
                )
                return
            
            # Создаем inline кнопки для каждого товара
            markup = types.InlineKeyboardMarkup(row_width=1)
            for product in products[:20]:  # Показываем первые 20
                btn_text = f"🗑 {product['name']} - {product['price']:,} сум"
                callback_data = f"delete_{product['id']}"
                markup.add(types.InlineKeyboardButton(btn_text, callback_data=callback_data))
            
            self.bot.send_message(
                message.chat.id,
                self.t("select_product_to_delete", count=len(products)),
                parse_mode='HTML',
                reply_markup=markup
            )
        
        @self.bot.message_handler(func=lambda message: message.text == self.t("btn_list_products"))
        def handle_list_products(message):
            if not self._is_authorized(message.from_user.id):
                self.bot.send_message(message.chat.id, self.t("access_forbidden"))
                return
            
            products = get_all_products()
            
            if not products:
                self.bot.send_message(
                    message.chat.id,
                    self.t("no_products")
                )
                return
            
            response = self.t("products_list", count=len(products))
            
            for idx, product in enumerate(products[:30], 1):  # Показываем первые 30
                response += self.t("product_item", num=idx, name=product['name'], price=product['price'], id=product['id'])
            
            if len(products) > 30:
                response += self.t("products_more", count=len(products) - 30)
            
            self.bot.send_message(
                message.chat.id,
                response,
                parse_mode='HTML'
            )
        
        @self.bot.message_handler(func=lambda message: message.text == self.t("btn_categories"))
        def handle_categories(message):
            if not self._is_authorized(message.from_user.id):
                self.bot.send_message(message.chat.id, self.t("access_forbidden"))
                return
            
            categories = get_categories_from_config()
            
            if not categories:
                self.bot.send_message(
                    message.chat.id,
                    self.t("no_categories")
                )
                return
            
            response = self.t("categories_list")
            
            for cat in categories:
                response += self.t("category_item", name=cat['name'], id=cat['id'])
            
            self.bot.send_message(
                message.chat.id,
                response,
                parse_mode='HTML'
            )
        
        @self.bot.message_handler(func=lambda message: message.text == self.t("btn_cancel"))
        def handle_cancel(message):
            user_id = message.from_user.id
            
            if user_id in self.user_states:
                del self.user_states[user_id]
            if user_id in self.temp_data:
                del self.temp_data[user_id]
            
            self.bot.send_message(
                message.chat.id,
                self.t("operation_cancelled"),
                reply_markup=self._create_main_menu()
            )
        
        @self.bot.callback_query_handler(func=lambda call: call.data.startswith('delete_'))
        def handle_delete_callback(call):
            """Обработка удаления товара"""
            if not self._is_authorized(call.from_user.id):
                self.bot.answer_callback_query(call.id, "❌ Доступ запрещен")
                return
            
            product_id = call.data.replace('delete_', '')
            
            # Получаем информацию о товаре перед удалением
            product = get_product_by_id(product_id)
            
            if not product:
                self.bot.answer_callback_query(call.id, "❌ Товар не найден")
                return
            
            # Удаляем товар
            if delete_product(product_id):
                self.bot.answer_callback_query(call.id, "✅ Товар удален")
                self.bot.edit_message_text(
                    f"✅ <b>Товар успешно удален:</b>\n\n"
                    f"📦 {product['name']}\n"
                    f"💰 {product['price']:,} сум\n"
                    f"🆔 {product_id}",
                    call.message.chat.id,
                    call.message.message_id,
                    parse_mode='HTML'
                )
            else:
                self.bot.answer_callback_query(call.id, "❌ Ошибка удаления")

        @self.bot.callback_query_handler(func=lambda call: call.data.startswith('order_status_'))
        def handle_order_status(call):
            """Обработка изменения статуса заказа"""
            if not self._is_authorized(call.from_user.id):
                self.bot.answer_callback_query(call.id, "❌ Доступ запрещен")
                return

            # Формат: order_status_{status}_{order_id}
            parts = call.data.split('_')
            if len(parts) >= 4:
                status = parts[2]
                order_id = parts[3]
                
                status_map = {
                    'delivering': 'delivering',
                    'delivered': 'delivered',
                    'cancelled': 'cancelled'
                }
                
                db_status = status_map.get(status)
                if db_status and update_order_status(order_id, db_status):
                    status_text = {
                        'delivering': '🚚 В пути',
                        'delivered': '✅ Доставлен',
                        'cancelled': '❌ Отменен'
                    }.get(status, status)
                    
                    self.bot.answer_callback_query(call.id, f"✅ Статус изменен на: {status_text}")
                    # Обновляем сообщение, чтобы показать новый статус (добавляем текст вниз)
                    new_text = call.message.text + f"\n\n<b>Статус обновлен:</b> {status_text}"
                    try:
                        self.bot.edit_message_text(
                            new_text,
                            call.message.chat.id,
                            call.message.message_id,
                            parse_mode='HTML',
                            reply_markup=None # Убираем кнопки после нажатия
                        )
                    except:
                        pass
                else:
                    self.bot.answer_callback_query(call.id, "❌ Ошибка изменения статуса")
        
        @self.bot.callback_query_handler(func=lambda call: call.data.startswith('color_') or call.data in ['colors_done', 'colors_skip'])
        def handle_color_callback(call):
            """Обработка выбора цветов"""
            user_id = call.from_user.id
            
            if not self._is_authorized(user_id):
                self.bot.answer_callback_query(call.id, "❌ Доступ запрещен")
                return
            
            if self.user_states.get(user_id) != "awaiting_colors":
                return
            
            if call.data == "colors_skip":
                # Пропускаем цвета
                self.user_states[user_id] = "awaiting_attr1_name"
                
                markup = types.ReplyKeyboardMarkup(resize_keyboard=True)
                markup.add(types.KeyboardButton("⏭ Пропустить"))
                markup.add(types.KeyboardButton("❌ Отмена"))
                
                self.bot.edit_message_text(
                    "⏭ Цвета пропущены",
                    call.message.chat.id,
                    call.message.message_id
                )
                self.bot.send_message(
                    call.message.chat.id,
                    "📝 Введите название первой характеристики:\n\n"
                    "Или нажмите '⏭ Пропустить' чтобы завершить без характеристик",
                    reply_markup=markup
                )
            elif call.data == "colors_done":
                # Завершаем выбор цветов
                colors = self.temp_data[user_id].get('colors', [])
                self.user_states[user_id] = "awaiting_attr1_name"
                
                markup = types.ReplyKeyboardMarkup(resize_keyboard=True)
                markup.add(types.KeyboardButton("⏭ Пропустить"))
                markup.add(types.KeyboardButton("❌ Отмена"))
                
                self.bot.edit_message_text(
                    f"✅ Выбрано цветов: {len(colors)}",
                    call.message.chat.id,
                    call.message.message_id
                )
                self.bot.send_message(
                    call.message.chat.id,
                    "📝 Введите название первой характеристики:\n\n"
                    "Или нажмите '⏭ Пропустить' чтобы завершить без характеристик",
                    reply_markup=markup
                )
            elif call.data.startswith('color_'):
                # Добавляем/убираем цвет
                color_hex = call.data.replace('color_', '')
                colors = self.temp_data[user_id].get('colors', [])
                
                if color_hex in colors:
                    colors.remove(color_hex)
                    self.bot.answer_callback_query(call.id, f"❌ Цвет убран")
                else:
                    colors.append(color_hex)
                    self.bot.answer_callback_query(call.id, f"✅ Цвет добавлен")
                
                self.temp_data[user_id]['colors'] = colors
        
        # Обработчик фотографий
        @self.bot.message_handler(content_types=['photo'])
        def handle_photo(message):
            """Обработка получения фото от пользователя"""
            user_id = message.from_user.id
            
            if not self._is_authorized(user_id):
                self.bot.send_message(message.chat.id, "❌ Доступ запрещен")
                return
            
            # Проверяем, находится ли пользователь в состоянии ожидания фото
            user_state = self.user_states.get(user_id)
            if user_state != "awaiting_images":
                return
            
            # Проверяем лимит фото (безопасно через .get())
            user_temp = self.temp_data.get(user_id)
            if not user_temp:
                return
            
            current_images = user_temp.get('images', [])
            if len(current_images) >= 9:
                self.bot.send_message(
                    message.chat.id,
                    "⚠️ Достигнут лимит в 9 фотографий.\n"
                    "Нажмите '✅ Готово' чтобы завершить добавление товара."
                )
                return
            
            # Получаем самое большое фото
            photo = message.photo[-1]
            
            # Отправляем статус загрузки
            status_msg = self.bot.send_message(
                message.chat.id,
                f"⏳ Загружаю фото {len(current_images) + 1}/9..."
            )
            
            # Загружаем фото в Cloudinary
            photo_url = self._upload_photo_to_cloudinary(photo.file_id)
            
            # Повторно проверяем состояние после загрузки
            # (могли нажать "Готово" или "Отмена" пока фото загружалось)
            user_temp_after = self.temp_data.get(user_id)
            user_state_after = self.user_states.get(user_id)
            
            if not user_temp_after or user_state_after != "awaiting_images":
                # Пользователь уже завершил процесс, игнорируем результат загрузки
                try:
                    self.bot.delete_message(message.chat.id, status_msg.message_id)
                except:
                    pass
                return
            
            if photo_url:
                # Добавляем URL в список (безопасно, т.к. проверили выше)
                user_temp_after['images'].append(photo_url)
                
                self.bot.edit_message_text(
                    f"✅ Фото {len(user_temp_after['images'])}/9 загружено успешно!\n\n"
                    f"Отправьте еще фото или нажмите '✅ Готово'",
                    message.chat.id,
                    status_msg.message_id
                )
            else:
                self.bot.edit_message_text(
                    "❌ Ошибка загрузки фото. Попробуйте еще раз.",
                    message.chat.id,
                    status_msg.message_id
                )
        
        # Обработчик состояний для добавления товара
        @self.bot.message_handler(func=lambda message: message.from_user.id in self.user_states)
        def handle_states(message):
            user_id = message.from_user.id
            state = self.user_states.get(user_id)
            
            if not state:
                return
            
            if state == "awaiting_product_name":
                # Сохраняем название
                self.temp_data[user_id]['name'] = message.text
                self.user_states[user_id] = "awaiting_description"
                
                self.bot.send_message(
                    message.chat.id,
                    "📝 Введите описание товара:"
                )
            
            elif state == "awaiting_description":
                # Сохраняем описание
                self.temp_data[user_id]['description'] = message.text
                self.user_states[user_id] = "awaiting_price"
                
                self.bot.send_message(
                    message.chat.id,
                    "💰 Введите цену товара (в сумах, только число):"
                )
            
            elif state == "awaiting_price":
                # Проверяем и сохраняем цену
                try:
                    price = int(message.text)
                    self.temp_data[user_id]['price'] = price
                    self.user_states[user_id] = "awaiting_category"
                    
                    # Показываем категории
                    categories = get_categories_from_config()
                    markup = types.ReplyKeyboardMarkup(resize_keyboard=True, row_width=2)
                    
                    for cat in categories:
                        markup.add(types.KeyboardButton(cat['name']))
                    markup.add(types.KeyboardButton("❌ Отмена"))
                    
                    self.bot.send_message(
                        message.chat.id,
                        "📁 Выберите категорию:",
                        reply_markup=markup
                    )
                except ValueError:
                    self.bot.send_message(
                        message.chat.id,
                        "❌ Ошибка! Введите цену числом (например: 50000)"
                    )
            
            elif state == "awaiting_category":
                # Находим выбранную категорию
                categories = get_categories_from_config()
                selected_category = None
                
                for cat in categories:
                    if cat['name'] == message.text:
                        selected_category = cat
                        break
                
                if not selected_category:
                    self.bot.send_message(
                        message.chat.id,
                        "❌ Неверная категория. Выберите из предложенных кнопок."
                    )
                    return
                
                self.temp_data[user_id]['category_id'] = selected_category['id']
                self.temp_data[user_id]['images'] = []  # Инициализируем список для фото
                self.user_states[user_id] = "awaiting_images"
                
                markup = types.ReplyKeyboardMarkup(resize_keyboard=True)
                markup.add(types.KeyboardButton("✅ Готово"))
                markup.add(types.KeyboardButton("⏭ Пропустить (без фото)"))
                markup.add(types.KeyboardButton("❌ Отмена"))
                
                self.bot.send_message(
                    message.chat.id,
                    "📸 Отправьте фотографии товара (до 9 штук).\n\n"
                    "Отправляйте по одному фото.\n"
                    "После загрузки всех фото нажмите '✅ Готово'\n\n"
                    "Или нажмите '⏭ Пропустить' чтобы добавить товар без изображений.",
                    reply_markup=markup
                )
            
            elif state == "awaiting_images":
                if message.text == "⏭ Пропустить (без фото)":
                    self.temp_data[user_id]['images'] = ["https://via.placeholder.com/400x400?text=No+Image"]
                elif message.text == "✅ Готово":
                    if not self.temp_data[user_id].get('images'):
                        self.temp_data[user_id]['images'] = ["https://via.placeholder.com/400x400?text=No+Image"]
                else:
                    return
                
                # Переход к выбору цветов
                self.user_states[user_id] = "awaiting_colors"
                self.temp_data[user_id]['colors'] = []
                
                markup = types.InlineKeyboardMarkup(row_width=3)
                for color_name, color_hex in self.POPULAR_COLORS:
                    markup.add(types.InlineKeyboardButton(
                        f"{color_name}", 
                        callback_data=f"color_{color_hex}"
                    ))
                markup.add(types.InlineKeyboardButton("✅ Готово", callback_data="colors_done"))
                markup.add(types.InlineKeyboardButton("⏭ Пропустить", callback_data="colors_skip"))
                
                self.bot.send_message(
                    message.chat.id,
                    "🎨 <b>Выберите доступные цвета товара</b>\n\n"
                    "Нажимайте на кнопки, чтобы добавить цвет.\n"
                    "Когда закончите, нажмите '✅ Готово'",
                    parse_mode='HTML',
                    reply_markup=markup
                )
            
            elif state == "awaiting_attr1_name":
                if message.text == "⏭ Пропустить":
                    # Сохраняем товар без характеристик
                    self._save_product(user_id, message.chat.id)
                else:
                    # Сохраняем название первой характеристики
                    self.temp_data[user_id]['attr1_name'] = message.text
                    self.temp_data[user_id]['attr1_values'] = []
                    self.user_states[user_id] = "awaiting_attr1_values"
                    
                    markup = types.ReplyKeyboardMarkup(resize_keyboard=True)
                    markup.add(types.KeyboardButton("✅ Готово"))
                    markup.add(types.KeyboardButton("❌ Отмена"))
                    
                    self.bot.send_message(
                        message.chat.id,
                        f"📝 Введите варианты для характеристики '<b>{message.text}</b>':\n\n"
                        f"Отправляйте по одному варианту.\n"
                        f"Когда закончите, нажмите '✅ Готово'",
                        parse_mode='HTML',
                        reply_markup=markup
                    )
            
            elif state == "awaiting_attr1_values":
                if message.text == "✅ Готово":
                    if not self.temp_data[user_id].get('attr1_values'):
                        self.bot.send_message(
                            message.chat.id,
                            "⚠️ Добавьте хотя бы один вариант!"
                        )
                        return
                    
                    # Предлагаем добавить вторую характеристику
                    markup = types.ReplyKeyboardMarkup(resize_keyboard=True)
                    markup.add(types.KeyboardButton("➕ Добавить"))
                    markup.add(types.KeyboardButton("⏭ Пропустить"))
                    markup.add(types.KeyboardButton("❌ Отмена"))
                    
                    self.user_states[user_id] = "awaiting_attr2_decision"
                    self.bot.send_message(
                        message.chat.id,
                        "✅ Первая характеристика добавлена!\n\n"
                        "Хотите добавить вторую характеристику?",
                        reply_markup=markup
                    )
                else:
                    # Добавляем вариант
                    self.temp_data[user_id]['attr1_values'].append(message.text)
                    self.bot.send_message(
                        message.chat.id,
                        f"✅ Вариант добавлен: <b>{message.text}</b>\n"
                        f"Всего вариантов: {len(self.temp_data[user_id]['attr1_values'])}\n\n"
                        f"Продолжайте вводить варианты или нажмите '✅ Готово'",
                        parse_mode='HTML'
                    )
            
            elif state == "awaiting_attr2_decision":
                if message.text == "➕ Добавить":
                    self.user_states[user_id] = "awaiting_attr2_name"
                    
                    markup = types.ReplyKeyboardMarkup(resize_keyboard=True)
                    markup.add(types.KeyboardButton("❌ Отмена"))
                    
                    self.bot.send_message(
                        message.chat.id,
                        "📝 Введите название второй характеристики:",
                        reply_markup=markup
                    )
                elif message.text == "⏭ Пропустить":
                    self._save_product(user_id, message.chat.id)
                else:
                    return
            
            elif state == "awaiting_attr2_name":
                # Сохраняем название второй характеристики
                self.temp_data[user_id]['attr2_name'] = message.text
                self.temp_data[user_id]['attr2_values'] = []
                self.user_states[user_id] = "awaiting_attr2_values"
                
                markup = types.ReplyKeyboardMarkup(resize_keyboard=True)
                markup.add(types.KeyboardButton("✅ Готово"))
                markup.add(types.KeyboardButton("❌ Отмена"))
                
                self.bot.send_message(
                    message.chat.id,
                    f"📝 Введите варианты для характеристики '<b>{message.text}</b>':\n\n"
                    f"Отправляйте по одному варианту.\n"
                    f"Когда закончите, нажмите '✅ Готово'",
                    parse_mode='HTML',
                    reply_markup=markup
                )
            
            elif state == "awaiting_attr2_values":
                if message.text == "✅ Готово":
                    if not self.temp_data[user_id].get('attr2_values'):
                        self.bot.send_message(
                            message.chat.id,
                            "⚠️ Добавьте хотя бы один вариант!"
                        )
                        return
                    
                    # Сохраняем товар
                    self._save_product(user_id, message.chat.id)
                else:
                    # Добавляем вариант
                    self.temp_data[user_id]['attr2_values'].append(message.text)
                    self.bot.send_message(
                        message.chat.id,
                        f"✅ Вариант добавлен: <b>{message.text}</b>\n"
                        f"Всего вариантов: {len(self.temp_data[user_id]['attr2_values'])}\n\n"
                        f"Продолжайте вводить варианты или нажмите '✅ Готово'",
                        parse_mode='HTML'
                    )
    
    def _save_product(self, user_id, chat_id):
        """Сохраняет товар в базу данных"""
        try:
            # Собираем данные
            temp = self.temp_data[user_id]
            colors = temp.get('colors')
            attributes = []
            
            # Добавляем характеристики если есть
            if temp.get('attr1_name') and temp.get('attr1_values'):
                attributes.append({
                    'name': temp['attr1_name'],
                    'values': temp['attr1_values']
                })
            
            if temp.get('attr2_name') and temp.get('attr2_values'):
                attributes.append({
                    'name': temp['attr2_name'],
                    'values': temp['attr2_values']
                })
            
            # Сохраняем товар в БД
            product = add_product(
                name=temp['name'],
                description=temp['description'],
                price=temp['price'],
                images=temp['images'],
                category_id=temp['category_id'],
                colors=colors if colors else None,
                attributes=attributes if attributes else None
            )
            
            if product:
                # Формируем сообщение об успехе
                message = (
                    f"✅ <b>Товар успешно добавлен!</b>\n\n"
                    f"📦 Название: {product['name']}\n"
                    f"📝 Описание: {product['description']}\n"
                    f"💰 Цена: {product['price']:,} сум\n"
                    f"📁 Категория: {temp['category_id']}\n"
                    f"📸 Фотографий: {len(temp['images'])}\n"
                )
                
                if colors:
                    message += f"🎨 Цветов: {len(colors)}\n"
                
                if attributes:
                    message += f"📋 Характеристик: {len(attributes)}\n"
                    for attr in attributes:
                        message += f"   • {attr['name']}: {len(attr['values'])} вариантов\n"
                
                message += f"🆔 ID: <code>{product['id']}</code>"
                
                self.bot.send_message(
                    chat_id,
                    message,
                    parse_mode='HTML',
                    reply_markup=self._create_main_menu()
                )
            else:
                self.bot.send_message(
                    chat_id,
                    "❌ Ошибка при добавлении товара в базу данных.",
                    reply_markup=self._create_main_menu()
                )
        except Exception as e:
            print(f"❌ Ошибка сохранения товара: {e}")
            self.bot.send_message(
                chat_id,
                f"❌ Ошибка: {str(e)}",
                reply_markup=self._create_main_menu()
            )
        finally:
            # Очищаем состояние
            if user_id in self.user_states:
                del self.user_states[user_id]
            if user_id in self.temp_data:
                del self.temp_data[user_id]
    
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
