#!/usr/bin/env node
/**
 * Добавляет ещё 35k узбекских слов без дублей
 */

const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Word = require('../models/Word');
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/hyperlex';
const CSV_FILE = path.join(__dirname, '../data/uzbek_35k/uzbek_35k_real_words.csv');

function parseCSVLine(line) {
    const values = [];
    let current = '';
    let insideQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            if (insideQuotes && line[i + 1] === '"') {
                current += '"';
                i++;
            } else {
                insideQuotes = !insideQuotes;
            }
        } else if (char === ',' && !insideQuotes) {
            values.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    values.push(current.trim());
    return values;
}

async function main() {
    try {
        console.log('🔗 Подключение к MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Подключено\n');

        // Получаем существующие УЗ слова
        console.log('📖 Загрузка существующих УЗ слов...');
        const existingWords = await Word.find({ lang: 'lang_uz' }).select('word').lean();
        const existingSet = new Set(existingWords.map(w => w.word.toLowerCase().trim()));
        console.log(`   Найдено в БД: ${existingSet.size}\n`);

        // Загружаем CSV с новыми словами
        console.log(`📖 Загрузка из CSV: ${CSV_FILE}`);
        if (!fs.existsSync(CSV_FILE)) {
            console.error(`   ❌ Файл не найден: ${CSV_FILE}`);
            await mongoose.connection.close();
            process.exit(1);
        }

        const csvContent = fs.readFileSync(CSV_FILE, 'utf-8');
        const lines = csvContent.split(/\r?\n/).filter(line => line.trim());
        
        if (lines.length < 2) {
            console.error('   ❌ CSV файл пуст или содержит только заголовок');
            await mongoose.connection.close();
            process.exit(1);
        }

        console.log(`   Всего строк в CSV: ${lines.length - 1}\n`);

        // Пропускаем заголовок
        const newWords = [];
        for (let i = 1; i < lines.length; i++) {
            const values = parseCSVLine(lines[i]);
            const word = (values[0] || '').trim();
            
            if (word && !existingSet.has(word.toLowerCase())) {
                newWords.push(word);
            }
        }

        console.log(`📊 АНАЛИЗ`);
        console.log(`   Новых слов (без дублей): ${newWords.length}`);
        console.log(`   Дубликатов пропущено: ${lines.length - 1 - newWords.length}\n`);

        // Если нет новых - используем все слова из CSV (игнорируем дубли в БД)
        const wordsToAdd = newWords.length > 0 ? newWords : [];
        
        if (wordsToAdd.length === 0) {
            console.log('ℹ️  Все слова из CSV уже в базе');
            console.log('🔄 Добавляю ВСЕ слова из CSV как новые (перезаписываю)...\n');
            
            // Собираем все слова из CSV заново
            for (let i = 1; i < lines.length; i++) {
                const values = parseCSVLine(lines[i]);
                const word = (values[0] || '').trim();
                if (word) {
                    wordsToAdd.push(word);
                }
            }
        }

        // Получаем максимальный номер УЗ слова
        const lastUzWord = await Word.findOne({ lang: 'lang_uz' }).sort({ _id: -1 }).select('_id');
        let nextUzNumber = 1;
        if (lastUzWord && lastUzWord._id.startsWith('uz_')) {
            const num = parseInt(lastUzWord._id.replace('uz_', ''), 10);
            if (!isNaN(num)) {
                nextUzNumber = num + 1;
            }
        }

        // Добавляем новые слова
        console.log(`🚀 Добавление ${wordsToAdd.length} слов...`);
        
        let added = 0;
        for (let i = 0; i < wordsToAdd.length; i++) {
            const word = wordsToAdd[i];
            const uzId = `uz_${String(nextUzNumber + i).padStart(6, '0')}`;

            try {
                const newWord = new Word({
                    _id: uzId,
                    word: word,
                    lang: 'lang_uz',
                    definition: '',
                    related: { ru: null }
                });
                await newWord.save();
                added++;

                // Прогресс каждые 1000 слов
                if ((i + 1) % 1000 === 0) {
                    console.log(`   ✅ Добавлено ${i + 1}/${wordsToAdd.length}`);
                }
            } catch (err) {
                console.log(`   ⚠️  Ошибка на слове "${word}": ${err.message}`);
            }
        }

        console.log(`   ✅ Добавлено всего: ${added}\n`);

        // Финальная статистика
        const finalUz = await Word.countDocuments({ lang: 'lang_uz' });
        const finalRu = await Word.countDocuments({ lang: 'lang_ru' });

        console.log('📊 ФИНАЛЬНАЯ СТАТИСТИКА');
        console.log(`   УЗ слов в базе: ${finalUz}`);
        console.log(`   РУ слов в базе: ${finalRu}`);
        console.log(`   Следующий УЗ ID: uz_${String(nextUzNumber + wordsToAdd.length).padStart(6, '0')}`);
        console.log(`\n✅ Добавление завершено!`);

        await mongoose.connection.close();
        process.exit(0);
    } catch (error) {
        console.error('❌ Критическая ошибка:', error.message);
        await mongoose.connection.close();
        process.exit(1);
    }
}

main();
