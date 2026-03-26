/**
 * Маршруты админ-панели
 * Эндпоинты для CRUD операций и импорта/экспорта данных
 */

const express = require('express');
const router = express.Router();
const wordController = require('../controllers/wordController');

// Получение всех слов (для таблицы в админке)
// GET /api/admin/words?lang=ru
router.get('/words', wordController.getAllWords);

// Добавление нового слова
// POST /api/admin/word
router.post('/word', wordController.addWord);

// Обновление слова
// PUT /api/admin/word/:id
router.put('/word/:id', wordController.updateWord);

// Удаление слова
// DELETE /api/admin/word/:id
router.delete('/word/:id', wordController.deleteWord);

// Экспорт всей базы
// GET /api/admin/export
router.get('/export', wordController.exportData);

// Импорт данных
// POST /api/admin/import
router.post('/import', wordController.importData);

module.exports = router;
