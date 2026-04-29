/**
 * Merge RU and UZ enriched CSV files into one final CSV.
 * Keeps the original word columns and prefers non-empty definitions from each enriched file.
 * Usage:
 *   BASE_CSV=path/to/rwn_2020_senses.N_0_68392_paired.csv \
 *   RU_CSV=path/to/rwn_2020_senses.N_0_68392_paired_ru_enriched.csv \
 *   UZ_CSV=path/to/rwn_2020_senses.N_0_68392_paired_uz_enriched.csv \
 *   node server/scripts/merge_enriched_csv.js
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

function parseCsvLine(line) {
  const res = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === ',' && !inQuotes) {
      res.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  res.push(cur);
  return res.map(s => (s === undefined ? '' : s));
}

function escCsvCol(s) {
  if (s === null || s === undefined || s === '') return '""';
  const str = String(s).replace(/"/g, '""');
  return (str.includes(',') || str.includes('\n') || str.includes('"')) ? `"${str}"` : str;
}

function loadCsv(csvPath) {
  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSV not found: ${csvPath}`);
  }
  const content = fs.readFileSync(csvPath, 'utf8');
  const lines = content.split(/\r?\n/).filter(Boolean);
  if (!lines.length) {
    throw new Error(`CSV is empty: ${csvPath}`);
  }
  const header = lines[0];
  const rows = lines.slice(1).map(parseCsvLine);
  return { header, rows };
}

function choose(primary, fallback) {
  return primary && String(primary).trim() !== '' ? primary : (fallback || '');
}

async function main() {
  const baseCsv = process.env.BASE_CSV || path.join(__dirname, '..', 'datasetforme', 'python-ruwordnet-master', 'data', 'csvfile', 'rwn_2020_senses.N_0_68392_paired.csv');
  const ruCsv = process.env.RU_CSV || baseCsv.replace(/\.csv$/, '_ru_enriched.csv');
  const uzCsv = process.env.UZ_CSV || baseCsv.replace(/\.csv$/, '_uz_enriched.csv');
  const outCsv = process.env.OUT_CSV || baseCsv.replace(/\.csv$/, '_final_ai_enriched.csv');

  console.log('Base CSV:', baseCsv);
  console.log('RU CSV:', ruCsv);
  console.log('UZ CSV:', uzCsv);

  const base = loadCsv(baseCsv);
  const ru = loadCsv(ruCsv);
  const uz = loadCsv(uzCsv);

  if (base.rows.length !== ru.rows.length || base.rows.length !== uz.rows.length) {
    throw new Error(`Row counts differ: base=${base.rows.length}, ru=${ru.rows.length}, uz=${uz.rows.length}`);
  }

  const mergedRows = [];
  for (let i = 0; i < base.rows.length; i++) {
    const baseRow = base.rows[i];
    const ruRow = ru.rows[i];
    const uzRow = uz.rows[i];

    const word_ru = baseRow[0] || ruRow[0] || '';
    const word_uz = baseRow[2] || uzRow[2] || '';
    const definition_ru = choose(ruRow[1], baseRow[1]);
    const definition_uz = choose(uzRow[3], baseRow[3]);

    mergedRows.push([word_ru, definition_ru, word_uz, definition_uz]);
  }

  const header = base.header || 'word_ru,definition_ru,word_uz,definition_uz';
  const output = [header, ...mergedRows.map(row => row.map(escCsvCol).join(','))].join('\n');
  fs.writeFileSync(outCsv, output, 'utf8');

  console.log(`✅ Merged CSV written to: ${outCsv}`);
  console.log(`Rows: ${mergedRows.length}`);
}

main().catch(err => {
  console.error('Merge error:', err.message || err);
  process.exit(1);
});
