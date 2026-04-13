# 🔤 HyperLex - Платформа анализа гиперонимо-гипонимических отношений

Интерактивная платформа для визуализации и анализа семантических отношений между словами в русском и узбекском языках.

## 🎯 Основные возможности

- **Поиск слов** - быстрый поиск с фильтром по языкам
- **Визуализация графов** - интерактивные D3.js деревья гиперонимов/гипонимов
- **Сравнение языков** - параллельное отображение РУ↔УЗ отношений
- **Панель администратора** - управление словами и данными
- **REST API** - полнофункциональное API для интеграции

## 📦 Технологический стек

**Frontend:**
- React 18 + JSX
- Vite (быстрая сборка)
- Axios (HTTP запросы)
- D3.js (визуализация графов)
- CSS3 (адаптивный дизайн)

**Backend:**
- Node.js + Express.js
- MongoDB + Mongoose ODM
- JWT аутентификация
- bcryptjs (хеширование паролей)

**DevOps:**
- Docker (для MongoDB)
- Git (версионирование)
- npm (пакет менеджер)

## 🚀 Быстрый старт

### Требования
- Node.js 18+ 
- npm 8+
- MongoDB (или Docker)

### Установка

```bash
# 1. Клонировать репозиторий
git clone https://github.com/your-repo/hyperlex.git
cd hyperlex\ demo

# 2. Установить backend зависимости
cd server
npm install
cp .env.example .env  # Скопировать и настроить

# 3. Установить frontend зависимости
cd ../client
npm install

# 4. Запустить MongoDB (если используешь Docker)
docker run -d --name mongodb -p 27017:27017 mongo:latest
```

### Development

```bash
# Terminal 1: Backend (порт 3001)
cd server
npm start

# Terminal 2: Frontend (порт 3000)
cd client
npm run dev
```

Открыть браузер: **http://localhost:3000**

### Production Build

```bash
# Собрать frontend
cd client
npm run build

# Backend запускается с NODE_ENV=production
cd ../server
NODE_ENV=production npm start
```

## 📚 API Documentation

### Base URL
```
http://localhost:3001/api
```

### Эндпоинты

#### 🔍 Поиск
```bash
GET /search?q=query&lang=ru
```
Поиск слов с опциональной фильтрацией по языку (ru, uz, both)

**Response:**
```json
{
  "success": true,
  "count": 1,
  "results": [{
    "_id": "ru_001",
    "word": "собака",
    "lang": "lang_ru",
    "definition": "..."
  }]
}
```

#### 📖 Получение слова
```bash
GET /word/ru_001
```
Загружает слово с связанным переводом на другой язык

#### 🌳 Дерево отношений
```bash
GET /word/ru_001/tree?depth=3
```
Загружает дерево гиперонимов и гипонимов

#### ⚔️ Сравнение
```bash
GET /compare?ru=ru_001&uz=uz_001
```
Сравнивает два слова из разных языков, возвращает оба дерева

#### 🔐 Аутентификация
```bash
POST /auth/login
Content-Type: application/json

{
  "email": "admin@hyperlex.com",
  "password": "admin123"
}
```

**Response:**
```json
{
  "success": true,
  "token": "eyJhbGc...",
  "user": {...}
}
```

#### 🛠️ Администрирование (требует токен)
```bash
# Создать слово
POST /admin/words
Authorization: Bearer <token>
Content-Type: application/json

{
  "_id": "ru_025",
  "word": "новое слово",
  "lang": "lang_ru",
  "definition": "...",
  "hypernyms": ["ru_001"],
  "hyponyms": [],
  "related": { "uz": "uz_025", "ru": null }
}

# Изменить слово
PUT /admin/words/ru_001

# Удалить слово
DELETE /admin/words/ru_001
```

## 📂 Структура проекта

```
hyperlex demo/
├── client/                    # React фронтенд
│   ├── src/
│   │   ├── components/       # React компоненты
│   │   ├── pages/            # Страницы приложения
│   │   ├── services/         # API клиент
│   │   ├── utils/            # Утилиты (графы, деревья)
│   │   └── App.jsx
│   ├── package.json
│   ├── vite.config.js
│   └── dist/                 # Production build
│
├── server/                    # Node.js + Express бэкенд
│   ├── routes/               # API маршруты
│   ├── controllers/          # Бизнес-логика
│   ├── models/               # Mongoose схемы
│   ├── middleware/           # Express middleware
│   ├── config/               # Конфигурация БД
│   ├── scripts/              # Сервисные скрипты (seed)
│   ├── server.js             # Точка входа
│   ├── package.json
│   └── .env
│
├── LICENSE
└── README.md
```

## 🔄 Workflow

### Выпуск новых слов
```bash
# 1. Добавить в JSON файл (server/data/russian.json или uzbek.json)
# 2. Запустить seed скрипт
cd server
node scripts/seed.js

# 3. Проверить загрузку
curl http://localhost:3001/api/stats
```

### Добавление через админ панель
1. Открыть http://localhost:3000/admin
2. Раздел "Добавить слово"
3. Заполнить форму
4. Нажать "Сохранить"

## 🐛 Troubleshooting

**MongoDB не подключается**
```bash
# Проверить что MongoDB запущена
docker ps | grep mongodb

# Если нет - запустить
docker start mongodb
```

**Frontend не видит API**
```bash
# Убедиться что backend запущен на 3001
curl http://localhost:3001/api/stats

# В браузере проверить консоль (F12) на CORS ошибки
```

**Проблемы с UTF-8**
```bash
# Убедиться что терминал поддерживает UTF-8
export LANG=en_US.UTF-8
```

## 📈 Performance

- Frontend bundle (gzip): **104 KB** ✅
- API response time: **<100ms** ✅
- Database queries на индексах: **O(1) - O(log n)** ✅

## 🔐 Security

- JWT tokens с 7-дневным expiration
- Пароли хешированы bcryptjs
- CORS конфигурация
- Role-based access control (RBAC)
- Validation на frontend и backend

## 📝 Лицензия

MIT License - смотрите [LICENSE](LICENSE)

## 👨‍💻 Contributing

Fork → Branch → Commit → Push → Pull Request

## 📞 Support

Questions? Issues? [Создайте issue](https://github.com/your-repo/hyperlex/issues)

---

**Версия**: 1.0.0  
**Последнее обновление**: 13 апреля 2026 г.  
**Статус**: ✅ Production Ready
