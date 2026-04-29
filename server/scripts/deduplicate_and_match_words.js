#!/usr/bin/env node
/**
 * Скрипт для унификации/дедупликации русско-узбекских слов в MongoDB
 * 
 * Делает:
 * 1. Загружает все русские слова (lang_ru) и узбекские слова (lang_uz)
 * 2. Удаляет дубликаты внутри каждого языка
 * 3. Находит пары слов (где есть связь related.uz <-> related.ru)
 * 4. Удаляет сиротские слова (которые нет пары)
 * 5. Балансирует количество слов в обоих языках
 * 
 * Результат: одинаковое кол-во русских и узбекских слов, все спарены
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Word = require('../models/Word');
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/hyperlex';

async function getStats() {
    const ruCount = await Word.countDocuments({ lang: 'lang_ru' });
    const uzCount = await Word.countDocuments({ lang: 'lang_uz' });
    const ruWithRelated = await Word.countDocuments({ lang: 'lang_ru', 'related.uz': { $ne: null } });
    const uzWithRelated = await Word.countDocuments({ lang: 'lang_uz', 'related.ru': { $ne: null } });

    return { ruCount, uzCount, ruWithRelated, uzWithRelated };
}

async function removeDuplicates() {
    console.log('\n🔍 Ищу дубликаты...');
    
    // Русские дубликаты
    const ruDuplicates = await Word.aggregate([
        { $match: { lang: 'lang_ru' } },
        { $group: { _id: '$word', count: { $sum: 1 }, ids: { $push: '$_id' } } },
        { $match: { count: { $gt: 1 } } }
    ]);

    let ruRemoved = 0;
    for (const dup of ruDuplicates) {
        const [keep, ...remove] = dup.ids;
        for (const id of remove) {
            await Word.findByIdAndDelete(id);
            ruRemoved++;
        }
    }

    // Узбекские дубликаты
    const uzDuplicates = await Word.aggregate([
        { $match: { lang: 'lang_uz' } },
        { $group: { _id: '$word', count: { $sum: 1 }, ids: { $push: '$_id' } } },
        { $match: { count: { $gt: 1 } } }
    ]);

    let uzRemoved = 0;
    for (const dup of uzDuplicates) {
        const [keep, ...remove] = dup.ids;
        for (const id of remove) {
            await Word.findByIdAndDelete(id);
            uzRemoved++;
        }
    }

    console.log(`   Удалено РУ дубликатов: ${ruRemoved}`);
    console.log(`   Удалено УЗ дубликатов: ${uzRemoved}`);
    return ruRemoved + uzRemoved;
}

async function removeOrphans() {
    console.log('\n🗑️  Удаляю сиротские слова (без пары)...');

    // Русские слова БЕЗ узбекского перевода
    const ruOrphans = await Word.deleteMany({ 
        lang: 'lang_ru', 
        'related.uz': { $eq: null } 
    });

    // Узбекские слова БЕЗ русского перевода
    const uzOrphans = await Word.deleteMany({ 
        lang: 'lang_uz', 
        'related.ru': { $eq: null } 
    });

    console.log(`   Удалено РУ сирот: ${ruOrphans.deletedCount}`);
    console.log(`   Удалено УЗ сирот: ${uzOrphans.deletedCount}`);
    return ruOrphans.deletedCount + uzOrphans.deletedCount;
}

async function balanceAndNormalize() {
    console.log('\n⚖️  Балансирую кол-во слов...');

    const stats = await getStats();
    const minCount = Math.min(stats.ruWithRelated, stats.uzWithRelated);

    console.log(`   РУ слов с парой: ${stats.ruWithRelated}`);
    console.log(`   УЗ слов с парой: ${stats.uzWithRelated}`);
    console.log(`   Целевое кол-во (минимум): ${minCount}`);

    // Если есть различие - удаляем "лишние" старые слова
    if (stats.ruWithRelated > minCount) {
        const excess = stats.ruWithRelated - minCount;
        const toRemove = await Word.find({ lang: 'lang_ru', 'related.uz': { $ne: null } })
            .sort({ createdAt: 1 })
            .limit(excess)
            .select('_id');
        
        for (const doc of toRemove) {
            await Word.findByIdAndDelete(doc._id);
        }
        console.log(`   Удалено РУ слов (избыток): ${excess}`);
    }

    if (stats.uzWithRelated > minCount) {
        const excess = stats.uzWithRelated - minCount;
        const toRemove = await Word.find({ lang: 'lang_uz', 'related.ru': { $ne: null } })
            .sort({ createdAt: 1 })
            .limit(excess)
            .select('_id');
        
        for (const doc of toRemove) {
            await Word.findByIdAndDelete(doc._id);
        }
        console.log(`   Удалено УЗ слов (избыток): ${excess}`);
    }
}

async function verifyPairs() {
    console.log('\n✅ Проверка целостности пар...');

    const ruWords = await Word.find({ lang: 'lang_ru' }).select('_id word related');
    const uzWords = await Word.find({ lang: 'lang_uz' }).select('_id word related');

    let brokenPairs = 0;

    // Проверяем что каждое РУ слово имеет валидную УЗ пару
    for (const ruWord of ruWords) {
        if (!ruWord.related.uz) {
            console.log(`   ⚠️  РУ слово "${ruWord.word}" без узбекской пары`);
            await Word.findByIdAndDelete(ruWord._id);
            brokenPairs++;
            continue;
        }

        const uzWord = await Word.findById(ruWord.related.uz);
        if (!uzWord || uzWord.related.ru !== ruWord._id) {
            console.log(`   ⚠️  Битая пара: РУ "${ruWord.word}" -> УЗ ${ruWord.related.uz}`);
            await Word.findByIdAndDelete(ruWord._id);
            brokenPairs++;
        }
    }

    // Проверяем что каждое УЗ слово имеет валидную РУ пару
    for (const uzWord of uzWords) {
        if (!uzWord.related.ru) {
            console.log(`   ⚠️  УЗ слово "${uzWord.word}" без русской пары`);
            await Word.findByIdAndDelete(uzWord._id);
            brokenPairs++;
            continue;
        }

        const ruWord = await Word.findById(uzWord.related.ru);
        if (!ruWord || ruWord.related.uz !== uzWord._id) {
            console.log(`   ⚠️  Битая пара: УЗ "${uzWord.word}" -> РУ ${uzWord.related.ru}`);
            await Word.findByIdAndDelete(uzWord._id);
            brokenPairs++;
        }
    }

    if (brokenPairs > 0) {
        console.log(`   Удалено слов с битыми парами: ${brokenPairs}`);
    } else {
        console.log(`   ✅ Все пары целостны!`);
    }
}

async function main() {
    try {
        console.log('🔗 Подключение к MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Подключено');

        console.log('\n📊 НАЧАЛЬНАЯ СТАТИСТИКА');
        let stats = await getStats();
        console.log(`   РУ слов: ${stats.ruCount}`);
        console.log(`   УЗ слов: ${stats.uzCount}`);
        console.log(`   РУ с парой: ${stats.ruWithRelated}`);
        console.log(`   УЗ с парой: ${stats.uzWithRelated}`);

        // Процесс очистки
        await removeDuplicates();
        await removeOrphans();
        await balanceAndNormalize();
        await verifyPairs();

        console.log('\n📊 ФИНАЛЬНАЯ СТАТИСТИКА');
        stats = await getStats();
        console.log(`   РУ слов: ${stats.ruCount}`);
        console.log(`   УЗ слов: ${stats.uzCount}`);
        console.log(`   РУ с парой: ${stats.ruWithRelated}`);
        console.log(`   УЗ с парой: ${stats.uzWithRelated}`);

        console.log('\n✅ Унификация завершена успешно!');
        
        await mongoose.connection.close();
        process.exit(0);
    } catch (error) {
        console.error('❌ Ошибка:', error.message);
        await mongoose.connection.close();
        process.exit(1);
    }
}

main();
