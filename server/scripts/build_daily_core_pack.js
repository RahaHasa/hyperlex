const fs = require('fs');
const path = require('path');
const {
  GENERATED_DIR,
  DAILY_CATEGORIES,
  MANUAL_CATEGORY_WORDS,
  normalizeRu,
  getUzTranslation,
  buildCuratedTranslationMap,
  slugifyRu
} = require('./daily_core_shared');

const COMMON_JSON = path.join(GENERATED_DIR, 'common_noun_index_97k.json');
const OUTPUT_JSON = path.join(GENERATED_DIR, 'daily_core_pack_52k.json');
const OUTPUT_STATS = path.join(GENERATED_DIR, 'daily_core_pack_52k.stats.json');
const TARGET_AUTO_WORDS = 52000;
const LETTERS = ['а', 'б', 'в', 'г', 'д', 'е', 'ж', 'з', 'и', 'й', 'к', 'л', 'м', 'н', 'о', 'п', 'р', 'с', 'т', 'у', 'ф', 'х', 'ц', 'ч', 'ш', 'щ', 'э', 'ю', 'я'];

function isCleanSimpleEntry(ru) {
  const value = String(ru || '').trim();
  if (!value) return false;
  if (/\d/.test(value)) return false;
  if (!/^[А-Яа-яЁё -]+$/.test(value)) return false;
  if (value.length < 2 || value.length > 32) return false;
  if (/^[А-ЯЁ\s-]+$/.test(value) && value.length <= 5) return false;
  return true;
}

function isBetterCandidate(ru) {
  const value = String(ru || '').trim();
  if (!isCleanSimpleEntry(value)) return false;
  if (value.split(/\s+/).length > 2) return false;
  if (/[-]{2,}/.test(value)) return false;
  return true;
}

function detectCategory(ru, manualLookup) {
  const normalized = normalizeRu(ru);
  return manualLookup.get(normalized) || 'general';
}

function getBucketKey(ru) {
  const first = normalizeRu(ru)[0] || 'other';
  return LETTERS.includes(first) ? first : 'other';
}

function scoreCandidate(node, manualLookup, curatedMap) {
  const ru = String(node.ru || '').trim();
  const normalized = normalizeRu(ru);
  const wordCount = ru.split(/\s+/).length;
  let score = 0;

  if (manualLookup.has(normalized)) score += 1000;
  if (curatedMap.has(normalized)) score += 350;
  if (!/\s/.test(ru)) score += 240;
  if (wordCount === 2) score += 60;
  if (node.category === 'common_noun_entry') score += 130;
  if (node.category === 'common_noun_wordform') score += 80;
  if (node.category === 'common_noun_lemma') score += 50;
  if (ru.length <= 6) score += 90;
  else if (ru.length <= 10) score += 60;
  else if (ru.length <= 14) score += 35;
  else score += 10;
  if (/^[А-ЯЁ][а-яё]+(?: [А-ЯЁ][а-яё]+)?$/.test(ru)) score += 40;
  if (/-/.test(ru)) score -= 20;
  if (/^[А-ЯЁ\s-]+$/.test(ru)) score -= 200;
  if (/[ЪъЬь]/.test(ru)) score -= 10;

  return score;
}

function buildManualLookup() {
  const map = new Map();
  for (const [category, words] of Object.entries(MANUAL_CATEGORY_WORDS)) {
    for (const word of words) {
      map.set(normalizeRu(word), category);
    }
  }
  return map;
}

function buildSourceMap(commonData) {
  const sourceByRu = new Map();
  for (const [key, value] of Object.entries(commonData)) {
    if (!value || !value.ru) continue;
    const normalized = normalizeRu(value.ru);
    const prev = sourceByRu.get(normalized);
    if (!prev || scoreCandidate(value, new Map(), new Map()) > scoreCandidate(prev, new Map(), new Map())) {
      sourceByRu.set(normalized, { semantic_key: key, ...value });
    }
  }
  return sourceByRu;
}

function addCategoryNodes(output) {
  output.daily_core_pack = {
    ru: 'Базовый словарь простых слов',
    uz: 'Oddiy so‘zlarning asosiy lug‘ati',
    description_ru: 'Крупный слой простых и повседневных существительных для чистого поиска и понятной навигации.',
    description_uz: 'Toza qidiruv va tushunarli navigatsiya uchun oddiy hamda kundalik otlarning katta qatlami.',
    category: 'daily_core_pack',
    related: [],
    level: 1
  };

  for (const [categoryKey, meta] of Object.entries(DAILY_CATEGORIES)) {
    const semanticKey = `daily_core_category_${categoryKey}`;
    output[semanticKey] = {
      ru: meta.ru,
      uz: meta.uz,
      parent: 'daily_core_pack',
      description_ru: meta.description_ru,
      description_uz: meta.description_uz,
      category: 'daily_core_category',
      related: ['daily_core_pack'],
      level: 2
    };
  }

  for (const letter of [...LETTERS, 'other']) {
    const semanticKey = `daily_core_bucket_${letter}`;
    const labelRu = letter === 'other' ? 'Другие простые слова' : `Слова на «${letter.toUpperCase()}»`;
    const labelUz = letter === 'other' ? 'Boshqa oddiy so‘zlar' : `«${letter.toUpperCase()}» harfidagi so‘zlar`;
    output[semanticKey] = {
      ru: labelRu,
      uz: labelUz,
      parent: 'daily_core_category_general',
      description_ru: `Простые существительные, начинающиеся на букву ${letter === 'other' ? 'вне основного алфавитного списка' : `«${letter.toUpperCase()}»`}.`,
      description_uz: `${letter === 'other' ? 'Asosiy alifbo ro‘yxatidan tashqari' : `«${letter.toUpperCase()}»`} bilan boshlanadigan oddiy otlar.`,
      category: 'daily_core_bucket',
      related: ['daily_core_category_general'],
      level: 3
    };
  }
}

function buildManualWords(output, sourceByRu, manualLookup, curatedMap) {
  const created = new Set();

  for (const [categoryKey, words] of Object.entries(MANUAL_CATEGORY_WORDS)) {
    for (const word of words) {
      const normalized = normalizeRu(word);
      if (created.has(normalized)) continue;

      const sourceNode = sourceByRu.get(normalized);
      const semanticKey = `daily_core_word_${slugifyRu(word)}`;
      const parent = `daily_core_category_${categoryKey}`;
      const uz = getUzTranslation(word, curatedMap);

      output[semanticKey] = {
        ru: word[0].toUpperCase() + word.slice(1),
        uz,
        parent,
        description_ru: `Базовое повседневное существительное «${word}».`,
        description_uz: `Kundalik ishlatiladigan asosiy ot: «${uz}».`,
        category: 'daily_core_word',
        related: [
          parent,
          ...(sourceNode ? [sourceNode.semantic_key] : [])
        ].filter(Boolean),
        level: 3
      };

      created.add(normalized);
    }
  }

  return created;
}

function buildAutoWords(output, commonData, createdWords, manualLookup, curatedMap) {
  const candidates = [];

  for (const [key, value] of Object.entries(commonData)) {
    if (!value || !value.ru) continue;
    if (!key.startsWith('entry_') && !key.startsWith('lemma_')) continue;
    if (!isBetterCandidate(value.ru)) continue;

    const normalized = normalizeRu(value.ru);
    if (createdWords.has(normalized)) continue;

    candidates.push({
      semantic_key: key,
      ...value,
      _normalized: normalized,
      _score: scoreCandidate(value, manualLookup, curatedMap)
    });
  }

  candidates.sort((a, b) => {
    if (b._score !== a._score) return b._score - a._score;
    return a.ru.localeCompare(b.ru, 'ru');
  });

  let count = 0;
  for (const candidate of candidates) {
    if (count >= TARGET_AUTO_WORDS) break;
    if (createdWords.has(candidate._normalized)) continue;

    const categoryKey = detectCategory(candidate.ru, manualLookup);
    const parent = categoryKey === 'general'
      ? `daily_core_bucket_${getBucketKey(candidate.ru)}`
      : `daily_core_category_${categoryKey}`;
    const semanticKey = `daily_core_auto_${slugifyRu(candidate.ru)}`;
    const uz = getUzTranslation(candidate.ru, curatedMap);
    const level = categoryKey === 'general' ? 4 : 3;

    output[semanticKey] = {
      ru: candidate.ru,
      uz,
      parent,
      description_ru: `Простое существительное для повседневного поиска: «${candidate.ru}».`,
      description_uz: `Kundalik qidiruv uchun oddiy ot: «${uz}».`,
      category: 'daily_core_word',
      related: [parent, candidate.semantic_key].filter(Boolean),
      level
    };

    createdWords.add(candidate._normalized);
    count += 1;
  }

  return count;
}

function main() {
  const curatedMap = buildCuratedTranslationMap();
  const manualLookup = buildManualLookup();
  const commonData = JSON.parse(fs.readFileSync(COMMON_JSON, 'utf8'));
  const sourceByRu = buildSourceMap(commonData);
  const output = {};

  addCategoryNodes(output);
  const createdWords = buildManualWords(output, sourceByRu, manualLookup, curatedMap);
  const autoWordCount = buildAutoWords(output, commonData, createdWords, manualLookup, curatedMap);

  output.daily_core_pack.related = Object.keys(output)
    .filter((key) => key.startsWith('daily_core_category_'))
    .slice(0, 10);

  const stats = {
    totalNodes: Object.keys(output).length,
    manualWordCount: createdWords.size - autoWordCount,
    autoWordCount,
    uniqueWordCount: createdWords.size,
    categoryCount: Object.keys(DAILY_CATEGORIES).length,
    bucketCount: LETTERS.length + 1
  };

  fs.mkdirSync(GENERATED_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT_JSON, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  fs.writeFileSync(OUTPUT_STATS, `${JSON.stringify(stats, null, 2)}\n`, 'utf8');

  console.log(`Generated ${OUTPUT_JSON}`);
  console.log(stats);
}

main();
