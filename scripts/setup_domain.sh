#!/bin/bash

# Цвета для вывода
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}=== Настройка домена для Telegram Shop ===${NC}"
echo ""

# Проверка прав root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}Запустите скрипт с правами root: sudo ./setup_domain.sh${NC}"
    exit 1
fi

# Запросить домен
read -p "Введите ваш домен (например: myshop.com): " DOMAIN

if [ -z "$DOMAIN" ]; then
    echo -e "${RED}Ошибка: домен не указан${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}Настройка Nginx для домена: $DOMAIN${NC}"
echo ""

# Создать конфигурацию Nginx
cat > /etc/nginx/sites-available/shop << EOF
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;

    # Ограничения соединений и частоты запросов
    limit_conn conn_limit_per_ip 20;
    limit_req zone=req_limit_per_ip burst=30 nodelay;

    # Защитные HTTP заголовки
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Блокировка известных хакерских сканеров и утилит
    if (\$http_user_agent ~* (nikto|sqlmap|nmap|masscan|hydra|metasploit|slowloris|bsqlbf|harvest|netsparker|zmeu|dirbuster|pangolin)) {
        return 403;
    }

    # Запрет доступа к скрытым файлам (.env, .git и т.д.)
    location ~ /\. {
        deny all;
        access_log off;
        log_not_found off;
    }

    # Запрет доступа к конфигурациям и скриптам
    location ~ \.(env|git|sqlite3|sh|bak|config)$ {
        deny all;
        return 404;
    }

    # Логи
    access_log /var/log/nginx/shop_access.log;
    error_log /var/log/nginx/shop_error.log;

    # Статические файлы (frontend)
    location / {
        root /home/shopapp/app/dist/public;
        try_files \$uri \$uri/ /index.html;
        add_header Cache-Control "public, max-age=3600";
    }

    # API запросы к Flask
    location /api/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # Конфигурация из settings.json
    location /config/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
    }
}
EOF

echo "Проверка конфигурации Nginx..."

# Проверить конфигурацию
nginx -t

if [ $? -eq 0 ]; then
    # Перезапустить Nginx
    systemctl reload nginx
    
    echo ""
    echo -e "${GREEN}✅ Nginx успешно настроен для домена: $DOMAIN${NC}"
    echo ""
    echo "Теперь ваш сайт доступен по адресу:"
    echo -e "  ${BLUE}http://$DOMAIN${NC}"
    echo -e "  ${BLUE}http://www.$DOMAIN${NC}"
    echo ""
    echo -e "${YELLOW}⚠️  ВАЖНО для безопасной работы:${NC}"
    echo "Современные функции (PWA, кэширование, service workers) требуют HTTPS для работы!"
    echo ""
    echo "🔐 Установите SSL сертификат командой:"
    echo -e "  ${GREEN}sudo ./setup_ssl.sh${NC}"
    echo ""
else
    echo ""
    echo -e "${RED}❌ Ошибка в конфигурации Nginx${NC}"
    exit 1
fi
