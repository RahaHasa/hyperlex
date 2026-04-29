#!/usr/bin/env node
/**
 * Скрипт для создания пар русско-узбекских слов в MongoDB
 * 
 * Процесс:
 * 1. Читает CSV с 35k узбекскими словами
 * 2. Для каждого переводит на русский (libretranslate)
 * 3. Создает русское слово в MongoDB
 * 4. Связывает их через related поле
 * 5. Результат: 35k пар (70k слов всего)
 */

const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const http = require('http');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Word = require('../models/Word');
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/hyperlex';
const UZ_CSV = path.join(__dirname, '../data/uzbek_35k/uzbek_35k_real_words.csv');

// Простой парсер CSV
function parseCSV(content) {
    const lines = content.trim().split('\n');
    const result = [];
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line) result.push(line);
    }
    return result;
}

// Функция перевода через libretranslate
async function translateUzToRu(uzWord) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify({
            q: uzWord,
            source: 'uz',
            target: 'ru'
        });

        const options = {
            hostname: 'localhost',
            port: 5000,
            path: '/translate',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': data.length
            }
        };

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    const result = JSON.parse(body);
                    resolve(result.translatedText);
                } catch (e) {
                    resolve(null);
                }
            });
        });

        req.on('error', (e) => {
            resolve(null); // При ошибке возвращаем null
        });

        req.write(data);
        req.end();
    });
}

// Альтернативный перевод через простую подстановку (если libretranslate недоступен)
const basicTranslations = {
    'va': 'и',
    'bilan': 'с',
    'ham': 'также',
    'bu': 'этот',
    'o\'z': 'сам',
    'qilish': 'делать',
    'salom': 'привет',
    'xayr': 'до свидания',
    'rahmat': 'спасибо',
    'iltimos': 'пожалуйста'
};

function translateBasic(uzWord) {
    if (basicTranslations[uzWord.toLowerCase()]) {
        return basicTranslations[uzWord.toLowerCase()];
    }
    // Простая эвристика: если слово на узбекском, вернуть примерный перевод
    return `[${uzWord}]`; // Пометить как неизвестное
}

async function main() {
    try {
        console.log('🔗 Подключение к MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Подключено');

        // Читаем CSV
        console.log('\n📖 Чтение узбекских слов...');
        const csvContent = fs.readFileSync(UZ_CSV, 'utf-8');
        const uzWords = parseCSV(csvContent).filter(w => w && w.trim());
        console.log(`   Загружено слов: ${uzWords.length}`);

        let created = 0;
        let errors = [];
        let skipped = 0;

        console.log('\n🚀 Создание пар слов (uz → ru)...');
        console.log('   ℹ️  Если libretranslate недоступен, будет использован базовый перевод');

        for (let i = 0; i < uzWords.length; i++) {
            const uzWord = uzWords[i].trim();
            if (!uzWord) {
                skipped++;
                continue;
            }

            try {
                // Проверяем есть ли уже такое слово
                const existing = await Word.findOne({ word: uzWord, lang: 'lang_uz' });
                if (existing) {
                    console.log(`   ⏭️  Пропущено (существует): ${uzWord}`);
                    skipped++;
                    continue;
                }

                // Переводим
                let ruWord = await translateUzToRu(uzWord);
                if (!ruWord) {
                    ruWord = translateBasic(uzWord);
                }

                // ID для новых слов
                const uzId = `uz_${String(i + 1).padStart(6, '0')}`;
                const ruId = `ru_${String(i + 1).padStart(6, '0')}`;

                // Создаем узбекское слово
                const uzDoc = new Word({
                    _id: uzId,
                    word: uzWord,
                    lang: 'lang_uz',
                    definition: '',
                    related: { ru: ruId }
                });

                // Создаем русское слово
                const ruDoc = new Word({
                    _id: ruId,
                    word: ruWord.trim(),
                    lang: 'lang_ru',
                    definition: '',
                    related: { uz: uzId }
                });

                await Promise.all([uzDoc.save(), ruDoc.save()]);
                created++;

                // Прогресс каждые 100 слов
                if ((i + 1) % 100 === 0) {
                    console.log(`   ✅ Обработано ${i + 1}/${uzWords.length}`);
                }
            } catch (err) {
                errors.push(`Ошибка на слове "${uzWord}": ${err.message}`);
                if (errors.length <= 5) {
                    console.log(`   ⚠️  ${errors[errors.length - 1]}`);
                }
            }
        }

        console.log('\n📊 ИТОГОВАЯ СТАТИСТИКА');
        const ruCount = await Word.countDocuments({ lang: 'lang_ru' });
        const uzCount = await Word.countDocuments({ lang: 'lang_uz' });
        console.log(`   ✅ РУ слов создано: ${ruCount}`);
        console.log(`   ✅ УЗ слов создано: ${uzCount}`);
        console.log(`   ℹ️  Пропущено (существующих): ${skipped}`);
        console.log(`   ℹ️  Ошибок: ${errors.length}`);

        if (errors.length > 5) {
            console.log(`   ... и еще ${errors.length - 5} ошибок`);
        }

        console.log('\n✅ Импорт завершен!');
        console.log('   💡 Совет: если переводы неполные, установите libretranslate:');
        console.log('   pip install libretranslate');
        console.log('   libretranslate --port 5000');

        await mongoose.connection.close();
        process.exit(0);
    } catch (error) {
        console.error('❌ Критическая ошибка:', error.message);
        await mongoose.connection.close();
        process.exit(1);
    }
}

main();
