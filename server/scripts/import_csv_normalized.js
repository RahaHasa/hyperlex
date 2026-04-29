/**
 * Импорт CSV в MongoDB с нормальными ID (ru_NNNNNN, uz_NNNNNN)
 * Использует собственные счетчики для каждого языка
 * Usage:
 *  IMPORT_CSV=path/to/file.csv node server/scripts/import_csv_normalized.js
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

function zeroPad(n, width = 6) {
  return String(n).padStart(width, '0');
}

async function importFile(csvPath) {
  if (!fs.existsSync(csvPath)) throw new Error('CSV not found: ' + csvPath);
  const content = fs.readFileSync(csvPath, 'utf8');
  const lines = content.split(/\r?\n/).filter(Boolean);
  if (lines.length <= 1) return { inserted: 0 };
  const rows = lines.slice(1);

  // Get current max counters from DB to continue numbering
  const maxRu = await Word.findOne({ lang: 'lang_ru' }).sort({ _id: -1 }).lean();
  const maxUz = await Word.findOne({ lang: 'lang_uz' }).sort({ _id: -1 }).lean();
  
  let ruCounter = 0;
  let uzCounter = 0;
  
  if (maxRu && maxRu._id) {
    const m = maxRu._id.match(/^ru_(\d+)$/);
    if (m) ruCounter = parseInt(m[1], 10);
  }
  if (maxUz && maxUz._id) {
    const m = maxUz._id.match(/^uz_(\d+)$/);
    if (m) uzCounter = parseInt(m[1], 10);
  }
  
  console.log(`Starting counters: ru=${ruCounter}, uz=${uzCounter}`);

  const docs = [];
  let rowIdx = 0;
  for (const line of rows) {
    rowIdx++;
    const cols = parseCsvLine(line);
    const [word_ru, def_ru, word_uz, def_uz] = cols.map(c => (c || '').trim());
    if (!word_ru && !word_uz) continue;

    const ruId = word_ru ? `ru_${zeroPad(++ruCounter)}` : null;
    const uzId = word_uz ? `uz_${zeroPad(++uzCounter)}` : null;

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
      if (err && err.writeErrors) {
        inserted += (batch.length - err.writeErrors.length);
      }
    }
    if ((i + batch.length) % 5000 === 0) {
      console.log(`Inserted ${i + batch.length} documents...`);
    }
  }
  return { inserted, ruCounter, uzCounter };
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

  console.log('➡ Import CSV (normalized IDs):', csvPath);
  await connectDB();
  try {
    const { inserted, ruCounter, uzCounter } = await importFile(csvPath);
    const finalTotal = await Word.countDocuments();
    console.log(`✅ Inserted: ${inserted} documents`);
    console.log(`📊 Final counters: ru_${zeroPad(ruCounter)}, uz_${zeroPad(uzCounter)}`);
    console.log(`📊 Total words in DB: ${finalTotal}`);
  } catch (err) {
    console.error('❌ Import error:', err.message || err);
  }
  await disconnectDB();
}

main().catch(err => { console.error(err); process.exit(1); });
