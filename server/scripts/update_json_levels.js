const fs = require('fs');
const path = require('path');
const semanticHelper = require('../utils/semanticHelper');

const dataDir = path.join(__dirname, '../data/data');
const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.json'));

let allEntries = [];

// Считываем все файлы
for (const file of files) {
    const filePath = path.join(dataDir, file);
    try {
        const rawData = fs.readFileSync(filePath, 'utf8');
        const data = JSON.parse(rawData);
        
        if (typeof data === 'object' && !Array.isArray(data)) {
            Object.entries(data).forEach(([key, value]) => {
                allEntries.push({
                    semantic_key: key,
                    ...value
                });
            });
        }
    } catch (err) {
        console.error(`Error reading ${file}:`, err.message);
    }
}

// Строим граф для определения уровней
const graph = semanticHelper.buildSemanticGraph(allEntries);

// Записываем уровни обратно в JSON файлы
for (const file of files) {
    const filePath = path.join(dataDir, file);
    try {
        const rawData = fs.readFileSync(filePath, 'utf8');
        const data = JSON.parse(rawData);
        let updated = false;

        if (typeof data === 'object' && !Array.isArray(data)) {
            for (const key of Object.keys(data)) {
                const node = graph[key];
                if (node && node.level) {
                    if (data[key].level !== node.level) {
                        // Добавляем поле level после parent, если parent существует. Иначе в начало
                        data[key].level = node.level;
                        updated = true;
                    }
                }
            }

            if (updated) {
                fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
                console.log(`Updated levels in ${file}`);
            } else {
                console.log(`No changes needed in ${file}`);
            }
        }
    } catch (err) {
        console.error(`Error updating ${file}:`, err.message);
    }
}
console.log('Done!');
