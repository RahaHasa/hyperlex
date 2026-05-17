const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Word = require('../models/Word');
const { normalizeWord } = require('../utils/semanticHelper');

const DEFAULT_INPUT_JSON = path.join(__dirname, '../data/generated/ruwordnet_nouns_106k.json');

function sanitizeParentMap(rawEntries) {
  const rootKey = 'noun_lexicon';
  const parentMap = new Map();

  for (const entry of rawEntries) {
    parentMap.set(entry.semantic_key, entry.parent || null);
  }

  const cycleNodes = new Set();

  for (const entry of rawEntries) {
    const trail = new Map();
    let current = entry.semantic_key;
    let step = 0;

    while (current && parentMap.has(current)) {
      if (trail.has(current)) {
        for (const node of trail.keys()) {
          cycleNodes.add(node);
        }
        break;
      }

      trail.set(current, step++);
      current = parentMap.get(current);
    }
  }

  for (const entry of rawEntries) {
    if (!entry.semantic_key.startsWith('concept_')) continue;
    if (cycleNodes.has(entry.semantic_key)) {
      entry.parent = rootKey;
    }
  }

  return { rawEntries, cycleNodes };
}

function buildChildrenMap(rawEntries) {
  const childrenMap = new Map();
  for (const entry of rawEntries) {
    childrenMap.set(entry.semantic_key, []);
  }

  for (const entry of rawEntries) {
    if (entry.parent && childrenMap.has(entry.parent)) {
      childrenMap.get(entry.parent).push(entry.semantic_key);
    }
  }

  return childrenMap;
}

function recomputeLevels(rawEntries) {
  const entryMap = new Map(rawEntries.map((entry) => [entry.semantic_key, entry]));
  const memo = new Map();
  const visiting = new Set();

  function visit(key) {
    if (memo.has(key)) return memo.get(key);
    if (visiting.has(key)) return 1;

    visiting.add(key);
    const entry = entryMap.get(key);
    let level = entry?.level || 1;

    if (entry?.parent && entryMap.has(entry.parent)) {
      level = Math.min(6, visit(entry.parent) + 1);
    }

    visiting.delete(key);
    memo.set(key, level);
    entry.level = level;
    return level;
  }

  for (const entry of rawEntries) {
    visit(entry.semantic_key);
  }
}

async function main() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/hyperlexdemo';
  const inputJson = process.env.INPUT_JSON || DEFAULT_INPUT_JSON;

  if (!fs.existsSync(inputJson)) {
    throw new Error(`Generated file not found: ${inputJson}`);
  }

  const raw = fs.readFileSync(inputJson, 'utf8');
  const data = JSON.parse(raw);
  let rawEntries = Object.entries(data).map(([semantic_key, value]) => ({
    semantic_key,
    ...value
  }));

  const { cycleNodes } = sanitizeParentMap(rawEntries);
  recomputeLevels(rawEntries);
  const childrenMap = buildChildrenMap(rawEntries);
  console.log(`Sanitized ${cycleNodes.size} cyclic nodes before import`);

  const entries = rawEntries.map((entry) => ({
    semantic_key: entry.semantic_key,
    ru: entry.ru || '',
    uz: entry.uz || '',
    normalized_ru: normalizeWord(entry.ru || '', 'ru'),
    normalized_uz: normalizeWord(entry.uz || '', 'uz'),
    description_ru: entry.description_ru || '',
    description_uz: entry.description_uz || '',
    parent_semantic_key: entry.parent || null,
    children_semantic_keys: childrenMap.get(entry.semantic_key) || [],
    category: entry.category || 'generated_noun',
    level: entry.level || 1,
    related: Array.isArray(entry.related) ? entry.related : []
  }));

  console.log(`Connecting to MongoDB: ${mongoUri}`);
  await mongoose.connect(mongoUri);

  let saved = 0;
  let failed = 0;

  for (const entry of entries) {
    try {
      await Word.findOneAndUpdate(
        { semantic_key: entry.semantic_key },
        { $set: entry },
        { upsert: true, new: true }
      );
      saved += 1;

      if (saved % 5000 === 0) {
        console.log(`Saved ${saved}/${entries.length}`);
      }
    } catch (error) {
      failed += 1;
      if (failed <= 20) {
        console.error(`Failed ${entry.semantic_key}: ${error.message}`);
      }
    }
  }

  console.log(`Done. Saved: ${saved}, Failed: ${failed}`);
  console.log(`Total words in DB: ${await Word.countDocuments()}`);

  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
