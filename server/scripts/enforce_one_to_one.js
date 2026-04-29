#!/usr/bin/env node
/**
 * Привести БД к чистой 1-to-1 логике
 * Каждому РУ слову — ровно по одному УЗ слову
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

        // Получаем все РУ слова
        const ruWords = await Word.find({ lang: 'lang_ru' }).select('_id word related').lean();
        console.log(`📊 РУ слов в БД: ${ruWords.length}\n`);

        // Для каждого РУ слова находим все связанные УЗ и оставляем только первое
        const keepUzIds = new Set();
        const ruToUzMap = new Map();

        for (const ruWord of ruWords) {
            // Находим все УЗ слова, которые указывают на это РУ
            const linkedUzWords = await Word.find({
                lang: 'lang_uz',
                'related.ru': ruWord._id
            }).select('_id word').lean();

            if (linkedUzWords.length > 0) {
                // Берём только первое
                const keepUzId = linkedUzWords[0]._id;
                keepUzIds.add(String(keepUzId));
                ruToUzMap.set(String(ruWord._id), String(keepUzId));

                if (linkedUzWords.length > 1) {
                    console.log(`   РУ "${ruWord.word}" → ${linkedUzWords.length} УЗ вариантов, оставляю только "${linkedUzWords[0].word}"`);
                }
            }
        }

        console.log(`\n📌 Оставляю для 1-to-1: ${keepUzIds.size} УЗ слов\n`);

        // Удаляем все остальные УЗ слова
        const toDeleteUz = await Word.find({
            lang: 'lang_uz',
            _id: { $nin: Array.from(keepUzIds) }
        }).select('_id').lean();

        if (toDeleteUz.length > 0) {
            const deleteResult = await Word.deleteMany({
                _id: { $in: toDeleteUz.map(w => w._id) }
            });
            console.log(`🗑️  Удалено "лишних" УЗ слов: ${deleteResult.deletedCount}\n`);
        }

        // Обновляем связи — обнуляем related.ru для УЗ слов, которые не в списке
        // (это должно быть пусто, если всё сработало)

        // Финальная проверка
        const finalRu = await Word.countDocuments({ lang: 'lang_ru' });
        const finalUz = await Word.countDocuments({ lang: 'lang_uz' });
        const pairedRu = await Word.countDocuments({
            lang: 'lang_ru',
            'related.uz': { $exists: true, $ne: null }
        });
        const pairedUz = await Word.countDocuments({
            lang: 'lang_uz',
            'related.ru': { $exists: true, $ne: null }
        });

        console.log('📊 ФИНАЛЬНОЕ СОСТОЯНИЕ (1-to-1):');
        console.log(`   РУ слов: ${finalRu}`);
        console.log(`   УЗ слов: ${finalUz}`);
        console.log(`   РУ с полными парами: ${pairedRu}`);
        console.log(`   УЗ с полными парами: ${pairedUz}`);

        if (finalRu === finalUz && finalRu === pairedRu && finalUz === pairedUz) {
            console.log(`\n✅ ИДЕАЛЬНО! ${finalRu} чистых пар 1-to-1!`);
        } else {
            console.log(`\n⚠️  Проверьте состояние.`);
        }

        console.log(`\n✅ Привнесение к 1-to-1 завершено!`);

        await mongoose.disconnect();
        process.exit(0);
    } catch (error) {
        console.error('❌ Ошибка:', error.message);
        await mongoose.disconnect();
        process.exit(1);
    }
}

main();
