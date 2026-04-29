#!/usr/bin/env node
/**
 * Удаляет все слова которые не имеют пар
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

        // Считаем УЗ слова без пары
        const uzUnpaired = await Word.countDocuments({
            lang: 'lang_uz',
            $or: [
                { 'related.ru': null },
                { 'related.ru': undefined },
                { related: { $exists: false } }
            ]
        });

        // Считаем РУ слова без пары
        const ruUnpaired = await Word.countDocuments({
            lang: 'lang_ru',
            $or: [
                { 'related.uz': null },
                { 'related.uz': undefined },
                { related: { $exists: false } }
            ]
        });

        console.log('📊 АНАЛИЗ НЕПОЛНЫХ ПАР');
        console.log(`   УЗ без пары: ${uzUnpaired}`);
        console.log(`   РУ без пары: ${ruUnpaired}`);
        console.log(`   Всего: ${uzUnpaired + ruUnpaired}\n`);

        // Удаляем УЗ слова без пары
        console.log('🗑️  Удаляю УЗ слова без пары...');
        const uzResult = await Word.deleteMany({
            lang: 'lang_uz',
            $or: [
                { 'related.ru': null },
                { 'related.ru': undefined },
                { related: { $exists: false } }
            ]
        });
        console.log(`   ✅ Удалено УЗ слов: ${uzResult.deletedCount}`);

        // Удаляем РУ слова без пары
        console.log('🗑️  Удаляю РУ слова без пары...');
        const ruResult = await Word.deleteMany({
            lang: 'lang_ru',
            $or: [
                { 'related.uz': null },
                { 'related.uz': undefined },
                { related: { $exists: false } }
            ]
        });
        console.log(`   ✅ Удалено РУ слов: ${ruResult.deletedCount}\n`);

        // Финальная статистика
        const finalUz = await Word.countDocuments({ lang: 'lang_uz' });
        const finalRu = await Word.countDocuments({ lang: 'lang_ru' });
        const pairedUz = await Word.countDocuments({
            lang: 'lang_uz',
            'related.ru': { $ne: null }
        });
        const pairedRu = await Word.countDocuments({
            lang: 'lang_ru',
            'related.uz': { $ne: null }
        });

        console.log('📊 ФИНАЛЬНАЯ СТАТИСТИКА');
        console.log(`   УЗ слов осталось: ${finalUz}`);
        console.log(`   РУ слов осталось: ${finalRu}`);
        console.log(`   УЗ с полными парами: ${pairedUz}`);
        console.log(`   РУ с полными парами: ${pairedRu}`);
        console.log(`\n✅ Очистка завершена!`);

        await mongoose.connection.close();
        process.exit(0);
    } catch (error) {
        console.error('❌ Ошибка:', error.message);
        await mongoose.connection.close();
        process.exit(1);
    }
}

main();
