/**
 * Маршруты публичного API
 * Эндпоинты для поиска и получения данных о словах
 */

const express = require('express');
const router = express.Router();
const wordController = require('../controllers/wordController');

// Поиск слова
// GET /api/search?q=собака&lang=ru
router.get('/search', wordController.searchWords);

// Получение слова по ID
// GET /api/word/:id
router.get('/word/:id', wordController.getWord);

// Получение дерева слова (гиперонимы + гипонимы)
// GET /api/word/:id/tree?depth=3
router.get('/word/:id/tree', wordController.getWordTree);

// Сравнение двух слов
// GET /api/compare?ru=ru_001&uz=uz_001
router.get('/compare', wordController.compareWords);

// Список доступных языков
// GET /api/languages
router.get('/languages', wordController.getLanguages);

// Статистика базы
// GET /api/stats
router.get('/stats', wordController.getStats);

module.exports = router;
