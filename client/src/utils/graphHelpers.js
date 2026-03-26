/**
 * Утилиты для работы с графами и визуализацией
 * Преобразование данных API в формат для D3.js
 */

/**
 * Преобразует дерево из API в формат nodes/links для D3
 * @param {Object} treeData - Данные дерева из API
 * @returns {Object} { nodes, links }
 */
export function treeToGraph(treeData) {
    if (!treeData || !treeData.center) return { nodes: [], links: [] };
    
    const nodes = [];
    const links = [];
    const nodeMap = new Map();
    
    // Добавляем центральный узел
    const centerNode = {
        id: treeData.center.id,
        word: treeData.center.word,
        language: treeData.center.language,
        definition: treeData.center.definition,
        type: 'center',
        level: 0
    };
    nodes.push(centerNode);
    nodeMap.set(centerNode.id, centerNode);
    
    // Добавляем гиперонимы (родительские узлы)
    if (treeData.hypernyms) {
        treeData.hypernyms.forEach((hypernym, index) => {
            const node = {
                id: hypernym.id,
                word: hypernym.word,
                language: hypernym.language,
                definition: hypernym.definition,
                type: 'hypernym',
                level: -(index + 1)
            };
            nodes.push(node);
            nodeMap.set(node.id, node);
            
            // Связь с предыдущим узлом
            const sourceId = index === 0 ? treeData.center.id : treeData.hypernyms[index - 1].id;
            links.push({
                source: sourceId,
                target: hypernym.id,
                type: 'hypernym'
            });
        });
    }
    
    // Добавляем гипонимы (дочерние узлы)
    if (treeData.hyponyms) {
        treeData.hyponyms.forEach(hyponym => {
            if (!nodeMap.has(hyponym.id)) {
                const node = {
                    id: hyponym.id,
                    word: hyponym.word,
                    language: hyponym.language,
                    definition: hyponym.definition,
                    type: 'hyponym',
                    level: hyponym.level || 1,
                    parentId: hyponym.parentId
                };
                nodes.push(node);
                nodeMap.set(node.id, node);
            }
            
            // Связь с родительским узлом
            const parentId = hyponym.parentId || treeData.center.id;
            links.push({
                source: parentId,
                target: hyponym.id,
                type: 'hyponym'
            });
        });
    }
    
    return { nodes, links };
}

/**
 * Вычисляет позиции узлов для вертикального дерева
 * @param {Array} nodes - Узлы графа
 * @param {number} width - Ширина области
 * @param {number} height - Высота области
 * @returns {Array} Узлы с координатами
 */
export function calculateTreeLayout(nodes, width, height) {
    if (!nodes.length) return [];
    
    const centerY = height / 2;
    const levelHeight = 100;
    const minNodeSpacing = 120;
    
    // Группируем узлы по уровням
    const levels = new Map();
    nodes.forEach(node => {
        const level = node.level || 0;
        if (!levels.has(level)) levels.set(level, []);
        levels.get(level).push(node);
    });
    
    // Расставляем узлы по уровням
    const positionedNodes = [];
    
    levels.forEach((levelNodes, level) => {
        const y = centerY - (level * levelHeight);
        const totalWidth = levelNodes.length * minNodeSpacing;
        const startX = (width - totalWidth) / 2 + minNodeSpacing / 2;
        
        levelNodes.forEach((node, index) => {
            positionedNodes.push({
                ...node,
                x: startX + index * minNodeSpacing,
                y: y
            });
        });
    });
    
    return positionedNodes;
}

/**
 * Генерирует путь для криволинейной связи
 * @param {Object} source - Начальный узел { x, y }
 * @param {Object} target - Конечный узел { x, y }
 * @returns {string} SVG path
 */
export function generateLinkPath(source, target) {
    const midY = (source.y + target.y) / 2;
    return `M ${source.x} ${source.y} 
            C ${source.x} ${midY}, 
              ${target.x} ${midY}, 
              ${target.x} ${target.y}`;
}

/**
 * Возвращает цвет для узла в зависимости от типа и языка
 * @param {Object} node - Узел
 * @returns {string} CSS цвет
 */
export function getNodeColor(node) {
    const colors = {
        ru: {
            center: '#2d5a27',
            hypernym: '#4a7c42',
            hyponym: '#6b9d62'
        },
        uz: {
            center: '#b35a3a',
            hypernym: '#c97a5a',
            hyponym: '#d99a7a'
        }
    };
    
    const lang = node.language || 'ru';
    const type = node.type || 'hyponym';
    
    return colors[lang]?.[type] || colors.ru.hyponym;
}

/**
 * Форматирует слово для отображения (обрезка длинных)
 * @param {string} word - Слово
 * @param {number} maxLength - Максимальная длина
 * @returns {string} Форматированное слово
 */
export function formatWord(word, maxLength = 15) {
    if (!word) return '';
    if (word.length <= maxLength) return word;
    return word.substring(0, maxLength - 2) + '…';
}

/**
 * Создаёт breadcrumb путь от корня до текущего слова
 * @param {Array} hypernyms - Массив гиперонимов
 * @param {Object} center - Центральное слово
 * @returns {Array} Путь от корня
 */
export function createBreadcrumb(hypernyms, center) {
    const path = [];
    
    // Добавляем гиперонимы в обратном порядке (от корня)
    if (hypernyms && hypernyms.length) {
        const reversed = [...hypernyms].reverse();
        reversed.forEach(h => {
            path.push({
                id: h.id,
                word: h.word,
                language: h.language
            });
        });
    }
    
    // Добавляем текущее слово
    if (center) {
        path.push({
            id: center.id,
            word: center.word,
            language: center.language,
            current: true
        });
    }
    
    return path;
}

export default {
    treeToGraph,
    calculateTreeLayout,
    generateLinkPath,
    getNodeColor,
    formatWord,
    createBreadcrumb
};
