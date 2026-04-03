/**
 * Скрипт для загрузски данных из JSON файлов в MongoDB
 */

const mongoose = require('mongoose');
const Word = require('../models/Word');
const russianData = require('../data/russian.json');
const uzbekData = require('../data/uzbek.json');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/hyperlex';

async function loadData() {
    try {
        // Подключение к MongoDB
        console.log('📡 Подключение к MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Подключение установлено');
        
        // Очистка существующих слов
        console.log('🗑️  Очистка существующих данных...');
        await Word.deleteMany({});
        console.log('✅ Данные сделаны');
        
        // Подготовка русских слов
        console.log('📝 Загрузка русских слов...');
        const russianWords = russianData.words.map(word => ({
            _id: word.id,
            word: word.word,
            lang: 'lang_ru',
            definition: word.definition,
            hypernyms: word.hypernyms || [],
            hyponyms: word.hyponyms || [],
            related: {
                uz: word.related_uz || null
            },
            translations: {
                ru: null,
                uz: null
            }
        }));
        
        // Подготовка узбекских слов
        console.log('📝 Загрузка узбекских слов...');
        const uzbekWords = uzbekData.words.map(word => ({
            _id: word.id,
            word: word.word,
            lang: 'lang_uz',
            definition: word.definition,
            hypernyms: word.hypernyms || [],
            hyponyms: word.hyponyms || [],
            related: {
                ru: word.related_ru || null
            },
            translations: {
                ru: word.translation?.ru || null,
                uz: null
            }
        }));
        
        // Вставка всех слов
        const allWords = [...russianWords, ...uzbekWords];
        
        console.log(`📦 Вставка ${allWords.length} слов...`);
        await Word.insertMany(allWords, { ordered: false });
        
        // Статистика
        const ruCount = await Word.countDocuments({ lang: 'lang_ru' });
        const uzCount = await Word.countDocuments({ lang: 'lang_uz' });
        
        console.log('\n✅ Загрузка завершена!');
        console.log(`📊 Всего слов: ${ruCount + uzCount}`);
        console.log(`   🇷🇺 Русских: ${ruCount}`);
        console.log(`   🇺🇿 Узбекских: ${uzCount}`);
        
        await mongoose.connection.close();
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Ошибка:', error.message);
        await mongoose.connection.close();
        process.exit(1);
    }
}

loadData();
