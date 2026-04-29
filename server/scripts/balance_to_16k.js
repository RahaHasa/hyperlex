#!/usr/bin/env node
/**
 * Сбалансировать БД так чтобы было ровно 16000 пар УЗ-РУ слов
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Word = require('../models/Word');
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/hyperlex';

const TARGET_COUNT = 16000;

async function main() {
    try {
        console.log('🔗 Подключение к MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Подключено\n');

        // Получаем все УЗ слова с валидными парами
        const uzWords = await Word.find({ lang: 'lang_uz' }).select('_id word related').lean();
        console.log(`📊 Всего УЗ слов в БД: ${uzWords.length}`);
        console.log(`🎯 Целевое количество: ${TARGET_COUNT}\n`);

        if (uzWords.length <= TARGET_COUNT) {
            console.log('✅ УЗ слов уже достаточно или равно целевому числу');
            await mongoose.disconnect();
            process.exit(0);
        }

        // Берём первые 16000 УЗ слов
        const keepUzIds = new Set(uzWords.slice(0, TARGET_COUNT).map(w => String(w._id)));
        const keepRuIds = new Set(
            uzWords.slice(0, TARGET_COUNT)
                .map(w => String(w.related?.ru))
                .filter(id => id && id !== 'null')
        );

        console.log(`📌 Оставляем первые ${TARGET_COUNT} УЗ слов`);
        console.log(`📌 Соответствующие им РУ слова: ${keepRuIds.size}\n`);

        // Удаляем лишние УЗ слова (те что не в списке первых 16000)
        const deleteUzResult = await Word.deleteMany({
            lang: 'lang_uz',
            _id: { $nin: Array.from(keepUzIds) }
        });
        console.log(`🗑️  Удалено УЗ слов: ${deleteUzResult.deletedCount}`);

        // Удаляем РУ слова которые не связаны с оставшимися УЗ словами
        const deleteRuResult = await Word.deleteMany({
            lang: 'lang_ru',
            _id: { $nin: Array.from(keepRuIds) }
        });
        console.log(`🗑️  Удалено РУ слов: ${deleteRuResult.deletedCount}\n`);

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

        if (finalUz === finalRu && finalUz === TARGET_COUNT && finalUz === pairedUz && finalRu === pairedRu) {
            console.log(`\n✅ Идеально! ${TARGET_COUNT} пар на каждом языке с полними связями!`);
        } else {
            console.log(`\n⚠️  Результат не совсем идеален. Проверьте данные.`);
        }

        console.log(`\n✅ Балансировка завершена!`);

        await mongoose.disconnect();
        process.exit(0);
    } catch (error) {
        console.error('❌ Ошибка:', error.message);
        await mongoose.disconnect();
        process.exit(1);
    }
}

main();
