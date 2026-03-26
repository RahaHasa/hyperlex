/**
 * Контроллер для работы со словами
 * Обрабатывает все операции поиска, получения и модификации данных
 */

const dataHelpers = require('../utils/dataHelpers');

/**
 * Поиск слова по запросу
 * GET /api/search?q=собака&lang=ru
 */
function searchWords(req, res) {
    const { q, lang = 'both' } = req.query;
    
    if (!q || q.trim().length === 0) {
        return res.status(400).json({
            success: false,
            error: 'Параметр поиска (q) обязателен'
        });
    }
    
    const results = dataHelpers.searchWord(q, lang);
    
    res.json({
        success: true,
        query: q,
        language: lang,
        count: results.length,
        results
    });
}

/**
 * Получение слова по ID
 * GET /api/word/:id
 */
function getWord(req, res) {
    const { id } = req.params;
    
    const word = dataHelpers.getWordById(id);
    
    if (!word) {
        return res.status(404).json({
            success: false,
            error: 'Слово не найдено'
        });
    }
    
    // Добавляем связанное слово на другом языке
    const relatedWord = dataHelpers.getRelatedWord(id);
    
    res.json({
        success: true,
        word,
        relatedWord
    });
}

/**
 * Получение полного дерева слова
 * GET /api/word/:id/tree?depth=3
 */
function getWordTree(req, res) {
    const { id } = req.params;
    const depth = parseInt(req.query.depth) || 3;
    
    const tree = dataHelpers.buildFullTree(id, depth);
    
    if (!tree) {
        return res.status(404).json({
            success: false,
            error: 'Слово не найдено'
        });
    }
    
    res.json({
        success: true,
        depth,
        tree
    });
}

/**
 * Сравнение двух слов (русское и узбекское)
 * GET /api/compare?ru=ru_001&uz=uz_001
 */
function compareWords(req, res) {
    const { ru, uz } = req.query;
    
    if (!ru && !uz) {
        return res.status(400).json({
            success: false,
            error: 'Необходимо указать хотя бы один ID слова'
        });
    }
    
    let ruTree = null;
    let uzTree = null;
    
    if (ru) {
        ruTree = dataHelpers.buildFullTree(ru);
    }
    
    if (uz) {
        uzTree = dataHelpers.buildFullTree(uz);
    }
    
    // Если указано только одно слово, пытаемся найти связанное
    if (ru && !uz) {
        const ruWord = dataHelpers.getWordById(ru);
        if (ruWord && ruWord.related_uz) {
            uzTree = dataHelpers.buildFullTree(ruWord.related_uz);
        }
    }
    
    if (uz && !ru) {
        const uzWord = dataHelpers.getWordById(uz);
        if (uzWord && uzWord.related_ru) {
            ruTree = dataHelpers.buildFullTree(uzWord.related_ru);
        }
    }
    
    res.json({
        success: true,
        comparison: {
            russian: ruTree,
            uzbek: uzTree
        }
    });
}

/**
 * Список доступных языков
 * GET /api/languages
 */
function getLanguages(req, res) {
    res.json({
        success: true,
        languages: [
            { code: 'ru', name: 'Русский', nativeName: 'Русский' },
            { code: 'uz', name: 'Узбекский', nativeName: "O'zbek" }
        ]
    });
}

/**
 * Получение статистики базы
 * GET /api/stats
 */
function getStats(req, res) {
    const ruData = dataHelpers.readData('ru');
    const uzData = dataHelpers.readData('uz');
    
    res.json({
        success: true,
        stats: {
            russian: {
                totalWords: ruData ? ruData.metadata.totalWords : 0,
                lastUpdated: ruData ? ruData.metadata.lastUpdated : null
            },
            uzbek: {
                totalWords: uzData ? uzData.metadata.totalWords : 0,
                lastUpdated: uzData ? uzData.metadata.lastUpdated : null
            }
        }
    });
}

// === АДМИН-ФУНКЦИИ ===

/**
 * Добавление нового слова
 * POST /api/admin/word
 */
function addWord(req, res) {
    const wordData = req.body;
    
    // Валидация обязательных полей
    if (!wordData.id || !wordData.word || !wordData.language) {
        return res.status(400).json({
            success: false,
            error: 'Обязательные поля: id, word, language'
        });
    }
    
    // Устанавливаем значения по умолчанию
    wordData.hypernyms = wordData.hypernyms || [];
    wordData.hyponyms = wordData.hyponyms || [];
    wordData.definition = wordData.definition || '';
    
    const result = dataHelpers.addWord(wordData);
    
    if (result.success) {
        res.status(201).json(result);
    } else {
        res.status(400).json(result);
    }
}

/**
 * Обновление слова
 * PUT /api/admin/word/:id
 */
function updateWord(req, res) {
    const { id } = req.params;
    const updates = req.body;
    
    const result = dataHelpers.updateWord(id, updates);
    
    if (result.success) {
        res.json(result);
    } else {
        res.status(400).json(result);
    }
}

/**
 * Удаление слова
 * DELETE /api/admin/word/:id
 */
function deleteWord(req, res) {
    const { id } = req.params;
    
    const result = dataHelpers.deleteWord(id);
    
    if (result.success) {
        res.json(result);
    } else {
        res.status(400).json(result);
    }
}

/**
 * Экспорт всей базы
 * GET /api/admin/export
 */
function exportData(req, res) {
    const data = dataHelpers.exportAllData();
    
    res.json({
        success: true,
        data
    });
}

/**
 * Импорт данных
 * POST /api/admin/import
 */
function importData(req, res) {
    const importData = req.body;
    
    if (!importData.russian && !importData.uzbek) {
        return res.status(400).json({
            success: false,
            error: 'Данные для импорта должны содержать russian и/или uzbek'
        });
    }
    
    const result = dataHelpers.importData(importData);
    res.json(result);
}

/**
 * Получение всех слов (для админки)
 * GET /api/admin/words?lang=ru
 */
function getAllWords(req, res) {
    const { lang = 'both' } = req.query;
    
    let words = [];
    
    if (lang === 'ru' || lang === 'both') {
        const ruData = dataHelpers.readData('ru');
        if (ruData) words.push(...ruData.words);
    }
    
    if (lang === 'uz' || lang === 'both') {
        const uzData = dataHelpers.readData('uz');
        if (uzData) words.push(...uzData.words);
    }
    
    res.json({
        success: true,
        count: words.length,
        words
    });
}

module.exports = {
    // Публичные эндпоинты
    searchWords,
    getWord,
    getWordTree,
    compareWords,
    getLanguages,
    getStats,
    // Админ-эндпоинты
    addWord,
    updateWord,
    deleteWord,
    exportData,
    importData,
    getAllWords
};
