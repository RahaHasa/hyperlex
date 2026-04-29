/**
 * Orchestrator: filter -> enrich RU -> enrich UZ -> merge
 * Usage examples:
 *   # run all steps (default)
 *   INPUT_CSV=path/to/file.csv OPENAI_API_KEY=xxx CONCURRENCY=8 node server/scripts/run_full_enrichment.js
 *
 *   # run only RU enrichment (assumes paired CSV exists)
 *   STEP=ru INPUT_CSV=... CONCURRENCY=10 node server/scripts/run_full_enrichment.js
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
  return res.map(s => (s === undefined ? '' : s));
}

function escCsvCol(s) {
  if (s === null || s === undefined || s === '') return '""';
  const str = String(s).replace(/"/g, '""');
  return (str.includes(',') || str.includes('\n') || str.includes('"')) ? `"${str}"` : str;
}

async function callOpenAIChat(messages, model, max_tokens = 300) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY not set');
  if (typeof fetch !== 'function') throw new Error('global fetch not available in this Node runtime');
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`
    },
    body: JSON.stringify({ model, messages, max_completion_tokens: max_tokens })
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`OpenAI error ${res.status}: ${txt}`);
  }
  const payload = await res.json();
  return String(payload?.choices?.[0]?.message?.content || '').trim();
}

function filterPaired(inputCsv) {
  if (!fs.existsSync(inputCsv)) throw new Error(`Input CSV not found: ${inputCsv}`);
  const content = fs.readFileSync(inputCsv, 'utf8');
  const lines = content.split(/\r?\n/).filter(Boolean);
  const header = lines[0];
  const rows = lines.slice(1).map(parseCsvLine);
  const paired = rows.filter(r => {
    const word_ru = (r[0] || '').trim();
    const word_uz = (r[2] || '').trim();
    return word_ru && word_uz;
  });
  const outCsv = inputCsv.replace(/\.csv$/, '_paired.csv');
  const lines_out = [header, ...paired.map(r => r.map(escCsvCol).join(','))];
  fs.writeFileSync(outCsv, lines_out.join('\n'), 'utf8');
  return outCsv;
}

async function enrichRU(inputCsv, mode = 'gen', concurrency = 3, model = 'gpt-5-mini') {
  const content = fs.readFileSync(inputCsv, 'utf8');
  const lines = content.split(/\r?\n/).filter(Boolean);
  const header = lines[0];
  const rows = lines.slice(1).map(parseCsvLine);
  const toProcess = (mode === 'improve'
    ? rows.map((row, idx) => ({ row, idx }))
    : rows.map((row, idx) => ({ row, idx })).filter(item => !item.row[1] || item.row[1].trim() === ''));
  console.log(`RU: will process ${toProcess.length}/${rows.length} rows (mode=${mode})`);

  let idx = 0;
  async function worker() {
    while (true) {
      const i = idx++;
      if (i >= toProcess.length) break;
      const { row, idx: originalIndex } = toProcess[i];
      const word_ru = row[0];
      if (!word_ru) continue;
      const msg = [
        { role: 'system', content: 'You are a concise Russian dictionary writer. Provide a short one-line definition in Russian for the given word. Return plain text only.' },
        { role: 'user', content: `Give a short definition for the Russian word: ${word_ru}` }
      ];
      try {
        const generated = await callOpenAIChat(msg, model, 300);
        if (generated) rows[originalIndex][1] = generated;
      } catch (e) {
        console.error('RU generation error:', e.message || e);
      }
      if ((i + 1) % 50 === 0) console.log(`  RU processed ${i + 1}/${toProcess.length}`);
    }
  }
  const workers = [];
  for (let w = 0; w < Math.min(concurrency, toProcess.length); w++) workers.push(worker());
  await Promise.all(workers);
  const outCsv = inputCsv.replace(/\.csv$/, '_ru_enriched.csv');
  const lines_out = [header, ...rows.map(r => r.map(escCsvCol).join(','))];
  fs.writeFileSync(outCsv, lines_out.join('\n'), 'utf8');
  return outCsv;
}

async function enrichUZ(inputCsv, mode = 'gen', concurrency = 3, modelUz = null) {
  const model = modelUz || process.env.MODEL_UZ || process.env.MODEL || 'gpt-4o-mini';
  const content = fs.readFileSync(inputCsv, 'utf8');
  const lines = content.split(/\r?\n/).filter(Boolean);
  const header = lines[0];
  const rows = lines.slice(1).map(parseCsvLine);
  const toProcess = (mode === 'improve'
    ? rows.map((row, idx) => ({ row, idx }))
    : rows.map((row, idx) => ({ row, idx })).filter(item => (item.row[3] === '' || item.row[3].trim() === '') && (item.row[2] || item.row[1])));
  console.log(`UZ: will process ${toProcess.length}/${rows.length} rows (mode=${mode})`);

  let idx = 0;
  async function worker() {
    while (true) {
      const i = idx++;
      if (i >= toProcess.length) break;
      const { row, idx: originalIndex } = toProcess[i];
      const [word_ru, def_ru, word_uz] = row;
      let newDef = '';
      if (def_ru && def_ru.trim()) {
        const msg = [
          { role: 'system', content: 'You are a translator. Translate the given Russian text to Uzbek. Return plain text only.' },
          { role: 'user', content: `Translate to Uzbek: ${def_ru}` }
        ];
        try {
          const translated = await callOpenAIChat(msg, model, 300);
          if (translated) newDef = translated;
        } catch (e) { console.error('UZ translate error:', e.message || e); }
      }
      if ((!newDef || newDef.trim() === '') && word_uz && word_uz.trim()) {
        const msg2 = [
          { role: 'system', content: 'You are a concise Uzbek dictionary writer. Provide a short one-line definition in Uzbek for the given word. Return plain text only.' },
          { role: 'user', content: `Give a short Uzbek definition for the word: ${word_uz}` }
        ];
        try {
          const generated = await callOpenAIChat(msg2, model, 300);
          if (generated) newDef = generated;
        } catch (e) { console.error('UZ generation error:', e.message || e); }
      }
      if (newDef) rows[originalIndex][3] = newDef;
      if ((i + 1) % 50 === 0) console.log(`  UZ processed ${i + 1}/${toProcess.length}`);
    }
  }
  const workers = [];
  for (let w = 0; w < Math.min(concurrency, toProcess.length); w++) workers.push(worker());
  await Promise.all(workers);
  const outCsv = inputCsv.replace(/\.csv$/, '_uz_enriched.csv');
  const lines_out = [header, ...rows.map(r => r.map(escCsvCol).join(','))];
  fs.writeFileSync(outCsv, lines_out.join('\n'), 'utf8');
  return outCsv;
}

function mergeEnriched(baseCsv, ruCsv, uzCsv, outCsv) {
  const base = fs.readFileSync(baseCsv, 'utf8').split(/\r?\n/).filter(Boolean);
  const ru = fs.readFileSync(ruCsv, 'utf8').split(/\r?\n/).filter(Boolean);
  const uz = fs.readFileSync(uzCsv, 'utf8').split(/\r?\n/).filter(Boolean);
  const baseRows = base.slice(1).map(parseCsvLine);
  const ruRows = ru.slice(1).map(parseCsvLine);
  const uzRows = uz.slice(1).map(parseCsvLine);
  if (baseRows.length !== ruRows.length || baseRows.length !== uzRows.length) {
    throw new Error('Row counts differ between base/ru/uz CSVs');
  }
  const merged = [];
  for (let i = 0; i < baseRows.length; i++) {
    const baseRow = baseRows[i];
    const ruRow = ruRows[i];
    const uzRow = uzRows[i];
    const word_ru = baseRow[0] || ruRow[0] || '';
    const word_uz = baseRow[2] || uzRow[2] || '';
    const definition_ru = (ruRow[1] && ruRow[1].trim()) ? ruRow[1] : (baseRow[1] || '');
    const definition_uz = (uzRow[3] && uzRow[3].trim()) ? uzRow[3] : (baseRow[3] || '');
    merged.push([word_ru, definition_ru, word_uz, definition_uz]);
  }
  const header = base[0] || 'word_ru,definition_ru,word_uz,definition_uz';
  const out = [header, ...merged.map(r => r.map(escCsvCol).join(','))].join('\n');
  fs.writeFileSync(outCsv, out, 'utf8');
  return outCsv;
}

async function main() {
  const inputCsv = process.env.INPUT_CSV || path.join(__dirname, '..', 'datasetforme', 'python-ruwordnet-master', 'data', 'csvfile', 'rwn_2020_senses.N_0_68392.csv');
  const step = (process.env.STEP || 'all').toLowerCase();
  const mode = (process.env.MODE || 'gen').toLowerCase();
  const concurrency = parseInt(process.env.CONCURRENCY || '4', 10);
  const model = process.env.MODEL || 'gpt-5-mini';
  const modelUz = process.env.MODEL_UZ || process.env.MODEL || 'gpt-4o-mini';

  let pairedCsv = inputCsv;
  if (step === 'filter' || step === 'all') {
    console.log('Step: filter paired rows');
    pairedCsv = filterPaired(inputCsv);
    console.log('Filtered CSV:', pairedCsv);
    if (step === 'filter') return;
  }

  const ruInput = pairedCsv;
  let ruCsv;
  if (step === 'ru' || step === 'all') {
    console.log('Step: RU enrichment');
    ruCsv = await enrichRU(ruInput, mode, concurrency, model);
    console.log('RU enriched CSV:', ruCsv);
    if (step === 'ru') return;
  }

  const uzInput = ruCsv || pairedCsv;
  let uzCsv;
  if (step === 'uz' || step === 'all') {
    console.log('Step: UZ enrichment');
    uzCsv = await enrichUZ(uzInput, mode, concurrency, modelUz);
    console.log('UZ enriched CSV:', uzCsv);
    if (step === 'uz') return;
  }

  if (step === 'merge' || step === 'all') {
    console.log('Step: merge enriched outputs');
    const baseCsv = pairedCsv;
    const ruPath = ruCsv || baseCsv.replace(/\.csv$/, '_ru_enriched.csv');
    const uzPath = uzCsv || baseCsv.replace(/\.csv$/, '_uz_enriched.csv');
    const outCsv = process.env.OUT_CSV || baseCsv.replace(/\.csv$/, '_final_ai_enriched.csv');
    const merged = mergeEnriched(baseCsv, ruPath, uzPath, outCsv);
    console.log('Merged CSV:', merged);
  }
}

main().catch(err => { console.error('Orchestrator error:', err.message || err); process.exit(1); });
