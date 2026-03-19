# 🎨 Универсальный шаблон магазина

Этот проект — универсальный шаблон для создания мобильных интернет-магазинов. Все настройки магазина хранятся в одном месте, что позволяет легко адаптировать приложение под любой бизнес.

## 📁 Структура конфигурации

Все настройки магазина находятся в папке `config/`:

```
config/
├── settings.json    # Основные настройки (магазин, платежи, уведомления)
└── logo.svg         # Логотип магазина
```

## ⚙️ Файл config/settings.json

### Основные настройки

```json
{
	"shopName": "Название вашего магазина",
	"description": "Краткое описание",
	"logo": "/config/logo.svg",
	"currency": {
		"symbol": "₽", // Символ валюты
		"code": "RUB", // Код валюты
		"position": "after" // Позиция символа: "before" или "after"
	},
	"managerContact": "@your_telegram" // Telegram контакт менеджера
}
```

### Цветовая схема

Настройте цвета под ваш бренд в HEX формате:

```json
{
	"colorScheme": {
		"background": "#FEFEFE", // Фон приложения
		"foreground": "#1A1A1A", // Основной текст
		"card": "#FFFFFF", // Фон карточек
		"cardForeground": "#1A1A1A", // Текст на карточках
		"primary": "#EADCF0", // Акцентный цвет (кнопки, выделения)
		"primaryForeground": "#1A1A1A", // Текст на акцентном фоне
		"secondary": "#F5F5F5", // Вторичный фон
		"secondaryForeground": "#1A1A1A",
		"muted": "#F5F5F5", // Приглушенные элементы
		"mutedForeground": "#737373", // Приглушенный текст
		"accent": "#EADCF0", // Дополнительный акцент
		"accentForeground": "#1A1A1A",
		"border": "#E5E5E5", // Границы
		"input": "#E5E5E5", // Поля ввода
		"ring": "#EADCF0" // Обводка фокуса
	}
}
```

### Варианты сортировки

Настройте способы сортировки товаров:

```json
{
	"sortOptions": [
		{
			"id": "new", // Уникальный ID
			"label": "Новинки", // Название для пользователей
			"emoji": "✨" // Эмодзи для визуального отображения
		},
		{
			"id": "price_asc",
			"label": "Сначала дешевые",
			"emoji": "💰"
		},
		{
			"id": "price_desc",
			"label": "Сначала дорогие",
			"emoji": "💎"
		}
	]
}
```

### UI настройки

```json
{
	"ui": {
		"maxWidth": "420px", // Максимальная ширина
		"productsPerPage": 12, // Товаров на странице
		"showCategoryIcons": true, // Показывать иконки категорий
		"showPriceFilter": true // Показывать фильтр по цене
	}
}
```

### Тексты интерфейса

Настройте тексты кнопок и сообщений:

```json
{
	"texts": {
		"addToCart": "В корзину",
		"addedToCart": "Добавлено",
		"checkout": "Оформить заказ",
		"total": "Итого",
		"emptyCart": "Корзина пуста",
		"emptyFavorites": "Нет избранных товаров",
		"loading": "Загрузка..."
	}
}
```

---

## 💳 Настройка платежей

Методы оплаты настраиваются в `config/settings.json` под ключом `payment`:

### Перевод на карту

```json
{
	"payment": {
		"cardTransfer": {
			"enabled": true,
			"cardNumber": "8600 1234 5678 9012",
			"cardHolder": "Иванов Иван Иванович",
			"bankName": "Uzcard"
		}
	}
}
```

Покупатель делает перевод и загружает скриншот чека. Админ подтверждает оплату.

### Click

```json
{
	"payment": {
		"click": {
			"enabled": true,
			"merchantId": "12345",
			"serviceId": "67890"
		}
	}
}
```

**Переменные окружения (секретные):**

```bash
CLICK_MERCHANT_ID=12345
CLICK_SERVICE_ID=67890
CLICK_SECRET_KEY=your_secret_key
```

### Payme

```json
{
	"payment": {
		"payme": {
			"enabled": true,
			"merchantId": "your_merchant_id"
		}
	}
}
```

**Переменные окружения:**

```bash
PAYME_MERCHANT_ID=your_merchant_id
PAYME_KEY=your_secret_key
```

### Uzum Bank

```json
{
	"payment": {
		"uzum": {
			"enabled": true,
			"merchantId": "your_merchant_id",
			"serviceId": "your_service_id"
		}
	}
}
```

**Переменные окружения:**

```bash
UZUM_MERCHANT_ID=your_merchant_id
UZUM_SERVICE_ID=your_service_id
UZUM_SECRET_KEY=your_secret_key
```

---

## 📱 Telegram уведомления

```json
{
	"telegramNotifications": {
		"enabled": true,
		"adminChatId": "987654321"
	}
}
```

**Переменные окружения:**

```bash
TELEGRAM_BOT_TOKEN=123456789:AAHxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TELEGRAM_ADMIN_CHAT_ID=987654321
```

При каждом заказе администратор получает сообщение с деталями заказа и чеком оплаты (если есть).

---

## 🎨 Логотип

Замените файл `config/logo.svg` на свой логотип:

- Формат: SVG (рекомендуется) или PNG
- Размер: 200x200px или больше
- Обновите путь в `settings.json` если используете другое имя файла

---

## 👨‍💼 Админ-панель

Доступна по адресу: `/admin`

### Возможности:

| Вкладка        | Функции                                                                |
| -------------- | ---------------------------------------------------------------------- |
| **Товары**     | Добавление, редактирование, удаление с загрузкой фото через Cloudinary |
| **Категории**  | CRUD для категорий с иконками (эмодзи)                                 |
| **Заказы**     | Просмотр, изменение статуса, просмотр чеков                            |
| **Статистика** | Пользователи, заказы, выручка, конверсия                               |
| **Настройки**  | Cloudinary, платежи, Telegram, SMTP                                    |
| **Менеджеры**  | Управление админами (только superadmin)                                |

### Первый вход:

1. Зарегистрируйтесь на сайте
2. Перейдите на `/admin/login`
3. Если нет администраторов — вы станете первым админом

---

## 🗃️ База данных

Товары и категории хранятся в PostgreSQL базе данных.

### Через админ-панель (рекомендуется):

1. Войдите в `/admin`
2. Настройте Cloudinary в "Настройки"
3. Добавьте категории в "Категории"
4. Добавьте товары в "Товары"

### Через SQL:

#### Категории

```sql
INSERT INTO categories (name, icon) VALUES ('Электроника', '📱');
```

#### Товары

```sql
INSERT INTO products (name, description, price, images, category_id, colors, attributes)
VALUES (
  'iPhone 15',
  'Новый смартфон Apple',
  15000000,
  ARRAY['https://example.com/image1.jpg'],
  'category-id-here',
  ARRAY['Черный', 'Белый', 'Синий'],
  '{"name": "Память", "values": ["128GB", "256GB", "512GB"]}'::jsonb
);
```

---

## 🖼️ Cloudinary (для изображений)

### Настройка через админ-панель:

1. Войдите в `/admin`
2. Перейдите в "Настройки" → "Cloudinary"
3. Введите:
   - Cloud Name
   - API Key
   - API Secret
4. Нажмите "Сохранить"

### Или через переменные окружения:

```bash
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

Получить данные: [cloudinary.com](https://cloudinary.com) (бесплатный аккаунт)

---

## 🚀 Быстрый старт

1. **Настройте config/settings.json** под ваш бизнес
2. **Замените logo.svg** на свой логотип
3. **Разверните на VPS** через `auto_deploy.sh`
4. **Войдите в админку** `/admin` и настройте Cloudinary
5. **Добавьте категории** через админ-панель
6. **Добавьте товары** с изображениями
7. **Настройте платежи** в админке или в `settings.json`
8. **Готово!** 🎉

---

## 💡 Примеры использования

### Магазин одежды

```json
{
	"shopName": "Fashion Store",
	"currency": { "symbol": "$", "code": "USD", "position": "before" },
	"colorScheme": {
		"primary": "#FF6B9D",
		"accent": "#C44569"
	},
	"sortOptions": [
		{ "id": "new", "label": "New Arrivals", "emoji": "✨" },
		{ "id": "popular", "label": "Trending", "emoji": "🔥" }
	]
}
```

### Магазин электроники

```json
{
	"shopName": "TechHub",
	"currency": { "symbol": "€", "code": "EUR", "position": "after" },
	"colorScheme": {
		"primary": "#2C3E50",
		"accent": "#3498DB"
	},
	"sortOptions": [
		{ "id": "new", "label": "Latest", "emoji": "🆕" },
		{ "id": "rating", "label": "Top Rated", "emoji": "⭐" }
	]
}
```

### Магазин в Узбекистане

```json
{
	"shopName": "Online Do'kon",
	"currency": { "symbol": "сум", "code": "UZS", "position": "after" },
	"colorScheme": {
		"primary": "#3B82F6",
		"accent": "#1E40AF"
	},
	"payment": {
		"click": { "enabled": true, "merchantId": "12345", "serviceId": "67890" },
		"payme": { "enabled": true, "merchantId": "abcdef" },
		"cardTransfer": {
			"enabled": true,
			"cardNumber": "8600 1234 5678 9012",
			"cardHolder": "Иванов Иван",
			"bankName": "Uzcard"
		}
	}
}
```

---

## 📝 Примечания

- **Цвета**: Все цвета автоматически конвертируются в HSL формат для Tailwind CSS
- **Валюта**: Поддерживается форматирование с разделителями тысяч
- **Эмодзи**: Используйте любые эмодзи Unicode для категорий и сортировки
- **База данных**: Категории и товары остаются в БД и не дублируются в конфиге
- **Секретные ключи**: Храните ТОЛЬКО в переменных окружения, не в settings.json
- **Изображения**: Загружаются через Cloudinary для оптимизации и CDN

---

## 🔧 API Endpoints

### Публичные

- `GET /api/config` - Получить конфигурацию
- `GET /config/logo.svg` - Получить логотип
- `GET /api/categories` - Список категорий
- `GET /api/products` - Список товаров
- `GET /api/products/<id>` - Товар по ID

### Авторизация

- `POST /api/auth/register` - Регистрация
- `POST /api/auth/login` - Вход
- `GET /api/auth/me` - Текущий пользователь
- `POST /api/auth/logout` - Выход

### Корзина и заказы

- `GET /api/cart` - Корзина
- `POST /api/cart` - Добавить в корзину
- `DELETE /api/cart/<id>` - Удалить из корзины
- `POST /api/orders` - Создать заказ
- `GET /api/orders` - История заказов

### Админ-панель

- `POST /api/admin/login` - Вход админа
- `GET/POST /api/admin/products` - Управление товарами
- `GET/POST /api/admin/categories` - Управление категориями
- `GET /api/admin/orders` - Заказы
- `GET/PUT /api/admin/settings/cloudinary` - Настройки Cloudinary

### Платежи (webhooks)

- `POST /api/webhooks/click/prepare` - Click prepare
- `POST /api/webhooks/click/complete` - Click complete
- `POST /api/webhooks/payme` - Payme JSON-RPC
- `POST /api/webhooks/uzum/check` - Uzum check
- `POST /api/webhooks/uzum/create` - Uzum create
- `POST /api/webhooks/uzum/confirm` - Uzum confirm

---

## ✅ Готово!

Теперь у вас есть полностью настраиваемый шаблон интернет-магазина. Просто измените конфиг, добавьте товары через админ-панель и ваш магазин готов! 🎉

Подробнее: **[ПОЛНОЕ_РУКОВОДСТВО.md](ПОЛНОЕ_РУКОВОДСТВО.md)**
