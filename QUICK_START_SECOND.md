# ⚡ БЫСТРЫЙ ГАЙД: Запуск hyperlex_second

## 🎯 За 3 минуты

### 1. Убедитесь, что MongoDB запущена

```bash
# Проверить
docker ps | grep mongodb

# Если нет, запустить
docker run -d -p 27017:27017 --name hyperlex-mongodb mongo:latest
```

### 2. Используйте .env.second при запуске

```bash
cd server
cp .env.second .env
npm start
```

**Или через переменную:**
```bash
cd server
MONGODB_URI=mongodb://localhost:27017/hyperlex_second npm start
```

### 3. Логинитесь

```
Email:    admin@hyperlex.com
Password: admin123
```

---

## 📋 Параметры БД

| Параметр | Значение |
|----------|----------|
| БД | `hyperlex_second` |
| Адрес | `localhost:27017` |
| Админ email | `admin@hyperlex.com` |
| Пароль | `admin123` |
| Порт сервера | `3002` |

---

## 🚀 Просто копипастьте эту команду:

```bash
cd "/home/r1ppa/Desktop/New Folder/hyperlex demo/server" && \
cp .env.second .env && \
npm start
```

---

## ✅ Готово! Система запущена 🎉
