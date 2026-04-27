/**
 * Маршруты админ-панели
 * Эндпоинты для CRUD операций со словами
 * Все маршруты требуют аутентификации и админ роли
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const wordAdminController = require('../controllers/wordAdminController');
const { authenticateToken, checkAdminRole } = require('../controllers/authController');

const upload = multer({
	storage: multer.memoryStorage(),
	limits: { fileSize: 50 * 1024 * 1024 }
});

// Middleware для всех маршрутов: требует аутентификации и админ роли
router.use(authenticateToken);
router.use(checkAdminRole);

// ===== CRUD Операции =====

// Автопоиск для hypernyms (должен быть ДО маршрутов с параметрами)
// GET /api/admin/words/autocomplete/hypernyms?q=собак&lang=ru&limit=10
router.get('/words/autocomplete/hypernyms', wordAdminController.searchForHypernyms);

// Получение всех слов (с пагинацией и фильтрацией)
// GET /api/admin/words?lang=ru&limit=50&skip=0&search=собака
router.get('/words', wordAdminController.getAllWords);

// Получить дерево связей слова
// GET /api/admin/words/:id/tree?depth=3
router.get('/words/:id/tree', wordAdminController.getWordTree);

// Получить одно слово по ID
// GET /api/admin/words/:id
router.get('/words/:id', wordAdminController.getWordById);

// Добавление нового слова
// POST /api/admin/words
router.post('/words', wordAdminController.createWord);

// Обновление слова
// PUT /api/admin/words/:id
router.put('/words/:id', wordAdminController.updateWord);

// Синхронизация связей (рекурсивное связывание всех гиперонимов и гипонимов)
// POST /api/admin/words/sync-relations
router.post('/words/sync-relations', wordAdminController.syncRelations);

// Удаление слова
// DELETE /api/admin/words/:id
router.delete('/words/:id', wordAdminController.deleteWord);

// Массовый импорт слов
// POST /api/admin/import
router.post('/import', upload.single('file'), wordAdminController.importWords);

// AI связывание гиперонимов/гипонимов
// POST /api/admin/ai/link-hyponyms
router.post('/ai/link-hyponyms', wordAdminController.aiLinkHyponyms);

module.exports = router;
