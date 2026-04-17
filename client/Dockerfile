FROM node:20-alpine

WORKDIR /app

# Копировать package.json и установить зависимости
COPY package*.json ./
RUN npm install

# Копировать код
COPY . .

# Build
RUN npm run build

# Port
EXPOSE 3002

# Start dev server
CMD ["npm", "run", "dev"]
