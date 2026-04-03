/**
 * Word Model - MongoDB Schema для слов
 */

const mongoose = require('mongoose');

const wordSchema = new mongoose.Schema({
    _id: {
        type: String,
        required: [true, 'Word ID is required'],
        unique: true,
        // Format: ru_001, uz_002, etc.
    },
    word: {
        type: String,
        required: [true, 'Word is required'],
        trim: true
    },
    lang: {
        type: String,
        enum: ['lang_ru', 'lang_uz'],
        required: [true, 'Language is required']
    },
    definition: {
        type: String,
        default: ''
    },
    
    // Гиперонимо-гипонимические отношения
    hypernyms: [{
        type: String,
        ref: 'Word'
    }],
    hyponyms: [{
        type: String,
        ref: 'Word'
    }],
    
    // Переводы на другой язык
    related: {
        ru: { type: String, default: null },
        uz: { type: String, default: null }
    },
    
    // Альтернативный перевод
    translations: {
        ru: { type: String, default: null },
        uz: { type: String, default: null }
    },
    
    // Метаданные
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    updatedBy: {
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

// Индекс для быстрого поиска
wordSchema.index({ lang: 1 });
wordSchema.index({ hypernyms: 1 });
wordSchema.index({ hyponyms: 1 });

// Метод для получения синонимов
wordSchema.methods.getRelated = async function() {
    const relatedId = this.related[this.lang === 'lang_ru' ? 'lang_uz' : 'lang_ru'];
    if (!relatedId) return null;
    return await mongoose.model('Word').findById(relatedId);
};

// Метод для обновления связей при удалении
wordSchema.methods.removeFromRelations = async function() {
    const Word = mongoose.model('Word');
    
    // Удаляем это слово из hypernyms других слов
    await Word.updateMany(
        { hyponyms: this._id },
        { $pull: { hyponyms: this._id } }
    );
    
    // Удаляем это слово из hyponyms других слов
    await Word.updateMany(
        { hypernyms: this._id },
        { $pull: { hypernyms: this._id } }
    );
};

module.exports = mongoose.model('Word', wordSchema);
