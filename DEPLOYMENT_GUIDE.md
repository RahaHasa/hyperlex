# 🚀 Деплой на Production сервер

## Требования
- Node.js 18+
- Docker & Docker Compose
- Git

## Инструкции для развёртывания на https://huperlex.meyram.kz/

### 1. Клонировать репозиторий на сервер
```bash
git clone <repository-url> hyperlex
cd hyperlex
```

### 2. Установить зависимости
```bash
# Backend
cd server
npm install
cd ..

# Frontend
cd client
npm install
cd ..
```

### 3. Запустить MongoDB в Docker
```bash
docker-compose up -d
```

### 4. Восстановить БД из backup
```bash
docker exec hyperlex-mongo mongorestore --uri mongodb://localhost:27017/hyperlex --archive=/data/hyperlex.archive
```

Или если archive не работает:
```bash
cd server
npm run seed
cd ..
```

### 5. Настроить .env файлы

**server/.env**
```
PORT=3001
MONGODB_URI=mongodb://mongo:27017/hyperlex
JWT_SECRET=your_super_secret_key_here
NODE_ENV=production
```

**client/.env**
```
VITE_API_URL=https://api.huperlex.meyram.kz
```

### 6. Запустить сервер
```bash
cd server
npm start
cd ..
```

### 7. Запустить фронтенд
```bash
cd client
npm run build
npm run dev
# или используй PM2 / Nginx для production
cd ..
```

### 8. Настроить Nginx (для production)
```nginx
server {
    listen 80;
    server_name huperlex.meyram.kz;
    
    location / {
        proxy_pass http://localhost:3002;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    
    location /api {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
    }
}
```

## Восстановление БД
Если нужно восстановить БД:
```bash
# Из archive
docker exec hyperlex-mongo mongorestore --uri mongodb://localhost:27017 --archive=/data/hyperlex.archive

# Или из JSON файлов
cd server && npm run seed && cd ..
```

## Troubleshooting

### MongoDB не запускается
```bash
docker logs hyperlex-mongo
docker restart hyperlex-mongo
```

### Порты заняты
```bash
# Проверить что занимает порт
lsof -i :3001
lsof -i :3002
lsof -i :27017
```

### Очистить всё и начать заново
```bash
docker-compose down -v
docker-compose up -d
npm run seed
```
