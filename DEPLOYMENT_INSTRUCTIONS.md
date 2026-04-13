# 🚀 DEPLOYMENT GUIDE - Гайд по запуску на сервер

## Вариант 1: DigitalOcean (РЕКОМЕНДУЕТСЯ)

### Шаг 1: Создать Droplet
```
- OS: Ubuntu 22.04 LTS
- RAM: 2GB (минимум для production)
- Регион: Frankfurt (Европа)
```

### Шаг 2: Подключиться и подготовить
```bash
ssh root@your_droplet_ip

# Обновить систему
apt update && apt upgrade -y

# Установить Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
apt install -y nodejs

# Установить MongoDB через Docker
apt install -y docker.io
docker run -d \
  --name mongodb \
  --restart always \
  -p 27017:27017 \
  -v mongodb_data:/data/db \
  mongo:latest

# Установить nginx
apt install -y nginx
```

### Шаг 3: Развернуть приложение
```bash
# Клонировать репозиторий
cd /opt
git clone https://github.com/your-repo/hyperlex.git
cd hyperlex\ demo

# Backend
cd server
npm install
cp .env.example .env
# Редактировать .env (поставить production переменные)
nano .env

# Frontend build
cd ../client
npm install
npm run build
```

### Шаг 4: Настроить nginx
```bash
cat > /etc/nginx/sites-available/hyperlex << 'EOF'
server {
    listen 80;
    server_name your-domain.com;

    # Перенаправление на HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    # Frontend
    root /opt/hyperlex\ demo/client/dist;
    index index.html;

    location / {
        try_files $uri /index.html;
    }

    # API proxy
    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

# Включить сайт
ln -s /etc/nginx/sites-available/hyperlex /etc/nginx/sites-enabled/
rm /etc/nginx/sites-enabled/default

# Проверить конфигурацию
nginx -t

# Перезагрузить nginx
systemctl restart nginx
```

### Шаг 5: Установить SSL с Let's Encrypt
```bash
apt install -y certbot python3-certbot-nginx

certbot certonly --nginx -d your-domain.com

# Автоматическое продление
systemctl enable certbot.timer
```

### Шаг 6: Запустить backend как сервис
```bash
cat > /etc/systemd/system/hyperlex-api.service << 'EOF'
[Unit]
Description=HyperLex API Server
After=network.target mongodb.service

[Service]
Type=simple
User=nobody
WorkingDirectory=/opt/hyperlex\ demo/server
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
Environment="NODE_ENV=production"

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable hyperlex-api
systemctl start hyperlex-api
```

### Проверить статус
```bash
systemctl status hyperlex-api
curl https://your-domain.com/api/stats
```

---

## Вариант 2: Heroku

### Шаг 1: Создать два приложения
```bash
heroku create hyperlex-api      # Backend
heroku create hyperlex-web      # Frontend
```

### Шаг 2: Добавить MongoDB Atlas
```bash
# В Heroku Dashboard → Resources → Add-ons → MongoDB Atlas
# Скопировать connection string
```

### Шаг 3: Развернуть backend
```bash
cd server
heroku login
heroku git:remote -a hyperlex-api

# Установить переменные окружения
heroku config:set MONGODB_URI=your_connection_string
heroku config:set JWT_SECRET=your_secret_key
heroku config:set NODE_ENV=production

# Развернуть
git push heroku main
```

### Шаг 4: Развернуть frontend
```bash
cd ../client
heroku git:remote -a hyperlex-web

# Создать Procfile
echo "web: npx serve -s dist" > Procfile

# Build script в package.json уже есть
git push heroku main
```

---

## Вариант 3: Render.com (САМЫЙ ПРОСТОЙ)

### Backend
1. Connect GitHub репозиторий
2. Create New Service → Web Service
3. Build command: `npm install && npm run build` (или ничего)
4. Start command: `npm start`
5. Add environment variables из .env
6. Deploy

### Frontend
1. Create New Service → Static Site
2. Build command: `cd client && npm install && npm run build`
3. Publish directory: `client/dist`
4. Deploy

---

## Вариант 4: AWS EC2 + Docker (ПРОФЕССИОНАЛЬНЫЙ)

### Создать docker-compose.yml
```yaml
version: '3.8'

services:
  mongodb:
    image: mongo:latest
    ports:
      - "27017:27017"
    volumes:
      - mongodb_data:/data/db
    environment:
      MONGO_INITDB_DATABASE: hyperlex

  api:
    build:
      context: ./server
    ports:
      - "3001:3001"
    environment:
      MONGODB_URI: mongodb://mongodb:27017/hyperlex
      NODE_ENV: production
    depends_on:
      - mongodb

  web:
    build:
      context: ./client
      dockerfile: Dockerfile.prod
    ports:
      - "80:80"
    depends_on:
      - api

volumes:
  mongodb_data:
```

### Запустить
```bash
docker-compose up -d
```

---

## 🔍 Мониторинг и Логи

### Просмотр логов API
```bash
# На DigitalOcean
journalctl -u hyperlex-api -f

# На Heroku
heroku logs -a hyperlex-api --tail

# На Docker
docker logs -f hyperlex-api
```

### Мониторинг
- **Uptime**: Uptimerobot.com (бесплатно)
- **Analytics**: Google Analytics / Plausible
- **Errors**: Sentry.io
- **Logs**: LogRocket / Papertrail

---

## 🔒 Security Checklist

- [ ] HTTPS/SSL сертификат настроен
- [ ] JWT_SECRET уникален (генерируй: `openssl rand -base64 32`)
- [ ] MongoDB требует аутентификацию
- [ ] CORS настроена на конкретный домен
- [ ] Rate limiting на API endpoints
- [ ] Firewall блокирует ненужные порты
- [ ] Регулярные backup MongoDB
- [ ] GitHub SSH ключи добавлены

---

## 📊 Рекомендуемые параметры

| Параметр | Development | Production |
|----------|------------|------------|
| Node.js | 18+ | 20 LTS |
| MongoDB | Local | Atlas/Managed |
| Memory | 512MB | 2GB+ |
| CPU | 1 vCPU | 2 vCPU |
| Disk | 5GB | 20GB+ |
| Bandwidth | ∞ | 2TB+ |
| SSL | Self-signed | Let's Encrypt |
| Backups | Manual | Automatic |

---

## 💰 Примерные затраты в месяц

| Хостинг | Стоимость | Notes |
|---------|----------|-------|
| DigitalOcean Droplet | $5-20 | Basic - Standard |
| Heroku Dyno | Free - $7+ | Free tier deprecated |
| Render Free | $0 | Спит после 15 мин без активности |
| AWS Free Tier | $0-15 | 12 месяцев free, потом платно |
| Linode VPS | $5-15 | Хорошее соотношение цена/качество |

---

## 🎯 Troubleshooting

**API недоступна после развёртывания**
```bash
# Проверить сервис
systemctl status hyperlex-api

# Проверить логи
journalctl -u hyperlex-api -n 50

# Проверить порт
netstat -tulpn | grep 3001
```

**Frontend показывает API ошибки**
```bash
# Проверить CORS в .env
CORS_ORIGIN=https://your-domain.com

# Проверить proxy в nginx
curl -I http://localhost:3001/api/stats
```

---

**Помощь нужна?** Смотри README.md или créate GitHub issue!

---
**Версия**: 1.0 | **Updated**: 13 апреля 2026
