/**
 * Утилиты для работы с данными гиперонимов/гипонимов
 * Модуль содержит функции чтения, записи и обработки JSON-файлов
 */

const fs = require('fs');
const path = require('path');

// Пути к файлам данных
const DATA_DIR = path.join(__dirname, '../data');
const RUSSIAN_FILE = path.join(DATA_DIR, 'russian.json');
const UZBEK_FILE = path.join(DATA_DIR, 'uzbek.json');

/**
 * Читает данные из JSON-файла
 * @param {string} language - Код языка ('ru' или 'uz')
 * @returns {Object} Объект с данными или null при ошибке
 */
function readData(language) {
    const filePath = language === 'ru' ? RUSSIAN_FILE : UZBEK_FILE;
    
    try {
        const rawData = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(rawData);
    } catch (error) {
        console.error(`Ошибка чтения файла ${filePath}:`, error.message);
        return null;
    }
}

/**
 * Записывает данные в JSON-файл
 * @param {string} language - Код языка ('ru' или 'uz')
 * @param {Object} data - Данные для записи
 * @returns {boolean} Успешность операции
 */
function writeData(language, data) {
    const filePath = language === 'ru' ? RUSSIAN_FILE : UZBEK_FILE;
    
    try {
        // Обновляем метаданные
        data.metadata.lastUpdated = new Date().toISOString().split('T')[0];
        data.metadata.totalWords = data.words.length;
        
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
        return true;
    } catch (error) {
        console.error(`Ошибка записи в файл ${filePath}:`, error.message);
        return false;
    }
}

/**
 * Ищет слово по тексту (частичное совпадение)
 * @param {string} query - Поисковый запрос
 * @param {string} language - Код языка ('ru', 'uz' или 'both')
 * @returns {Array} Массив найденных слов
 */
function searchWord(query, language = 'both') {
    const results = [];
    const searchQuery = query.toLowerCase().trim();
    
    if (language === 'ru' || language === 'both') {
        const ruData = readData('ru');
        if (ruData) {
            const ruResults = ruData.words.filter(w => 
                w.word.toLowerCase().includes(searchQuery)
            );
            results.push(...ruResults);
        }
    }
    
    if (language === 'uz' || language === 'both') {
        const uzData = readData('uz');
        if (uzData) {
            const uzResults = uzData.words.filter(w => 
                w.word.toLowerCase().includes(searchQuery)
            );
            results.push(...uzResults);
        }
    }
    
    return results;
}

/**
 * Получает слово по ID
 * @param {string} id - Идентификатор слова
 * @returns {Object|null} Объект слова или null
 */
function getWordById(id) {
    // Определяем язык по префиксу ID
    const language = id.startsWith('ru_') ? 'ru' : 'uz';
    const data = readData(language);
    
    if (!data) return null;
    
    return data.words.find(w => w.id === id) || null;
}

/**
 * Строит дерево гиперонимов (вверх по иерархии)
 * @param {string} wordId - ID слова
 * @param {number} depth - Глубина поиска
 * @returns {Array} Массив гиперонимов с информацией
 */
function buildHypernymTree(wordId, depth = 3) {
    const tree = [];
    let currentId = wordId;
    let currentDepth = 0;
    
    while (currentDepth < depth) {
        const word = getWordById(currentId);
        if (!word || word.hypernyms.length === 0) break;
        
        const hypernymId = word.hypernyms[0]; // Берём первый гипероним
        const hypernym = getWordById(hypernymId);
        
        if (!hypernym) break;
        
        tree.push({
            level: currentDepth + 1,
            ...hypernym
        });
        
        currentId = hypernymId;
        currentDepth++;
    }
    
    return tree;
}

/**
 * Строит дерево гипонимов (вниз по иерархии)
 * @param {string} wordId - ID слова
 * @param {number} depth - Глубина поиска
 * @returns {Array} Массив гипонимов с информацией
 */
function buildHyponymTree(wordId, depth = 3) {
    const result = [];
    
    function traverse(id, currentDepth) {
        if (currentDepth > depth) return;
        
        const word = getWordById(id);
        if (!word) return;
        
        for (const hyponymId of word.hyponyms) {
            const hyponym = getWordById(hyponymId);
            if (hyponym) {
                result.push({
                    level: currentDepth,
                    parentId: id,
                    ...hyponym
                });
                traverse(hyponymId, currentDepth + 1);
            }
        }
    }
    
    traverse(wordId, 1);
    return result;
}

/**
 * Строит полное дерево (гиперонимы + гипонимы)
 * @param {string} wordId - ID слова
 * @param {number} depth - Глубина поиска в каждом направлении
 * @returns {Object} Объект с деревом
 */
function buildFullTree(wordId, depth = 3) {
    const word = getWordById(wordId);
    if (!word) return null;
    
    return {
        center: word,
        hypernyms: buildHypernymTree(wordId, depth),
        hyponyms: buildHyponymTree(wordId, depth)
    };
}

/**
 * Получает связанное слово на другом языке
 * @param {string} wordId - ID слова
 * @returns {Object|null} Связанное слово или null
 */
function getRelatedWord(wordId) {
    const word = getWordById(wordId);
    if (!word) return null;
    
    const relatedId = word.related_ru || word.related_uz;
    if (!relatedId) return null;
    
    return getWordById(relatedId);
}

/**
 * Добавляет новое слово в базу
 * @param {Object} wordData - Данные слова
 * @returns {Object} Результат операции
 */
function addWord(wordData) {
    const language = wordData.language;
    const data = readData(language);
    
    if (!data) {
        return { success: false, error: 'Не удалось прочитать базу данных' };
    }
    
    // Проверяем, нет ли уже такого ID
    if (data.words.some(w => w.id === wordData.id)) {
        return { success: false, error: 'Слово с таким ID уже существует' };
    }
    
    data.words.push(wordData);
    
    if (writeData(language, data)) {
        return { success: true, word: wordData };
    }
    
    return { success: false, error: 'Ошибка при сохранении' };
}

/**
 * Обновляет существующее слово
 * @param {string} id - ID слова
 * @param {Object} updates - Обновления
 * @returns {Object} Результат операции
 */
function updateWord(id, updates) {
    const language = id.startsWith('ru_') ? 'ru' : 'uz';
    const data = readData(language);
    
    if (!data) {
        return { success: false, error: 'Не удалось прочитать базу данных' };
    }
    
    const index = data.words.findIndex(w => w.id === id);
    if (index === -1) {
        return { success: false, error: 'Слово не найдено' };
    }
    
    // Не позволяем менять ID и язык
    delete updates.id;
    delete updates.language;
    
    data.words[index] = { ...data.words[index], ...updates };
    
    if (writeData(language, data)) {
        return { success: true, word: data.words[index] };
    }
    
    return { success: false, error: 'Ошибка при сохранении' };
}

/**
 * Удаляет слово из базы
 * @param {string} id - ID слова
 * @returns {Object} Результат операции
 */
function deleteWord(id) {
    const language = id.startsWith('ru_') ? 'ru' : 'uz';
    const data = readData(language);
    
    if (!data) {
        return { success: false, error: 'Не удалось прочитать базу данных' };
    }
    
    const index = data.words.findIndex(w => w.id === id);
    if (index === -1) {
        return { success: false, error: 'Слово не найдено' };
    }
    
    const deleted = data.words.splice(index, 1)[0];
    
    // Удаляем ссылки на это слово из других слов
    data.words.forEach(word => {
        word.hypernyms = word.hypernyms.filter(h => h !== id);
        word.hyponyms = word.hyponyms.filter(h => h !== id);
    });
    
    if (writeData(language, data)) {
        return { success: true, deleted };
    }
    
    return { success: false, error: 'Ошибка при сохранении' };
}

/**
 * Экспортирует всю базу данных
 * @returns {Object} Объект со всеми данными
 */
function exportAllData() {
    return {
        russian: readData('ru'),
        uzbek: readData('uz'),
        exportedAt: new Date().toISOString()
    };
}

/**
 * Импортирует данные из объекта
 * @param {Object} importData - Данные для импорта
 * @returns {Object} Результат операции
 */
function importData(importData) {
    const results = { ru: false, uz: false };
    
    if (importData.russian) {
        results.ru = writeData('ru', importData.russian);
    }
    
    if (importData.uzbek) {
        results.uz = writeData('uz', importData.uzbek);
    }
    
    return {
        success: results.ru || results.uz,
        details: results
    };
}

module.exports = {
    readData,
    writeData,
    searchWord,
    getWordById,
    buildHypernymTree,
    buildHyponymTree,
    buildFullTree,
    getRelatedWord,
    addWord,
    updateWord,
    deleteWord,
    exportAllData,
    importData
};
