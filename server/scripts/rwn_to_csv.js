const fs = require('fs');
const path = require('path');

// Config
const DATA_DIR = path.join(__dirname, '..', 'datasetforme', 'python-ruwordnet-master', 'data', 'rwn-2020');
const OUT_DIR = path.join(__dirname, '..', 'datasetforme', 'python-ruwordnet-master', 'data');
const OUT_FILE = path.join(OUT_DIR, 'csvfile'); // user asked for this folder; we'll write csv inside
const OUT_CSV = path.join(OUT_FILE, 'rwn_2020_ru_uz.csv');

const BATCH = parseInt(process.env.BATCH || '250', 10);
const CONCURRENCY = parseInt(process.env.CONCURRENCY || '15', 10);

function readFileSyncSafe(p) {
  try {
    return fs.readFileSync(p, 'utf8');
  } catch (e) {
    console.error('Read error', p, e.message);
    return '';
  }
}

function parseSynsetsXml(content) {
  // very simple XML parsing by regex for <synset ...>...</synset>
  const results = [];
  const synsetRe = /<synset\b([^>]*)>([\s\S]*?)<\/synset>/gi;
  let m;
  while ((m = synsetRe.exec(content)) !== null) {
    const attrs = m[1];
    const body = m[2];
    // extract definition attr
    const defMatch = /definition="([^"]*)"/i.exec(attrs);
    const definition = defMatch ? defMatch[1].trim() : '';
    // extract sense texts
    const senseRe = /<sense[^>]*>([\s\S]*?)<\/sense>/gi;
    let s;
    const senses = [];
    while ((s = senseRe.exec(body)) !== null) {
      const text = s[1].trim();
      if (text) senses.push(text);
    }
    for (const senseText of senses) {
      results.push({ word_ru: senseText, definition_ru: definition });
    }
  }
  return results;
}

function parseSensesXml(content) {
  // fallback simple parser for small content strings (keeps compatibility)
  const results = [];
  const senseRe = /<sense\b([^>]*)\/?/gi;
  let m;
  while ((m = senseRe.exec(content)) !== null) {
    const attrs = m[1] || '';
    const nameMatch = /name=\"([^\"]*)\"/i.exec(attrs);
    const lemmaMatch = /lemma=\"([^\"]*)\"/i.exec(attrs);
    const posMatch = /part_of_speech=\"([^\"]*)\"/i.exec(attrs);
    const name = (nameMatch && nameMatch[1]) ? nameMatch[1].trim() : (lemmaMatch && lemmaMatch[1]) ? lemmaMatch[1].trim() : '';
    const pos = posMatch && posMatch[1] ? posMatch[1].trim() : '';
    if (!name) continue;
    if (pos && !/^[NA]$/.test(pos)) continue;
    results.push({ word_ru: name, definition_ru: '' });
  }
  return results;
}

// Streaming, faster parser for large senses.*.xml files. Extracts `name`/`lemma` and `part_of_speech` reliably.
async function parseSensesXmlFromFile(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];
    const stream = fs.createReadStream(filePath, { encoding: 'utf8' });
    let buf = '';

    function processBuffer() {
      let idx = buf.indexOf('<sense');
      while (idx !== -1) {
        const start = idx;
        const endIdx = buf.indexOf('>', start);
        if (endIdx === -1) break; // need more data
        const tag = buf.substring(start, endIdx + 1);
        buf = buf.substring(endIdx + 1);

        const attrRe = /(name|lemma|part_of_speech)\s*=\s*['\"]([^'\"]*)['\"]/gi;
        let a;
        let name = '';
        let lemma = '';
        let pos = '';
        while ((a = attrRe.exec(tag)) !== null) {
          const k = a[1].toLowerCase();
          const v = a[2] ? a[2].trim() : '';
          if (k === 'name' && v) name = v;
          if (k === 'lemma' && v) lemma = v;
          if (k === 'part_of_speech' && v) pos = v;
        }
        const useName = name || lemma || '';
        if (!useName) {
          idx = buf.indexOf('<sense');
          continue;
        }
        if (pos && !/^[NA]$/.test(pos)) {
          idx = buf.indexOf('<sense');
          continue;
        }
        results.push({ word_ru: useName, definition_ru: '' });
        idx = buf.indexOf('<sense');
      }
      if (buf.length > 1e6) buf = buf.slice(-1e6);
    }

    stream.on('data', chunk => {
      buf += chunk;
      processBuffer();
    });
    stream.on('end', () => {
      processBuffer();
      resolve(results);
    });
    stream.on('error', err => reject(err));
  });
}

async function translateGoogle(text, sl, tl) {
  try {
    const q = encodeURIComponent(String(text || ''));
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${tl}&dt=t&q=${q}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const payload = await res.json();
    const segments = Array.isArray(payload?.[0]) ? payload[0] : [];
    const translated = segments.map(p => p?.[0] || '').join('').trim();
    return translated || null;
  } catch (e) {
    return null;
  }
}

async function callOpenAIChat(messages, model, temperature = 0.1) {
  try {
    const key = process.env.OPENAI_API_KEY;
    if (!key) return null;
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`
      },
      body: JSON.stringify({ model, messages, temperature })
    });
    if (!res.ok) return null;
    const payload = await res.json();
    return String(payload?.choices?.[0]?.message?.content || '').trim();
  } catch (e) {
    return null;
  }
}

async function translateOpenAIText(text, sourceLang, targetLang, model) {
  const system = `You are a professional translator. Translate text from ${sourceLang} to ${targetLang}. Return plain text only.`;
  const msg = [
    { role: 'system', content: system },
    { role: 'user', content: String(text || '') }
  ];
  return callOpenAIChat(msg, model, 0.1);
}

async function translateOpenAIWord(word, sourceLang, targetLang, model) {
  const system = `You are a translator for single-word translations between ${sourceLang} and ${targetLang}. RULES: return exactly one single word (no spaces), translate only nouns/adjectives; if not applicable or unsure, reply SKIP. Return plain text only.`;
  const msg = [
    { role: 'system', content: system },
    { role: 'user', content: `Translate this ${sourceLang} word to ${targetLang}: ${word}` }
  ];
  const out = await callOpenAIChat(msg, model, 0.05);
  if (!out) return null;
  const clean = out.split('\n')[0].trim();
  if (clean.toUpperCase() === 'SKIP') return null;
  if (!isSingleWord(clean)) return null;
  return clean;
}

async function generateDefinitionOpenAI(word, language, model) {
  const system = `You are a concise dictionary writer. Provide a short one-sentence definition in ${language} for the single word provided. If the word is not a noun or adjective or you are unsure, reply SKIP. Return plain text only.`;
  const msg = [
    { role: 'system', content: system },
    { role: 'user', content: `Give a short definition for the word: ${word}` }
  ];
  const out = await callOpenAIChat(msg, model, 0.2);
  if (!out) return '';
  const clean = out.split('\n')[0].trim();
  if (clean.toUpperCase() === 'SKIP') return '';
  return clean;
}

function isSingleWord(value) {
  return typeof value === 'string' && value.trim() !== '' && !/\s+/.test(value.trim());
}

function sanitizeWord(w) {
  if (!w) return '';
  return String(w).trim();
}

function toCSVLine(row) {
  // CSV with headers: word_ru,definition_ru,word_uz,definition_uz
  function esc(s) {
    if (s === null || s === undefined) return '""';
    const str = String(s).replace(/"/g, '""');
    return '"' + str + '"';
  }
  return [esc(row.word_ru), esc(row.definition_ru), esc(row.word_uz), esc(row.definition_uz)].join(',');
}

async function processAll() {
  // ensure out dir exists
  fs.mkdirSync(OUT_FILE, { recursive: true });

  const inputFilesRaw = String(process.env.INPUT_FILES || process.env.INPUT_FILE || 'synsets.N.xml,synsets.A.xml');
  const files = inputFilesRaw
    .split(',')
    .map(fileName => fileName.trim())
    .filter(Boolean);

  console.log('Reading synsets files from', DATA_DIR);
  console.log('Input files:', files.join(', '));
  let entries = [];
  for (const f of files) {
    const p = path.join(DATA_DIR, f);
    let parsed = [];
    if (/\bsense/i.test(f) || /senses\./i.test(f)) {
      // use streaming parser for large senses files
      parsed = await parseSensesXmlFromFile(p);
    } else {
      const content = readFileSyncSafe(p);
      parsed = parseSynsetsXml(content);
    }
    entries = entries.concat(parsed);
  }

  // deduplicate by word_ru (keep first)
  const seen = new Set();
  const uniq = [];
  for (const e of entries) {
    const word = sanitizeWord(e.word_ru);
    if (!word) continue;
    const key = word.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    uniq.push({ word_ru: word, definition_ru: e.definition_ru || '' });
  }

  // support OFFSET/LIMIT so multiple terminals can process disjoint slices
  const OFFSET = parseInt(process.env.OFFSET || '0', 10) || 0;
  const LIMIT = parseInt(process.env.LIMIT || String(uniq.length), 10) || uniq.length;
  const slice = uniq.slice(OFFSET, Math.min(OFFSET + LIMIT, uniq.length));

  // output file name per slice to avoid conflicts when running many terminals
  const safeFilesName = files.map(fileName => fileName.replace(/\.xml$/i, '')).join('_');
  const outCsvName = `rwn_2020_${safeFilesName}_${OFFSET}_${slice.length}.csv`;
  const OUT_CSV_FINAL = path.join(OUT_FILE, outCsvName);

  console.log('Total unique entries (nouns+adjectives):', uniq.length);

  // Process translations with concurrency pool over the selected slice
  const results = [];
  let index = 0;
  const useOpenAI = String(process.env.USE_OPENAI || 'false').toLowerCase() === 'true';
  const model = String(process.env.MODEL || process.env.OPENAI_MODEL || 'gpt-5-mini');

  async function worker() {
    while (true) {
      const i = index++;
      if (i >= slice.length) break;
      const item = slice[i];
      try {
        let wordUz = '';
        let defRu = item.definition_ru || '';
        let defUz = '';

        // generate or translate the Uzbek word
        if (useOpenAI) {
          const w = await translateOpenAIWord(item.word_ru, 'Russian', 'Uzbek', model);
          if (w) wordUz = w;
        } else {
          const transWord = await translateGoogle(item.word_ru, 'ru', 'uz');
          wordUz = transWord ? transWord.split(/[,;\/\s]+/)[0] : '';
          if (!isSingleWord(wordUz)) wordUz = '';
        }

        // If definition in Russian missing and OpenAI is enabled, generate it
        if ((!defRu || defRu.trim() === '') && useOpenAI) {
          defRu = await generateDefinitionOpenAI(item.word_ru, 'Russian', model);
        }

        // Produce Uzbek definition: prefer OpenAI translation when available, otherwise Google
        if (useOpenAI) {
          if (defRu && defRu.length > 0) {
            const d = await translateOpenAIText(defRu, 'Russian', 'Uzbek', model);
            if (d) defUz = d;
          } else {
            // as fallback, attempt to ask OpenAI to produce Uzbek definition directly
            const genUz = await callOpenAIChat([
              { role: 'system', content: `You are a concise dictionary writer. Provide a short one-sentence definition in Uzbek for the given Russian word. If unsure, reply SKIP. Return plain text only.` },
              { role: 'user', content: `Give a short Uzbek definition for the Russian word: ${item.word_ru}` }
            ], model, 0.2);
            if (genUz && genUz.toUpperCase() !== 'SKIP') defUz = genUz.split('\n')[0].trim();
          }
        } else {
          if (defRu && defRu.length > 0) {
            const td = await translateGoogle(defRu, 'ru', 'uz');
            defUz = td || '';
          }
        }

        results.push({ word_ru: item.word_ru, definition_ru: defRu || '', word_uz: wordUz, definition_uz: defUz });
      } catch (e) {
        console.error('Error processing', item.word_ru, e.message);
        results.push({ word_ru: item.word_ru, definition_ru: item.definition_ru || '', word_uz: '', definition_uz: '' });
      }
      if ((i + 1) % 100 === 0) console.log('Processed', i + 1, '/', uniq.length);
    }
  }

  const workers = [];
  const conc = Math.max(1, Math.min(CONCURRENCY, 20));
  for (let w = 0; w < conc; w++) workers.push(worker());
  await Promise.all(workers);

  // write CSV
  const header = 'word_ru,definition_ru,word_uz,definition_uz';
  const lines = [header].concat(results.map(toCSVLine));
  fs.writeFileSync(OUT_CSV_FINAL, lines.join('\n'), 'utf8');
  console.log('CSV written to', OUT_CSV_FINAL, 'rows:', results.length);
}

processAll().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
