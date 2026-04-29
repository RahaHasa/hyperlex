/**
 * Filter CSV: Keep only rows with both word_ru AND word_uz (complete pairs)
 * Removes unpaired entries
 * Usage:
 *  INPUT_CSV=path/to/file.csv node server/scripts/filter_paired_words.js
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');

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

function escCsvCol(s) {
  if (!s) return '""';
  const str = String(s).replace(/"/g, '""');
  return (str.includes(',') || str.includes('\n') || str.includes('"')) ? `"${str}"` : str;
}

async function main() {
  const inputCsv = process.env.INPUT_CSV || path.join(__dirname, '..', 'datasetforme', 'python-ruwordnet-master', 'data', 'csvfile', 'rwn_2020_senses.N_0_68392.csv');
  
  if (!fs.existsSync(inputCsv)) {
    console.error('Input CSV not found:', inputCsv);
    process.exit(1);
  }
  
  console.log(`Reading CSV: ${inputCsv}`);
  const content = fs.readFileSync(inputCsv, 'utf8');
  const lines = content.split(/\r?\n/).filter(Boolean);
  const header = lines[0];
  const rows = lines.slice(1).map(line => parseCsvLine(line));
  
  console.log(`Total rows: ${rows.length}`);
  
  // Keep only paired rows (both word_ru AND word_uz present)
  const paired = rows.filter(r => {
    const word_ru = (r[0] || '').trim();
    const word_uz = (r[2] || '').trim();
    return word_ru && word_uz;
  });
  
  const removed = rows.length - paired.length;
  console.log(`Paired rows: ${paired.length}`);
  console.log(`Removed unpaired: ${removed}`);
  
  // Show samples of removed
  const unpaired = rows.filter(r => {
    const word_ru = (r[0] || '').trim();
    const word_uz = (r[2] || '').trim();
    return !(word_ru && word_uz);
  });
  console.log(`\nSample removed rows (first 10):`);
  unpaired.slice(0, 10).forEach(r => {
    console.log(`  ru="${r[0]}" uz="${r[2]}"`);
  });
  
  // Write filtered CSV
  const outCsv = inputCsv.replace(/\.csv$/, '_paired.csv');
  const lines_out = [header, ...paired.map(r => r.map(escCsvCol).join(','))];
  fs.writeFileSync(outCsv, lines_out.join('\n'), 'utf8');
  
  console.log(`\n✅ Saved to: ${outCsv} (${paired.length} rows)`);
}

main().catch(e => { console.error(e); process.exit(1); });
