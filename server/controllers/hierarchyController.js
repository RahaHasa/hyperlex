/**
 * Hierarchy Import Controller - Контроллер для импорта иерархических данных
 */

const Word = require('../models/Word');
const {
    validateImportData,
    buildSemanticGraph,
    formatHierarchy
} = require('../utils/semanticHelper');

/**
 * POST /api/admin/import/hierarchy
 * Импортировать иерархические данные из JSON
 */
exports.importHierarchy = async (req, res) => {
    try {
        const data = req.body?.data ?? req.body;

        // Валидируем данные
        const validation = validateImportData(data);
        if (!validation.valid) {
            return res.status(400).json({
                success: false,
                message: 'Validation errors',
                errors: validation.errors
            });
        }

        // Строим граф
        const graph = buildSemanticGraph(data);
        const totalWords = Object.keys(graph).length;

        // Очищаем коллекцию
        await Word.deleteMany({});

        // Подготавливаем данные для вставки
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

        // Вставляем в БД
        const inserted = await Word.insertMany(wordsToInsert);

        // Получаем статистику
        const rootWords = inserted.filter(w => !w.parent_semantic_key);
        const categories = new Set(inserted.map(w => w.category));

        res.json({
            success: true,
            message: `Successfully imported ${totalWords} concepts`,
            statistics: {
                totalConcepts: totalWords,
                rootConcepts: rootWords.length,
                categories: Array.from(categories),
                timestamp: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('Import error:', error);
        res.status(500).json({
            success: false,
            message: 'Import failed',
            error: error.message
        });
    }
};

/**
 * GET /api/admin/hierarchy/structure
 * Получить полную структуру иерархии
 */
exports.getHierarchyStructure = async (req, res) => {
    try {
        // Получаем все root слова
        const rootWords = await Word.find({ parent_semantic_key: null });

        // Строим деревья
        const trees = [];
        for (const root of rootWords) {
            const tree = await root.getTreeStructure();
            trees.push(tree);
        }

        res.json({
            success: true,
            totalRoots: trees.length,
            hierarchies: trees
        });

    } catch (error) {
        console.error('Error getting hierarchy:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get hierarchy',
            error: error.message
        });
    }
};

/**
 * GET /api/admin/hierarchy/tree/:semantic_key
 * Получить дерево для конкретного концепта
 */
exports.getWordTree = async (req, res) => {
    try {
        const { semantic_key } = req.params;
        
        const word = await Word.findOne({ semantic_key });
        if (!word) {
            return res.status(404).json({
                success: false,
                message: 'Word not found'
            });
        }

        const tree = await word.getTreeStructure();

        res.json({
            success: true,
            tree
        });

    } catch (error) {
        console.error('Error getting word tree:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get word tree',
            error: error.message
        });
    }
};

/**
 * GET /api/admin/hierarchy/stats
 * Получить статистику иерархии
 */
exports.getHierarchyStats = async (req, res) => {
    try {
        const totalWords = await Word.countDocuments();
        const rootWords = await Word.countDocuments({ parent_semantic_key: null });
        
        const categories = await Word.aggregate([
            { $group: { _id: '$category', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);

        const avgChildrenPerWord = await Word.aggregate([
            { $group: { _id: null, avgChildren: { $avg: { $size: '$children_semantic_keys' } } } }
        ]);

        res.json({
            success: true,
            statistics: {
                totalConcepts: totalWords,
                rootConcepts: rootWords,
                averageChildrenPerWord: avgChildrenPerWord[0]?.avgChildren || 0,
                categories: categories.map(c => ({
                    name: c._id,
                    count: c.count
                }))
            }
        });

    } catch (error) {
        console.error('Error getting stats:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get statistics',
            error: error.message
        });
    }
};

/**
 * POST /api/admin/hierarchy/add-word
 * Добавить новое слово в иерархию
 */
exports.addWordToHierarchy = async (req, res) => {
    try {
        const {
            ru,
            uz,
            description_ru,
            description_uz,
            category,
            parent_semantic_key,
            related
        } = req.body;

        // Валидируем
        if (!ru || !uz) {
            return res.status(400).json({
                success: false,
                message: 'Russian and Uzbek words are required'
            });
        }

        // Проверяем parent
        let parentWord = null;
        if (parent_semantic_key) {
            parentWord = await Word.findOne({ semantic_key: parent_semantic_key });
            if (!parentWord) {
                return res.status(404).json({
                    success: false,
                    message: 'Parent word not found'
                });
            }
        }

        // Создаём новое слово
        const newWord = new Word({
            semantic_key: `${ru.substring(0, 3)}${uz.substring(0, 3)}_${Date.now().toString(36)}${Math.random().toString(36).substr(2, 5)}`.toLowerCase(),
            ru: ru.trim(),
            uz: uz.trim(),
            normalized_ru: ru.trim().toLowerCase(),
            normalized_uz: uz.trim().toLowerCase(),
            description_ru: description_ru || '',
            description_uz: description_uz || '',
            category: category || 'general',
            parent_semantic_key: parent_semantic_key || null,
            children_semantic_keys: [],
            related: related || []
        });

        await newWord.save();

        // Обновляем parent
        if (parentWord) {
            parentWord.children_semantic_keys.push(newWord.semantic_key);
            await parentWord.save();
        }

        res.status(201).json({
            success: true,
            message: 'Word added successfully',
            word: newWord
        });

    } catch (error) {
        console.error('Error adding word:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to add word',
            error: error.message
        });
    }
};

/**
 * DELETE /api/admin/hierarchy/:semantic_key
 * Удалить слово из иерархии
 */
exports.deleteWordFromHierarchy = async (req, res) => {
    try {
        const { semantic_key } = req.params;

        const word = await Word.findOne({ semantic_key });
        if (!word) {
            return res.status(404).json({
                success: false,
                message: 'Word not found'
            });
        }

        // Используем метод модели для удаления с обновлением иерархии
        await word.deleteWithHierarchy();

        res.json({
            success: true,
            message: 'Word deleted successfully'
        });

    } catch (error) {
        console.error('Error deleting word:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete word',
            error: error.message
        });
    }
};
