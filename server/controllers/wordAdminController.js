/**
 * Контроллер для CRUD операций со словами (для админки)
 */

const Word = require('../models/Word');

/**
 * Получить все слова (с фильтрацией)
 * GET /api/admin/words?lang=ru&limit=50&skip=0
 */
async function getAllWords(req, res) {
    try {
        const { lang, limit = 50, skip = 0, search } = req.query;
        
        let filter = {};
        if (lang && ['lang_ru', 'lang_uz'].includes(lang)) {
            filter.lang = lang;
        }
        
        if (search) {
            filter.$or = [
                { word: { $regex: search, $options: 'i' } },
                { definition: { $regex: search, $options: 'i' } }
            ];
        }
        
        const total = await Word.countDocuments(filter);
        const words = await Word.find(filter)
            .limit(parseInt(limit))
            .skip(parseInt(skip))
            .sort({ createdAt: -1 });
        
        res.json({
            success: true,
            total,
            count: words.length,
            words
        });
    } catch (error) {
        console.error('Get all words error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Server error' 
        });
    }
}

/**
 * Получить одно слово по ID
 * GET /api/admin/words/:id
 */
async function getWordById(req, res) {
    try {
        const { id } = req.params;
        
        const word = await Word.findById(id)
            .populate('hypernyms', '_id word lang')
            .populate('hyponyms', '_id word lang');
        
        if (!word) {
            return res.status(404).json({
                success: false,
                error: 'Word not found'
            });
        }
        
        res.json({
            success: true,
            word
        });
    } catch (error) {
        console.error('Get word error:', error);
        res.status(500).json({
            success: false,
            error: 'Server error'
        });
    }
}

/**
 * Создать новое слово
 * POST /api/admin/words
 */
async function createWord(req, res) {
    try {
        const { _id, word, lang, definition, hypernyms, hyponyms } = req.body;
        
        // Валидация
        if (!_id || !word || !lang) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: _id, word, lang'
            });
        }
        
        if (!['lang_ru', 'lang_uz'].includes(lang)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid language code. Must be "lang_ru" or "lang_uz"'
            });
        }
        
        // Проверка, не существует ли уже такое слово
        const existing = await Word.findById(_id);
        if (existing) {
            return res.status(409).json({
                success: false,
                error: 'Word with this ID already exists'
            });
        }
        
        // Создание слова
        const newWord = new Word({
            _id,
            word,
            lang,
            definition: definition || '',
            hypernyms: hypernyms || [],
            hyponyms: hyponyms || [],
            createdBy: req.user?.id
        });
        
        await newWord.save();
        
        // Обновляем hyponyms у гиперонимов
        if (hypernyms && hypernyms.length > 0) {
            await Word.updateMany(
                { _id: { $in: hypernyms } },
                { $addToSet: { hyponyms: newWord._id } }
            );
        }
        
        res.status(201).json({
            success: true,
            message: 'Word created successfully',
            word: newWord
        });
    } catch (error) {
        console.error('Create word error:', error);
        res.status(500).json({
            success: false,
            error: 'Server error'
        });
    }
}

/**
 * Обновить слово
 * PUT /api/admin/words/:id
 */
async function updateWord(req, res) {
    try {
        const { id } = req.params;
        const { word, definition, hypernyms, hyponyms } = req.body;
        
        const existingWord = await Word.findById(id);
        if (!existingWord) {
            return res.status(404).json({
                success: false,
                error: 'Word not found'
            });
        }
        
        // Если меняем hypernyms, обновляем связи
        if (hypernyms) {
            // Удаляем из старых гиперонимов
            await Word.updateMany(
                { _id: { $in: existingWord.hypernyms } },
                { $pull: { hyponyms: id } }
            );
            
            // Добавляем в новые гиперонимы
            await Word.updateMany(
                { _id: { $in: hypernyms } },
                { $addToSet: { hyponyms: id } }
            );
        }
        
        const updateData = {};
        if (word) updateData.word = word;
        if (definition !== undefined) updateData.definition = definition;
        if (hypernyms) updateData.hypernyms = hypernyms;
        if (hyponyms) updateData.hyponyms = hyponyms;
        updateData.updatedBy = req.user?.id;
        updateData.updatedAt = new Date();
        
        const updated = await Word.findByIdAndUpdate(id, updateData, { new: true });
        
        res.json({
            success: true,
            message: 'Word updated successfully',
            word: updated
        });
    } catch (error) {
        console.error('Update word error:', error);
        res.status(500).json({
            success: false,
            error: 'Server error'
        });
    }
}

/**
 * Удалить слово
 * DELETE /api/admin/words/:id
 */
async function deleteWord(req, res) {
    try {
        const { id } = req.params;
        
        const word = await Word.findById(id);
        if (!word) {
            return res.status(404).json({
                success: false,
                error: 'Word not found'
            });
        }
        
        // Удаляем это слово из отношений других слов
        await word.removeFromRelations();
        
        // Удаляем само слово
        await Word.findByIdAndDelete(id);
        
        res.json({
            success: true,
            message: 'Word deleted successfully'
        });
    } catch (error) {
        console.error('Delete word error:', error);
        res.status(500).json({
            success: false,
            error: 'Server error'
        });
    }
}

/**
 * Автопоиск для hypernyms (для комплита-окна)
 * GET /api/admin/words/search/hypernyms?q=собак&lang=ru
 */
async function searchForHypernyms(req, res) {
    try {
        const { q, lang, limit = 10 } = req.query;
        
        if (!q || q.length < 2) {
            return res.json({
                success: true,
                results: []
            });
        }
        
        let filter = {
            word: { $regex: q, $options: 'i' }
        };
        
        if (lang && ['lang_ru', 'lang_uz'].includes(lang)) {
            filter.lang = lang;
        }
        
        const results = await Word.find(filter)
            .limit(parseInt(limit))
            .select('_id word lang')
            .sort({ word: 1 });
        
        res.json({
            success: true,
            results
        });
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({
            success: false,
            error: 'Server error'
        });
    }
}

/**
 * Получить дерево связей слова
 * GET /api/admin/words/:id/tree?depth=3
 */
async function getWordTree(req, res) {
    try {
        const { id } = req.params;
        const { depth = 3 } = req.query;
        
        const word = await Word.findById(id);
        if (!word) {
            return res.status(404).json({
                success: false,
                error: 'Word not found'
            });
        }
        
        const tree = await buildWordTree(id, depth, new Set());
        
        res.json({
            success: true,
            tree
        });
    } catch (error) {
        console.error('Tree error:', error);
        res.status(500).json({
            success: false,
            error: 'Server error'
        });
    }
}

/**
 * Рекурсивное построение дерева слова
 */
async function buildWordTree(wordId, depth, visited) {
    if (depth === 0 || visited.has(wordId)) {
        return null;
    }
    
    visited.add(wordId);
    
    const word = await Word.findById(wordId)
        .select('_id word language definition')
        .lean();
    
    if (!word) return null;
    
    const hypernyms = await Word.find({ _id: { $in: await Word.findById(wordId).select('hypernyms').lean() } })
        .select('_id word language')
        .lean();
    
    const hyponyms = await Word.find({ _id: { $in: await Word.findById(wordId).select('hyponyms').lean() } })
        .select('_id word language')
        .lean();
    
    return {
        ...word,
        hypernyms: await Promise.all(
            hypernyms.map(h => buildWordTree(h._id, depth - 1, new Set(visited)))
        ),
        hyponyms: await Promise.all(
            hyponyms.map(h => buildWordTree(h._id, depth - 1, new Set(visited)))
        )
    };
}

module.exports = {
    getAllWords,
    getWordById,
    createWord,
    updateWord,
    deleteWord,
    searchForHypernyms,
    getWordTree
};
