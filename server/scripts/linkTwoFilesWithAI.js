/*
 * Автоматическое связывание 2 файлов (RU + UZ) через AI:
 * 1) пары переводов RU<->UZ
 * 2) гипероним/гипоним внутри каждого языка
 *
 * Пример:
 * node scripts/linkTwoFilesWithAI.js \
 *   --ru ./filesforme/ru.csv \
 *   --uz ./filesforme/uz.csv \
 *   --dry-run false
 */

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const Word = require('../models/Word');
const { connectDB, disconnectDB } = require('../config/database');

function parseArgs(argv) {
    const args = {};
    for (let i = 2; i < argv.length; i++) {
        const item = argv[i];
        if (item.startsWith('--')) {
            const key = item.slice(2);
            const next = argv[i + 1];
            if (!next || next.startsWith('--')) {
                args[key] = true;
            } else {
                args[key] = next;
                i += 1;
            }
        }
    }
    return args;
}

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
        return [];
    }

    const headers = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase());

    return lines.slice(1).map(line => {
        const values = parseCSVLine(line);
        const row = {};
        headers.forEach((h, idx) => {
            row[h] = values[idx] || '';
        });
        return row;
    });
}

function readStructuredFile(filePath) {
    const abs = path.resolve(filePath);
    const content = fs.readFileSync(abs, 'utf-8');
    const ext = path.extname(abs).toLowerCase();

    if (ext === '.json') {
        const parsed = JSON.parse(content);
        return Array.isArray(parsed) ? parsed : [parsed];
    }

    if (ext === '.csv') {
        return parseCSV(content);
    }

    throw new Error(`Неподдерживаемый формат файла: ${ext}`);
}

function normalizeRu(rows) {
    return rows
        .map((row, idx) => {
            const word = String(row.word_ru || row.word || row.term || row.lemma || '').trim();
            const definition = String(row.definition_ru || row.definition || row.gloss || '').trim();
            return { idx, word, definition };
        })
        .filter(row => row.word);
}

function normalizeUz(rows) {
    return rows
        .map((row, idx) => {
            const word = String(row.word_uz || row.word || row.term || row.lemma || '').trim();
            const definition = String(row.definition_uz || row.definition || row.gloss || '').trim();
            return { idx, word, definition };
        })
        .filter(row => row.word);
}

function parseModelJson(content) {
    const text = String(content || '').trim();
    if (!text) throw new Error('Пустой ответ модели');

    if (text.startsWith('{') || text.startsWith('[')) {
        return JSON.parse(text);
    }

    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced && fenced[1]) {
        return JSON.parse(fenced[1].trim());
    }

    const b1 = text.indexOf('{');
    const b2 = text.lastIndexOf('}');
    if (b1 !== -1 && b2 !== -1 && b2 > b1) {
        return JSON.parse(text.slice(b1, b2 + 1));
    }

    throw new Error('Не удалось разобрать JSON ответа модели');
}

async function chatJson({ model, systemPrompt, userPrompt }) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        throw new Error('OPENAI_API_KEY не задан');
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`
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
        throw new Error(payload?.error?.message || `OpenAI error ${response.status}`);
    }

    return parseModelJson(payload?.choices?.[0]?.message?.content);
}

async function generatePairs(ruWords, uzWords, model) {
    const systemPrompt = [
        'You are a linguistics matcher for Russian and Uzbek words.',
        'Return strict JSON with schema:',
        '{"pairs":[{"ruIndex":0,"uzIndex":1,"confidence":0.9,"reason":"..."}],"unmatchedRu":[0],"unmatchedUz":[1]}',
        'Rules:',
        '- ruIndex and uzIndex must be valid indices from provided arrays.',
        '- Each uzIndex can be used at most once.',
        '- Pair only semantically matching words.',
        '- confidence in [0,1].'
    ].join('\n');

    const userPrompt = JSON.stringify({ ruWords, uzWords }, null, 2);
    const result = await chatJson({ model, systemPrompt, userPrompt });

    if (!result || !Array.isArray(result.pairs)) {
        throw new Error('Модель вернула неверный формат pairs');
    }

    return result;
}

async function generateHypernymLinks(words, model) {
    const systemPrompt = [
        'You are a linguistics expert building hypernym-hyponym links.',
        'Return strict JSON schema:',
        '{"links":[{"hypernymIndex":0,"hyponymIndex":1,"confidence":0.9,"reason":"..."}]}',
        'Rules:',
        '- hypernym is the more generic concept.',
        '- no self links.',
        '- confidence in [0,1].'
    ].join('\n');

    const userPrompt = JSON.stringify({ words }, null, 2);
    const result = await chatJson({ model, systemPrompt, userPrompt });

    if (!result || !Array.isArray(result.links)) {
        throw new Error('Модель вернула неверный формат hypernym links');
    }

    return result.links;
}

function parseNumericSuffix(id, prefix) {
    if (!id || !id.startsWith(prefix)) return null;
    const suffix = id.slice(prefix.length);
    return /^\d+$/.test(suffix) ? suffix : null;
}

async function nextCounter() {
    const [ru, uz] = await Promise.all([
        Word.findOne({ lang: 'lang_ru' }).sort({ _id: -1 }).select('_id').lean(),
        Word.findOne({ lang: 'lang_uz' }).sort({ _id: -1 }).select('_id').lean()
    ]);

    const ruNum = ru?._id ? parseInt(ru._id.replace('ru_', ''), 10) || 0 : 0;
    const uzNum = uz?._id ? parseInt(uz._id.replace('uz_', ''), 10) || 0 : 0;
    return Math.max(ruNum, uzNum) + 1;
}

async function upsertWordByLang({ word, definition, lang, id, relatedId }) {
    const existing = await Word.findOne({ word, lang });

    if (existing) {
        existing.definition = definition || existing.definition || '';
        if (lang === 'lang_ru' && relatedId) existing.related.uz = relatedId;
        if (lang === 'lang_uz' && relatedId) existing.related.ru = relatedId;
        existing.updatedAt = new Date();
        await existing.save();
        return existing;
    }

    const doc = new Word({
        _id: id,
        word,
        definition: definition || '',
        lang,
        related: lang === 'lang_ru' ? { uz: relatedId || null } : { ru: relatedId || null }
    });
    await doc.save();
    return doc;
}

async function applyHypernymLinks(idLinks, minConfidence, dryRun) {
    const accepted = [];
    for (const link of idLinks) {
        const confidence = Number(link.confidence || 0);
        if (!link.hypernymId || !link.hyponymId || link.hypernymId === link.hyponymId) continue;
        if (confidence < minConfidence) continue;
        accepted.push({
            hypernymId: link.hypernymId,
            hyponymId: link.hyponymId,
            confidence
        });
    }

    if (dryRun) {
        return { accepted, applied: 0 };
    }

    let applied = 0;
    for (const link of accepted) {
        const [a, b] = await Promise.all([
            Word.updateOne(
                { _id: link.hypernymId },
                { $addToSet: { hyponyms: link.hyponymId }, $set: { updatedAt: new Date() } }
            ),
            Word.updateOne(
                { _id: link.hyponymId },
                { $addToSet: { hypernyms: link.hypernymId }, $set: { updatedAt: new Date() } }
            )
        ]);

        if ((a.modifiedCount || a.upsertedCount) || (b.modifiedCount || b.upsertedCount)) {
            applied += 1;
        }
    }

    return { accepted, applied };
}

async function main() {
    const args = parseArgs(process.argv);
    const ruFile = args.ru;
    const uzFile = args.uz;

    if (!ruFile || !uzFile) {
        throw new Error('Нужно передать оба файла: --ru <path> --uz <path>');
    }

    const dryRun = String(args['dry-run'] ?? 'true').toLowerCase() !== 'false';
    const minConfidence = Number(args['min-confidence'] || 0.75);
    const model = args.model || process.env.OPENAI_MODEL || 'gpt-4o-mini';

    const ruRows = readStructuredFile(ruFile);
    const uzRows = readStructuredFile(uzFile);
    const ruWords = normalizeRu(ruRows);
    const uzWords = normalizeUz(uzRows);

    if (!ruWords.length || !uzWords.length) {
        throw new Error('В одном из файлов нет валидных слов');
    }

    console.log(`RU words: ${ruWords.length}, UZ words: ${uzWords.length}`);
    console.log(`Model: ${model}, dryRun: ${dryRun}, minConfidence: ${minConfidence}`);

    await connectDB();

    const pairResult = await generatePairs(ruWords, uzWords, model);
    const pairs = pairResult.pairs || [];

    const usedRu = new Set();
    const usedUz = new Set();
    const validPairs = [];

    for (const pair of pairs) {
        const ri = Number(pair.ruIndex);
        const ui = Number(pair.uzIndex);
        const confidence = Number(pair.confidence || 0);

        if (Number.isNaN(ri) || Number.isNaN(ui)) continue;
        if (!ruWords[ri] || !uzWords[ui]) continue;
        if (usedRu.has(ri) || usedUz.has(ui)) continue;
        if (confidence < minConfidence) continue;

        usedRu.add(ri);
        usedUz.add(ui);
        validPairs.push({
            ruIndex: ri,
            uzIndex: ui,
            confidence,
            reason: pair.reason || ''
        });
    }

    let counter = await nextCounter();
    const ruIdByIndex = {};
    const uzIdByIndex = {};

    let created = 0;
    let updated = 0;

    for (const pair of validPairs) {
        const ruItem = ruWords[pair.ruIndex];
        const uzItem = uzWords[pair.uzIndex];

        const ruExisting = await Word.findOne({ word: ruItem.word, lang: 'lang_ru' });
        const uzExisting = await Word.findOne({ word: uzItem.word, lang: 'lang_uz' });

        let suffix = String(counter).padStart(6, '0');
        if (ruExisting && !uzExisting) {
            const s = parseNumericSuffix(ruExisting._id, 'ru_');
            if (s) suffix = s;
        }
        if (!ruExisting && uzExisting) {
            const s = parseNumericSuffix(uzExisting._id, 'uz_');
            if (s) suffix = s;
        }

        const ruId = `ru_${suffix}`;
        const uzId = `uz_${suffix}`;

        if (dryRun) {
            ruIdByIndex[pair.ruIndex] = ruExisting?._id || ruId;
            uzIdByIndex[pair.uzIndex] = uzExisting?._id || uzId;
            if (!ruExisting) created += 1; else updated += 1;
            if (!uzExisting) created += 1; else updated += 1;
            if (!ruExisting && !uzExisting) counter += 1;
            continue;
        }

        const ruDoc = await upsertWordByLang({
            word: ruItem.word,
            definition: ruItem.definition,
            lang: 'lang_ru',
            id: ruId,
            relatedId: uzExisting?._id || uzId
        });

        const uzDoc = await upsertWordByLang({
            word: uzItem.word,
            definition: uzItem.definition,
            lang: 'lang_uz',
            id: uzId,
            relatedId: ruDoc._id
        });

        if (ruDoc.related?.uz !== uzDoc._id) {
            ruDoc.related.uz = uzDoc._id;
            ruDoc.updatedAt = new Date();
            await ruDoc.save();
        }

        ruIdByIndex[pair.ruIndex] = ruDoc._id;
        uzIdByIndex[pair.uzIndex] = uzDoc._id;

        if (ruExisting) updated += 1; else created += 1;
        if (uzExisting) updated += 1; else created += 1;
        if (!ruExisting && !uzExisting) counter += 1;
    }

    const unmatchedRuIdx = ruWords.map((_, i) => i).filter(i => !usedRu.has(i));
    const unmatchedUzIdx = uzWords.map((_, i) => i).filter(i => !usedUz.has(i));

    for (const i of unmatchedRuIdx) {
        const item = ruWords[i];
        const existing = await Word.findOne({ word: item.word, lang: 'lang_ru' });
        const id = existing?._id || `ru_${String(counter).padStart(6, '0')}`;

        if (!dryRun) {
            const doc = await upsertWordByLang({
                word: item.word,
                definition: item.definition,
                lang: 'lang_ru',
                id,
                relatedId: null
            });
            ruIdByIndex[i] = doc._id;
        } else {
            ruIdByIndex[i] = id;
        }

        if (existing) updated += 1; else {
            created += 1;
            counter += 1;
        }
    }

    for (const i of unmatchedUzIdx) {
        const item = uzWords[i];
        const existing = await Word.findOne({ word: item.word, lang: 'lang_uz' });
        const id = existing?._id || `uz_${String(counter).padStart(6, '0')}`;

        if (!dryRun) {
            const doc = await upsertWordByLang({
                word: item.word,
                definition: item.definition,
                lang: 'lang_uz',
                id,
                relatedId: null
            });
            uzIdByIndex[i] = doc._id;
        } else {
            uzIdByIndex[i] = id;
        }

        if (existing) updated += 1; else {
            created += 1;
            counter += 1;
        }
    }

    const ruLinksRaw = await generateHypernymLinks(ruWords, model);
    const uzLinksRaw = await generateHypernymLinks(uzWords, model);

    const ruLinks = ruLinksRaw.map(link => ({
        hypernymId: ruIdByIndex[Number(link.hypernymIndex)],
        hyponymId: ruIdByIndex[Number(link.hyponymIndex)],
        confidence: Number(link.confidence || 0)
    }));

    const uzLinks = uzLinksRaw.map(link => ({
        hypernymId: uzIdByIndex[Number(link.hypernymIndex)],
        hyponymId: uzIdByIndex[Number(link.hyponymIndex)],
        confidence: Number(link.confidence || 0)
    }));

    const ruApply = await applyHypernymLinks(ruLinks, minConfidence, dryRun);
    const uzApply = await applyHypernymLinks(uzLinks, minConfidence, dryRun);

    console.log('===== RESULT =====');
    console.log(`Pairs accepted: ${validPairs.length}`);
    console.log(`Created: ${created}, Updated: ${updated}`);
    console.log(`RU hypernym links accepted: ${ruApply.accepted.length}, applied: ${ruApply.applied}`);
    console.log(`UZ hypernym links accepted: ${uzApply.accepted.length}, applied: ${uzApply.applied}`);
    console.log(`Next IDs preview: ru_${String(counter).padStart(6, '0')} / uz_${String(counter).padStart(6, '0')}`);

    await disconnectDB();
}

main().catch(async (error) => {
    console.error('ERROR:', error.message);
    try {
        await disconnectDB();
    } catch (e) {
        // ignore
    }
    process.exit(1);
});
