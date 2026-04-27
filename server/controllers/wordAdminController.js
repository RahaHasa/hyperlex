/**
 * Контроллер для CRUD операций со словами (для админки)
 */

const Word = require('../models/Word');

function escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function findDuplicateWord({ word, lang, excludeId = null }) {
    const normalizedWord = String(word || '').trim();
    if (!normalizedWord) return null;

    const filter = {
        lang,
        word: { $regex: new RegExp(`^${escapeRegex(normalizedWord)}$`, 'i') }
    };

    if (excludeId) {
        filter._id = { $ne: excludeId };
    }

    return Word.findOne(filter).select('_id word lang');
}

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
        const { _id, word, lang, definition, hypernyms, hyponyms, related } = req.body;
        const normalizedWord = String(word || '').trim();
        
        // Валидация
        if (!_id || !normalizedWord || !lang) {
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

        const duplicateWord = await findDuplicateWord({ word: normalizedWord, lang });
        if (duplicateWord) {
            return res.status(409).json({
                success: false,
                error: `Word "${normalizedWord}" already exists for this language (${duplicateWord._id})`
            });
        }
        
        // Создание слова
        const newWord = new Word({
            _id,
            word: normalizedWord,
            lang,
            definition: definition || '',
            hypernyms: hypernyms || [],
            hyponyms: hyponyms || [],
            related: related || { ru: null, uz: null },
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
            error: 'Server error: ' + error.message
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
        const { word, definition, hypernyms, hyponyms, related } = req.body;
        
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

        if (word !== undefined) {
            const normalizedWord = String(word || '').trim();
            if (!normalizedWord) {
                return res.status(400).json({
                    success: false,
                    error: 'Word cannot be empty'
                });
            }

            const duplicateWord = await findDuplicateWord({
                word: normalizedWord,
                lang: existingWord.lang,
                excludeId: id
            });

            if (duplicateWord) {
                return res.status(409).json({
                    success: false,
                    error: `Word "${normalizedWord}" already exists for this language (${duplicateWord._id})`
                });
            }
        }
        
        const updateData = {};
        if (word !== undefined) updateData.word = String(word).trim();
        if (definition !== undefined) updateData.definition = definition;
        if (hypernyms) updateData.hypernyms = hypernyms;
        if (hyponyms) updateData.hyponyms = hyponyms;
        if (related) updateData.related = related;
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
            error: 'Server error: ' + error.message
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

/**
 * Простой CSV-парсер с поддержкой кавычек и запятых внутри полей
 */
function parseCSVLine(line) {
    const values = [];
    let current = '';
    let insideQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
            if (insideQuotes && line[i + 1] === '"') {
                current += '"';
                i++;
            } else {
                insideQuotes = !insideQuotes;
            }
        } else if (char === ',' && !insideQuotes) {
            values.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }

    values.push(current.trim());
    return values;
}

function parseCSV(content) {
    const lines = content.split(/\r?\n/).filter(line => line.trim());

    if (lines.length < 2) {
        throw new Error('CSV должен содержать заголовок и минимум одну строку данных');
    }

    const headers = parseCSVLine(lines[0]).map(header => header.trim().toLowerCase());

    return lines.slice(1).map(line => {
        const values = parseCSVLine(line);
        const row = {};

        headers.forEach((header, index) => {
            row[header] = values[index] || '';
        });

        return row;
    }).filter(row => row.word_ru || row.word_uz);
}

function decodeXmlEntities(value) {
    return String(value || '')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .trim();
}

function xmlAttr(attrs, name) {
    const match = attrs.match(new RegExp(`${name}="([^"]*)"`, 'i'));
    return match ? decodeXmlEntities(match[1]) : '';
}

function parseWordnetSynsetsXML(content) {
    const words = [];
    const synsetRegex = /<synset\b([^>]*)>([\s\S]*?)<\/synset>/gi;
    let synsetMatch;

    while ((synsetMatch = synsetRegex.exec(content)) !== null) {
        const attrs = synsetMatch[1] || '';
        const body = synsetMatch[2] || '';
        const definition = xmlAttr(attrs, 'definition');
        const ruthesName = xmlAttr(attrs, 'ruthes_name');

        const senseRegex = /<sense\b[^>]*>([^<]+)<\/sense>/gi;
        let senseMatch;
        let hasSense = false;

        while ((senseMatch = senseRegex.exec(body)) !== null) {
            const senseWord = decodeXmlEntities(senseMatch[1]);
            if (senseWord) {
                words.push({
                    word_ru: senseWord,
                    definition_ru: definition
                });
                hasSense = true;
            }
        }

        if (!hasSense && ruthesName) {
            words.push({
                word_ru: ruthesName,
                definition_ru: definition
            });
        }
    }

    return words;
}

function parseWordnetSensesXML(content) {
    const words = [];
    const senseTagRegex = /<sense\b([^>]*)\/?>(?:[^<]*)/gi;
    let senseMatch;

    while ((senseMatch = senseTagRegex.exec(content)) !== null) {
        const attrs = senseMatch[1] || '';
        const lemma = xmlAttr(attrs, 'lemma');
        const name = xmlAttr(attrs, 'name');
        const word = lemma || name;
        if (!word) continue;

        words.push({
            word_ru: word,
            definition_ru: ''
        });
    }

    return words;
}

function parseGenericWordXML(content) {
    const words = [];
    const itemRegex = /<item\b[^>]*>([\s\S]*?)<\/item>/gi;
    let itemMatch;

    while ((itemMatch = itemRegex.exec(content)) !== null) {
        const item = itemMatch[1];
        const pick = (tag) => {
            const m = item.match(new RegExp(`<${tag}>([\\s\\S]*?)<\/${tag}>`, 'i'));
            return m ? decodeXmlEntities(m[1]) : '';
        };

        const wordRu = pick('word_ru');
        const wordUz = pick('word_uz');
        const definitionRu = pick('definition_ru');
        const definitionUz = pick('definition_uz');

        if (wordRu || wordUz) {
            words.push({ word_ru: wordRu, word_uz: wordUz, definition_ru: definitionRu, definition_uz: definitionUz });
        }
    }

    return words;
}

function parseXML(content) {
    const xml = String(content || '');

    let words = parseGenericWordXML(xml);
    if (words.length > 0) {
        return words;
    }

    if (/<synsets\b/i.test(xml)) {
        words = parseWordnetSynsetsXML(xml);
    } else if (/<senses\b/i.test(xml)) {
        words = parseWordnetSensesXML(xml);
    }

    // Удаляем дубли внутри файла (без учета регистра)
    const seen = new Set();
    const unique = [];
    for (const row of words) {
        const key = `${String(row.word_ru || '').trim().toLowerCase()}|${String(row.word_uz || '').trim().toLowerCase()}`;
        if (!row.word_ru && !row.word_uz) continue;
        if (seen.has(key)) continue;
        seen.add(key);
        unique.push(row);
    }

    if (unique.length === 0) {
        throw new Error('XML не содержит поддерживаемых полей для импорта');
    }

    return unique;
}

function parsePlainWordList(content) {
    const lines = String(content || '')
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean)
        .filter(line => !line.startsWith('#'));

    const seen = new Set();
    const words = [];

    for (const line of lines) {
        // Поддержка форматов: "слово", "слово;определение", "слово,определение", "слово\tопределение"
        const parts = line.split(/[;,\t]/);
        const word = (parts[0] || '').trim();
        const definition = (parts.slice(1).join(' ') || '').trim();

        if (!word) continue;
        const key = word.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);

        words.push({ word, definition });
    }

    if (words.length === 0) {
        throw new Error('Файл не содержит слов для импорта');
    }

    return words;
}

function detectFormatByContent(content) {
    const text = String(content || '').trim();
    if (!text) return 'csv';

    if (text.startsWith('<')) return 'xml';
    if (text.startsWith('{') || text.startsWith('[')) return 'json';

    // Простой список слов: одна запись на строку без явного заголовка CSV
    const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    if (lines.length > 0 && !/^word_ru\s*,|^word_uz\s*,/i.test(lines[0])) {
        return 'txt';
    }

    return 'csv';
}

function detectLanguage(word) {
    const text = String(word || '').trim();
    if (!text) return null;

    // Кириллица -> русский
    if (/[А-Яа-яЁё]/.test(text)) return 'lang_ru';

    // Латиница (включая узбекские апострофы/символы) -> узбекский
    if (/[A-Za-z]/.test(text)) return 'lang_uz';

    return null;
}

function isSingleWord(value) {
    const text = String(value || '').trim();
    if (!text) return false;
    return !/\s+/.test(text);
}

/**
 * Массовый импорт пар слов из CSV/JSON
 * POST /api/admin/import
 */
async function importWords(req, res) {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'Файл не загружен'
            });
        }

        const requestedFormat = String(req.body?.format || '').trim().toLowerCase();
        const originalName = String(req.file?.originalname || '').toLowerCase();
        const formatFromExt =
            originalName.endsWith('.xml') ? 'xml' :
            originalName.endsWith('.json') ? 'json' :
            originalName.endsWith('.txt') ? 'txt' :
            originalName.endsWith('.csv') ? 'csv' : '';
        const rawContent = req.file.buffer.toString('utf-8');
        const normalizedRequested = ['csv', 'json', 'xml', 'txt'].includes(requestedFormat) ? requestedFormat : '';
        const format = normalizedRequested || formatFromExt || detectFormatByContent(rawContent);
        let words = [];

        if (format === 'csv') {
            words = parseCSV(rawContent);
        } else if (format === 'json') {
            const jsonData = JSON.parse(rawContent);
            words = Array.isArray(jsonData) ? jsonData : [jsonData];
        } else if (format === 'xml') {
            words = parseXML(rawContent);
        } else if (format === 'txt') {
            words = parsePlainWordList(rawContent);
        } else {
            return res.status(400).json({
                success: false,
                error: `Неподдерживаемый формат файла: ${requestedFormat || 'unknown'}. Поддерживаются: csv, json, xml, txt`
            });
        }

        const lastRuWord = await Word.findOne({ lang: 'lang_ru' }).sort({ _id: -1 }).select('_id');
        const lastUzWord = await Word.findOne({ lang: 'lang_uz' }).sort({ _id: -1 }).select('_id');

        const getNumber = (wordId, prefix) => {
            if (!wordId || !wordId.startsWith(prefix)) return 0;
            const number = parseInt(wordId.replace(prefix, ''), 10);
            return Number.isNaN(number) ? 0 : number;
        };

        let nextNumber = Math.max(
            getNumber(lastRuWord?._id, 'ru_'),
            getNumber(lastUzWord?._id, 'uz_')
        ) + 1;

        let created = 0;
        let updated = 0;
        const errors = [];

        for (const wordData of words) {
            try {
                let wordRu = (wordData.word_ru || '').trim();
                let wordUz = (wordData.word_uz || '').trim();
                const genericWord = (wordData.word || wordData.lemma || wordData.name || '').trim();
                const genericDefinition = (wordData.definition || '').trim();
                let definitionRu = (wordData.definition_ru || genericDefinition || '').trim();
                let definitionUz = (wordData.definition_uz || genericDefinition || '').trim();

                if (!wordRu && !wordUz && genericWord) {
                    const detected = detectLanguage(genericWord);
                    if (detected === 'lang_ru') {
                        wordRu = genericWord;
                    } else if (detected === 'lang_uz') {
                        wordUz = genericWord;
                    }
                }

                if (!wordRu && !wordUz) {
                    errors.push('Пропущено слово: отсутствуют word_ru и word_uz');
                    continue;
                }

                if (wordRu && !isSingleWord(wordRu)) {
                    errors.push(`Пропущено слово: "${wordRu}" не является одиночным словом`);
                    continue;
                }

                if (wordUz && !isSingleWord(wordUz)) {
                    errors.push(`Пропущено слово: "${wordUz}" не является одиночным словом`);
                    continue;
                }

                if (wordRu && !wordUz) {
                    const existingOnlyRu = await Word.findOne({ word: wordRu, lang: 'lang_ru' });

                    if (existingOnlyRu) {
                        existingOnlyRu.definition = definitionRu || existingOnlyRu.definition || '';
                        existingOnlyRu.updatedBy = req.user?.id;
                        existingOnlyRu.updatedAt = new Date();
                        await existingOnlyRu.save();
                        updated += 1;
                    } else {
                        const ruId = `ru_${String(nextNumber).padStart(6, '0')}`;
                        const ruWord = new Word({
                            _id: ruId,
                            word: wordRu,
                            definition: definitionRu,
                            lang: 'lang_ru',
                            related: { uz: null },
                            createdBy: req.user?.id
                        });
                        await ruWord.save();
                        created += 1;
                        nextNumber += 1;
                    }

                    continue;
                }

                if (!wordRu && wordUz) {
                    const existingOnlyUz = await Word.findOne({ word: wordUz, lang: 'lang_uz' });

                    if (existingOnlyUz) {
                        existingOnlyUz.definition = definitionUz || existingOnlyUz.definition || '';
                        existingOnlyUz.updatedBy = req.user?.id;
                        existingOnlyUz.updatedAt = new Date();
                        await existingOnlyUz.save();
                        updated += 1;
                    } else {
                        const uzId = `uz_${String(nextNumber).padStart(6, '0')}`;
                        const uzWord = new Word({
                            _id: uzId,
                            word: wordUz,
                            definition: definitionUz,
                            lang: 'lang_uz',
                            related: { ru: null },
                            createdBy: req.user?.id
                        });
                        await uzWord.save();
                        created += 1;
                        nextNumber += 1;
                    }

                    continue;
                }

                if (!wordRu || !wordUz) {
                    errors.push('Пропущено слово: для парного импорта нужны и word_ru и word_uz');
                    continue;
                }

                const existingRu = await Word.findOne({ word: wordRu, lang: 'lang_ru' });
                const existingUz = await Word.findOne({ word: wordUz, lang: 'lang_uz' });

                if (existingRu && existingUz) {
                    existingRu.definition = definitionRu || existingRu.definition || '';
                    existingUz.definition = definitionUz || existingUz.definition || '';
                    existingRu.related.uz = existingUz._id;
                    existingUz.related.ru = existingRu._id;
                    existingRu.updatedBy = req.user?.id;
                    existingUz.updatedBy = req.user?.id;
                    existingRu.updatedAt = new Date();
                    existingUz.updatedAt = new Date();
                    await existingRu.save();
                    await existingUz.save();
                    updated += 2;
                    continue;
                }

                let pairSuffix = String(nextNumber).padStart(6, '0');

                if (existingRu && !existingUz) {
                    const suffix = existingRu._id.replace('ru_', '');
                    if (/^\d+$/.test(suffix)) {
                        pairSuffix = suffix;
                    }
                } else if (!existingRu && existingUz) {
                    const suffix = existingUz._id.replace('uz_', '');
                    if (/^\d+$/.test(suffix)) {
                        pairSuffix = suffix;
                    }
                }

                const ruId = `ru_${pairSuffix}`;
                const uzId = `uz_${pairSuffix}`;

                if (!existingRu && !existingUz) {
                    const ruWord = new Word({
                        _id: ruId,
                        word: wordRu,
                        definition: definitionRu,
                        lang: 'lang_ru',
                        related: { uz: uzId },
                        createdBy: req.user?.id
                    });

                    const uzWord = new Word({
                        _id: uzId,
                        word: wordUz,
                        definition: definitionUz,
                        lang: 'lang_uz',
                        related: { ru: ruId },
                        createdBy: req.user?.id
                    });

                    await ruWord.save();
                    await uzWord.save();
                    created += 2;
                    nextNumber += 1;
                    continue;
                }

                if (existingRu && !existingUz) {
                    const uzWord = new Word({
                        _id: uzId,
                        word: wordUz,
                        definition: definitionUz,
                        lang: 'lang_uz',
                        related: { ru: existingRu._id },
                        createdBy: req.user?.id
                    });

                    existingRu.definition = definitionRu || existingRu.definition || '';
                    existingRu.related.uz = uzWord._id;
                    existingRu.updatedBy = req.user?.id;
                    existingRu.updatedAt = new Date();

                    await existingRu.save();
                    await uzWord.save();
                    created += 1;
                    continue;
                }

                if (!existingRu && existingUz) {
                    const ruWord = new Word({
                        _id: ruId,
                        word: wordRu,
                        definition: definitionRu,
                        lang: 'lang_ru',
                        related: { uz: existingUz._id },
                        createdBy: req.user?.id
                    });

                    existingUz.definition = definitionUz || existingUz.definition || '';
                    existingUz.related.ru = ruWord._id;
                    existingUz.updatedBy = req.user?.id;
                    existingUz.updatedAt = new Date();

                    await ruWord.save();
                    await existingUz.save();
                    created += 1;
                    continue;
                }
            } catch (itemError) {
                errors.push(`Ошибка импорта слова "${wordData.word_ru || wordData.word_uz || 'unknown'}": ${itemError.message}`);
            }
        }

        res.json({
            success: true,
            message: 'Импорт завершен',
            created,
            updated,
            errors,
            nextRuId: `ru_${String(nextNumber).padStart(6, '0')}`,
            nextUzId: `uz_${String(nextNumber).padStart(6, '0')}`
        });
    } catch (error) {
        console.error('Import error:', error);
        res.status(500).json({
            success: false,
            error: 'Server error: ' + error.message
        });
    }
}

/**
 * Извлекает JSON из ответа модели (в т.ч. если ответ в markdown code fence)
 */
function parseModelJson(content) {
    if (!content || typeof content !== 'string') {
        throw new Error('Пустой ответ модели');
    }

    const trimmed = content.trim();

    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        return JSON.parse(trimmed);
    }

    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced && fenced[1]) {
        return JSON.parse(fenced[1].trim());
    }

    const firstBrace = trimmed.indexOf('{');
    const lastBrace = trimmed.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
    }

    throw new Error('Не удалось извлечь JSON из ответа модели');
}

/**
 * Запрос к OpenAI Chat Completions API
 */
async function requestOpenAIHyponymLinks(words, model) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        throw new Error('OPENAI_API_KEY не задан. Добавьте ключ в server/.env');
    }

    const systemPrompt = [
        'You are a linguistics expert building hypernym-hyponym relations.',
        'Return STRICT JSON only.',
        'The output schema is: {"links":[{"hypernymId":"...","hyponymId":"...","confidence":0.0,"reason":"..."}]}',
        'Rules:',
        '- Use only ids from the input list.',
        '- hypernymId must be a more general concept than hyponymId.',
        '- Do not create duplicate or reversed duplicates.',
        '- confidence must be a number from 0 to 1.'
    ].join('\n');

    const userPrompt = JSON.stringify({ words }, null, 2);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model,
            temperature: 0.2,
            response_format: { type: 'json_object' },
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ]
        })
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        const message = payload?.error?.message || `OpenAI error ${response.status}`;
        throw new Error(message);
    }

    const content = payload?.choices?.[0]?.message?.content;
    const parsed = parseModelJson(content);

    if (!parsed || !Array.isArray(parsed.links)) {
        throw new Error('Модель вернула некорректный формат links');
    }

    return parsed.links;
}

/**
 * AI-связывание гипероним/гипоним по имеющимся словам
 * POST /api/admin/ai/link-hyponyms
 */
async function aiLinkHyponyms(req, res) {
    try {
        const {
            lang = 'lang_ru',
            limit = 200,
            minConfidence = 0.75,
            dryRun = true,
            model = process.env.OPENAI_MODEL || 'gpt-4o-mini'
        } = req.body || {};

        if (!['lang_ru', 'lang_uz'].includes(lang)) {
            return res.status(400).json({
                success: false,
                error: 'lang должен быть lang_ru или lang_uz'
            });
        }

        const maxLimit = Math.min(Number(limit) || 200, 500);
        const words = await Word.find({ lang })
            .select('_id word definition lang hypernyms hyponyms')
            .limit(maxLimit)
            .sort({ word: 1 })
            .lean();

        if (words.length < 2) {
            return res.status(400).json({
                success: false,
                error: 'Недостаточно слов для построения связей'
            });
        }

        const modelLinks = await requestOpenAIHyponymLinks(
            words.map(w => ({
                id: w._id,
                word: w.word,
                definition: w.definition || ''
            })),
            model
        );

        const wordIds = new Set(words.map(w => w._id));
        const linkKeySet = new Set();
        const acceptedLinks = [];
        const rejectedLinks = [];

        for (const link of modelLinks) {
            const hypernymId = String(link?.hypernymId || '').trim();
            const hyponymId = String(link?.hyponymId || '').trim();
            const confidence = Number(link?.confidence || 0);
            const reason = String(link?.reason || '').trim();

            if (!hypernymId || !hyponymId || hypernymId === hyponymId) {
                rejectedLinks.push({ ...link, rejectReason: 'invalid_ids' });
                continue;
            }

            if (!wordIds.has(hypernymId) || !wordIds.has(hyponymId)) {
                rejectedLinks.push({ ...link, rejectReason: 'unknown_id' });
                continue;
            }

            if (Number.isNaN(confidence) || confidence < Number(minConfidence)) {
                rejectedLinks.push({ ...link, rejectReason: 'low_confidence' });
                continue;
            }

            const key = `${hypernymId}=>${hyponymId}`;
            if (linkKeySet.has(key)) {
                rejectedLinks.push({ ...link, rejectReason: 'duplicate' });
                continue;
            }

            linkKeySet.add(key);
            acceptedLinks.push({ hypernymId, hyponymId, confidence, reason });
        }

        if (dryRun) {
            return res.json({
                success: true,
                dryRun: true,
                model,
                lang,
                processedWords: words.length,
                acceptedCount: acceptedLinks.length,
                rejectedCount: rejectedLinks.length,
                acceptedLinks,
                rejectedLinks
            });
        }

        let applied = 0;
        for (const link of acceptedLinks) {
            const { hypernymId, hyponymId } = link;

            const [hyperResult, hypoResult] = await Promise.all([
                Word.updateOne(
                    { _id: hypernymId },
                    {
                        $addToSet: { hyponyms: hyponymId },
                        $set: { updatedAt: new Date(), updatedBy: req.user?.id }
                    }
                ),
                Word.updateOne(
                    { _id: hyponymId },
                    {
                        $addToSet: { hypernyms: hypernymId },
                        $set: { updatedAt: new Date(), updatedBy: req.user?.id }
                    }
                )
            ]);

            if ((hyperResult.modifiedCount || hyperResult.upsertedCount) || (hypoResult.modifiedCount || hypoResult.upsertedCount)) {
                applied += 1;
            }
        }

        return res.json({
            success: true,
            dryRun: false,
            model,
            lang,
            processedWords: words.length,
            acceptedCount: acceptedLinks.length,
            rejectedCount: rejectedLinks.length,
            applied,
            acceptedLinks,
            rejectedLinks
        });
    } catch (error) {
        console.error('AI link hyponyms error:', error);
        return res.status(500).json({
            success: false,
            error: 'AI linking error: ' + error.message
        });
    }
}

module.exports = {
    getAllWords,
    getWordById,
    createWord,
    updateWord,
    deleteWord,
    searchForHypernyms,
    getWordTree,
    importWords,
    aiLinkHyponyms
};
