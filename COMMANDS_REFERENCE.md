# 📚 СПРАВОЧНИК КОМАНД

## 🚀 БЫСТРЫЙ СТАРТ

### Запустить новую БД (hyperlex_second)
```bash
cd "/home/r1ppa/Desktop/New Folder/hyperlex demo/server" && \
cp .env.second .env && \
npm start
```

### Проверить MongoDB
```bash
docker ps | grep hyperlex-mongodb
```

### Посмотреть логи MongoDB
```bash
docker logs hyperlex-mongodb
```

---

## 📋 ИНФОРМАЦИЯ О БД

| БД | URI | Порт | Админ |
|---|---|---|---|
| **Старая** | `mongodb://localhost:27017/hyperlex` | 3001 | - |
| **Новая** | `mongodb://localhost:27017/hyperlex_second` | 3002 | admin@hyperlex.com / admin123 |

---

## 🔧 УПРАВЛЕНИЕ MONGODB

### Запустить MongoDB (если не запущена)
```bash
docker run -d -p 27017:27017 --name hyperlex-mongodb mongo:latest
```

### Остановить MongoDB
```bash
docker stop hyperlex-mongodb
```

### Перезагрузить MongoDB
```bash
docker restart hyperlex-mongodb
```

### Удалить контейнер MongoDB
```bash
docker rm -f hyperlex-mongodb
```

---

## 🗄️ УПРАВЛЕНИЕ СЕРВЕРОМ

### Запустить сервер (старая БД)
```bash
cd "/home/r1ppa/Desktop/New Folder/hyperlex demo/server"
npm start
```

### Запустить сервер (новая БД)
```bash
cd "/home/r1ppa/Desktop/New Folder/hyperlex demo/server"
MONGODB_URI=mongodb://localhost:27017/hyperlex_second npm start
```

### Запустить фронтенд
```bash
cd "/home/r1ppa/Desktop/New Folder/hyperlex demo/client"
npm start
```

---

## 📥 ИМПОРТ ИЕРАРХИИ

### Импортировать пример
```bash
cd "/home/r1ppa/Desktop/New Folder/hyperlex demo/server"
node scripts/import_hierarchy.js ./data/hierarchy_example.json
```

### Инициализировать новую БД с админом
```bash
cd "/home/r1ppa/Desktop/New Folder/hyperlex demo/server"
node scripts/init_hyperlex_second.js
```

### Тестировать иерархию
```bash
cd "/home/r1ppa/Desktop/New Folder/hyperlex demo/server"
node scripts/test_hierarchy.js
```

---

## 🔐 ЛОГИН

### Старая БД (hyperlex)
```
Email: (нужно создать)
Password: (нужно создать)
```

### Новая БД (hyperlex_second)
```
Email: admin@hyperlex.com
Password: admin123
```

---

## 📁 ВАЖНЫЕ ФАЙЛЫ

### Конфигурация
- `server/.env` - текущая конфигурация (старая БД)
- `server/.env.second` - конфигурация для новой БД

### Скрипты
- `server/scripts/import_hierarchy.js` - импорт JSON
- `server/scripts/init_hyperlex_second.js` - инициализация БД
- `server/scripts/test_hierarchy.js` - тестирование

### Данные
- `server/data/hierarchy_example.json` - пример иерархии (18 слов)

### Документация
- `HIERARCHY_GUIDE.md` - полная документация иерархии
- `SETUP_HIERARCHY.md` - быстрый старт иерархии
- `HYPERLEX_SECOND_SETUP.md` - полная документация новой БД
- `QUICK_START_SECOND.md` - быстрый старт новой БД
- `HYPERLEX_SECOND_SUMMARY.md` - резюме новой БД

---

## 🌐 WEB ИНТЕРФЕЙСЫ

### Фронтенд (React)
```
URL: http://localhost:3000
Порт: 3000
```

### Сервер (Express/Node)
- Старая БД: `http://localhost:3001`
- Новая БД: `http://localhost:3002`

### MongoDB Express (опционально)
```
URL: http://localhost:8081
Порт: 8081
```

**Запуск:**
```bash
docker run -d --name mongo-express -p 8081:8081 \
  -e ME_CONFIG_MONGODB_URL="mongodb://localhost:27017" \
  mongo-express:latest
```

---

## 🐛 РЕШЕНИЕ ПРОБЛЕМ

### MongoDB не подключается
```bash
# Проверить, запущена ли
docker ps | grep mongodb

# Если нет, запустить
docker run -d -p 27017:27017 --name hyperlex-mongodb mongo:latest

# Проверить логи
docker logs hyperlex-mongodb
```

### Ошибка ECONNREFUSED
```bash
# MongoDB не запущена, запустить:
docker start hyperlex-mongodb
# или
docker run -d -p 27017:27017 --name hyperlex-mongodb mongo:latest
```

### Порт 27017 занят
```bash
# Найти процесс на этом порту
lsof -i :27017

# Остановить контейнер
docker stop hyperlex-mongodb
docker rm -f hyperlex-mongodb

# Запустить заново
docker run -d -p 27017:27017 --name hyperlex-mongodb mongo:latest
```

### Адрес уже используется (порт 3001/3002)
```bash
# Найти процесс
lsof -i :3001  # или :3002

# Остановить Node процесс
kill -9 <PID>

# или просто запустить на другом порту
PORT=3003 npm start
```

---

## 📝 ПЕРЕКЛЮЧЕНИЕ МЕЖДУ БД

### На новую БД
```bash
cd server
cp .env.second .env
npm start
```

### На старую БД
```bash
cd server
# Восстановить оригинальный .env если в git
git checkout .env
# или вручную изменить:
# MONGODB_URI=mongodb://localhost:27017/hyperlex
npm start
```

---

## 💾 РЕЗЕРВНАЯ КОПИЯ БД

### Экспорт (dump)
```bash
docker exec hyperlex-mongodb mongodump --out /backup
```

### Импорт (restore)
```bash
docker exec hyperlex-mongodb mongorestore /backup
```

---

## 📊 СТАТИСТИКА

### Количество пользователей в hyperlex_second
```bash
# Через MongoDB Express: http://localhost:8081
# Или через shell:
docker exec hyperlex-mongodb mongo hyperlex_second
> db.users.count()
```

### Количество слов в иерархии
```bash
docker exec hyperlex-mongodb mongo hyperlex_second
> db.words.count()
```

---

## ✅ ЧЕКЛИСТ ИСПОЛЬЗОВАНИЯ

- [ ] MongoDB запущена
- [ ] .env.second скопирован в .env
- [ ] Сервер запущен (`npm start`)
- [ ] Фронтенд запущен
- [ ] Залогинены с admin@hyperlex.com
- [ ] Данные импортированы
- [ ] Иерархия видна в приложении

---

## 🎯 ОСНОВНЫЕ ОПЕРАЦИИ

| Операция | Команда |
|----------|---------|
| Запустить БД | `docker run -d -p 27017:27017 --name hyperlex-mongodb mongo:latest` |
| Запустить сервер | `cd server && npm start` |
| Импортировать | `node scripts/import_hierarchy.js <file>` |
| Тестировать | `node scripts/test_hierarchy.js` |
| Логин | email: admin@hyperlex.com, пароль: admin123 |

---

**Последнее обновление:** 10 мая 2026 г.
