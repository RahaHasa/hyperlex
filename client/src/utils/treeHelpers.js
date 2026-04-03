/**
 * Хелпер функции для работы с деревом связей слов (гиперонимы/гипонимы)
 */

/**
 * Преобразуем плоскую структуру слова в иерархическое дерево для D3
 * 
 * @param {Object} word - Слово с массивами hypernyms и hyponyms
 * @param {Array} allWords - Все доступные слова для поиска связей
 * @param {number} maxDepth - Максимальная глубина дерева
 * @returns {Object} Иерархическое дерево
 */
export function buildHierarchyTree(word, allWords = [], maxDepth = 3) {
    if (!word) return null;
    
    // Если это уже иерархическое дерево с children, просто верни его
    if (word.children) {
        return word;
    }
    
    const wordMap = new Map();
    if (allWords && allWords.length > 0) {
        allWords.forEach(w => {
            const id = w.id || w._id;
            wordMap.set(id, w);
        });
    }
    
    // Если слово имеет гиперонимы/гипонимы уже загруженные, используй их
    if (word.hypernyms || word.hyponyms) {
        const node = {
            _id: word._id || word.id,
            id: word.id || word._id,
            word: word.word,
            language: word.language,
            children: []
        };
        
        // Добавляем гиперонимы
        if (word.hypernyms && Array.isArray(word.hypernyms)) {
            word.hypernyms.forEach(hypernym => {
                const hypernymNode = {
                    _id: hypernym._id || hypernym.id || hypernym,
                    id: hypernym.id || hypernym._id || hypernym,
                    word: hypernym.word || hypernym,
                    language: hypernym.language || word.language,
                    isHypernym: true,
                    children: []
                };
                node.children.push(hypernymNode);
            });
        }
        
        // Добавляем гипонимы
        if (word.hyponyms && Array.isArray(word.hyponyms)) {
            word.hyponyms.forEach(hyponym => {
                const hyponymNode = {
                    _id: hyponym._id || hyponym.id || hyponym,
                    id: hyponym.id || hyponym._id || hyponym,
                    word: hyponym.word || hyponym,
                    language: hyponym.language || word.language,
                    isHypernym: false,
                    children: []
                };
                node.children.push(hyponymNode);
            });
        }
        
        return node;
    }
    
    // Рекурсивное построение, если это простой объект
    const buildNode = (wordId, visited = new Set(), depth = 0) => {
        if (depth >= maxDepth || visited.has(wordId)) {
            return null;
        }
        
        visited.add(wordId);
        
        let nodeWord = null;
        if (wordMap.has(wordId)) {
            nodeWord = wordMap.get(wordId);
        } else {
            nodeWord = { _id: wordId, word: wordId, language: 'unknown' };
        }
        
        const node = {
            _id: nodeWord._id || nodeWord.id,
            id: nodeWord.id || nodeWord._id,
            word: nodeWord.word,
            language: nodeWord.language,
            children: []
        };
        
        // Добавляем гиперонимы
        if (nodeWord.hypernyms && Array.isArray(nodeWord.hypernyms)) {
            nodeWord.hypernyms.forEach(hypernymId => {
                const hypernymNode = buildNode(hypernymId, new Set(visited), depth + 1);
                if (hypernymNode) {
                    hypernymNode.isHypernym = true;
                    node.children.push(hypernymNode);
                }
            });
        }
        
        // Добавляем гипонимы
        if (nodeWord.hyponyms && Array.isArray(nodeWord.hyponyms)) {
            nodeWord.hyponyms.forEach(hyponymId => {
                const hyponymNode = buildNode(hyponymId, new Set(visited), depth + 1);
                if (hyponymNode) {
                    hyponymNode.isHypernym = false;
                    node.children.push(hyponymNode);
                }
            });
        }
        
        return node;
    };
    
    const wordId = word._id || word.id;
    return buildNode(wordId);
}

/**
 * Построить дерево с поддержкой асинхронной загрузки узлов
 * (для больших графов)
 */
export function buildLazyHierarchyTree(word, fetchRelatedWords, maxDepth = 3) {
    const buildNode = async (wordId, visited = new Set(), depth = 0) => {
        if (depth >= maxDepth || visited.has(wordId)) {
            return null;
        }
        
        visited.add(wordId);
        
        try {
            const nodeWord = await fetchRelatedWords(wordId);
            
            if (!nodeWord) {
                return { _id: wordId, word: wordId, language: 'unknown', children: [] };
            }
            
            const node = {
                _id: nodeWord._id,
                word: nodeWord.word,
                language: nodeWord.language,
                children: []
            };
            
            // Гиперонимы
            if (nodeWord.hypernyms && nodeWord.hypernyms.length > 0) {
                for (const hypernymId of nodeWord.hypernyms) {
                    const hypernymNode = await buildNode(hypernymId, new Set(visited), depth + 1);
                    if (hypernymNode) {
                        hypernymNode.isHypernym = true;
                        node.children.push(hypernymNode);
                    }
                }
            }
            
            // Гипонимы
            if (nodeWord.hyponyms && nodeWord.hyponyms.length > 0) {
                for (const hyponymId of nodeWord.hyponyms) {
                    const hyponymNode = await buildNode(hyponymId, new Set(visited), depth + 1);
                    if (hyponymNode) {
                        hyponymNode.isHypernym = false;
                        node.children.push(hyponymNode);
                    }
                }
            }
            
            return node;
        } catch (error) {
            console.error(`Error fetching word ${wordId}:`, error);
            return null;
        }
    };
    
    return buildNode(word._id);
}

/**
 * Подальны используемые статистики дерева
 */
export function getTreeStats(node) {
    if (!node) return null;
    
    let totalNodes = 1;
    let totalLinks = 0;
    let hypernymsCount = 0;
    let hyponymsCount = 0;
    let maxDepth = 0;
    
    const traverse = (currentNode, depth = 0) => {
        maxDepth = Math.max(maxDepth, depth);
        
        if (currentNode.children) {
            currentNode.children.forEach(child => {
                totalNodes++;
                totalLinks++;
                
                if (child.isHypernym) {
                    hypernymsCount++;
                } else {
                    hyponymsCount++;
                }
                
                traverse(child, depth + 1);
            });
        }
    };
    
    traverse(node);
    
    return {
        totalNodes,
        totalLinks,
        hypernymsCount,
        hyponymsCount,
        maxDepth,
        word: node.word,
        language: node.language
    };
}

/**
 * Найти путь от узла к корню или к конкретному узлу
 */
export function findPathToNode(tree, targetId, currentPath = []) {
    if (!tree) return null;
    
    currentPath.push(tree._id);
    
    if (tree._id === targetId) {
        return currentPath;
    }
    
    if (tree.children && tree.children.length > 0) {
        for (const child of tree.children) {
            const path = findPathToNode(child, targetId, [...currentPath]);
            if (path) return path;
        }
    }
    
    return null;
}

/**
 * Поиск узлов по слову (фильтрация)
 */
export function searchInTree(tree, query, results = []) {
    if (!tree) return results;
    
    if (tree.word.toLowerCase().includes(query.toLowerCase())) {
        results.push({
            _id: tree._id,
            word: tree.word,
            language: tree.language
        });
    }
    
    if (tree.children && tree.children.length > 0) {
        tree.children.forEach(child => searchInTree(child, query, results));
    }
    
    return results;
}

/**
 * Экспорт дерева в JSON
 */
export function exportTreeAsJSON(tree) {
    return JSON.stringify(tree, null, 2);
}

/**
 * Экспорт дерева в CSV (для анализа в Excel)
 */
export function exportTreeAsCSV(tree) {
    const rows = [];
    rows.push('ID,Word,Language,Type,Path');
    
    const traverse = (node, path = '', type = 'root') => {
        const currentPath = path ? `${path}/${node.word}` : node.word;
        rows.push(`${node._id},"${node.word}",${node.language},${type},"${currentPath}"`);
        
        if (node.children && node.children.length > 0) {
            node.children.forEach(child => {
                traverse(child, currentPath, child.isHypernym ? 'hypernym' : 'hyponym');
            });
        }
    };
    
    traverse(tree);
    return rows.join('\n');
}

/**
 * Сравнение двух деревьев (для поиска сходства)
 */
export function compareTreeSimilarity(tree1, tree2) {
    if (!tree1 || !tree2) return 0;
    
    const collect = (tree, set = new Set()) => {
        set.add(tree._id);
        if (tree.children) {
            tree.children.forEach(child => collect(child, set));
        }
        return set;
    };
    
    const set1 = collect(tree1);
    const set2 = collect(tree2);
    
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return intersection.size / union.size;
}

export default {
    buildHierarchyTree,
    buildLazyHierarchyTree,
    getTreeStats,
    findPathToNode,
    searchInTree,
    exportTreeAsJSON,
    exportTreeAsCSV,
    compareTreeSimilarity
};
