#!/usr/bin/env node
/**
 * Скрипт для создания пар существующих слов в MongoDB
 * 
 * Процесс:
 * 1. Находит все УЗ слова в базе
 * 2. Для каждого переводит на русский через основной перевод
 * 3. Ищет или создает РУ слово в базе
 * 4. Связывает их через related поле
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Word = require('../models/Word');
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/hyperlex';

// Простые переводы базовых слов
const basicTranslations = {
    'va': 'и',
    'bilan': 'с',
    'ham': 'также',
    'bu': 'этот',
    'uchun': 'для',
    'bir': 'один',
    'shu': 'тот',
    'bo\'yicha': 'по',
    'tomonidan': 'от',
    'o\'zbekiston': 'узбекистан',
    'tashkil': 'форма',
    'davlat': 'государство',
    'ushbu': 'этот',
    'olib': 'взяв',
    'ming': 'тысяча',
    'o\'z': 'сам',
    'bo\'lgan': 'был',
    'ta': 'и',
    'har': 'каждый',
    'bo\'lib': 'будучи',
    'amalga': 'реализация',
    'hamda': 'и',
    'yangi': 'новый',
    'esa': 'же',
    'qilish': 'делать',
    'joriy': 'текущий',
    'ish': 'работа',
    'mazkur': 'упомянутый',
    'ishlab': 'производя',
    'nafar': 'человек',
    'barcha': 'все',
    'ta\'lim': 'образование',
    'edi': 'был',
    'eng': 'самый',
    'mumkin': 'возможно',
    'shuningdek': 'также',
    'etish': 'делать',
    'uning': 'его',
    'bor': 'есть',
    'respublikasi': 'республика',
    'yil': 'год',
    'orqali': 'через',
    'boshqa': 'другой',
    'xalqaro': 'международный',
    'qabul': 'принять',
    'deb': 'что',
    'ularning': 'их',
    'ishlar': 'работы',
    'million': 'миллион',
    'olish': 'брать',
    'katta': 'большой',
    'yoki': 'или',
    'yana': 'еще',
    'ko\'ra': 'согласно',
    'emas': 'не',
    'bugungi': 'сегодняшний',
    'etilgan': 'сделанный',
    'toshkent': 'ташкент',
    'oliy': 'высший',
    'kabi': 'как',
    'muhim': 'важный',
    'kerak': 'нужно',
    'ayni': 'тот же',
    'ko\'p': 'много',
    'o\'tgan': 'прошлый',
    'qarshi': 'против',
    'kuni': 'день',
    'xizmat': 'служба',
    'ijtimoiy': 'социальный',
    'etildi': 'сделано',
    'qilib': 'делая',
    'shunday': 'таким образом',
    'haqida': 'о',
    'ular': 'они',
    'ikki': 'два',
    'koronavirus': 'коронавирус',
    '-yil': 'год',
    'asosida': 'на основе',
    'bo\'ladi': 'будет',
    'bugun': 'сегодня',
    'bo\'ldi': 'был',
    'ega': 'владелец',
    'kunda': 'день',
    'milliy': 'национальный',
    'bosh': 'главный',
    'ishlari': 'дела',
    'yoshlar': 'молодежь',
    'alohida': 'отдельно',
    'davomida': 'во время',
    'viloyat': 'область'
};

function translateUzToRu(uzWord) {
    const lower = uzWord.toLowerCase().trim();
    if (basicTranslations[lower]) {
        return basicTranslations[lower];
    }
    // Если нет в словаре - вернуть слово с пометкой
    return `[${uzWord}]`;
}

async function generateUniqueRuId() {
    // Находим максимальный ID для РУ слов и генерируем следующий
    const existingRu = await Word.findOne({ lang: 'lang_ru' })
        .sort({ _id: -1 })
        .limit(1);
    
    let nextNum = 1;
    if (existingRu && existingRu._id.startsWith('ru_')) {
        try {
            const num = parseInt(existingRu._id.substring(3));
            if (!isNaN(num)) {
                nextNum = num + 1;
            }
        } catch (e) { }
    }
    
    return `ru_${String(nextNum).padStart(6, '0')}`;
}

async function main() {
    try {
        console.log('🔗 Подключение к MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Подключено');

        // Получаем все УЗ слова
        console.log('\n📖 Загрузка УЗ слов из базы...');
        const uzWords = await Word.find({ lang: 'lang_uz' }).select('_id word related');
        console.log(`   Найдено УЗ слов: ${uzWords.length}`);

        let paired = 0;
        let updated = 0;
        let errors = [];
        let ruIdCounter = 1;

        console.log('\n🚀 Создание пар (UZ → RU)...');

        for (let i = 0; i < uzWords.length; i++) {
            const uzWord = uzWords[i];

            try {
                // Если уже есть пара - пропускаем
                if (uzWord.related.ru) {
                    continue;
                }

                // Переводим узбекское слово на русский
                const ruWordText = translateUzToRu(uzWord.word);

                // Проверяем есть ли уже такое РУ слово
                let ruWord = await Word.findOne({ word: ruWordText, lang: 'lang_ru' });

                if (!ruWord) {
                    // Генерируем уникальный ID для РУ слова
                    let ruId = `ru_${String(ruIdCounter).padStart(6, '0')}`;
                    let idExists = true;
                    
                    // Убеждаемся что ID уникален
                    while (idExists) {
                        const existing = await Word.findById(ruId);
                        if (!existing) {
                            idExists = false;
                        } else {
                            ruIdCounter++;
                            ruId = `ru_${String(ruIdCounter).padStart(6, '0')}`;
                        }
                    }
                    
                    // Создаем новое РУ слово с явным ID
                    ruWord = new Word({
                        _id: ruId,
                        word: ruWordText,
                        lang: 'lang_ru',
                        definition: '',
                        related: { uz: uzWord._id }
                    });
                    await ruWord.save();
                    ruIdCounter++;
                } else {
                    // Обновляем существующее РУ слово
                    ruWord.related.uz = uzWord._id;
                    await ruWord.save();
                }

                // Обновляем УЗ слово со ссылкой на РУ
                uzWord.related.ru = ruWord._id;
                await uzWord.save();

                paired++;

                // Прогресс каждые 500 слов
                if ((i + 1) % 500 === 0) {
                    console.log(`   ✅ Обработано ${i + 1}/${uzWords.length}`);
                }
            } catch (err) {
                errors.push(`Ошибка на слове "${uzWord.word}": ${err.message}`);
                if (errors.length <= 5) {
                    console.log(`   ⚠️  ${errors[errors.length - 1]}`);
                }
            }
        }

        console.log('\n📊 ИТОГОВАЯ СТАТИСТИКА');
        const ruCount = await Word.countDocuments({ lang: 'lang_ru' });
        const uzCount = await Word.countDocuments({ lang: 'lang_uz' });
        const ruWithPair = await Word.countDocuments({ lang: 'lang_ru', 'related.uz': { $ne: null } });
        const uzWithPair = await Word.countDocuments({ lang: 'lang_uz', 'related.ru': { $ne: null } });

        console.log(`   📈 РУ слов всего: ${ruCount}`);
        console.log(`   📈 УЗ слов всего: ${uzCount}`);
        console.log(`   🔗 РУ с парой: ${ruWithPair}`);
        console.log(`   🔗 УЗ с парой: ${uzWithPair}`);
        console.log(`   ✅ Создано пар: ${paired}`);
        console.log(`   ℹ️  Ошибок: ${errors.length}`);

        console.log('\n✅ Создание пар завершено!');

        await mongoose.connection.close();
        process.exit(0);
    } catch (error) {
        console.error('❌ Критическая ошибка:', error.message);
        await mongoose.connection.close();
        process.exit(1);
    }
}

main();
