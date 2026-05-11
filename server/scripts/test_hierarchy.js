/**
 * Test Script - Тестирование новой системы иерархии
 * Использование: node test_hierarchy.js
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const {
    normalizeWord,
    generateSemanticKey,
    buildSemanticGraph,
    validateImportData,
    formatHierarchy
} = require('../utils/semanticHelper');

console.log('🧪 ТЕСТИРОВАНИЕ СИСТЕМЫ ИЕРАРХИИ\n');

// ===== ТЕСТ 1: Нормализация =====
console.log('TEST 1️⃣  - Нормализация слов');
console.log('─'.repeat(50));

const testWords = [
    { word: 'Собака', lang: 'ru', expected: 'собака' },
    { word: 'ЖИВОТНОЕ', lang: 'ru', expected: 'животное' },
    { word: 'It', lang: 'uz', expected: 'it' },
    { word: 'Hayvon', lang: 'uz', expected: 'hayvon' }
];

let passed = 0;
for (const test of testWords) {
    const result = normalizeWord(test.word, test.lang);
    const status = result === test.expected ? '✅' : '❌';
    console.log(`${status} "${test.word}" → "${result}"`);
    if (result === test.expected) passed++;
}
console.log(`\nРезультат: ${passed}/${testWords.length} тестов пройдено\n`);

// ===== ТЕСТ 2: Генерация семантических ключей =====
console.log('TEST 2️⃣  - Генерация семантических ключей');
console.log('─'.repeat(50));

const keys = [
    generateSemanticKey('Животное', 'Hayvon'),
    generateSemanticKey('Собака', 'It'),
    generateSemanticKey('Машина', 'Mashina')
];

console.log('Сгенерированные ключи:');
for (const key of keys) {
    console.log(`✅ ${key}`);
}
console.log(`\nВсе ключи уникальны: ${new Set(keys).size === keys.length ? '✅ ДА' : '❌ НЕТ'}\n`);

// ===== ТЕСТ 3: Валидация JSON =====
console.log('TEST 3️⃣  - Валидация JSON');
console.log('─'.repeat(50));

const validData = [
    {
        ru: 'Животное',
        uz: 'Hayvon',
        description_ru: 'Test',
        description_uz: 'Test'
    },
    {
        ru: 'Собака',
        uz: 'It',
        parent_ru: 'Животное'
    }
];

const validation = validateImportData(validData);
console.log(`✅ Валидные данные: ${validation.valid ? 'PASS' : 'FAIL'}`);

const invalidData = [
    { uz: 'Hayvon' }, // Missing 'ru'
    { ru: 'Test' }    // Missing 'uz'
];

const invalidValidation = validateImportData(invalidData);
console.log(`✅ Невалидные данные обнаружены: ${!invalidValidation.valid ? 'PASS' : 'FAIL'}`);
if (!invalidValidation.valid) {
    console.log('   Ошибки:');
    invalidValidation.errors.forEach(err => console.log(`   - ${err}`));
}
console.log();

// ===== ТЕСТ 4: Построение графа =====
console.log('TEST 4️⃣  - Построение семантического графа');
console.log('─'.repeat(50));

const graphData = [
    {
        ru: 'Животное',
        uz: 'Hayvon',
        category: 'biology',
        related: ['Собака']
    },
    {
        ru: 'Собака',
        uz: 'It',
        parent_ru: 'Животное',
        category: 'biology',
        related: ['Бульдог']
    },
    {
        ru: 'Бульдог',
        uz: 'Buldog',
        parent_ru: 'Собака',
        category: 'biology',
        related: []
    }
];

const graph = buildSemanticGraph(graphData);
console.log(`✅ Построен граф с ${Object.keys(graph).length} узлами`);
console.log(`✅ Root узлов: ${Object.values(graph).filter(w => !w.parent_semantic_key).length}`);
console.log(`✅ Total связей (related): ${Object.values(graph).reduce((sum, w) => sum + w.related.length, 0)}`);

// Показываем структуру
console.log('\n📊 Структура графа:');
for (const [key, word] of Object.entries(graph)) {
    console.log(`\n  ${word.ru} (${word.uz})`);
    console.log(`    semantic_key: ${key}`);
    console.log(`    parent: ${word.parent_semantic_key || 'ROOT'}`);
    console.log(`    children: ${word.children_semantic_keys.length}`);
    console.log(`    related: ${word.related.length}`);
}
console.log();

// ===== ТЕСТ 5: Загрузка JSON файла =====
console.log('TEST 5️⃣  - Загрузка примера JSON');
console.log('─'.repeat(50));

const examplePath = path.join(__dirname, '../data/hierarchy_example.json');
if (fs.existsSync(examplePath)) {
    try {
        const exampleData = JSON.parse(fs.readFileSync(examplePath, 'utf-8'));
        console.log(`✅ Файл загружен: ${exampleData.length} элементов`);
        
        const exampleValidation = validateImportData(exampleData);
        console.log(`✅ Валидация: ${exampleValidation.valid ? 'PASS' : 'FAIL'}`);
        
        const exampleGraph = buildSemanticGraph(exampleData);
        console.log(`✅ Граф построен: ${Object.keys(exampleGraph).length} узлов`);
        
        // Найти root элементы
        const roots = Object.values(exampleGraph).filter(w => !w.parent_semantic_key);
        console.log(`✅ Root элементы: ${roots.length}`);
        roots.forEach(root => console.log(`   - ${root.ru} (${root.uz})`));
        
    } catch (error) {
        console.log(`❌ Ошибка при загрузке: ${error.message}`);
    }
} else {
    console.log(`❌ Файл не найден: ${examplePath}`);
}
console.log();

// ===== ИТОГИ =====
console.log('═'.repeat(50));
console.log('✅ ✅ ✅ ВСЕ ТЕСТЫ ЗАВЕРШЕНЫ ✅ ✅ ✅');
console.log('═'.repeat(50));
