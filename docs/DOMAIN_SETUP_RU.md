# 🌐 Подключение домена к VPS

Инструкция по подключению собственного доменного имени к вашему магазину на VPS.

---

## 📋 Что вам понадобится

- ✅ Доменное имя (например: `myshop.com`)
- ✅ Доступ к панели управления доменом
- ✅ SSH доступ к VPS (YOUR_VPS_IP)

---

## 🚀 Шаг 1: Настройка DNS записей

### У вашего регистратора домена:

1. Войдите в панель управления доменом (например: Reg.ru, Namecheap, GoDaddy)
2. Найдите раздел "DNS записи" или "DNS управление"
3. Добавьте **A-запись**:

```
Тип:  A
Имя:  @ (или оставить пустым)
Значение: YOUR_VPS_IP
TTL:  3600 (или автоматически)
```

4. **Опционально** - добавьте запись для `www`:

```
Тип:  A
Имя:  www
Значение: YOUR_VPS_IP
TTL:  3600
```

### ⏰ Ожидание

DNS записи обновляются от **5 минут до 24 часов**. Обычно работает через 15-30 минут.

**Проверить готовность:**

```bash
# На вашем компьютере
ping myshop.com
# Должен вернуть ваш IP: YOUR_VPS_IP
```

---

## 🔧 Шаг 2: Настройка Nginx на VPS

### 1️⃣ Подключитесь к VPS:

```bash
ssh root@YOUR_VPS_IP
```

### 2️⃣ Создайте скрипт настройки домена:

Сохраните этот скрипт в `/home/shopapp/app/setup_domain.sh`:

```bash
#!/bin/bash

# Цвета для вывода
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}=== Настройка домена для Telegram Shop ===${NC}"

# Запросить домен
read -p "Введите ваш домен (например: myshop.com): " DOMAIN

if [ -z "$DOMAIN" ]; then
    echo "Ошибка: домен не указан"
    exit 1
fi

echo -e "${BLUE}Настройка Nginx для домена: $DOMAIN${NC}"

# Создать конфигурацию Nginx
cat > /etc/nginx/sites-available/shop << EOF
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;

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

# Проверить конфигурацию
nginx -t

if [ $? -eq 0 ]; then
    # Перезапустить Nginx
    systemctl reload nginx

    echo -e "${GREEN}✅ Nginx успешно настроен для домена: $DOMAIN${NC}"
    echo ""
    echo "Теперь ваш сайт доступен по адресу:"
    echo "  http://$DOMAIN"
    echo "  http://www.$DOMAIN"
    echo ""
    echo "🔐 Рекомендуется установить SSL сертификат:"
    echo "  sudo ./setup_ssl.sh"
else
    echo "❌ Ошибка в конфигурации Nginx"
    exit 1
fi
EOF
```

### 3️⃣ Сделайте скрипт исполняемым и запустите:

```bash
cd /home/shopapp/app
chmod +x setup_domain.sh
sudo ./setup_domain.sh
```

### 4️⃣ Введите ваш домен:

```
Введите ваш домен (например: myshop.com): myshop.com
```

### ✅ Готово!

Теперь ваш сайт доступен по адресу: `http://myshop.com`

---

## 🔐 Шаг 3: Установка SSL сертификата (HTTPS)

**Обязательно!** HTTPS необходим для безопасной работы современного веба и PWA.

### 1️⃣ Создайте скрипт установки SSL:

Сохраните в `/home/shopapp/app/setup_ssl.sh`:

```bash
#!/bin/bash

# Цвета
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}=== Установка SSL сертификата (Let's Encrypt) ===${NC}"

# Установить Certbot
apt update
apt install -y certbot python3-certbot-nginx

# Запросить домен
read -p "Введите ваш домен (например: myshop.com): " DOMAIN

if [ -z "$DOMAIN" ]; then
    echo "Ошибка: домен не указан"
    exit 1
fi

# Запросить email
read -p "Введите ваш email для уведомлений: " EMAIL

if [ -z "$EMAIL" ]; then
    echo "Ошибка: email не указан"
    exit 1
fi

echo -e "${BLUE}Получение SSL сертификата для: $DOMAIN${NC}"

# Получить сертификат
certbot --nginx -d $DOMAIN -d www.$DOMAIN --non-interactive --agree-tos --email $EMAIL

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ SSL сертификат успешно установлен!${NC}"
    echo ""
    echo "Теперь ваш сайт доступен по HTTPS:"
    echo "  https://$DOMAIN"
    echo "  https://www.$DOMAIN"
    echo ""
    echo "🔄 Сертификат будет автоматически обновляться"
else
    echo "❌ Ошибка при установке SSL"
    exit 1
fi
```

### 2️⃣ Запустите установку SSL:

```bash
cd /home/shopapp/app
chmod +x setup_ssl.sh
sudo ./setup_ssl.sh
```

### 3️⃣ Введите данные:

```
Введите ваш домен: myshop.com
Введите ваш email: your@email.com
```

### ✅ Готово!

Теперь ваш сайт работает по HTTPS: `https://myshop.com` 🎉

---

## 📱 Шаг 4: Настройка интеграции с Telegram (опционально)

После установки SSL обновите URL в настройках вашего Telegram бота:

### 1️⃣ Откройте [@BotFather](https://t.me/BotFather) в Telegram

### 2️⃣ Отправьте команды:

```
/mybots
→ Выберите вашего бота
→ Bot Settings
→ Menu Button
→ Edit Menu Button URL
```

### 3️⃣ Введите новый URL:

```
https://myshop.com
```

---

## 🔄 Автоматическое обновление SSL

Certbot автоматически настраивает обновление сертификата. Проверить:

```bash
# Проверить таймер автообновления
systemctl status certbot.timer

# Тестовое обновление (без реального обновления)
certbot renew --dry-run
```

---

## 🆘 Решение проблем

### Сайт не открывается по домену

**Проверьте DNS:**

```bash
# На вашем компьютере
nslookup myshop.com
# Должен вернуть: YOUR_VPS_IP
```

Если IP не совпадает - DNS еще не обновился. Подождите 30-60 минут.

### Nginx показывает ошибку

**Проверьте конфигурацию:**

```bash
sudo nginx -t
sudo systemctl status nginx
sudo tail -f /var/log/nginx/shop_error.log
```

### SSL сертификат не устанавливается

**Причины:**

1. DNS еще не обновился (подождите)
2. Порт 80/443 закрыт в firewall:

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw reload
```

3. Домен не резолвится:

```bash
# Проверить на VPS
ping myshop.com
# Должен вернуть ваш IP
```

### Не открывается внутри Telegram

**Telegram требует HTTPS!** Убедитесь, что:

1. SSL сертификат установлен
2. Сайт открывается по `https://`
3. URL в BotFather обновлен на `https://`

---

## ✅ Чеклист настройки домена

- [ ] DNS A-запись добавлена (@ → YOUR_VPS_IP)
- [ ] DNS A-запись для www добавлена (www → YOUR_VPS_IP)
- [ ] Домен резолвится в IP (проверка через ping)
- [ ] Nginx настроен для домена (`setup_domain.sh`)
- [ ] Сайт открывается по HTTP
- [ ] SSL сертификат установлен (`setup_ssl.sh`)
- [ ] Сайт открывается по HTTPS
- [ ] URL в BotFather обновлен
- [ ] Веб-приложение загружается корректно

---

## 📚 Полезные команды

```bash
# Проверить статус Nginx
systemctl status nginx

# Перезапустить Nginx
systemctl restart nginx

# Проверить SSL сертификат
certbot certificates

# Обновить SSL вручную
certbot renew

# Посмотреть логи Nginx
tail -f /var/log/nginx/shop_access.log
tail -f /var/log/nginx/shop_error.log
```

---

## 💡 Советы

1. **Используйте короткий домен** для удобства пользователей
2. **Всегда используйте HTTPS** - это обязательно для Telegram
3. **Настройте автобэкапы** перед изменением конфигурации
4. **Сохраните email** - Let's Encrypt отправит уведомление перед истечением сертификата

---

**Вопросы?** Смотрите основную документацию в `DEPLOY_TO_VPS_README.md`
