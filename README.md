# 🛍️ Универсальный Веб-Магазин

Универсальный шаблон адаптивного интернет-магазина. Полностью настраивается через JSON файлы — **не нужно менять код!** Адаптивный дизайн для мобильных и десктопных устройств.

## ⚡ Быстрый старт

### Установка на VPS:

```bash
ssh root@YOUR_VPS_IP
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git app
cd app/scripts
chmod +x master_deploy.sh
sudo ./master_deploy.sh
```

**Готово!** Через 3-5 минут откройте: `http://YOUR_VPS_IP`

📖 Подробности: [docs/БЫСТРАЯ_УСТАНОВКА.md](docs/БЫСТРАЯ_УСТАНОВКА.md)

---

## ✨ Возможности

### Основные функции

- ✅ **Полностью настраиваемый** — всё через JSON конфигурацию
- ✅ **Любой бизнес** — цветы, одежда, электроника, еда
- ✅ **Любая валюта** — ₽, $, €, сум и т.д.
- ✅ **Свой дизайн** — цвета, шрифты, логотип
- ✅ **Адаптивный дизайн** — 2 колонки на мобильных, 4 на десктопе

### Админ-панель (`/admin`)

- ✅ **Управление товарами** — добавление, редактирование, удаление
- ✅ **Загрузка изображений** — через Cloudinary
- ✅ **Управление категориями** — CRUD операции
- ✅ **Просмотр заказов** — статусы, детали, чеки оплаты
- ✅ **Статистика** — выручка, заказы, пользователи
- ✅ **Настройки** — платежи, уведомления, Cloudinary

### Платежные системы

- ✅ **Click** — онлайн оплата (Узбекистан)
- ✅ **Payme** — онлайн оплата (Узбекистан)
- ✅ **Uzum Bank** — онлайн оплата (Узбекистан)
- ✅ **Перевод на карту** — с загрузкой чека

### Уведомления

- ✅ **Telegram уведомления** — о новых заказах администратору
- ✅ **Email** — сброс пароля через SMTP

### Инфраструктура

- ✅ **PostgreSQL** — надёжная база данных
- ✅ **Автоматический деплой** — интерактивный скрипт на VPS
- ✅ **SSL из коробки** — бесплатный HTTPS от Let's Encrypt
- ✅ **Резервное копирование** — автоматические бэкапы БД

---

## 📚 Документация

### 🎯 Главный документ

**[📖 ПОЛНОЕ РУКОВОДСТВО](docs/ПОЛНОЕ_РУКОВОДСТВО.md)** — ВСЁ в одном файле:

- Как настроить магазин
- Как развернуть на VPS
- Как работать с админ-панелью
- Платежи и уведомления
- Решение всех проблем

### 📁 Вся документация

Все инструкции находятся в папке **[docs/](docs/)** → [Смотреть все документы](docs/README.md)

---

## 🎨 Кастомизация

### 1. Настройте магазин

Отредактируйте `config/settings.json`:

```json
{
	"shopName": "Ваш Магазин",
	"currency": {
		"symbol": "сум",
		"code": "UZS",
		"position": "after"
	},
	"managerContact": "@ваш_telegram",
	"colorScheme": {
		"primary": "#3B82F6",
		"background": "#FEFEFE"
	}
}
```

### 2. Замените логотип

Положите свой логотип в `config/logo.svg`

### 3. Настройте платежи

В `config/settings.json` под `payment`:

```json
{
	"payment": {
		"click": {
			"enabled": true,
			"merchantId": "YOUR_MERCHANT_ID",
			"serviceId": "YOUR_SERVICE_ID"
		},
		"payme": {
			"enabled": true,
			"merchantId": "YOUR_MERCHANT_ID"
		},
		"cardTransfer": {
			"enabled": true,
			"cardNumber": "8600 1234 5678 9012",
			"cardHolder": "Иванов Иван",
			"bankName": "Uzcard"
		}
	}
}
```

### 4. Добавьте товары

Через админ-панель (`/admin`) или напрямую в PostgreSQL.

**Подробнее:** [📖 Полное руководство](docs/ПОЛНОЕ_РУКОВОДСТВО.md)

---

## 👨‍💼 Админ-панель

Доступна по адресу: `http://ваш-сайт/admin`

### Первый вход:

1. Зарегистрируйте аккаунт на сайте
2. Перейдите на `/admin/login`
3. Если администраторов нет — вы станете первым админом

### Возможности:

- **Товары** — добавление с загрузкой фото через Cloudinary
- **Категории** — создание и редактирование
- **Заказы** — просмотр, изменение статуса
- **Статистика** — выручка, заказы, конверсия
- **Настройки** — Cloudinary, платежи, Telegram уведомления
- **Менеджеры** — добавление других администраторов (только superadmin)

---

## 🚀 Развертывание на VPS

### Установка на VPS:

1. **Запустите мастер-установку:**

```bash
cd scripts
chmod +x master_deploy.sh
sudo ./master_deploy.sh
```

_(Скрипт полностью настроит сайт, базу данных, Nginx, SSL и обоих ботов)_

### 🔄 Другие сценарии:

_ (Скрипт полностью настроит сайт, базу данных, Nginx, SSL и обоих ботов) _

- **Удалить всё с сервера**:

```bash
wget https://raw.githubusercontent.com/abu-bakrr/MiniTaskerBot3/main/scripts/uninstall_vps.sh
chmod +x uninstall_vps.sh
sudo ./uninstall_vps.sh
```

**Документация:** [docs/БЫСТРАЯ_УСТАНОВКА.md](docs/БЫСТРАЯ_УСТАНОВКА.md)

---

## 🔄 Обновление

После изменений в коде:

````bash
# На вашем компьютере
git add .
git commit -m "Update"
git push

```bash
# На VPS
ssh root@YOUR_VPS_IP
cd /home/shopapp/app/scripts
sudo ./update_vps.sh
````

---

## 🌐 Домен и SSL

### Подключить домен:

```bash
cd /home/shopapp/app
sudo ./setup_domain.sh
```

### Установить SSL:

```bash
sudo ./setup_ssl.sh
```

**Документация:** [docs/DOMAIN_SETUP_RU.md](docs/DOMAIN_SETUP_RU.md)

---

## 🛠️ Полезные команды

```bash
# Статус приложения
systemctl status shop-app

# Логи
journalctl -u shop-app -f

# Перезапуск
systemctl restart shop-app

# Резервная копия БД
cd /home/shopapp/app
sudo ./backup_db.sh

# Исправить ошибки 403
sudo ./fix_permissions.sh
```

---

## 📦 Структура проекта

```
├── config/               # Конфигурация магазина
│   ├── settings.json    # Основные настройки
│   └── logo.svg         # Логотип
├── client/              # React фронтенд (TypeScript)
│   └── src/
│       ├── components/  # UI компоненты
│       ├── pages/       # Страницы (включая admin/)
│       ├── hooks/       # React хуки
│       └── contexts/    # Контексты (Auth)
├── server/              # Node.js Express сервер (Vite dev)
├── backend/             # 🐍 API эндпоинты (Flask)
├── shared/              # 🔄 Общие типы и схемы БД (Drizzle)
├── docs/                # 📚 Документация
│   ├── ПОЛНОЕ_РУКОВОДСТВО.md  # ⭐ Главный документ
│   └── ...
├── telegram_bot/        # Telegram бот (управление товарами + цвета/атрибуты)
├── ai_bot/              # AI ассистент Mona
├── app.py               # 🐍 Flask бэкенд (основной файл)
├── main.py              # Точка входа
├── scripts/             # Скрипты автоматизации
│   └── master_deploy.sh # 🚀 ПОЛНОЕ развертывание всего проекта
```

---

## 🆘 Помощь

### Частые проблемы:

| Проблема             | Решение                                 |
| -------------------- | --------------------------------------- |
| Белая страница / 403 | `sudo ./fix_permissions.sh`             |
| Не запускается       | `journalctl -u shop-app -n 100`         |
| Git pull не работает | `sudo -u shopapp git stash && git pull` |

**Полный список:** [docs/ПОЛНОЕ_РУКОВОДСТВО.md](docs/ПОЛНОЕ_РУКОВОДСТВО.md#решение-проблем)

---

## 🔧 Технологии

**Frontend:**

- React 18 + TypeScript
- Vite
- TanStack Query
- Shadcn/ui + Radix UI
- Tailwind CSS

**Backend:**

- Flask (Python)
- Express / Node.js (Локальный сервер)
- PostgreSQL + Drizzle ORM
- Gunicorn
- Cloudinary (изображения)

**Платежи:**

- Click, Payme, Uzum Bank
- Перевод на карту

**Deployment:**

- Ubuntu 22.04
- Nginx
- Systemd
- Let's Encrypt SSL

---

## 📝 Примеры использования

### Цветочный магазин

```json
{
	"shopName": "Цветочная Лавка",
	"currency": { "symbol": "₽", "code": "RUB", "position": "after" },
	"colorScheme": { "primary": "#FFE5EC" }
}
```

### Магазин электроники

```json
{
	"shopName": "TechStore",
	"currency": { "symbol": "$", "code": "USD", "position": "before" },
	"colorScheme": { "primary": "#2C3E50" }
}
```

### Магазин в Узбекистане

```json
{
	"shopName": "Online Do'kon",
	"currency": { "symbol": "сум", "code": "UZS", "position": "after" },
	"colorScheme": { "primary": "#3B82F6" }
}
```

---

## 📜 Лицензия

MIT License — используйте свободно для любых целей

---

## 🚀 С чего начать?

1. **Прочитайте:** [📖 ПОЛНОЕ РУКОВОДСТВО](docs/ПОЛНОЕ_РУКОВОДСТВО.md)
2. **Настройте:** `config/settings.json` под ваш магазин
3. **Разверните:** Запустите `master_deploy.sh` на VPS
4. **Войдите в админку:** `/admin` для добавления товаров
5. **Готово!** Ваш магазин работает 🎉

---

**Успешного запуска! 💪**

Вопросы? → [docs/ПОЛНОЕ_РУКОВОДСТВО.md](docs/ПОЛНОЕ_РУКОВОДСТВО.md)
