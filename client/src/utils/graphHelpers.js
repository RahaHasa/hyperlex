/**
 * Утилиты для уровневой визуализации графа.
 * Показываем путь от корня до текущего слова и до 5 слов на активном уровне.
 */

function normalizeNode(node, type = 'sibling') {
    if (!node) return null;

    return {
        id: node.id || node.semantic_key || node._id,
        word: node.word || node.ru || node.uz || '',
        language: node.language || 'ru',
        definition: node.definition || node.description_ru || node.description_uz || '',
        ru: node.ru || node.word || '',
        uz: node.uz || '',
        level: node.level || 1,
        type,
        semantic_key: node.semantic_key || node.id || node._id
    };
}

function getParentNode(node) {
    if (!node?.hypernyms || node.hypernyms.length === 0) {
        return null;
    }

    return node.hypernyms[0] || null;
}

function buildAncestorChain(node) {
    if (!node) return [];

    const chain = [];
    let current = node;

    while (current) {
        chain.unshift(current);
        current = getParentNode(current);
    }

    return chain;
}

function buildFocusedSiblingWindow(siblings, selectedId, maxVisible = 5) {
    if (!Array.isArray(siblings) || siblings.length === 0) {
        return [];
    }

    const normalizedSiblings = siblings.filter(Boolean);
    const selectedIndex = Math.max(
        0,
        normalizedSiblings.findIndex((item) => (item.id || item.semantic_key || item._id) === selectedId)
    );

    const left = [];
    const right = [];
    let offset = 1;

    while ((left.length + right.length + 1) < maxVisible && (selectedIndex - offset >= 0 || selectedIndex + offset < normalizedSiblings.length)) {
        if (selectedIndex - offset >= 0 && left.length < 2) {
            left.unshift(normalizedSiblings[selectedIndex - offset]);
        }

        if ((left.length + right.length + 1) < maxVisible && selectedIndex + offset < normalizedSiblings.length && right.length < 2) {
            right.push(normalizedSiblings[selectedIndex + offset]);
        }

        offset += 1;
    }

    return [...left, normalizedSiblings[selectedIndex], ...right];
}

export function treeToGraph(treeData) {
    if (!treeData) {
        return { nodes: [], links: [], rows: [], activeLevel: 1 };
    }

    const chain = buildAncestorChain(treeData);
    const currentNode = normalizeNode(treeData, 'center');
    const parentNode = getParentNode(treeData);
    const siblingSource = parentNode?.hyponyms?.length ? parentNode.hyponyms : [treeData];
    const focusedSiblings = buildFocusedSiblingWindow(siblingSource, currentNode.id, 5)
        .map((node) => normalizeNode(node, (node.id || node.semantic_key || node._id) === currentNode.id ? 'center' : 'sibling'));

    const ancestorRows = chain
        .slice(0, -1)
        .map((node) => [normalizeNode(node, 'ancestor')]);

    const rows = [...ancestorRows, focusedSiblings];
    const nodes = rows.flat();
    const links = [];

    for (let index = 1; index < chain.length - 1; index += 1) {
        const child = chain[index];
        const parent = chain[index - 1];

        links.push({
            source: parent.id,
            target: child.id,
            type: 'path'
        });
    }

    if (parentNode) {
        for (const sibling of focusedSiblings) {
            links.push({
                source: parentNode.id,
                target: sibling.id,
                type: sibling.type === 'center' ? 'focus' : 'sibling'
            });
        }
    }

    return {
        nodes,
        links,
        rows,
        activeLevel: currentNode.level || rows.length || 1
    };
}

export function calculateFocusedLayout(rows, width, height, isMobile = false) {
    if (!rows.length) return [];

    const topPadding = isMobile ? 60 : 80;
    const bottomPadding = isMobile ? 50 : 70;
    const rowCount = rows.length;
    const usableHeight = Math.max(180, height - topPadding - bottomPadding);
    const rowGap = rowCount === 1 ? 0 : usableHeight / (rowCount - 1);
    const centerX = width / 2;

    const positionedNodes = [];

    rows.forEach((row, rowIndex) => {
        const y = topPadding + rowGap * rowIndex;
        const rowWidth = row.length > 1 ? Math.min(width * 0.7, isMobile ? 260 : 560) : 0;
        const xStep = row.length > 1 ? rowWidth / Math.max(row.length - 1, 1) : 0;
        const startX = centerX - rowWidth / 2;

        row.forEach((node, nodeIndex) => {
            positionedNodes.push({
                ...node,
                x: row.length === 1 ? centerX : startX + xStep * nodeIndex,
                y,
                rowIndex,
                rowSize: row.length
            });
        });
    });

    return positionedNodes;
}

export function generateLinkPath(source, target) {
    if (!source || !target) return '';

    const midY = (source.y + target.y) / 2;
    return `M ${source.x} ${source.y}
            C ${source.x} ${midY},
              ${target.x} ${midY},
              ${target.x} ${target.y}`;
}

export function getNodeColor(node) {
    const byLanguage = {
        ru: {
            ancestor: '#7a8f57',
            center: '#2d5a27',
            sibling: '#5f8f4d'
        },
        uz: {
            ancestor: '#c08c61',
            center: '#b35a3a',
            sibling: '#c9774f'
        }
    };

    const palette = byLanguage[node.language] || byLanguage.ru;
    return palette[node.type] || palette.sibling;
}

export function createBreadcrumb(hypernyms, center) {
    const chain = buildAncestorChain(center);

    return chain.map((node, index) => ({
        id: node.id,
        word: node.word,
        language: node.language,
        current: index === chain.length - 1
    }));
}

export default {
    treeToGraph,
    calculateFocusedLayout,
    generateLinkPath,
    getNodeColor,
    createBreadcrumb
};
