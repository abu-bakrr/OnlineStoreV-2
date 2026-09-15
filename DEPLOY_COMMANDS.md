# Команды для развертывания (Deployment)

## 1. Отправка изменений на GitHub (Локально)

Выполните эти команды в терминале IDE:

```bash
# Добавляем все измененные файлы
git add .

# Создаем коммит с описанием изменений
git commit -m "Fix AI bot order memory and context"

# Отправляем на GitHub (ветка main или master)
git push
```

## 2. Обновление на VPS

Подключитесь к VPS и выполните:

```bash
# Переходим в папку бота
cd /path/to/MiniTaskerBot3

# Скачиваем обновления
git pull

# Запуск обновления приложения
sudo ./scripts/update_vps.sh

# ЗАЩИТА СЕРВЕРА ОТ ХАКЕРОВ, SLOWLORIS И DDoS:
sudo ./scripts/security_vps.sh
```
