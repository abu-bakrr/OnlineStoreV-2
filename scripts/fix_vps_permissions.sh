#!/bin/bash

# ============================================================================
# СКРИПТ ИСПРАВЛЕНИЯ ПРАВ ДОСТУПА НА VPS
# Запускать под root: sudo bash scripts/fix_vps_permissions.sh
# ============================================================================

APP_USER="shopapp"
APP_DIR="/home/shopapp/app"

echo "🔧 Исправление прав доступа для $APP_USER..."

# 1. Удаляем папку dist, если она принадлежит root
if [ -d "$APP_DIR/dist" ]; then
    echo "🧹 Удаление старой папки dist..."
    rm -rf "$APP_DIR/dist"
fi

# 2. Устанавливаем владельца на всю папку проекта
echo "👤 Смена владельца на $APP_USER..."
chown -R $APP_USER:$APP_USER "$APP_DIR"

# 3. Устанавливаем права на папки (755) и файлы (644)
echo "📂 Настройка прав доступа..."
find "$APP_DIR" -type d -exec chmod 755 {} +
find "$APP_DIR" -type f -exec chmod 644 {} +

# 4. Делаем скрипты исполняемыми
chmod +x "$APP_DIR/scripts/"*.sh 2>/dev/null || true

# 5. Исправляем права на саму домашнюю папку
chmod 755 "/home/$APP_USER"

echo "✅ Все права исправлены!"
echo "⚠️  ВАЖНО: Всегда запускайте npm и git под пользователем $APP_USER:"
echo "   su - $APP_USER"
echo "   cd app && npm run build"
