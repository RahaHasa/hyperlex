/**
 * HyperLex Server
 * Сервер для платформы анализа гиперонимо-гипонимических отношений
 * 
 * Запуск: npm start или node server.js
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { connectDB } = require('./config/database');

// Импорт маршрутов
const wordsRoutes = require('./routes/words');
const adminRoutes = require('./routes/admin');
const authRoutes = require('./routes/auth');

const app = express();
const PORT = process.env.PORT || 3001;

// === MIDDLEWARE ===

// Разрешаем CORS для фронтенда
app.use(cors({
    origin: ['http://localhost:3000', 'http://localhost:5173'],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Парсинг JSON
app.use(express.json({ limit: '10mb' }));

// Логирование запросов (простое)
app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${req.method} ${req.path}`);
    next();
});

// === МАРШРУТЫ ===

// Аутентификация
app.use('/api/auth', authRoutes);

// Публичное API
app.use('/api', wordsRoutes);

// Админ API
app.use('/api/admin', adminRoutes);

// Корневой маршрут — информация об API
app.get('/', (req, res) => {
    res.json({
        name: 'HyperLex API',
        version: '1.0.0',
        description: 'API для анализа гиперонимо-гипонимических отношений',
        endpoints: {
            search: 'GET /api/search?q={query}&lang={ru|uz|both}',
            word: 'GET /api/word/:id',
            tree: 'GET /api/word/:id/tree?depth={number}',
            compare: 'GET /api/compare?ru={id}&uz={id}',
            languages: 'GET /api/languages',
            stats: 'GET /api/stats',
            admin: {
                words: 'GET /api/admin/words?lang={ru|uz|both}',
                addWord: 'POST /api/admin/word',
                updateWord: 'PUT /api/admin/word/:id',
                deleteWord: 'DELETE /api/admin/word/:id',
                export: 'GET /api/admin/export',
                import: 'POST /api/admin/import'
            }
        },
        languages: ['ru', 'uz']
    });
});

// === ОБРАБОТКА ОШИБОК ===

// 404 — маршрут не найден
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Маршрут не найден',
        path: req.path
    });
});

// Общий обработчик ошибок
app.use((err, req, res, next) => {
    console.error('Ошибка сервера:', err);
    res.status(500).json({
        success: false,
        error: 'Внутренняя ошибка сервера'
    });
});

// === ЗАПУСК СЕРВЕРА ===

async function startServer() {
    try {
        // Подключение к MongoDB
        await connectDB();
        
        app.listen(PORT, () => {
            console.log('');
            console.log('╔════════════════════════════════════════════════╗');
            console.log('║            🔤 HyperLex Server 🔤               ║');
            console.log('╠════════════════════════════════════════════════╣');
            console.log(`║  Server running on port ${PORT}                  ║`);
            console.log(`║  API: http://localhost:${PORT}/api                ║`);
            console.log('║  Languages: Russian, Uzbek                     ║');
            console.log('║  Database: MongoDB                             ║');
            console.log('╚════════════════════════════════════════════════╝');
            console.log('');
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

startServer();

module.exports = app;
