/**
 * Enrich Uzbek definitions via OpenAI
 * Reads CSV, generates/translates definition_uz, outputs new CSV
 * Usage:
 *  INPUT_CSV=path/to/rwn_2020_senses.N_0_68392_paired.csv OPENAI_API_KEY=xxx CONCURRENCY=10 MODE=gen node server/scripts/enrich_definitions_uz.js
 * MODE: gen (generate/translate if empty), improve (regenerate all), check (preview only)
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

async function callOpenAIChat(messages, temperature = 0.2) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  const model = String(process.env.MODEL_UZ || process.env.MODEL || 'gpt-4o-mini');
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`
      },
      body: JSON.stringify({
        model,
        messages,
        max_completion_tokens: 300
      })
    });
    if (!res.ok) return null;
    const payload = await res.json();
    return String(payload?.choices?.[0]?.message?.content || '').trim();
  } catch (e) {
    console.error('OpenAI error:', e.message);
    return null;
  }
}

async function translateToUzbek(russianDef) {
  const msg = [
    { role: 'system', content: 'You are a translator. Translate the given Russian text to Uzbek. Return plain text only, no quotes.' },
    { role: 'user', content: `Translate to Uzbek: ${russianDef}` }
  ];
  return callOpenAIChat(msg, 0.1);
}

async function generateUzbekDefinition(word) {
  const msg = [
    { role: 'system', content: 'You are a concise Uzbek dictionary writer. Provide a short one-line definition in Uzbek for the given word. Return plain text only, no quotes.' },
    { role: 'user', content: `Give a short Uzbek definition for the word: ${word}` }
  ];
  return callOpenAIChat(msg, 0.2);
}

async function processRows(rows, mode = 'gen', concurrency = 3) {
  let idx = 0;
  const toProcess = (mode === 'improve'
    ? rows.map((row, originalIndex) => ({ row, originalIndex }))
    : rows
        .map((row, originalIndex) => ({ row, originalIndex }))
        .filter(item => (item.row[3] === '' || item.row[3].trim() === '') && (item.row[2] || item.row[1])));
  const result = new Array(rows.length);
  
  console.log(`Processing ${toProcess.length} rows (mode=${mode})...`);
  
  async function worker() {
    while (true) {
      const i = idx++;
      if (i >= toProcess.length) break;
      const { row, originalIndex } = toProcess[i];
      const [word_ru, def_ru, word_uz, def_uz] = row;
      
      let newDef = def_uz;
      
      // Try to translate from Russian definition first
      if ((!newDef || newDef.trim() === '') && (def_ru && def_ru.trim())) {
        try {
          const translated = await translateToUzbek(def_ru);
          if (translated) newDef = translated;
        } catch (e) {
          console.error('Translation error:', e.message);
        }
      }
      
      // If no Russian definition to translate, generate directly for Uzbek word
      if ((!newDef || newDef.trim() === '') && (word_uz && word_uz.trim())) {
        try {
          const generated = await generateUzbekDefinition(word_uz);
          if (generated) newDef = generated;
        } catch (e) {
          console.error('Generation error:', e.message);
        }
      }
      
      result[originalIndex] = [word_ru, def_ru, word_uz, newDef || def_uz];
      if ((i + 1) % 50 === 0) console.log(`  Processed ${i + 1}/${toProcess.length}`);
    }
  }
  
  const workers = [];
  for (let w = 0; w < Math.min(concurrency, toProcess.length); w++) workers.push(worker());
  await Promise.all(workers);
  
  return result;
}

async function main() {
  const inputCsv = process.env.INPUT_CSV || path.join(__dirname, '..', 'datasetforme', 'python-ruwordnet-master', 'data', 'csvfile', 'rwn_2020_senses.N_0_68392_paired.csv');
  const mode = String(process.env.MODE || 'gen').toLowerCase();
  const concurrency = parseInt(process.env.CONCURRENCY || '3', 10);
  
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
  
  if (mode === 'check') {
    const empty = rows.filter(r => (r[3] === '' || r[3].trim() === '') && (r[2] || r[1]));
    console.log(`Empty Uzbek definitions (but have word or Russian def): ${empty.length}`);
    console.log('Sample:');
    empty.slice(0, 5).forEach(r => console.log(`  ru=${r[0]} uz=${r[2]} def_uz="${r[3]}"`));
    return;
  }
  
  const processed = await processRows(rows, mode, concurrency);
  
  const outCsv = inputCsv.replace(/\.csv$/, '_uz_enriched.csv');
  const lines_out = [header, ...processed.map(r => (r || []).map(escCsvCol).join(','))];
  fs.writeFileSync(outCsv, lines_out.join('\n'), 'utf8');
  
  console.log(`✅ Saved to: ${outCsv}`);
}

main().catch(e => { console.error(e); process.exit(1); });
