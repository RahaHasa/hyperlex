FROM node:20-alpine

WORKDIR /app

# Копировать package.json и установить зависимости
COPY package*.json ./
RUN npm install --production

# Копировать код
COPY . .

# Ports
EXPOSE 3001

# Start server
CMD ["npm", "start"]
