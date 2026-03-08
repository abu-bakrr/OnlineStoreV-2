#!/bin/bash

# ============================================================================
# СКРИПТ ДОБАВЛЕНИЯ НОВОГО ЭКЗЕМПЛЯРА МАГАЗИНА (Multi-Instance)
# Позволяет запустить второй/третий сайт на том же VPS с другим доменом.
# ============================================================================

set -e

# Цвета
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}Запустите скрипт с правами root: sudo bash scripts/add_shop_instance.sh${NC}"
    exit 1
fi

echo -e "${BLUE}=== ГЕНЕРАТОР НОВОГО ЭКЗЕМПЛЯРА МАГАЗИНА ===${NC}"
echo ""

# 1. Сбор параметров
read -p "Введите ID экземпляра (латиницей, например luxury): " INSTANCE_ID
INSTANCE_ID=${INSTANCE_ID:-shop2}

read -p "Введите название магазина (например: Luxury Boutique): " SHOP_NAME
SHOP_NAME=${SHOP_NAME:-"New Shop"}

read -p "Введите основной цвет (HEX, например #f5a40d): " PRIMARY_COLOR
PRIMARY_COLOR=${PRIMARY_COLOR:-"#f5a40d"}

read -p "Введите домен для этого сайта (например: luxe-shop.uz): " DOMAIN
if [ -z "$DOMAIN" ]; then echo -e "${RED}Домен обязателен!${NC}"; exit 1; fi

read -p "Введите порт для приложения [5001]: " APP_PORT
APP_PORT=${APP_PORT:-5001}

read -p "Введите основной токен бота: " TELEGRAM_BOT_TOKEN
read -p "Введите токен AI бота: " AI_BOT_TOKEN
read -p "Введите GROQ API Key: " GROQ_API_KEY

# Системные имена
APP_USER="shop_$INSTANCE_ID"
DB_NAME="db_$INSTANCE_ID"
DB_USER="user_$INSTANCE_ID"
DB_PASSWORD=$(openssl rand -hex 12)
APP_DIR="/home/$APP_USER/app"

echo ""
echo -e "${YELLOW}Будет создано:${NC}"
echo "👤 Пользователь: $APP_USER"
echo "📂 Директория:  $APP_DIR"
echo "🗄️ База данных:  $DB_NAME"
echo "🌐 Домен:       $DOMAIN"
echo "🔌 Порт:        $APP_PORT"
echo ""
read -p "Все верно? (y/n): " CONFIRM
if [[ "$CONFIRM" != "y" ]]; then exit 0; fi

# 2. Создание пользователя
if id "$APP_USER" &>/dev/null; then
    echo "Пользователь $APP_USER уже существует"
else
    useradd -m -s /bin/bash $APP_USER
fi
usermod -a -G www-data $APP_USER

# 3. Настройка базы данных
sudo -u postgres psql <<EOF
CREATE DATABASE $DB_NAME;
CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';
GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;
ALTER DATABASE $DB_NAME OWNER TO $DB_USER;
EOF

# 4. Копирование кода
mkdir -p $APP_DIR
cp -r ./* $APP_DIR/
chown -R $APP_USER:$APP_USER $APP_DIR

# 5. Обновление настроек (Брендинг)
echo "🎨 Применение брендинга в settings.json..."
sudo -u $APP_USER python3 <<EOF
import json
import os

path = '$APP_DIR/config/settings.json'
with open(path, 'r', encoding='utf-8') as f:
    config = json.load(f)

config['shopName'] = '$SHOP_NAME'
# Обновляем основные цвета в обеих темах
if 'colorScheme' in config:
    config['colorScheme']['primary'] = '$PRIMARY_COLOR'
    config['colorScheme']['accent'] = '$PRIMARY_COLOR'
    config['colorScheme']['ring'] = '$PRIMARY_COLOR'
if 'colorSchemeDark' in config:
    config['colorSchemeDark']['primary'] = '$PRIMARY_COLOR'
    config['colorSchemeDark']['accent'] = '$PRIMARY_COLOR'
    config['colorSchemeDark']['ring'] = '$PRIMARY_COLOR'

with open(path, 'w', encoding='utf-8') as f:
    json.dump(config, f, indent=4, ensure_ascii=False)
EOF

# 6. Создание .env
SESSION_SECRET=$(openssl rand -hex 32)
cat > $APP_DIR/.env <<EOF
DATABASE_URL=postgresql://$DB_USER:$DB_PASSWORD@localhost:5432/$DB_NAME
PORT=$APP_PORT
FLASK_ENV=production
SESSION_SECRET=$SESSION_SECRET
TELEGRAM_BOT_TOKEN=$TELEGRAM_BOT_TOKEN
AI_BOT_TOKEN=$AI_BOT_TOKEN
GROQ_API_KEY=$GROQ_API_KEY
EOF
chown $APP_USER:$APP_USER $APP_DIR/.env
chmod 600 $APP_DIR/.env

# 6. Установка и сборка (под пользователем)
sudo -u $APP_USER bash <<EOF
cd $APP_DIR
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
npm install
npm run build
python3 scripts/init_tables.py
EOF

# 7. Systemd Сервисы
cat > /etc/systemd/system/shop-$INSTANCE_ID.service <<EOF
[Unit]
Description=Shop App ($INSTANCE_ID)
After=network.target postgresql.service

[Service]
User=$APP_USER
WorkingDirectory=$APP_DIR
Environment="PATH=$APP_DIR/venv/bin"
EnvironmentFile=$APP_DIR/.env
ExecStart=$APP_DIR/venv/bin/gunicorn app:app --bind 127.0.0.1:$APP_PORT --workers 2
Restart=always

[Install]
WantedBy=multi-user.target
EOF

cat > /etc/systemd/system/bot-$INSTANCE_ID.service <<EOF
[Unit]
Description=Telegram Bot ($INSTANCE_ID)
After=network.target shop-$INSTANCE_ID.service

[Service]
User=$APP_USER
WorkingDirectory=$APP_DIR/telegram_bot
Environment="PATH=$APP_DIR/venv/bin"
EnvironmentFile=$APP_DIR/.env
ExecStart=$APP_DIR/venv/bin/python3 telegrambot.py
Restart=always

[Install]
WantedBy=multi-user.target
EOF

cat > /etc/systemd/system/ai-$INSTANCE_ID.service <<EOF
[Unit]
Description=AI Bot ($INSTANCE_ID)
After=network.target shop-$INSTANCE_ID.service

[Service]
User=$APP_USER
WorkingDirectory=$APP_DIR
Environment="PATH=$APP_DIR/venv/bin"
EnvironmentFile=$APP_DIR/.env
ExecStart=$APP_DIR/venv/bin/python3 ai_bot/ai_customer_bot.py
Restart=always

[Install]
WantedBy=multi-user.target
EOF

# 8. Nginx
cat > /etc/nginx/sites-available/$INSTANCE_ID <<EOF
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;

    location /assets {
        alias $APP_DIR/dist/public/assets;
    }

    location / {
        proxy_pass http://127.0.0.1:$APP_PORT;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
    }
}
EOF

ln -sf /etc/nginx/sites-available/$INSTANCE_ID /etc/nginx/sites-enabled/
systemctl daemon-reload
systemctl enable shop-$INSTANCE_ID bot-$INSTANCE_ID ai-$INSTANCE_ID
systemctl restart shop-$INSTANCE_ID bot-$INSTANCE_ID ai-$INSTANCE_ID
systemctl reload nginx

# 9. SSL
echo -e "${YELLOW}Настройка SSL...${NC}"
certbot --nginx -d $DOMAIN -d www.$DOMAIN --non-interactive --agree-tos --register-unsafely-without-email --redirect || echo "SSL failed, do it manually!"

echo -e "${GREEN}=== ЭКЗЕМПЛЯР $INSTANCE_ID УСПЕШНО ДОБАВЛЕН ===${NC}"
echo "URL: http://$DOMAIN"
