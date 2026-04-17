# 📋 Быстрый старт для деплоя на production

## ✅ Что уже готово в репозитории

- ✅ Backup БД: `server/data/hyperlex.archive`
- ✅ Docker-compose конфиг: `docker-compose.yml`
- ✅ Dockerfiles для server и client
- ✅ Скрипт seed для загрузки данных: `server/scripts/seed.js`
- ✅ Примеры .env файлов: `.env.example`

## 🚀 Деплой на свой сервер (https://huperlex.meyram.kz)

### Шаг 1: Подготовить сервер
```bash
ssh user@huperlex.meyram.kz

# Установить Docker и Docker Compose
sudo apt-get update
sudo apt-get install docker.io docker-compose -y
sudo usermod -aG docker $USER
```

### Шаг 2: Клонировать проект
```bash
git clone <repository-url> hyperlex
cd hyperlex
```

### Шаг 3: Создать .env файлы
```bash
cp server/.env.example server/.env
cp client/.env.example client/.env

# Отредактировать сервер/.env с нужными значениями
nano server/.env
nano client/.env
```

### Шаг 4: Запустить всё через Docker
```bash
docker-compose up -d
```

Это запустит:
- 🗄️ MongoDB на порту 27017
- 🔧 Backend на порту 3001
- 🌐 Frontend на порту 3002

### Шаг 5: Восстановить БД
```bash
# Вариант 1: Из backup archive (быстро)
docker exec hyperlex-mongo mongorestore --uri mongodb://localhost:27017 --archive=/data/hyperlex.archive

# Вариант 2: Из JSON файлов (если archive не работает)
docker exec hyperlex-server npm run seed
```

### Шаг 6: Настроить Nginx для HTTPS

```bash
# Установить Certbot
sudo apt-get install certbot python3-certbot-nginx -y

# Получить SSL сертификат
sudo certbot certonly --standalone -d huperlex.meyram.kz

# Конфиг Nginx (/etc/nginx/sites-available/hyperlex)
```

## 📚 Документация

- 📖 [Полный гайд деплоя](DEPLOYMENT_GUIDE.md)
- 🔧 [README проекта](README.md)
- 📝 [Build Report](BUILD_REPORT.md)

## 🆘 Быстрые команды

```bash
# Логи
docker-compose logs -f server
docker-compose logs -f client
docker-compose logs -f mongo

# Перезагрузить
docker-compose restart

# Остановить
docker-compose down

# Очистить и начать заново
docker-compose down -v
docker-compose up -d
docker exec hyperlex-mongo mongorestore --uri mongodb://localhost:27017 --archive=/data/hyperlex.archive
```

## ✨ После деплоя

- 🌐 Откройте https://huperlex.meyram.kz
- 📝 Регистрация: https://huperlex.meyram.kz/register
- 🔑 Логин: https://huperlex.meyram.kz/login
- 👨‍💼 Admin панель: https://huperlex.meyram.kz/admin

**Админ по умолчанию:**
- Email: `admin@hyperlex.com`
- Пароль: `admin123456` (ИЗМЕНИ после первого входа!)
