/**
 * Semantic Helper - Утилиты для работы с семантическими ключами и нормализацией
 */

/**
 * Нормализовать слово (удалить ударения, склонения и т.д.)
 * @param {string} word - исходное слово
 * @param {string} lang - язык ('ru' или 'uz')
 * @returns {string} - нормализованное слово
 */
function normalizeWord(word, lang) {
    if (!word) return '';
    
    let normalized = word.trim().toLowerCase();
    
    if (lang === 'ru') {
        // Для русского: базовая нормализация
        // Пока оставляем слово как есть (lowercase)
        // Полная морфологическая нормализация требует отдельной библиотеки (pymorphy2, etc.)
        normalized = normalized
            .replace(/\s+/g, ' ')   // множественные пробелы
            .trim();
    } else if (lang === 'uz') {
        // Для узбекского: базовая нормализация
        normalized = normalized
            .replace(/\s+/g, ' ')
            .trim();
    }
    
    return normalized;
}

function normalizeImportData(data) {
    if (Array.isArray(data)) {
        return data.map((word, index) => ({
            ...word,
            semantic_key: word.semantic_key || word.id || word.key || `item_${index}`
        }));
    }

    if (data && typeof data === 'object') {
        return Object.entries(data)
            .filter(([, word]) => word && typeof word === 'object' && !Array.isArray(word))
            .map(([semantic_key, word]) => ({
                semantic_key,
                ...word
            }));
    }

    return null;
}

/**
 * Генерировать семантический ключ из русского и узбекского слова
 * @param {string} ru - русское слово
 * @param {string} uz - узбекское слово
 * @returns {string} - семантический ключ
 */
function generateSemanticKey(ru, uz) {
    const normalizedRu = normalizeWord(ru, 'ru');
    const normalizedUz = normalizeWord(uz, 'uz');
    
    // Берём первые 3 буквы каждого слова и объединяем
    const ruPart = normalizedRu.substring(0, 3).replace(/\s/g, '');
    const uzPart = normalizedUz.substring(0, 3).replace(/\s/g, '');
    
    // Генерируем хеш для уникальности
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    
    // Формат: ru_uz_hash (например: zhiv_hay_abc123)
    return `${ruPart}${uzPart}_${timestamp}${random}`.toLowerCase();
}

/**
 * Создать семантический граф из массива слов
 * @param {Array} words - массив объектов слов
 * @returns {Object} - граф связей
 */
function buildSemanticGraph(words) {
    const normalizedWords = normalizeImportData(words);
    if (!Array.isArray(normalizedWords)) {
        return {};
    }

    const graph = {};
    const keyMap = {};  // Маппинг разных идентификаторов -> semantic_key

    const registerKey = (value, semanticKey) => {
        if (typeof value !== 'string') return;
        const normalizedValue = value.trim();
        if (!normalizedValue) return;
        keyMap[normalizedValue] = semanticKey;
    };
    
    // Первый проход: создаём ключи для всех слов
    for (const word of normalizedWords) {
        const semanticKey = word.semantic_key || generateSemanticKey(word.ru, word.uz);
        graph[semanticKey] = {
            semantic_key: semanticKey,
            ru: word.ru,
            uz: word.uz,
            normalized_ru: normalizeWord(word.ru, 'ru'),
            normalized_uz: normalizeWord(word.uz, 'uz'),
            description_ru: word.description_ru || '',
            description_uz: word.description_uz || '',
            category: word.category || 'general',
            parent_semantic_key: null,
            children_semantic_keys: [],
            related: []
        };

        registerKey(word.semantic_key, semanticKey);
        registerKey(word.ru, semanticKey);
        registerKey(word.uz, semanticKey);
        registerKey(graph[semanticKey].normalized_ru, semanticKey);
        registerKey(graph[semanticKey].normalized_uz, semanticKey);
    }
    
    // Второй проход: устанавливаем parent-child отношения
    for (const word of normalizedWords) {
        const currentKey = keyMap[word.semantic_key] || keyMap[word.ru] || keyMap[word.uz] || keyMap[normalizeWord(word.ru, 'ru')] || keyMap[normalizeWord(word.uz, 'uz')];
        if (!currentKey) {
            continue;
        }
        
        const parentReference = word.parent_semantic_key || word.parent || word.parent_ru;
        if (parentReference && keyMap[parentReference]) {
            const parentKey = keyMap[parentReference];
            graph[currentKey].parent_semantic_key = parentKey;
            
            // Добавляем текущее слово в children родителя
            if (!graph[parentKey].children_semantic_keys.includes(currentKey)) {
                graph[parentKey].children_semantic_keys.push(currentKey);
            }
        }
        
        // Добавляем related слова
        if (word.related && Array.isArray(word.related)) {
            for (const relatedWord of word.related) {
                const relatedKey = keyMap[relatedWord];
                if (relatedKey && relatedKey !== currentKey) {
                    if (!graph[currentKey].related.includes(relatedKey)) {
                        graph[currentKey].related.push(relatedKey);
                    }
                }
            }
        }
    }
    
    return graph;
}

/**
 * Валидировать JSON структуру перед импортом
 * @param {Array} data - массив слов из JSON
 * @returns {Object} - {valid: boolean, errors: Array<string>}
 */
function validateImportData(data) {
    const errors = [];
    const words = normalizeImportData(data);
    
    if (!Array.isArray(words)) {
        errors.push('Data must be an array or an object map');
        return { valid: false, errors };
    }
    
    for (let i = 0; i < words.length; i++) {
        const word = words[i];
        
        // Проверяем обязательные поля
        if (!word.ru || typeof word.ru !== 'string') {
            errors.push(`Item ${i}: Missing or invalid "ru" field`);
        }
        if (!word.uz || typeof word.uz !== 'string') {
            errors.push(`Item ${i}: Missing or invalid "uz" field`);
        }
        
        // Проверяем опциональные поля
        if (word.parent_ru && typeof word.parent_ru !== 'string') {
            errors.push(`Item ${i}: Invalid "parent_ru" field`);
        }
        if (word.parent_semantic_key && typeof word.parent_semantic_key !== 'string') {
            errors.push(`Item ${i}: Invalid "parent_semantic_key" field`);
        }
        if (word.parent && typeof word.parent !== 'string') {
            errors.push(`Item ${i}: Invalid "parent" field`);
        }
        if (word.category && typeof word.category !== 'string') {
            errors.push(`Item ${i}: Invalid "category" field`);
        }
        if (word.related && !Array.isArray(word.related)) {
            errors.push(`Item ${i}: "related" must be an array`);
        }
    }
    
    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * Форматировать иерархию для вывода
 * @param {Object} word - объект слова с иерархией
 * @param {number} level - уровень вложенности
 * @returns {string} - отформатированная иерархия
 */
function formatHierarchy(word, level = 0) {
    const indent = '  '.repeat(level) + (level > 0 ? '└── ' : '');
    let result = `${indent}${word.ru} (${word.uz})\n`;
    
    if (word.children && Array.isArray(word.children)) {
        for (const child of word.children) {
            result += formatHierarchy(child, level + 1);
        }
    }
    
    return result;
}

module.exports = {
    normalizeWord,
    normalizeImportData,
    generateSemanticKey,
    buildSemanticGraph,
    validateImportData,
    formatHierarchy
};