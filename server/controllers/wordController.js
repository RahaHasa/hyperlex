/**
 * Контроллер для работы со словами
 * Обрабатывает все операции поиска, получения и модификации данных
 */

const Word = require('../models/Word');

function isObjectId(value) {
    return typeof value === 'string' && /^[a-fA-F0-9]{24}$/.test(value);
}

async function findWordByAnyId(id) {
    if (!id) return null;

    let word = await Word.findOne({ semantic_key: id });
    if (word) return word;

    if (isObjectId(id)) {
        word = await Word.findById(id);
    }

    return word;
}

async function buildTreeByWord(word, depth) {
    if (!word || depth <= 0) return null;

    let parentNode = null;
    if (word.parent_semantic_key) {
        const parent = await Word.findOne({ semantic_key: word.parent_semantic_key });
        if (parent) {
            parentNode = await buildTreeByWord(parent, depth - 1);
        }
    }

    const children = word.children_semantic_keys?.length
        ? await Word.find({ semantic_key: { $in: word.children_semantic_keys } })
        : [];

    const hyponyms = [];
    for (const child of children) {
        const node = await buildTreeByWord(child, depth - 1);
        if (node) hyponyms.push(node);
    }

    const language = /[а-яё]/i.test(word.ru || '') ? 'ru' : 'uz';

    return {
        id: word.semantic_key,
        semantic_key: word.semantic_key,
        word: word.ru || word.uz || '',
        ru: word.ru,
        uz: word.uz,
        language,
        definition: word.description_ru || word.description_uz || '',
        description_ru: word.description_ru || '',
        description_uz: word.description_uz || '',
        category: word.category,
        parent_semantic_key: word.parent_semantic_key || null,
        children_semantic_keys: word.children_semantic_keys || [],
        hypernyms: parentNode ? [parentNode] : [],
        hyponyms
    };
}

/**
 * Поиск слова по запросу
 * GET /api/search?q=собака&lang=ru
 */
async function searchWords(req, res) {
    try {
        const { q, lang = 'both' } = req.query;
        
        if (!q || q.trim().length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Параметр поиска (q) обязателен'
            });
        }
        
        const searchRegex = new RegExp(q.trim(), 'i');
        let query;

        if (lang === 'ru') {
            query = {
                $or: [
                    { ru: searchRegex },
                    { normalized_ru: searchRegex }
                ]
            };
        } else if (lang === 'uz') {
            query = {
                $or: [
                    { uz: searchRegex },
                    { normalized_uz: searchRegex }
                ]
            };
        } else {
            query = {
                $or: [
                    { ru: searchRegex },
                    { uz: searchRegex },
                    { normalized_ru: searchRegex },
                    { normalized_uz: searchRegex }
                ]
            };
        }

        const results = await Word.find(query).limit(50);
        
        res.json({
            success: true,
            query: q,
            language: lang,
            count: results.length,
            results
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Ошибка при поиске: ' + error.message
        });
    }
}

/**
 * Получение слова по ID
 * GET /api/word/:id
 */
async function getWord(req, res) {
    try {
        const { id } = req.params;

        const word = await findWordByAnyId(id);
        
        if (!word) {
            return res.status(404).json({
                success: false,
                error: 'Слово не найдено'
            });
        }
        
        // Получаем первое связанное слово, если оно есть
        let relatedWord = null;
        if (Array.isArray(word.related) && word.related.length > 0) {
            relatedWord = await Word.findOne({ semantic_key: word.related[0] });
        }
        
        res.json({
            success: true,
            word,
            relatedWord
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Ошибка при получении слова: ' + error.message
        });
    }
}

/**
 * Получение полного дерева слова
 * GET /api/word/:id/tree?depth=3
 */
async function getWordTree(req, res) {
    try {
        const { id } = req.params;
        const depth = parseInt(req.query.depth) || 3;

        const centerWord = await findWordByAnyId(id);
        const tree = await buildTreeByWord(centerWord, depth);
        
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
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Ошибка при построении дерева: ' + error.message
        });
    }
}

/**
 * Сравнение двух слов (русское и узбекское)
 * GET /api/compare?ru=ru_001&uz=uz_001
 */
async function compareWords(req, res) {
    try {
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
            const ruWord = await findWordByAnyId(ru);
            ruTree = await buildTreeByWord(ruWord, 2);
        }
        
        if (uz) {
            const uzWord = await findWordByAnyId(uz);
            uzTree = await buildTreeByWord(uzWord, 2);
        }
        
        res.json({
            success: true,
            comparison: {
                russian: ruTree,
                uzbek: uzTree
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Ошибка при сравнении: ' + error.message
        });
    }
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
async function getStats(req, res) {
    try {
        // Подсчитываем слова из БД по полям новой схемы
        const rusCount = await Word.countDocuments({ ru: { $exists: true, $ne: '' } });
        const uzCount = await Word.countDocuments({ uz: { $exists: true, $ne: '' } });
        const totalCount = await Word.countDocuments();
        
        res.json({
            success: true,
            stats: {
                russian: {
                    totalWords: rusCount,
                    lastUpdated: new Date().toISOString()
                },
                uzbek: {
                    totalWords: uzCount,
                    lastUpdated: new Date().toISOString()
                },
                total: totalCount
            }
        });
    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({
            success: false,
            error: 'Server error'
        });
    }
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
