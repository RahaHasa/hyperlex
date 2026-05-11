/**
 * Import Script - Импорт иерархических данных из JSON
 * Использование: node import_hierarchy.js <path-to-json>
 */

require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const { connectDB } = require('../config/database');
const Word = require('../models/Word');
const {
    validateImportData,
    buildSemanticGraph,
    formatHierarchy,
    generateSemanticKey,
    normalizeWord
} = require('../utils/semanticHelper');

const jsonFilePath = process.argv[2];

async function importHierarchy() {
    try {
        // Проверяем аргумент
        if (!jsonFilePath) {
            console.error('Usage: node import_hierarchy.js <path-to-json>');
            console.error('Example: node import_hierarchy.js ./data/hierarchy.json');
            process.exit(1);
        }

        // Проверяем существование файла
        if (!fs.existsSync(jsonFilePath)) {
            console.error(`File not found: ${jsonFilePath}`);
            process.exit(1);
        }

        console.log('📥 Импорт иерархических данных...\n');

        // Подключаемся к БД
        await connectDB();
        console.log('✅ БД подключена\n');

        // Читаем JSON
        const fileContent = fs.readFileSync(jsonFilePath, 'utf-8');
        let importData;
        
        try {
            importData = JSON.parse(fileContent);
        } catch (e) {
            console.error('❌ Ошибка парсинга JSON:', e.message);
            process.exit(1);
        }

        // Валидируем данные
        console.log('🔍 Валидация данных...');
        const validation = validateImportData(importData);
        
        if (!validation.valid) {
            console.error('❌ Ошибки валидации:');
            validation.errors.forEach(err => console.error(`   - ${err}`));
            process.exit(1);
        }
        console.log('✅ Данные валидны\n');

        // Строим граф
        console.log('📊 Построение семантического графа...');
        const graph = buildSemanticGraph(importData);
        const totalWords = Object.keys(graph).length;
        console.log(`✅ Создано ${totalWords} концептов\n`);

        // Очищаем коллекцию (осторожно!)
        console.log('🗑️  Очистка коллекции Words...');
        await Word.deleteMany({});
        console.log('✅ Коллекция очищена\n');

        // Вставляем слова в БД
        console.log('💾 Сохранение в БД...');
        const wordsToInsert = Object.entries(graph).map(([key, data]) => ({
            semantic_key: key,
            ru: data.ru,
            uz: data.uz,
            normalized_ru: data.normalized_ru,
            normalized_uz: data.normalized_uz,
            description_ru: data.description_ru,
            description_uz: data.description_uz,
            category: data.category,
            parent_semantic_key: data.parent_semantic_key,
            children_semantic_keys: data.children_semantic_keys,
            related: data.related,
            createdAt: new Date(),
            updatedAt: new Date()
        }));

        const inserted = await Word.insertMany(wordsToInsert);
        console.log(`✅ Сохранено ${inserted.length} слов\n`);

        // Выводим статистику и примеры иерархии
        console.log('📈 СТАТИСТИКА:');
        console.log(`   • Всего концептов: ${totalWords}`);
        
        const rootWords = inserted.filter(w => !w.parent_semantic_key);
        console.log(`   • Root концептов: ${rootWords.length}`);
        
        const categories = new Set(inserted.map(w => w.category));
        console.log(`   • Категории: ${Array.from(categories).join(', ')}\n`);

        // Выводим примеры иерархии
        if (rootWords.length > 0) {
            console.log('🌳 ПРИМЕРЫ ИЕРАРХИИ:\n');
            
            for (const root of rootWords) {
                const tree = await root.getTreeStructure();
                const formatted = formatHierarchy(tree);
                console.log(formatted);
            }
        }

        console.log('✅ ✅ ✅ Импорт завершён успешно! ✅ ✅ ✅\n');
        process.exit(0);

    } catch (error) {
        console.error('❌ Ошибка:', error.message);
        if (error.stack) {
            console.error('\nStack trace:');
            console.error(error.stack);
        }
        process.exit(1);
    }
}

// Запускаем импорт
importHierarchy();
