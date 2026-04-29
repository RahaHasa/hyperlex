#!/usr/bin/env node
/**
 * Удаляет все русские слова из БД
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Word = require('../models/Word');
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/hyperlex';

async function main() {
    try {
        console.log('🔗 Подключение к MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Подключено\n');

        // Считаем РУ слова
        const ruCount = await Word.countDocuments({ lang: 'lang_ru' });
        console.log(`📊 АНАЛИЗ`);
        console.log(`   РУ слов в базе: ${ruCount}\n`);

        if (ruCount === 0) {
            console.log('ℹ️  Русских слов в базе нет');
            await mongoose.connection.close();
            process.exit(0);
        }

        // Удаляем все РУ слова
        console.log('🗑️  Удаляю ВСЕ русские слова...');
        const result = await Word.deleteMany({ lang: 'lang_ru' });
        console.log(`   ✅ Удалено РУ слов: ${result.deletedCount}\n`);

        // Финальная статистика
        const finalUz = await Word.countDocuments({ lang: 'lang_uz' });
        const finalRu = await Word.countDocuments({ lang: 'lang_ru' });

        console.log('📊 ФИНАЛЬНАЯ СТАТИСТИКА');
        console.log(`   УЗ слов осталось: ${finalUz}`);
        console.log(`   РУ слов осталось: ${finalRu}`);
        console.log(`\n✅ Удаление завершено!`);

        await mongoose.connection.close();
        process.exit(0);
    } catch (error) {
        console.error('❌ Ошибка:', error.message);
        await mongoose.connection.close();
        process.exit(1);
    }
}

main();
