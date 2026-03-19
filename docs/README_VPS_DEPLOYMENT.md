# 🚀 Развертывание приложения на VPS

> **Ваш проект готов к развертыванию на VPS Ubuntu 22.04!**

---

## 🎯 Начните здесь

### У вас есть GitHub репозиторий ✅

**Отлично!** Прочитайте: **[START_HERE_GITHUB.md](START_HERE_GITHUB.md)**

Развертывание займет **2 команды** и 5 минут!

---

## 📚 Вся документация

| Файл                                                              | Описание            | Для кого                  |
| ----------------------------------------------------------------- | ------------------- | ------------------------- |
| 🌟 **[START_HERE_GITHUB.md](START_HERE_GITHUB.md)**               | **НАЧНИТЕ ОТСЮДА!** | Все                       |
| 📋 **[GITHUB_DEPLOY_CHEATSHEET.md](GITHUB_DEPLOY_CHEATSHEET.md)** | Быстрая шпаргалка   | Для ежедневной работы     |
| 🚀 **[QUICK_START_RU.md](QUICK_START_RU.md)**                     | Быстрый старт       | Для первого запуска       |
| 🐙 **[DEPLOY_FROM_GITHUB.md](DEPLOY_FROM_GITHUB.md)**             | Работа с GitHub     | Детальная инструкция      |
| 📚 **[VPS_DEPLOY_GUIDE.md](VPS_DEPLOY_GUIDE.md)**                 | Полное руководство  | Для углубленного изучения |
| 📖 **[DEPLOY_TO_VPS_README.md](DEPLOY_TO_VPS_README.md)**         | Справочник команд   | Решение проблем           |

---

## 🛠️ Скрипты автоматизации

| Скрипт          | Назначение                                |
| --------------- | ----------------------------------------- |
| `deploy_vps.sh` | Автоматическая установка всего приложения |
| `update_vps.sh` | Обновление приложения после изменений     |
| `backup_db.sh`  | Резервное копирование базы данных         |
| `restore_db.sh` | Восстановление базы данных                |

Все скрипты полностью автоматические!

---

## ⚡ Быстрое развертывание (2 команды)

```bash
# 1. Подключитесь к VPS и клонируйте
ssh root@YOUR_VPS_IP
cd /opt && git clone https://github.com/ваш-username/ваш-репозиторий.git shop-deploy

# 2. Запустите установку
cd shop-deploy && chmod +x deploy_vps.sh && ./deploy_vps.sh
```

**Замените** `ваш-username/ваш-репозиторий` на ваш GitHub URL!

После завершения откройте: **http://YOUR_VPS_IP**

---

## 🔄 Обновление после изменений

```bash
# На компьютере
git push

# На VPS
ssh root@YOUR_VPS_IP
cd /home/shopapp/app
sudo -u shopapp git pull && sudo ./update_vps.sh
```

---

## 📦 Что будет установлено

✅ **PostgreSQL** - база данных (локально на VPS)  
✅ **Python 3 + Flask + Gunicorn** - backend  
✅ **Node.js + React** - frontend  
✅ **Nginx** - веб-сервер  
✅ **Systemd** - автозапуск приложения  
✅ **UFW Firewall** - безопасность

Всё автоматически!

---

## 🎓 Рекомендуемый порядок действий

1. Прочитайте **[START_HERE_GITHUB.md](START_HERE_GITHUB.md)**
2. Закоммитьте все файлы в GitHub (если еще не сделали)
3. Выполните 2 команды из раздела "Быстрое развертывание" выше
4. Откройте приложение в браузере
5. Сохраните **[GITHUB_DEPLOY_CHEATSHEET.md](GITHUB_DEPLOY_CHEATSHEET.md)** под рукой

---

## 🔐 Приватный репозиторий?

Создайте SSH ключ и добавьте в GitHub:

```bash
ssh root@YOUR_VPS_IP
ssh-keygen -t ed25519 -C "vps@shop"
cat ~/.ssh/id_ed25519.pub
# Добавьте в GitHub → Settings → SSH and GPG keys
```

Подробнее в **[DEPLOY_FROM_GITHUB.md](DEPLOY_FROM_GITHUB.md)**

---

## 🆘 Нужна помощь?

| Проблема        | Решение                                                                |
| --------------- | ---------------------------------------------------------------------- |
| Как развернуть? | [START_HERE_GITHUB.md](START_HERE_GITHUB.md)                           |
| Как обновлять?  | [GITHUB_DEPLOY_CHEATSHEET.md](GITHUB_DEPLOY_CHEATSHEET.md)             |
| Не запускается  | [DEPLOY_TO_VPS_README.md](DEPLOY_TO_VPS_README.md) → "Решение проблем" |
| Нужны детали    | [VPS_DEPLOY_GUIDE.md](VPS_DEPLOY_GUIDE.md)                             |

---

## 💡 Полезные команды

```bash
# Проверить статус
systemctl status shop-app

# Логи приложения
journalctl -u shop-app -f

# Резервная копия
cd /home/shopapp/app && sudo ./backup_db.sh

# Перезапустить
systemctl restart shop-app
```

---

## 🌐 После развертывания

Ваше приложение будет доступно:

- **HTTP**: http://YOUR_VPS_IP
- **Telegram**: Настройте URL веб-приложения в BotFather, если планируете интегрировать сайт в бота

Для SSL (HTTPS) см. **[VPS_DEPLOY_GUIDE.md](VPS_DEPLOY_GUIDE.md)** → "Настройка SSL"

---

## 📊 Архитектура

```
GitHub Repository
       ↓ (git clone/pull)
   VPS Ubuntu 22.04
       ↓
PostgreSQL (local) ← Flask/Gunicorn → Nginx
                                        ↓
                                   Internet
```

---

## ✅ Готовы начать?

👉 **Читайте [START_HERE_GITHUB.md](START_HERE_GITHUB.md)** 👈

---

**Вопросы?** Откройте соответствующий MD файл из таблицы выше! 📚
