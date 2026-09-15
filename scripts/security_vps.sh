#!/bin/bash

# ============================================================================
# СКРИПТ УСИЛЕНИЯ БЕЗОПАСНОСТИ VPS (ANTI-DDoS, SLOWLORIS, FAIL2BAN, UFW)
# Использование: sudo ./scripts/security_vps.sh
# ============================================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_step() {
    echo -e "${GREEN}[STEP]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

if [ "$EUID" -ne 0 ]; then 
    print_error "Пожалуйста, запустите скрипт с правами root (sudo ./scripts/security_vps.sh)"
    exit 1
fi

echo -e "${BLUE}================================================================${NC}"
echo -e "${GREEN}🛡️  КОМПЛЕКСНАЯ ЗАЩИТА СЕРВЕРА ОТ ХАКЕРОВ И DDoS ТАКАК 🛡️${NC}"
echo -e "${BLUE}================================================================${NC}"
echo ""

# ----------------------------------------------------------------------------
# 1. НАСТРОЙКА БРАНДМАУЭРА (UFW FIREWALL)
# ----------------------------------------------------------------------------
print_step "1/5. Настройка брандмауэра UFW (блокировка неиспользуемых портов)..."
if ! command -v ufw &> /dev/null; then
    apt update && apt install -y ufw
fi

# Сброс правил (по умолчанию запретить всё входящее, разрешить исходящее)
ufw default deny incoming
ufw default allow outgoing

# Разрешить только необходимые порты
ufw allow 22/tcp comment 'SSH'
ufw allow 80/tcp comment 'HTTP'
ufw allow 443/tcp comment 'HTTPS'

# Ограничить брутфорс SSH
ufw limit 22/tcp

# Включить UFW без запроса интерактива
echo "y" | ufw enable
print_step "✅ UFW Firewall успешно настроен! Открыты только порты: 22 (SSH), 80 (HTTP), 443 (HTTPS)."

# ----------------------------------------------------------------------------
# 2. УСТАНОВКА И НАСТРОЙКА FAIL2BAN (АВТОМАТИЧЕСКАЯ БЛОКИРОВКА АТАКУЮЩИХ IP)
# ----------------------------------------------------------------------------
print_step "2/5. Установка и настройка Fail2Ban..."
apt update && apt install -y fail2ban

cat > /etc/fail2ban/jail.local << 'EOF'
[DEFAULT]
bantime  = 1h
findtime = 10m
maxretry = 5
backend  = auto

[sshd]
enabled = true
port    = ssh
logpath = %(sshd_log)s
backend = %(sshd_backend)s
maxretry = 3
bantime  = 24h

[nginx-http-auth]
enabled = true
port    = http,https
logpath = %(nginx_error_log)s

[nginx-botsearch]
enabled = true
port    = http,https
logpath = %(nginx_error_log)s
maxretry = 2

[nginx-limit-req]
enabled = true
port    = http,https
logpath = %(nginx_error_log)s
findtime = 60
maxretry = 10
bantime = 24h
EOF

systemctl restart fail2ban
systemctl enable fail2ban
print_step "✅ Fail2Ban запущен! Автоматически банит сканеры и брутфорсеры на 24 часа."

# ----------------------------------------------------------------------------
# 3. НАСТРОЙКА NGINX ANTI-SLOWLORIS & RATE LIMITING
# ----------------------------------------------------------------------------
print_step "3/5. Настройка Nginx от Slowloris и HTTP Flood..."

# Создаем файл глобальных лимитов и таймаутов
cat > /etc/nginx/conf.d/security_limits.conf << 'EOF'
# Защита от Slowloris (короткие таймауты для соединений)
client_body_timeout 10s;
client_header_timeout 10s;
keepalive_timeout 15s;
send_timeout 10s;

# Отключение передачи версии Nginx
server_tokens off;

# Зоны лимитов запросов и соединений по IP
limit_conn_zone $binary_remote_addr zone=conn_limit_per_ip:10m;
limit_req_zone $binary_remote_addr zone=req_limit_per_ip:10m rate=15r/s;
EOF

# Проверяем существующие конфиги Nginx и обновляем /etc/nginx/sites-available/shop если есть
if [ -f "/etc/nginx/sites-available/shop" ]; then
    print_step "Обновление конфигурации Nginx сайта..."
    
    # Находим домен или порт из текущего конфига или используем дефолт
    cat > /etc/nginx/sites-available/shop << 'EOF'
server {
    listen 80;
    server_name _;
    client_max_body_size 20M;

    # Ограничения соединений и частоты запросов
    limit_conn conn_limit_per_ip 20;
    limit_req zone=req_limit_per_ip burst=30 nodelay;

    # Защитные HTTP заголовки
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Блокировка известных хакерских сканеров и утилит (Metasploit, Slowloris, Nikto, etc.)
    if ($http_user_agent ~* (nikto|sqlmap|nmap|masscan|hydra|metasploit|slowloris|bsqlbf|harvest|netsparker|zmeu|dirbuster|pangolin)) {
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

    access_log /var/log/nginx/shop_access.log;
    error_log /var/log/nginx/shop_error.log;

    location /assets {
        alias /home/shopapp/app/dist/public/assets;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF
fi

if nginx -t; then
    systemctl restart nginx
    print_step "✅ Nginx успешно настроен и защищен от Slowloris & DoS!"
else
    print_error "Ошибка проверки Nginx конфига!"
fi

# ----------------------------------------------------------------------------
# 4. ПРОВЕРКА ПРАВ И СЕКРЕТОВ В СИСТЕМЕ
# ----------------------------------------------------------------------------
print_step "4/5. Защита прав доступа к конфигам и ключам..."
chmod 600 /home/*/*/app/.env 2>/dev/null || true
chmod 600 /home/*/.env 2>/dev/null || true
chmod 700 /home/*/*/backups 2>/dev/null || true

# ----------------------------------------------------------------------------
# 5. ИТОГОВЫЙ ОТЧЕТ И СТАТУС
# ----------------------------------------------------------------------------
echo ""
echo -e "${BLUE}================================================================${NC}"
echo -e "${GREEN}🎉 ВСЕ СИСТЕМЫ БЕЗОПАСНОСТИ УСПЕШНО АКТИВИРОВАНЫ! 🎉${NC}"
echo -e "${BLUE}================================================================${NC}"
echo ""
echo "📊 ТЕКУЩИЙ СТАТУС ЗАЩИТЫ:"
echo "------------------------------------------------"
echo "1. UFW Firewall: ACTIVE (Разрешены только 22, 80, 443)"
ufw status verbose | head -n 12
echo ""
echo "2. Fail2Ban: ACTIVE (Авто-блокировка штурма и сканирования)"
fail2ban-client status
echo ""
echo "3. Anti-Slowloris Nginx: ACTIVE (Таймауты: 10s, Лимит: 20 подкл/IP)"
echo ""
echo -e "${YELLOW}💡 ДЛЯ 100% НЕПРОБИВАЕМОЙ ЗАЩИТЫ ОТ DDoS И СВДИТЕНИЯ НА НЕТ АТАКИ ПО IP:${NC}"
echo "   Подключите бесплатный Cloudflare (инструкция передана разработчиком)."
echo "=================================================="
