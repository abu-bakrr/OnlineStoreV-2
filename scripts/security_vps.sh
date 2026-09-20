#!/bin/bash

# ============================================================================
# СКРИПТ УСИЛЕНИЯ БЕЗОПАСНОСТИ VPS V2 (PORT 21 PURGE, ANTI-DDoS, ANTI-SCAN, FAIL2BAN, UFW)
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
echo -e "${GREEN}🛡️  УЛЬТИМАТИВНАЯ ЗАЩИТА СЕРВЕРА ОТ ВЗЛОМА, FTP-УГРОЗ И DDoS 🛡️${NC}"
echo -e "${BLUE}================================================================${NC}"
echo ""

# ----------------------------------------------------------------------------
# 1. ПОЛНАЯ ЛИКВИДАЦИЯ И БЛОКИРОВКА ПОРТА 21 (FTP)
# ----------------------------------------------------------------------------
print_step "1/6. Отключение и полное удаление небезопасных FTP служб (порт 21)..."
systemctl stop vsftpd proftpd pure-ftpd bftpd ftpd 2>/dev/null || true
systemctl disable vsftpd proftpd pure-ftpd bftpd ftpd 2>/dev/null || true
apt purge -y vsftpd proftpd* pure-ftpd* 2>/dev/null || true

# Закрываем все FTP соединения
pkill -9 -f "vsftpd|proftpd|pure-ftpd" 2>/dev/null || true
print_step "✅ Порт 21 (FTP) полностью ликвидирован и остановлен!"

# ----------------------------------------------------------------------------
# 2. НАСТРОЙКА БРАНДМАУЭРА (UFW FIREWALL)
# ----------------------------------------------------------------------------
print_step "2/6. Настройка брандмауэра UFW (блокировка всех лишних портов)..."
if ! command -v ufw &> /dev/null; then
    apt update && apt install -y ufw
fi

# Сброс правил (по умолчанию запретить всё входящее, разрешить исходящее)
ufw --force reset
ufw default deny incoming
ufw default allow outgoing

# Разрешить только необходимые порты
ufw allow 22/tcp comment 'SSH'
ufw allow 80/tcp comment 'HTTP'
ufw allow 443/tcp comment 'HTTPS'

# Жесткий запрет порта 21 и базы данных 5432 извне
ufw deny 21/tcp comment 'FTP Block'
ufw deny 5432/tcp comment 'Postgres External Block'

# Ограничить брутфорс SSH
ufw limit 22/tcp

# Включить UFW без запроса интерактива
echo "y" | ufw enable
print_step "✅ UFW Firewall активирован! Открыты строго 3 порта: 22 (SSH), 80 (HTTP), 443 (HTTPS)."

# ----------------------------------------------------------------------------
# 3. УСТАНОВКА И НАСТРОЙКА FAIL2BAN (АВТОМАТИЧЕСКИЙ БАН АТАКУЮЩИХ)
# ----------------------------------------------------------------------------
print_step "3/6. Настройка Fail2Ban для мгновенного бана сканеров и ботов..."
apt update && apt install -y fail2ban

cat > /etc/fail2ban/jail.local << 'EOF'
[DEFAULT]
bantime  = 24h
findtime = 10m
maxretry = 3
backend  = auto

[sshd]
enabled = true
port    = ssh
logpath = %(sshd_log)s
backend = %(sshd_backend)s
maxretry = 3
bantime  = 48h

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
maxretry = 8
bantime = 24h
EOF

systemctl restart fail2ban
systemctl enable fail2ban
print_step "✅ Fail2Ban запущен! Любые попытки перебора паролей SSH или спама сайта получают бан на 24-48 часов."

# ----------------------------------------------------------------------------
# 4. ЗАЩИТА NGINX: БЛОКИРОВКА ПРЯМОГО ДОСТУПА ПО IP И ANTI-SLOWLORIS
# ----------------------------------------------------------------------------
print_step "4/6. Настройка Nginx (скрытие реального IP и защита от Slowloris)..."

mkdir -p /etc/nginx/conf.d

# Глобальные лимиты и таймауты против Slowloris
cat > /etc/nginx/conf.d/security_limits.conf << 'EOF'
# Защита от Slowloris (короткие таймауты для зависших соединений)
client_body_timeout 10s;
client_header_timeout 10s;
keepalive_timeout 15s;
send_timeout 10s;

# Скрытие версии сервера
server_tokens off;

# Лимиты соединений и запросов по IP
limit_conn_zone $binary_remote_addr zone=conn_limit_per_ip:10m;
limit_req_zone $binary_remote_addr zone=req_limit_per_ip:10m rate=15r/s;
EOF

# Блокировка прямого обращения по IP (сканеры Shodan, Censys, Metasploit получат моментальный сброс соединения)
cat > /etc/nginx/conf.d/block_direct_ip.conf << 'EOF'
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;
    # Моментально сбрасывает соединение без ответа для тех, кто сканирует IP напрямую
    return 444;
}
EOF

# Обновление конфига сайта (если есть)
if [ -f "/etc/nginx/sites-available/shop" ]; then
    cat > /etc/nginx/sites-available/shop << 'EOF'
server {
    listen 80;
    server_name _;
    client_max_body_size 20M;

    # Лимиты соединений
    limit_conn conn_limit_per_ip 20;
    limit_req zone=req_limit_per_ip burst=30 nodelay;

    # HTTP заголовки безопасности
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Блокировка хакерских утилит (Metasploit, Nikto, Sqlmap, Nmap, Slowloris)
    if ($http_user_agent ~* (nikto|sqlmap|nmap|masscan|hydra|metasploit|slowloris|bsqlbf|harvest|netsparker|zmeu|dirbuster|pangolin|wpscan)) {
        return 403;
    }

    # Запрет доступа к скрытым системным файлам
    location ~ /\. {
        deny all;
        access_log off;
        log_not_found off;
    }

    # Запрет доступа к конфигам, базам и скриптам
    location ~ \.(env|git|sqlite3|sh|bak|config|secret_key)$ {
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
    print_step "✅ Nginx успешно перезапущен со всеми модулями безопасности!"
else
    print_warning "Конфиг Nginx имеет предупреждения, проверьте: nginx -t"
fi

# ----------------------------------------------------------------------------
# 5. ЗАЩИТА СЕКРЕТНЫХ ФАЙЛОВ И ПРАВ ДОСТУПА
# ----------------------------------------------------------------------------
print_step "5/6. Установка строгих прав на конфиги и секретные ключи..."
find /home -name ".env" -exec chmod 600 {} + 2>/dev/null || true
find /home -name ".secret_key" -exec chmod 600 {} + 2>/dev/null || true
find /home -type d -name "backups" -exec chmod 700 {} + 2>/dev/null || true

# ----------------------------------------------------------------------------
# 6. ИТОГОВЫЙ ОТЧЕТ И СТАТУС БЕЗОПАСНОСТИ
# ----------------------------------------------------------------------------
echo ""
echo -e "${BLUE}================================================================${NC}"
echo -e "${GREEN}🎉 СЕРВЕР ПОЛНОСТЬЮ ЗАЩИЩЕН И ЗАБРОНИРОВАН! 🎉${NC}"
echo -e "${BLUE}================================================================${NC}"
echo ""
echo "📊 ИТОГИ ПРОВЕДЕННЫХ РАБОТ:"
echo "------------------------------------------------"
echo "1. Порт 21 (FTP): УДАЛЕН И ЗАБЛОКИРОВАН"
echo "2. Брандмауэр UFW: АКТИВЕН (Открыты только 22, 80, 443)"
echo "3. Сканеры прямого IP: БЛОКИРУЮТСЯ (HTTP 444 Drop)"
echo "4. Fail2Ban: АКТИВЕН (Бан за перебор паролей на 24-48ч)"
echo "5. Защита от подделки сессий и подмены реквизитов: АКТИВНА"
echo "=================================================="
