/**
 * Контроллер для работы со словами
 * Обрабатывает все операции поиска, получения и модификации данных
 */

const Word = require('../models/Word');

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
        
        // Создаём regex для поиска
        const searchRegex = new RegExp(q, 'i');
        let query = { word: searchRegex };
        
        // Фильтруем по языку, если указан
        if (lang !== 'both') {
            query.lang = lang === 'ru' ? 'lang_ru' : 'lang_uz';
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
        
        const word = await Word.findById(id);
        
        if (!word) {
            return res.status(404).json({
                success: false,
                error: 'Слово не найдено'
            });
        }
        
        // Получаем связанное слово на другом языке, если оно есть
        let relatedWord = null;
        if (word.related) {
            const relatedId = word.lang === 'lang_ru' ? word.related.uz : word.related.ru;
            if (relatedId) {
                relatedWord = await Word.findById(relatedId);
            }
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
        
        async function buildTree(wordId, currentDepth) {
            if (currentDepth === 0) return null;
            
            const word = await Word.findById(wordId);
            if (!word) return null;
            
            const hypernyms = word.hypernyms ? await Promise.all(
                word.hypernyms.map(hypId => buildTree(hypId, currentDepth - 1))
            ) : [];
            
            const hyponyms = word.hyponyms ? await Promise.all(
                word.hyponyms.map(hypId => buildTree(hypId, currentDepth - 1))
            ) : [];
            
            return {
                _id: word._id,
                word: word.word,
                definition: word.definition,
                lang: word.lang,
                hypernyms: hypernyms.filter(h => h !== null),
                hyponyms: hyponyms.filter(h => h !== null)
            };
        }
        
        const tree = await buildTree(id, depth);
        
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
        
        async function buildTree(wordId, depth = 2) {
            if (!wordId || depth === 0) return null;
            
            const word = await Word.findById(wordId);
            if (!word) return null;
            
            const hypernyms = word.hypernyms ? await Promise.all(
                word.hypernyms.map(hypId => buildTree(hypId, depth - 1))
            ) : [];
            
            const hyponyms = word.hyponyms ? await Promise.all(
                word.hyponyms.map(hypId => buildTree(hypId, depth - 1))
            ) : [];
            
            return {
                _id: word._id,
                word: word.word,
                definition: word.definition,
                lang: word.lang,
                hypernyms: hypernyms.filter(h => h !== null),
                hyponyms: hyponyms.filter(h => h !== null)
            };
        }
        
        let ruTree = null;
        let uzTree = null;
        
        if (ru) {
            ruTree = await buildTree(ru);
        }
        
        if (uz) {
            uzTree = await buildTree(uz);
        }
        
        // Если указано только одно слово, пытаемся найти связанное
        if (ru && !uz && ruTree) {
            const ruWord = await Word.findById(ru);
            if (ruWord && ruWord.related && ruWord.related.uz) {
                uzTree = await buildTree(ruWord.related.uz);
            }
        }
        
        if (uz && !ru && uzTree) {
            const uzWord = await Word.findById(uz);
            if (uzWord && uzWord.related && uzWord.related.ru) {
                ruTree = await buildTree(uzWord.related.ru);
            }
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
        // Подсчитываем слова из БД по языкам
        const rusCount = await Word.countDocuments({ lang: 'lang_ru' });
        const uzCount = await Word.countDocuments({ lang: 'lang_uz' });
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
