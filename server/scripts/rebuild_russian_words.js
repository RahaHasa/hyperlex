#!/usr/bin/env node
/**
 * Скрипт для пересоздания РУ слов с парами от УЗ слов
 * 
 * Процесс:
 * 1. Удаляет ВСЕ РУ слова из базы
 * 2. Берет все УЗ слова
 * 3. Переводит каждое на РУ
 * 4. Создает новые РУ слова с парами
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Word = require('../models/Word');
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/hyperlex';

// Словарь базовых переводов
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
    'viloyat': 'область',
    'qo\'l': 'рука',
    'qadam': 'шаг',
    'qalb': 'сердце',
    'qancha': 'сколько',
    'qavs': 'скобка',
    'qaynashish': 'кипеть',
    'o\'g\'li': 'сын',
    'o\'qituvchi': 'учитель',
    'o\'smirmta': 'подросток',
    'o\'tash': 'проходить',
    'o\'z': 'сам',
    'o\'zaro': 'взаимно',
    'o\'zgarish': 'изменение',
    'o\'ziga': 'себе',
    'o\'zini': 'себя',
    'o\'zining': 'свой',
    'o\'zlashtirish': 'освоение',
    'o\'zpak': 'самолет',
    'o\'ztutish': 'сдержать',
    'paydalar': 'интервалы',
    'palitra': 'палитра',
    'pamyatnik': 'памятник',
    'parchasi': 'его часть',
    'pardolatish': 'завеиватьсь',
    'parev': 'пар',
    'parfyum': 'парфюм',
    'pargit': 'пергамент',
    'parishan': 'взволнованный',
    'parket': 'паркет',
    'parol': 'пароль',
    'partiya': 'партия',
    'parzandshunoslik': 'генетика',
    'pas': 'затем',
    'pasayt': 'спуск',
    'pasayish': 'снижение',
    'pasayit': 'нис',
    'pasdaran': 'стражник',
    'pashman': 'шерсть',
    'pashoq': 'жара',
    'paskoz': 'сахар',
    'paslavchi': 'ссорящий',
    'pasmaki': 'лента',
    'pasmi': 'нить',
    'pasmola': 'шпагат',
    'pasof': 'блюдо',
    'pasport': 'паспорт',
    'passaval': 'проход',
    'passoron': 'переход',
    'pastajon': 'контроль',
    'pastaki': 'низший',
    'pastan': 'утихание',
    'pastang': 'низко',
    'pastarami': 'аньяст',
    'pastarash': 'утончение',
    'pastari': 'тесто',
    'pastarik': 'худший',
    'pastarm': 'вялое мясо',
    'pastash': 'утончение',
    'pastayli': 'тонкостенный',
    'pastda': 'внизу'
};

function translateUzToRu(uzWord) {
    const lower = uzWord.toLowerCase().trim();
    if (basicTranslations[lower]) {
        return basicTranslations[lower];
    }
    // Простой fallback
    return uzWord + '_пер';
}

async function main() {
    try {
        console.log('🔗 Подключение к MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Подключено\n');

        // 1. Удаляем ВСЕ РУ слова
        console.log('🗑️  Удаление всех РУ слов...');
        const deleteResult = await Word.deleteMany({ lang: 'lang_ru' });
        console.log(`   ✅ Удалено РУ слов: ${deleteResult.deletedCount}\n`);

        // 2. Загружаем все УЗ слова
        console.log('📖 Загрузка УЗ слов из базы...');
        const uzWords = await Word.find({ lang: 'lang_uz' }).select('_id word');
        console.log(`   ✅ Загружено УЗ слов: ${uzWords.length}\n`);

        // 3. Создаем РУ слова с парами
        console.log('🚀 Создание РУ слов с парами от УЗ...');
        let created = 0;
        let errors = [];

        for (let i = 0; i < uzWords.length; i++) {
            const uzWord = uzWords[i];
            
            try {
                // Переводим на русский
                const ruWordText = translateUzToRu(uzWord.word);
                const ruId = `ru_${String(i + 1).padStart(6, '0')}`;

                // Создаем РУ слово с паройот УЗ
                const ruWord = new Word({
                    _id: ruId,
                    word: ruWordText,
                    lang: 'lang_ru',
                    definition: '',
                    related: { uz: uzWord._id }
                });

                await ruWord.save();

                // Обновляем УЗ слово со ссылкой на новое РУ
                await Word.findByIdAndUpdate(
                    uzWord._id,
                    { $set: { 'related.ru': ruId } }
                );

                created++;

                // Прогресс каждые 5000 слов
                if ((i + 1) % 5000 === 0) {
                    console.log(`   ✅ Создано ${i + 1}/${uzWords.length}`);
                }
            } catch (err) {
                errors.push(`Слово "${uzWord.word}" (${uzWord._id}): ${err.message}`);
            }
        }

        console.log('\n📊 ИТОГОВАЯ СТАТИСТИКА');
        const ruCount = await Word.countDocuments({ lang: 'lang_ru' });
        const uzCount = await Word.countDocuments({ lang: 'lang_uz' });
        const ruWithPair = await Word.countDocuments({ lang: 'lang_ru', 'related.uz': { $ne: null } });
        const uzWithPair = await Word.countDocuments({ lang: 'lang_uz', 'related.ru': { $ne: null } });

        console.log(`   📦 РУ слов всего: ${ruCount}`);
        console.log(`   📦 УЗ слов всего: ${uzCount}`);
        console.log(`   🔗 РУ с парой: ${ruWithPair}`);
        console.log(`   🔗 УЗ с парой: ${uzWithPair}`);
        console.log(`   ✅ Создано: ${created}`);
        if (errors.length > 0) {
            console.log(`   ⚠️  Ошибок: ${errors.length}`);
            if (errors.length <= 10) {
                errors.forEach(err => console.log(`      - ${err}`));
            }
        }

        console.log('\n✅ Перестроение РУ слов завершено!');

        await mongoose.connection.close();
        process.exit(0);
    } catch (error) {
        console.error('❌ Критическая ошибка:', error.message);
        await mongoose.connection.close();
        process.exit(1);
    }
}

main();
