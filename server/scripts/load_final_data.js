/**
 * Скрипт загрузки финального формата данных
 */

const path = require('path');
const mongoose = require('mongoose');
const fs = require('fs');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI, {}).then(async () => {
  console.log('📀 Подключено к БД: hyperlex');
  
  const Word = require('../models/Word.js');
  
  const dataPath = path.join(__dirname, '../data/final_data.json');
  // Загружаем новый формат
  const finalData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  console.log('📖 Загружено ключей:', Object.keys(finalData).length);
  
  // Очищаем старые данные
  await Word.deleteMany({});
  console.log('🗑️  БД очищена');
  
  // Преобразуем формат
  const words = Object.entries(finalData).map(([semanticKey, data]) => ({
    semantic_key: semanticKey,
    ru: data.ru,
    uz: data.uz,
    normalized_ru: data.ru.toLowerCase(),
    normalized_uz: data.uz.toLowerCase(),
    description_ru: data.description_ru || '',
    description_uz: data.description_uz || '',
    category: data.category || 'general',
    parent_semantic_key: data.parent || null,
    children_semantic_keys: [],
    related: data.related || []
  }));
  
  // Вставляем в БД
  const inserted = await Word.insertMany(words);
  console.log('✅ Загружено слов:', inserted.length);
  
  // Обновляем parent-child связи
  for (const doc of inserted) {
    if (doc.parent_semantic_key) {
      const parent = await Word.findOne({ semantic_key: doc.parent_semantic_key });
      if (parent && !parent.children_semantic_keys.includes(doc.semantic_key)) {
        parent.children_semantic_keys.push(doc.semantic_key);
        await parent.save();
      }
    }
  }
  
  console.log('🔗 Иерархия установлена');
  
  // Показываем статистику
  const categories = new Set(inserted.map(w => w.category));
  console.log('📊 Категории:', Array.from(categories));
  console.log('\n✨ Все готово! БД обновлена с финальными данными.');
  
  process.exit(0);
}).catch(err => {
  console.error('❌ Ошибка:', err.message);
  process.exit(1);
});
