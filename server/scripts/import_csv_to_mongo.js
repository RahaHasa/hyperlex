/**
 * Импорт CSV (word_ru,definition_ru,word_uz,definition_uz) в MongoDB
 * Запускается так:
 * IMPORT_CSV=path/to/file.csv node server/scripts/import_csv_to_mongo.js
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { connectDB, disconnectDB } = require('../config/database');
const Word = require('../models/Word');

function parseCsvLine(line) {
  const res = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i+1] === '"') { cur += '"'; i++; continue; }
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === ',' && !inQuotes) { res.push(cur); cur = ''; continue; }
    cur += ch;
  }
  res.push(cur);
  return res.map(s => s === undefined ? '' : s);
}

function makeId(prefix, word, idx) {
  const safe = String(word || '').toLowerCase().replace(/[^a-z0-9а-яё]+/g, '_').replace(/^_+|_+$/g, '').slice(0,30) || 'w';
  return `${prefix}_${idx}_${safe}`;
}

async function importFile(csvPath) {
  if (!fs.existsSync(csvPath)) throw new Error('CSV not found: ' + csvPath);
  const content = fs.readFileSync(csvPath, 'utf8');
  const lines = content.split(/\r?\n/).filter(Boolean);
  if (lines.length <= 1) return { inserted: 0 };
  const header = lines[0].toLowerCase();
  const rows = lines.slice(1);

  const docs = [];
  let idx = 0;
  for (const line of rows) {
    idx++;
    const cols = parseCsvLine(line);
    const [word_ru, def_ru, word_uz, def_uz] = cols.map(c => (c || '').trim());
    if (!word_ru && !word_uz) continue;
    const ruId = word_ru ? makeId('ru', word_ru, idx) : null;
    const uzId = word_uz ? makeId('uz', word_uz, idx) : null;

    if (word_ru) {
      docs.push({
        _id: ruId,
        word: word_ru,
        lang: 'lang_ru',
        definition: def_ru || '',
        hypernyms: [],
        hyponyms: [],
        related: { uz: uzId || null, ru: null },
        translations: { ru: null, uz: word_uz || null }
      });
    }
    if (word_uz) {
      docs.push({
        _id: uzId,
        word: word_uz,
        lang: 'lang_uz',
        definition: def_uz || '',
        hypernyms: [],
        hyponyms: [],
        related: { ru: ruId || null, uz: null },
        translations: { uz: null, ru: word_ru || null }
      });
    }
  }

  // Insert in batches
  const BATCH = 1000;
  let inserted = 0;
  for (let i = 0; i < docs.length; i += BATCH) {
    const batch = docs.slice(i, i + BATCH);
    try {
      const res = await Word.insertMany(batch, { ordered: false });
      inserted += Array.isArray(res) ? res.length : 0;
    } catch (err) {
      // ignore duplicate key errors and continue
      if (err && err.writeErrors) {
        inserted += (batch.length - err.writeErrors.length);
      }
    }
  }
  return { inserted };
}

async function main() {
  const csvEnv = process.env.IMPORT_CSV;
  let csvPath = csvEnv;
  if (!csvPath) {
    // pick the latest rwn_2020_*.csv
    const csvDir = path.join(__dirname, '..', 'datasetforme', 'python-ruwordnet-master', 'data', 'csvfile');
    const files = fs.existsSync(csvDir) ? fs.readdirSync(csvDir).filter(f => f.startsWith('rwn_2020_') && f.endsWith('.csv')) : [];
    if (!files.length) throw new Error('No CSV files found in ' + csvDir + ', set IMPORT_CSV env');
    files.sort();
    csvPath = path.join(csvDir, files[files.length - 1]);
  }

  console.log('➡ Import CSV:', csvPath);
  await connectDB();
  try {
    const { inserted } = await importFile(csvPath);
    console.log('✅ Inserted documents:', inserted);
  } catch (err) {
    console.error('❌ Import error:', err.message || err);
  }
  await disconnectDB();
}

main().catch(err => { console.error(err); process.exit(1); });
