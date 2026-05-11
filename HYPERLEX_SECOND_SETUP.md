# 🆕 Новая БД: hyperlex_second

**Дата создания:** 10 мая 2026  
**Статус:** ✅ ГОТОВА К ИСПОЛЬЗОВАНИЮ

---

## 📋 Информация о БД

| Параметр | Значение |
|----------|----------|
| **Имя БД** | `hyperlex_second` |
| **MongoDB URI** | `mongodb://localhost:27017/hyperlex_second` |
| **Host** | `localhost` |
| **Port** | `27017` |

---

## 👤 Админ пользователь

```
Email:       admin@hyperlex.com
Username:    admin
Password:    admin123
Role:        admin
Created:     10.05.2026, 12:29:51
```

---

## 🚀 Запуск сервера с новой БД

### Вариант 1️⃣ - Через файл .env.second

```bash
cd server

# Скопировать .env.second в .env
cp .env.second .env

# Запустить сервер
npm start
```

**Результат:**
```
✓ Connected to MongoDB (hyperlex_second)
Server listening on port 3002
```

### Вариант 2️⃣ - Через переменную окружения

```bash
cd server
MONGODB_URI=mongodb://localhost:27017/hyperlex_second npm start
```

### Вариант 3️⃣ - Обновить .env вручную

Отредактировать `server/.env`:

```env
# MongoDB Connection
MONGODB_URI=mongodb://localhost:27017/hyperlex_second

# Server Port (опционально, можно изменить)
PORT=3002
```

Затем запустить:
```bash
cd server
npm start
```

---

## 🔐 Логин в приложение

### Email
```
admin@hyperlex.com
```

### Password
```
admin123
```

---

## 📊 Что содержит новая БД

Пока только **1 пользователь**:
- Admin: `admin@hyperlex.com`

Можно добавлять:
- ✅ Новые пользователей
- ✅ Слова и иерархии
- ✅ Данные через API

---

## 🔗 MongoDB контейнер

### Запущенный контейнер

```bash
# Проверить статус
docker ps -a | grep hyperlex-mongodb

# Получить информацию
docker ps --filter "name=hyperlex-mongodb"
```

**Output:**
```
CONTAINER ID   IMAGE          COMMAND     STATUS
63dcf253f825   mongo:latest   mongod...   Up 2 minutes
```

### Управление MongoDB

**Остановить:**
```bash
docker stop hyperlex-mongodb
```

**Запустить:**
```bash
docker start hyperlex-mongodb
```

**Перезагрузить:**
```bash
docker restart hyperlex-mongodb
```

**Удалить:**
```bash
docker rm hyperlex-mongodb
```

---

## 🔌 MongoDB Express (опционально)

Для управления БД через веб интерфейс используйте MongoDB Express:

### Запуск

```bash
docker run -d \
  --name mongo-express \
  -p 8081:8081 \
  -e ME_CONFIG_MONGODB_URL="mongodb://localhost:27017" \
  mongo-express:latest
```

### Доступ

```
URL: http://localhost:8081
```

### Остановка

```bash
docker stop mongo-express
docker rm mongo-express
```

---

## 📁 Файлы конфигурации

### `.env.second` (новый файл конфигурации)

```env
# MongoDB Connection для hyperlex_second
MONGODB_URI=mongodb://localhost:27017/hyperlex_second

# JWT Secret
JWT_SECRET=hyperlex-secret-key-2024

# Server Port
PORT=3002

# Environment
NODE_ENV=development

# OpenAI (опционально)
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o
```

**Расположение:**
```
server/.env.second
```

### `.env` (текущий файл)

```env
# MongoDB Connection для hyperlex (старая БД)
MONGODB_URI=mongodb://localhost:27017/hyperlex

# ... остальная конфигурация
```

---

## 🔄 Переключение между БД

### Использовать старую БД (hyperlex):
```bash
cd server
npm start  # Использует .env по умолчанию
```

### Использовать новую БД (hyperlex_second):

**Вариант A:**
```bash
cd server
cp .env.second .env
npm start
```

**Вариант B:**
```bash
cd server
MONGODB_URI=mongodb://localhost:27017/hyperlex_second npm start
```

---

## ✅ Чек-лист

- [x] БД `hyperlex_second` создана
- [x] MongoDB контейнер запущен
- [x] Админ пользователь создан
- [x] Файл `.env.second` готов
- [x] Docker-compose конфигурация готова
- [ ] Сервер запущен (см. инструкции выше)
- [ ] Проверено подключение
- [ ] Админ залогинен

---

## 🐛 Если что-то не работает

### MongoDB контейнер упал

```bash
# Проверить логи
docker logs hyperlex-mongodb

# Перезагрузить
docker restart hyperlex-mongodb

# Если не помогает, удалить и переоздать
docker rm -f hyperlex-mongodb
docker run -d -p 27017:27017 --name hyperlex-mongodb mongo:latest
```

### Ошибка подключения "ECONNREFUSED"

```bash
# Проверить, запущена ли MongoDB
docker ps | grep mongodb

# Если нет, запустить
docker start hyperlex-mongodb
# или
docker run -d -p 27017:27017 --name hyperlex-mongodb mongo:latest
```

### Ошибка при импорте иерархии

Убедитесь, что используете правильную БД:
```bash
# Проверить текущую URI
echo $MONGODB_URI

# Должна быть
mongodb://localhost:27017/hyperlex_second
```

---

## 📞 Дальнейшие шаги

1. ✅ Инициализация БД - **ГОТОВО**
2. 📥 Импортировать иерархию (`HIERARCHY_GUIDE.md`)
3. 🚀 Запустить сервер
4. 🌐 Подключить фронтенд (port 3002)
5. 🔐 Логинитесь с admin@hyperlex.com

---

## 📝 Важно

- **БД hyperlex_second** полностью отделена от старой **hyperlex**
- **Админ пароль** захеширован в БД (не хранится в открытом виде)
- **MongoDB контейнер** работает на порту **27017** (стандартный)
- **Сервер** может работать на порту **3002** (см. .env.second)

---

## ✨ Готово!

Новая БД полностью инициализирована и готова к использованию. 🎉

**Дата:** 10 мая 2026 г.
