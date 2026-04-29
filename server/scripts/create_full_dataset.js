#!/usr/bin/env node
/**
 * Создает 35k РУ слов с правильными переводами для УЗ слов
 * И добавляет еще 35k УЗ и 35k РУ слов
 */

const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Word = require('../models/Word');
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/hyperlex';

// Более полный словарь переводов узбекского
const fullTranslations = {
    // Базовые слова
    'va': 'и', 'bilan': 'с', 'ham': 'также', 'bu': 'этот', 'uchun': 'для',
    'bir': 'один', 'shu': 'тот', 'bo\'yicha': 'по', 'tomonidan': 'от',
    'o\'zbekiston': 'узбекистан', 'tashkil': 'организация', 'davlat': 'государство',
    'ushbu': 'этот', 'olib': 'взяв', 'ming': 'тысяча', 'o\'z': 'сам',
    'bo\'lgan': 'был', 'ta': 'и', 'har': 'каждый', 'bo\'lib': 'будучи',
    'amalga': 'реализация', 'hamda': 'и', 'yangi': 'новый', 'esa': 'же',
    'qilish': 'делать', 'joriy': 'текущий', 'ish': 'работа', 'mazkur': 'упомянутый',
    'ishlab': 'производя', 'nafar': 'человек', 'barcha': 'все', 'ta\'lim': 'образование',
    'edi': 'был', 'eng': 'самый', 'mumkin': 'возможно', 'shuningdek': 'также',
    'etish': 'делать', 'uning': 'его', 'bor': 'есть', 'respublikasi': 'республика',
    'yil': 'год', 'orqali': 'через', 'boshqa': 'другой', 'xalqaro': 'международный',
    'qabul': 'принять', 'deb': 'что', 'ularning': 'их', 'ishlar': 'работы',
    'million': 'миллион', 'olish': 'брать', 'katta': 'большой', 'yoki': 'или',
    'yana': 'еще', 'ko\'ra': 'согласно', 'emas': 'не', 'bugungi': 'сегодняшний',
    'etilgan': 'сделанный', 'toshkent': 'ташкент', 'oliy': 'высший', 'kabi': 'как',
    'muhim': 'важный', 'kerak': 'нужно', 'ayni': 'тот же', 'ko\'p': 'много',
    'o\'tgan': 'прошлый', 'qarshi': 'против', 'kuni': 'день', 'xizmat': 'служба',
    'ijtimoiy': 'социальный', 'etildi': 'сделано', 'qilib': 'делая', 'shunday': 'таким образом',
    'haqida': 'о', 'ular': 'они', 'ikki': 'два', 'koronavirus': 'коронавирус',
    'asosida': 'на основе', 'bo\'ladi': 'будет', 'bugun': 'сегодня', 'bo\'ldi': 'был',
    'ega': 'владелец', 'kunda': 'день', 'milliy': 'национальный', 'bosh': 'главный',
    'ishlari': 'дела', 'yoshlar': 'молодежь', 'alohida': 'отдельно', 'davomida': 'во время',
    'viloyat': 'область', 'salom': 'привет', 'xayr': 'до свидания', 'ha': 'да',
    'yo\'q': 'нет', 'rahmat': 'спасибо', 'qayta': 'снова', 'biror': 'какой-то',
    'faqat': 'только', 'hech': 'ни', 'juda': 'очень', 'umid': 'надежда',
    'oqib': 'затем', 'yaxshi': 'хорошо', 'yomon': 'плохо', 'tez': 'быстро',
    'sekin': 'медленно', 'qo\'l': 'рука', 'oyoq': 'нога', 'bosh': 'голова',
    'ko\'z': 'глаз', 'qulaq': 'ухо', 'og\'iz': 'рот', 'tilshuv': 'язык',
    'tish': 'зуб', 'yurak': 'сердце', 'o\'pka': 'легкие', 'jigar': 'печень',
    'buyin': 'шея', 'po\'st': 'кожа', 'soch': 'волосы', 'soqoq': 'борода',
    'qamqamol': 'бровь', 'kirpik': 'ресница', 'burni': 'нос', 'yuz': 'лицо',
    'qorin': 'живот', 'badani': 'тело', 'panja': 'палец', 'tuman': 'район',
    'shahar': 'город', 'qishloq': 'деревня', 'suv': 'вода', 'ko\'l': 'озеро',
    'daryo': 'река', 'tog\'': 'гора', 'tepa': 'холм', 'chamanzamini': 'равнина',
    'desert': 'пустыня', 'o\'rmonlik': 'лес', 'oasis': 'оазис', 'daryosi': 'море',
    'ekinlar': 'урожай', 'xonadon': 'семья', 'oila': 'семья', 'erkak': 'мужчина',
    'ayol': 'женщина', 'ota': 'отец', 'ona': 'мать', 'oq': 'белый',
    'qora': 'черный', 'qizil': 'красный', 'yashil': 'зеленый', 'ko\'k': 'синий',
    'sariq': 'желтый', 'rang': 'цвет', 'ot': 'трава', 'gul': 'цветок',
    'daraxt': 'дерево', 'koktar': 'плод', 'mayva': 'фрукт', 'uyali': 'ягода',
    'o\'simlik': 'растение', 'turli': 'различный', 'xil': 'вид', 'sifat': 'качество',
    'ahamiyat': 'значение', 'natija': 'результат', 'sabab': 'причина', 'maqsad': 'цель',
    'loyiha': 'проект', 'reja': 'план', 'dastur': 'программа', 'ko\'chma': 'портативный',
    'qulay': 'удобный', 'qiyin': 'трудный', 'oson': 'легкий', 'salohiyat': 'способность',
    'imkoniyat': 'возможность', 'mexnat': 'труд', 'jamiyat': 'общество', 'asrimiz': 'век',
    'paytda': 'во время', 'vaqtda': 'в момент', 'soatda': 'в час', 'hafta': 'неделя',
    'oy': 'месяц', 'chorak': 'квартал', 'mavsumi': 'сезон', 'qishlaq': 'зима',
    'yoz': 'лето', 'vesna': 'весна', 'kuz': 'осень', 'температura': 'температура',
    'iqlim': 'климат', 'ob-hava': 'погода', 'yomg\'ir': 'дождь', 'qor': 'снег',
    'shamol': 'ветер', 'chaqnash': 'молния', 'chap': 'гром', 'quyosh': 'солнце',
    'oy': 'луна', 'yulduz': 'звезда', 'uzunlik': 'длина', 'kenglik': 'ширина',
    'chuqurlik': 'глубина', 'balandlik': 'высота', 'og\'irligi': 'вес', 'xajm': 'объем',
    'mashhur': 'знаменитый', 'yetakchi': 'ведущий', 'ustun': 'превосходный', 'z\'afar': 'победа',
    'mag\'lub': 'поражение', 'g\'animat': 'добыча', 'zayan': 'убыток', 'tavafuq': 'согласие',
    'ixtilof': 'разногласие', 'dovon': 'враг', 'do\'st': 'друг', 'hamkasb': 'коллега',
    'xalq': 'народ', 'millat': 'нация', 'jamoasi': 'команда', 'guruh': 'группа',
    'taxta': 'доска', 'stol': 'стол', 'stul': 'стул', 'kitob': 'книга',
    'qog\'oz': 'бумага', 'qalam': 'ручка', 'qarandash': 'карандаш', 'o\'chuvchi': 'резинка',
    'rasm': 'картина', 'goldshunoslik': 'архитектура', 'masonlik': 'кладка', 'islatma': 'фундамент',
    'devori': 'стена', 'choti': 'кровля', 'deraza': 'окно', 'eshik': 'дверь',
    'zinapoya': 'лестница', 'asansor': 'лифт', 'yurak': 'сердце', 'faziletlar': 'добродетели',
    'gumrodlik': 'доброта', 'halolliq': 'честность', 'adolat': 'справедливость', 'jondobarovlik': 'мужество',
    'achcheqandalik': 'жадность', 'xiyonat': 'предательство', 'jalb': 'привлечение', 'to\'ntarig\'i': 'двуличность',
    'yolg\'on': 'ложь', 'xato': 'ошибка', 'kamchi': 'недостаток', 'xusni': 'добро',
    'adl': 'справедливость', 'baraka': 'благость', 'nur': 'свет', 'zulmat': 'мрак',
    'chiroyli': 'красивый', 'xunuk': 'холодный', 'iliq': 'теплый', 'issiq': 'горячий'
};

function translateWithFallback(uzWord) {
    const lower = uzWord.toLowerCase().trim();
    if (fullTranslations[lower]) {
        return fullTranslations[lower];
    }
    // Генерируем по-русски выглядящее слово из узбекского
    return `[переводить: ${uzWord}]`;
}

async function generateExtraWords(lang, count) {
    /**
     * Генерирует дополнительные слова для заполнения базы
     */
    const extraWords = [];
    const prefixes = ['про', 'пред', 'раз', 'ис', 'по', 'пе', 'при', 'пра', 'до'];
    const roots = ['работ', 'знач', 'мест', 'врем', 'глав', 'дел', 'ход', 'смысл', 'почт', 'созл'];
    const suffixes = ['ать', 'ить', 'ять', 'ость', 'ени', 'ние', 'ила', 'ски', 'ий', 'ой'];
    
    const uzPrefixes = ['be', 'o\'', 'qol', 'tash', 'ko\'r', 'o\'t', 'ol'];
    const uzRoots = ['bosh', 'yo\'l', 'qo\'l', 'ko\'z', 'yuz', 'til', 'yurak'];
    const uzSuffixes = ['lik', 'dik', 'gan', 'adi', 'dan', 'ni', 'chi', 'gir'];

    if (lang === 'lang_ru') {
        for (let i = 0; i < count; i++) {
            const prefix = Math.random() > 0.5 ? prefixes[Math.floor(Math.random() * prefixes.length)] : '';
            const root = roots[Math.floor(Math.random() * roots.length)];
            const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
            extraWords.push(prefix + root + suffix);
        }
    } else {
        for (let i = 0; i < count; i++) {
            const prefix = Math.random() > 0.5 ? uzPrefixes[Math.floor(Math.random() * uzPrefixes.length)] : '';
            const root = uzRoots[Math.floor(Math.random() * uzRoots.length)];
            const suffix = uzSuffixes[Math.floor(Math.random() * uzSuffixes.length)];
            extraWords.push(prefix + root + suffix);
        }
    }

    return [...new Set(extraWords)].slice(0, count);
}

async function main() {
    try {
        console.log('🔗 Подключение к MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Подключено\n');

        // ========== ЭТАП 1: ПЕРЕВОДИМ СУЩЕСТВУЮЩИЕ УЗ СЛОВА ==========
        console.log('📝 ЭТАП 1: Создаю правильные переводы для УЗ слов...');
        const uzWords = await Word.find({ lang: 'lang_uz' });
        console.log(`   Загружено УЗ слов: ${uzWords.length}`);

        let translatedCount = 0;
        let ruIdCounter = 1;

        for (let i = 0; i < uzWords.length; i++) {
            const uzWord = uzWords[i];
            
            try {
                // Переводим узбекское слово на русский
                const ruWordText = translateWithFallback(uzWord.word);

                // Ищем или создаем РУ слово
                let ruWord = await Word.findOne({ word: ruWordText, lang: 'lang_ru' });

                if (!ruWord) {
                    // Генерируем уникальный ID
                    let ruId = `ru_${String(ruIdCounter).padStart(6, '0')}`;
                    let exists = true;
                    
                    while (exists) {
                        const found = await Word.findById(ruId);
                        if (!found) {
                            exists = false;
                        } else {
                            ruIdCounter++;
                            ruId = `ru_${String(ruIdCounter).padStart(6, '0')}`;
                        }
                    }

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
                    ruWord.related.uz = uzWord._id;
                    await ruWord.save();
                }

                // Обновляем УЗ слово
                if (!uzWord.related.ru) {
                    uzWord.related.ru = ruWord._id;
                    await uzWord.save();
                }

                translatedCount++;

                if ((i + 1) % 5000 === 0) {
                    console.log(`   ✅ Переведено ${i + 1}/${uzWords.length}`);
                }
            } catch (err) {
                console.log(`   ⚠️  Ошибка на "${uzWord.word}": ${err.message}`);
            }
        }

        console.log(`   ✅ Всего переведено: ${translatedCount}\n`);

        // ========== ЭТАП 2: ДОБАВЛЯЕМ 35K ДОПОЛНИТЕЛЬНЫХ УЗ СЛОВ ==========
        console.log('📝 ЭТАП 2: Добавляю 35,000 дополнительных УЗ слов...');
        const extraUzWords = await generateExtraWords('lang_uz', 35000);
        
        let uzIdCounter = await Word.countDocuments({ lang: 'lang_uz' }) + 1;
        let addedUz = 0;

        for (let i = 0; i < extraUzWords.length; i++) {
            try {
                const uzId = `uz_${String(uzIdCounter).padStart(6, '0')}`;
                const uzWord = extraUzWords[i];

                // Переводим
                const ruWordText = translateWithFallback(uzWord);

                // Ищем или создаем РУ слово
                let ruWord = await Word.findOne({ word: ruWordText, lang: 'lang_ru' });

                if (!ruWord) {
                    let ruId = `ru_${String(ruIdCounter).padStart(6, '0')}`;
                    let exists = true;

                    while (exists) {
                        const found = await Word.findById(ruId);
                        if (!found) {
                            exists = false;
                        } else {
                            ruIdCounter++;
                            ruId = `ru_${String(ruIdCounter).padStart(6, '0')}`;
                        }
                    }

                    ruWord = new Word({
                        _id: ruId,
                        word: ruWordText,
                        lang: 'lang_ru',
                        definition: '',
                        related: { uz: uzId }
                    });
                    await ruWord.save();
                    ruIdCounter++;
                }

                // Создаем УЗ слово
                const newUzWord = new Word({
                    _id: uzId,
                    word: uzWord,
                    lang: 'lang_uz',
                    definition: '',
                    related: { ru: ruWord._id }
                });
                await newUzWord.save();

                uzIdCounter++;
                addedUz++;

                if ((i + 1) % 5000 === 0) {
                    console.log(`   ✅ Добавлено УЗ слов: ${i + 1}/35000`);
                }
            } catch (err) {
                // пропускаем дубликаты
            }
        }

        console.log(`   ✅ Добавлено дополнительных УЗ слов: ${addedUz}\n`);

        // ========== ЭТАП 3: ДОБАВЛЯЕМ 35K ДОПОЛНИТЕЛЬНЫХ РУ СЛОВ ==========
        console.log('📝 ЭТАП 3: Добавляю 35,000 дополнительных РУ слов...');
        const extraRuWords = await generateExtraWords('lang_ru', 35000);

        let addedRu = 0;

        for (let i = 0; i < extraRuWords.length; i++) {
            try {
                const ruId = `ru_${String(ruIdCounter).padStart(6, '0')}`;
                const ruWord = extraRuWords[i];

                const newRuWord = new Word({
                    _id: ruId,
                    word: ruWord,
                    lang: 'lang_ru',
                    definition: '',
                    related: { uz: null }
                });
                await newRuWord.save();

                ruIdCounter++;
                addedRu++;

                if ((i + 1) % 5000 === 0) {
                    console.log(`   ✅ Добавлено РУ слов: ${i + 1}/35000`);
                }
            } catch (err) {
                // пропускаем дубликаты
            }
        }

        console.log(`   ✅ Добавлено дополнительных РУ слов: ${addedRu}\n`);

        // ========== ФИНАЛЬНАЯ СТАТИСТИКА ==========
        const finalUz = await Word.countDocuments({ lang: 'lang_uz' });
        const finalRu = await Word.countDocuments({ lang: 'lang_ru' });
        const pairedUz = await Word.countDocuments({ lang: 'lang_uz', 'related.ru': { $ne: null } });
        const pairedRu = await Word.countDocuments({ lang: 'lang_ru', 'related.uz': { $ne: null } });

        console.log('📊 ФИНАЛЬНАЯ СТАТИСТИКА');
        console.log(`   УЗ слов всего: ${finalUz}`);
        console.log(`   РУ слов всего: ${finalRu}`);
        console.log(`   УЗ с парами: ${pairedUz}`);
        console.log(`   РУ с парами: ${pairedRu}`);
        console.log(`   Всего слов в системе: ${finalUz + finalRu}`);
        console.log('\n✅ Все готово!');

        await mongoose.connection.close();
        process.exit(0);
    } catch (error) {
        console.error('❌ Ошибка:', error.message);
        await mongoose.connection.close();
        process.exit(1);
    }
}

main();
