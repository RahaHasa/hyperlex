/**
 * Проверить количество слов в БД по языкам
 */

const mongoose = require('mongoose');
const Word = require('./models/Word');

async function checkWords() {
    try {
        // Подключение к MongoDB
        await mongoose.connect('mongodb://localhost:27017/hyperlex', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        
        console.log('✅ Подключено к MongoDB\n');
        
        // Количество русских слов
        const rusWords = await Word.countDocuments({ lang: 'lang_ru' });
        console.log(`🇷🇺 Русских слов: ${rusWords}`);
        
        // Количество узбекских слов
        const uzWords = await Word.countDocuments({ lang: 'lang_uz' });
        console.log(`🇺🇿 Узбекских слов: ${uzWords}`);
        
        // Общее количество
        const total = await Word.countDocuments();
        console.log(`\n📊 Всего слов: ${total}`);
        
        // Показать примеры
        console.log('\n--- Примеры русских слов ---');
        const ruSamples = await Word.find({ lang: 'lang_ru' }).limit(3);
        ruSamples.forEach(w => console.log(`  ${w._id}: ${w.word}`));
        
        console.log('\n--- Примеры узбекских слов ---');
        const uzSamples = await Word.find({ lang: 'lang_uz' }).limit(3);
        uzSamples.forEach(w => console.log(`  ${w._id}: ${w.word}`));
        
        // Проверка на ошибки
        if (rusWords !== 21) console.warn(`⚠️  Ожидается 21 русское слово, найдено: ${rusWords}`);
        if (uzWords !== 21) console.warn(`⚠️  Ожидается 21 узбекское слово, найдено: ${uzWords}`);
        
        if (rusWords === 21 && uzWords === 21) {
            console.log('\n✅ БД правильно заполнена! 21 + 21 = 42 слова');
        }
        
        await mongoose.connection.close();
        process.exit(0);
    } catch (error) {
        console.error('❌ Ошибка:', error.message);
        process.exit(1);
    }
}

checkWords();
