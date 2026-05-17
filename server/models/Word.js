/**
 * Word Model - MongoDB Schema для слов с иерархией
 * Новый формат для семантических отношений
 */

const mongoose = require('mongoose');

const wordSchema = new mongoose.Schema({
    // Семантический ключ (уникальный идентификатор концепта)
    semantic_key: {
        type: String,
        required: [true, 'Semantic key is required'],
        unique: true,
        trim: true
    },
    
    // Основные слова (русский и узбекский)
    ru: {
        type: String,
        required: [true, 'Russian word is required'],
        trim: true
    },
    uz: {
        type: String,
        required: [true, 'Uzbek word is required'],
        trim: true
    },
    
    // Нормализованные версии (для поиска и обработки)
    normalized_ru: {
        type: String,
        required: true,
        trim: true
    },
    normalized_uz: {
        type: String,
        required: true,
        trim: true
    },
    
    // Описания на двух языках
    description_ru: {
        type: String,
        default: ''
    },
    description_uz: {
        type: String,
        default: ''
    },
    
    // Иерархия (parent-child отношения)
    parent_semantic_key: {
        type: String,
        default: null,
        ref: 'Word'
    },
    children_semantic_keys: [{
        type: String,
        ref: 'Word'
    }],
    
    // Категория
    category: {
        type: String,
        default: 'general'
    },
    
    // Уровень иерархии (1 - корень, 2 - подкатегория, 3 - вид и т.д.)
    level: {
        type: Number,
        default: 1
    },
    
    // Связанные слова (внутри той же иерархии)
    related: [{
        type: String,  // semantic_key других слов
        ref: 'Word'
    }],
    
    // Метаданные
    importedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});


// === ИНДЕКСЫ ===
// Индекс для быстрого поиска по semantic_key
wordSchema.index({ semantic_key: 1 });
// Индекс для иерархии
wordSchema.index({ parent_semantic_key: 1 });
// Индекс для поиска по нормализованным словам
wordSchema.index({ normalized_ru: 1 });
wordSchema.index({ normalized_uz: 1 });
// Индекс для категорий
wordSchema.index({ category: 1 });

// === МЕТОДЫ ===

/**
 * Получить полную иерархию вверх (все родители)
 */
wordSchema.methods.getHierarchyUp = async function() {
    const Word = mongoose.model('Word');
    const hierarchy = [this];
    
    let current = this;
    while (current.parent_semantic_key) {
        const parent = await Word.findOne({ semantic_key: current.parent_semantic_key });
        if (!parent) break;
        hierarchy.unshift(parent);
        current = parent;
    }
    
    return hierarchy;
};

/**
 * Получить полную иерархию вниз (все дети)
 */
wordSchema.methods.getHierarchyDown = async function() {
    const Word = mongoose.model('Word');
    let result = [this];
    
    const getChildren = async (parent) => {
        const children = await Word.find({ parent_semantic_key: parent.semantic_key });
        for (const child of children) {
            result.push(child);
            await getChildren(child);
        }
    };
    
    await getChildren(this);
    return result;
};

/**
 * Получить дерево в формате JSON
 */
wordSchema.methods.getTreeStructure = async function() {
    const Word = mongoose.model('Word');
    
    const buildTree = async (word) => {
        const children = await Word.find({ parent_semantic_key: word.semantic_key });
        
        return {
            semantic_key: word.semantic_key,
            ru: word.ru,
            uz: word.uz,
            category: word.category,
            description_ru: word.description_ru,
            description_uz: word.description_uz,
            children: await Promise.all(children.map(child => buildTree(child)))
        };
    };
    
    return buildTree(this);
};

/**
 * Удалить слово и обновить иерархию
 */
wordSchema.methods.deleteWithHierarchy = async function() {
    const Word = mongoose.model('Word');
    
    // Если у слова есть дети, переместить их к родителю текущего слова
    if (this.children_semantic_keys.length > 0) {
        await Word.updateMany(
            { semantic_key: { $in: this.children_semantic_keys } },
            { parent_semantic_key: this.parent_semantic_key }
        );
    }
    
    // Удалить из related других слов
    await Word.updateMany(
        { related: this.semantic_key },
        { $pull: { related: this.semantic_key } }
    );
    
    // Удалить само слово
    await Word.deleteOne({ semantic_key: this.semantic_key });
};

// === ВЫВЕДЕНИЕ МОДЕЛИ ===

module.exports = mongoose.model('Word', wordSchema);
