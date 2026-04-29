#!/usr/bin/env node
/**
 * Довести БД до максимально возможной баланса
 * Если РУ слов меньше чем УЗ, удалить лишние УЗ слова
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

        // Текущие числа
        const uz = await Word.countDocuments({ lang: 'lang_uz' });
        const ru = await Word.countDocuments({ lang: 'lang_ru' });
        
        console.log(`📊 Текущее состояние:`);
        console.log(`   УЗ слов: ${uz}`);
        console.log(`   РУ слов: ${ru}\n`);

        // Если УЗ больше чем РУ, удалим лишние УЗ
        if (uz > ru) {
            const toDelete = uz - ru;
            console.log(`⚠️  УЗ слов больше чем РУ на ${toDelete}`);
            console.log(`🔄 Удаляю последние ${toDelete} УЗ слов...\n`);

            // Получаем УЗ слова отсортированные по _id в обратном порядке
            const excessUz = await Word.find({ lang: 'lang_uz' })
                .select('_id')
                .sort({ _id: -1 })
                .limit(toDelete)
                .lean();

            const idsToDelete = excessUz.map(w => w._id);
            const result = await Word.deleteMany({ _id: { $in: idsToDelete } });
            console.log(`🗑️  Удалено УЗ слов: ${result.deletedCount}\n`);
        }

        // Финальная проверка
        const finalUz = await Word.countDocuments({ lang: 'lang_uz' });
        const finalRu = await Word.countDocuments({ lang: 'lang_ru' });
        const pairedUz = await Word.countDocuments({
            lang: 'lang_uz',
            'related.ru': { $exists: true, $ne: null }
        });
        const pairedRu = await Word.countDocuments({
            lang: 'lang_ru',
            'related.uz': { $exists: true, $ne: null }
        });

        console.log('📊 ФИНАЛЬНАЯ СТАТИСТИКА:');
        console.log(`   УЗ слов в БД: ${finalUz}`);
        console.log(`   РУ слов в БД: ${finalRu}`);
        console.log(`   УЗ с полными парами: ${pairedUz}`);
        console.log(`   РУ с полными парами: ${pairedRu}`);

        if (finalUz === finalRu && finalUz === pairedUz && finalRu === pairedRu) {
            console.log(`\n✅ Идеально! Полная балансировка достигнута!`);
            console.log(`✅ ${finalUz} пар на каждом языке!`);
        } else {
            console.log(`\n⚠️  Есть небольшой дисбаланс.`);
        }

        console.log(`\n✅ Финализация завершена!`);

        await mongoose.disconnect();
        process.exit(0);
    } catch (error) {
        console.error('❌ Ошибка:', error.message);
        await mongoose.disconnect();
        process.exit(1);
    }
}

main();
