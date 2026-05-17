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

function toTreeNode(word, extra = {}) {
    const language = /[а-яё]/i.test(word.ru || '') ? 'ru' : 'uz';

    return {
        id: word.semantic_key,
        semantic_key: word.semantic_key,
        word: word.ru || word.uz || '',
        ru: word.ru,
        uz: word.uz,
        level: word.level || 1,
        language,
        definition: word.description_ru || word.description_uz || '',
        description_ru: word.description_ru || '',
        description_uz: word.description_uz || '',
        category: word.category,
        parent_semantic_key: word.parent_semantic_key || null,
        children_semantic_keys: word.children_semantic_keys || [],
        hypernyms: extra.hypernyms || [],
        hyponyms: extra.hyponyms || []
    };
}

async function getDirectChildren(word) {
    if (!word?.children_semantic_keys?.length) {
        return [];
    }

    const children = await Word.find({ semantic_key: { $in: word.children_semantic_keys } });

    return children.sort((a, b) => {
        const levelDiff = (a.level || 0) - (b.level || 0);
        if (levelDiff !== 0) return levelDiff;

        const aWord = (a.ru || a.uz || '').toLowerCase();
        const bWord = (b.ru || b.uz || '').toLowerCase();
        return aWord.localeCompare(bWord, 'ru');
    });
}

async function buildAncestorBranch(word, depth) {
    if (!word?.parent_semantic_key || depth <= 0) {
        return null;
    }

    const parent = await Word.findOne({ semantic_key: word.parent_semantic_key });
    if (!parent) {
        return null;
    }

    const upperBranch = await buildAncestorBranch(parent, depth - 1);
    const siblings = await getDirectChildren(parent);

    return toTreeNode(parent, {
        hypernyms: upperBranch ? [upperBranch] : [],
        hyponyms: siblings.map((child) => toTreeNode(child))
    });
}

async function buildTreeByWord(word, depth) {
    if (!word || depth <= 0) return null;

    const parentNode = await buildAncestorBranch(word, depth - 1);
    const children = await getDirectChildren(word);

    return toTreeNode(word, {
        hypernyms: parentNode ? [parentNode] : [],
        hyponyms: children.map((child) => toTreeNode(child))
    });
}

function normalizeSearchText(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/ё/g, 'е')
        .replace(/\s+/g, ' ');
}

function escapeRegex(value) {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getCategoryBoost(category = '') {
    const boosts = {
        daily_core_pack: 220,
        daily_core_category: 200,
        daily_core_word: 190,
        common_noun_index: 180,
        common_noun_entry: 170,
        common_noun_wordform: 160,
        common_noun_lemma: 120,
        education: 85,
        family: 85,
        food: 85,
        daily_life: 85,
        medicine: 85,
        transport: 85,
        people: 80,
        nature: 80,
        ruwordnet_noun_concept: 30,
        ruwordnet_noun_sense: 10
    };

    return boosts[category] || 40;
}

function computeSearchScore(word, query, lang) {
    const normalizedQuery = normalizeSearchText(query);
    const ru = normalizeSearchText(word.ru);
    const uz = normalizeSearchText(word.uz);
    const candidates = [];
    const wordCount = String(word.ru || word.uz || '').trim().split(/\s+/).filter(Boolean).length;

    if (lang === 'ru') {
        candidates.push(ru, normalizeSearchText(word.normalized_ru));
    } else if (lang === 'uz') {
        candidates.push(uz, normalizeSearchText(word.normalized_uz));
    } else {
        candidates.push(
            ru,
            uz,
            normalizeSearchText(word.normalized_ru),
            normalizeSearchText(word.normalized_uz)
        );
    }

    let score = getCategoryBoost(word.category);

    for (const candidate of candidates.filter(Boolean)) {
        if (candidate === normalizedQuery) score += 500;
        else if (candidate.startsWith(normalizedQuery)) score += 260;
        else if (candidate.includes(normalizedQuery)) score += 120;
    }

    if (word.semantic_key?.startsWith('entry_')) score += 90;
    if (word.semantic_key?.startsWith('lemma_')) score += 40;
    if (word.semantic_key?.startsWith('sense_')) score -= 30;
    if (word.semantic_key?.startsWith('concept_')) score -= 10;

    if (word.ru && !/\s/.test(word.ru)) score += 35;
    if (word.uz && !/\s/.test(word.uz)) score += 20;
    if (word.ru && /^[А-ЯЁ0-9 -]+$/.test(word.ru) && /[А-ЯЁ]/.test(word.ru)) score -= 180;
    if (wordCount > 1) score -= Math.min(180, (wordCount - 1) * 90);

    score += Math.max(0, 20 - String(word.ru || '').length);
    score += Math.max(0, 10 - ((word.level || 3) * 2));

    return score;
}

function dedupeSearchResults(results, lang) {
    const seen = new Set();
    const deduped = [];

    for (const word of results) {
        const keyBase = lang === 'uz'
            ? normalizeSearchText(word.uz || word.ru)
            : normalizeSearchText(word.ru || word.uz);

        if (!keyBase || seen.has(keyBase)) continue;

        seen.add(keyBase);
        deduped.push(word);
    }

    return deduped;
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
        
        const trimmedQuery = q.trim();
        const normalizedQuery = normalizeSearchText(trimmedQuery);
        const exactRegex = new RegExp(`^${escapeRegex(trimmedQuery)}$`, 'i');
        const prefixRegex = new RegExp(`^${escapeRegex(trimmedQuery)}`, 'i');
        const broadRegex = new RegExp(escapeRegex(trimmedQuery), 'i');
        const exactConditions = [];
        const prefixConditions = [];
        const broadConditions = [];

        if (lang === 'ru') {
            exactConditions.push(
                { ru: exactRegex },
                { normalized_ru: normalizedQuery }
            );
            prefixConditions.push(
                { ru: prefixRegex },
                { normalized_ru: prefixRegex }
            );
            broadConditions.push(
                { ru: broadRegex },
                { normalized_ru: broadRegex }
            );
        } else if (lang === 'uz') {
            exactConditions.push(
                { uz: exactRegex },
                { normalized_uz: normalizeSearchText(trimmedQuery) }
            );
            prefixConditions.push(
                { uz: prefixRegex },
                { normalized_uz: prefixRegex }
            );
            broadConditions.push(
                { uz: broadRegex },
                { normalized_uz: broadRegex }
            );
        } else {
            exactConditions.push(
                { ru: exactRegex },
                { uz: exactRegex },
                { normalized_ru: normalizedQuery },
                { normalized_uz: normalizedQuery }
            );
            prefixConditions.push(
                { ru: prefixRegex },
                { uz: prefixRegex },
                { normalized_ru: prefixRegex },
                { normalized_uz: prefixRegex }
            );
            broadConditions.push(
                { ru: broadRegex },
                { uz: broadRegex },
                { normalized_ru: broadRegex },
                { normalized_uz: broadRegex }
            );
        }

        const [exactResults, prefixResults, broadResults] = await Promise.all([
            Word.find({ $or: exactConditions }).limit(120).lean(),
            Word.find({ $or: prefixConditions }).limit(220).lean(),
            Word.find({ $or: broadConditions }).limit(320).lean()
        ]);

        const rawResults = [...exactResults, ...prefixResults, ...broadResults];
        const rankedResults = rawResults
            .map((word) => ({
                ...word,
                _searchScore: computeSearchScore(word, trimmedQuery, lang)
            }))
            .sort((a, b) => {
                if (b._searchScore !== a._searchScore) {
                    return b._searchScore - a._searchScore;
                }

                const aWord = normalizeSearchText(a.ru || a.uz);
                const bWord = normalizeSearchText(b.ru || b.uz);
                return aWord.localeCompare(bWord, 'ru');
            });

        const results = dedupeSearchResults(rankedResults, lang)
            .slice(0, 50)
            .map(({ _searchScore, ...word }) => word);
        
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
