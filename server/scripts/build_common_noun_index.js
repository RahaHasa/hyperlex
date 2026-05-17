const fs = require('fs');
const path = require('path');

const BASE_JSON = path.join(__dirname, '../data/generated/ruwordnet_nouns_106k.json');
const SENSES_XML = path.join(__dirname, '../data/rwn-2020/senses.N.xml');
const OUTPUT_DIR = path.join(__dirname, '../data/generated');
const OUTPUT_JSON = path.join(OUTPUT_DIR, 'common_noun_index_97k.json');
const OUTPUT_STATS = path.join(OUTPUT_DIR, 'common_noun_index_97k.stats.json');

function transliterateRuToUzLatin(text) {
  const map = {
    А: 'A', а: 'a', Б: 'B', б: 'b', В: 'V', в: 'v', Г: 'G', г: 'g',
    Д: 'D', д: 'd', Е: 'E', е: 'e', Ё: 'Yo', ё: 'yo', Ж: 'J', ж: 'j',
    З: 'Z', з: 'z', И: 'I', и: 'i', Й: 'Y', й: 'y', К: 'K', к: 'k',
    Л: 'L', л: 'l', М: 'M', м: 'm', Н: 'N', н: 'n', О: 'O', о: 'o',
    П: 'P', п: 'p', Р: 'R', р: 'r', С: 'S', с: 's', Т: 'T', т: 't',
    У: 'U', у: 'u', Ф: 'F', ф: 'f', Х: 'X', х: 'x', Ц: 'Ts', ц: 'ts',
    Ч: 'Ch', ч: 'ch', Ш: 'Sh', ш: 'sh', Щ: 'Shch', щ: 'shch',
    Ъ: '', ъ: '', Ы: 'I', ы: 'i', Ь: '', ь: '', Э: 'E', э: 'e',
    Ю: 'Yu', ю: 'yu', Я: 'Ya', я: 'ya'
  };

  return String(text || '')
    .split('')
    .map((char) => map[char] !== undefined ? map[char] : char)
    .join('');
}

function prettyRu(text) {
  const raw = String(text || '').trim().toLowerCase();
  return raw.replace(/(^|\s|-)([а-яё])/g, (_, start, char) => `${start}${char.toUpperCase()}`);
}

function prettyUz(text) {
  const raw = transliterateRuToUzLatin(text).trim().toLowerCase();
  return raw.replace(/(^|\s|-)([a-z])/g, (_, start, char) => `${start}${char.toUpperCase()}`);
}

function parseAttributes(rawAttrs) {
  const attrs = {};
  const attrRe = /([a-zA-Z_]+)="([^"]*)"/g;
  let match;

  while ((match = attrRe.exec(rawAttrs)) !== null) {
    attrs[match[1]] = match[2];
  }

  return attrs;
}

function parseLemmaMap() {
  const xml = fs.readFileSync(SENSES_XML, 'utf8');
  const byLemma = new Map();
  const names = new Set();
  const senseRe = /<sense\b([^>]*)\/>/g;
  let match;

  while ((match = senseRe.exec(xml)) !== null) {
    const attrs = parseAttributes(match[1]);
    if (attrs.part_of_speech !== 'N') continue;

    const senseId = String(attrs.id || '').trim();
    const conceptId = String(attrs.concept_id || '').trim();
    const name = String(attrs.name || '').trim();
    const lemma = String(attrs.lemma || '').trim();

    if (name) names.add(name);
    if (!lemma || !senseId || !conceptId) continue;
    if (names.has(lemma)) continue;

    if (!byLemma.has(lemma)) {
      byLemma.set(lemma, { senseId, conceptId, name });
    }
  }

  return byLemma;
}

function buildIndex() {
  const base = JSON.parse(fs.readFileSync(BASE_JSON, 'utf8'));
  const lemmaMap = parseLemmaMap();
  const output = {};

  output.common_noun_index = {
    ru: 'Часто используемые существительные',
    uz: 'Ko‘p ishlatiladigan otlar',
    description_ru: 'Дополнительный индекс частотных и удобных для поиска существительных.',
    description_uz: 'Qidiruv uchun qulay va tez-tez ishlatiladigan otlarning qo‘shimcha indeksi.',
    category: 'common_noun_index',
    related: [],
    level: 1
  };

  let conceptEntries = 0;
  let senseEntries = 0;
  let phraseEntries = 0;
  let lemmaEntries = 0;

  for (const [key, node] of Object.entries(base)) {
    if (!key.startsWith('concept_')) continue;

    const isSingle = !/\s/.test(node.ru);
    const entryKey = `entry_${key}`;
    output[entryKey] = {
      ru: prettyRu(node.ru),
      uz: prettyUz(node.ru),
      parent: key,
      description_ru: `Часто используемая поисковая форма существительного «${prettyRu(node.ru)}».`,
      description_uz: `«${prettyUz(node.ru)}» otining qidiruv uchun qulay shakli.`,
      category: isSingle ? 'common_noun_entry' : 'common_noun_phrase',
      related: [key, ...(node.related || []).slice(0, 4)],
      level: Math.min(6, (node.level || 1) + 1)
    };

    if (isSingle) conceptEntries += 1;
    else phraseEntries += 1;
  }

  for (const [key, node] of Object.entries(base)) {
    if (!key.startsWith('sense_')) continue;
    if (/\s/.test(node.ru)) continue;

    const entryKey = `entry_${key}`;
    output[entryKey] = {
      ru: prettyRu(node.ru),
      uz: prettyUz(node.ru),
      parent: key,
      description_ru: `Однословная частотная форма существительного «${prettyRu(node.ru)}».`,
      description_uz: `«${prettyUz(node.ru)}» otining bir so‘zli tez-tez ishlatiladigan shakli.`,
      category: 'common_noun_wordform',
      related: [key, ...(node.related || []).slice(0, 4)],
      level: Math.min(6, (node.level || 1) + 1)
    };

    senseEntries += 1;
  }

  for (const [lemma, info] of lemmaMap.entries()) {
    const parentConceptKey = `concept_${info.conceptId}`;
    const parent = base[parentConceptKey] ? parentConceptKey : `sense_${info.senseId}`;
    const parentNode = base[parent] || { level: 2, related: [] };
    const entryKey = `lemma_${info.senseId}`;

    output[entryKey] = {
      ru: prettyRu(lemma),
      uz: prettyUz(lemma),
      parent,
      description_ru: `Лемматизированная форма существительного «${prettyRu(lemma)}».`,
      description_uz: `«${prettyUz(lemma)}» otining lemmalashgan shakli.`,
      category: 'common_noun_lemma',
      related: [parent, ...(parentNode.related || []).slice(0, 4)],
      level: Math.min(6, (parentNode.level || 1) + 1)
    };

    lemmaEntries += 1;
  }

  output.common_noun_index.related = Object.keys(output)
    .filter((key) => key.startsWith('entry_concept_') || key.startsWith('lemma_'))
    .slice(0, 8);

  const stats = {
    totalNodes: Object.keys(output).length,
    conceptEntries,
    senseEntries,
    phraseEntries,
    lemmaEntries
  };

  return { output, stats };
}

function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const { output, stats } = buildIndex();

  fs.writeFileSync(OUTPUT_JSON, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  fs.writeFileSync(OUTPUT_STATS, `${JSON.stringify(stats, null, 2)}\n`, 'utf8');

  console.log('Generated common noun index');
  console.log(`Output: ${OUTPUT_JSON}`);
  console.log(`Stats: ${OUTPUT_STATS}`);
  console.log(stats);
}

main();
