/**
 * Скрипт для инициализации БД с реальными данными
 * Запуск: node server/scripts/seed.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Word = require('../models/Word');
const { connectDB } = require('../config/database');
const path = require('path');
const fs = require('fs');

async function seedDatabase() {
    try {
        console.log('🔗 Connecting to MongoDB...');
        await connectDB();
        
        console.log('🧹 Clearing existing words...');
        await Word.deleteMany({});
        
        console.log('📝 Loading data from JSON files...');
        
        // Загружаем русские слова
        const russianPath = path.join(__dirname, '../data/russian.json');
        const russianData = JSON.parse(fs.readFileSync(russianPath, 'utf8'));
        
        // Загружаем узбекские слова
        const uzbekPath = path.join(__dirname, '../data/uzbek.json');
        const uzbekData = JSON.parse(fs.readFileSync(uzbekPath, 'utf8'));
        
        // Трансформируем русские слова
        const russianWords = russianData.words.map(word => ({
            _id: word.id,
            word: word.word,
            lang: 'lang_ru',
            definition: word.definition,
            hypernyms: word.hypernyms || [],
            hyponyms: word.hyponyms || [],
            related: {
                uz: word.related_uz || null,
                ru: null
            },
            translations: {
                ru: null,
                uz: word.translation?.uz || null
            }
        }));
        
        // Трансформируем узбекские слова
        const uzbekWords = uzbekData.words.map(word => ({
            _id: word.id,
            word: word.word,
            lang: 'lang_uz',
            definition: word.definition,
            hypernyms: word.hypernyms || [],
            hyponyms: word.hyponyms || [],
            related: {
                uz: null,
                ru: word.related_ru || null
            },
            translations: {
                uz: null,
                ru: word.translation?.ru || null
            }
        }));
        
        // Вставляем все слова (по одному, чтобы избежать конфликтов)
        console.log(`📝 Creating ${russianWords.length} Russian words...`);
        for (const word of russianWords) {
            await Word.create(word);
        }
        
        console.log(`📝 Creating ${uzbekWords.length} Uzbek words...`);
        for (const word of uzbekWords) {
            await Word.create(word);
        }
        
        console.log(`✅ Successfully created ${russianWords.length + uzbekWords.length} words!`);
        console.log(`📊 Russian words: ${russianWords.length}`);
        console.log(`📊 Uzbek words: ${uzbekWords.length}`);
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Error seeding database:', error.message);
        process.exit(1);
    }
}

seedDatabase();
