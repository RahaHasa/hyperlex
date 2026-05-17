const fs = require('fs');
const path = require('path');

const INPUT_SENSES = path.join(__dirname, '../data/rwn-2020/senses.N.xml');
const INPUT_COMPOSED = path.join(__dirname, '../data/rwn-2020/composed_of.xml');
const OUTPUT_DIR = path.join(__dirname, '../data/generated');
const OUTPUT_JSON = path.join(OUTPUT_DIR, 'ruwordnet_nouns_106k.json');
const OUTPUT_STATS = path.join(OUTPUT_DIR, 'ruwordnet_nouns_106k.stats.json');

function readUtf8(filePath) {
  return fs.readFileSync(filePath, 'utf8');
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

function normalizeName(text) {
  return String(text || '')
    .trim()
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/\s+/g, ' ');
}

function parseSenses() {
  const xml = readUtf8(INPUT_SENSES);
  const senses = [];
  const byId = new Map();
  const byConcept = new Map();
  const byNormalizedName = new Map();
  const senseRe = /<sense\b([^>]*)\/>/g;
  let match;

  while ((match = senseRe.exec(xml)) !== null) {
    const attrs = parseAttributes(match[1]);
    if (attrs.part_of_speech !== 'N') continue;

    const sense = {
      id: attrs.id,
      synset_id: attrs.synset_id,
      name: String(attrs.name || '').trim(),
      lemma: String(attrs.lemma || '').trim(),
      main_word: String(attrs.main_word || '').trim(),
      concept_id: String(attrs.concept_id || '').trim(),
      meaning: String(attrs.meaning || '').trim(),
      synt_type: String(attrs.synt_type || '').trim(),
      poses: String(attrs.poses || '').trim()
    };

    if (!sense.id || !sense.concept_id || !sense.name) continue;

    senses.push(sense);
    byId.set(sense.id, sense);

    if (!byConcept.has(sense.concept_id)) byConcept.set(sense.concept_id, []);
    byConcept.get(sense.concept_id).push(sense);

    const normalized = normalizeName(sense.name);
    if (!byNormalizedName.has(normalized)) byNormalizedName.set(normalized, []);
    byNormalizedName.get(normalized).push(sense);
  }

  return { senses, byId, byConcept, byNormalizedName };
}

function parseComposedOf() {
  if (!fs.existsSync(INPUT_COMPOSED)) return new Map();

  const xml = readUtf8(INPUT_COMPOSED);
  const result = new Map();
  const blockRe = /<sense\b([^>]*)>([\s\S]*?)<\/sense>/g;
  let block;

  while ((block = blockRe.exec(xml)) !== null) {
    const outerAttrs = parseAttributes(block[1]);
    const body = block[2];
    const outerId = outerAttrs.id;
    if (!outerId) continue;

    const parts = [];
    const innerRe = /<sense\b([^>]*)\/>/g;
    let inner;
    while ((inner = innerRe.exec(body)) !== null) {
      const attrs = parseAttributes(inner[1]);
      if (attrs.id && /-N-/.test(attrs.id)) {
        parts.push({
          id: attrs.id,
          name: String(attrs.name || '').trim(),
          synset_id: String(attrs.synset_id || '').trim()
        });
      }
    }

    if (parts.length > 0) {
      result.set(outerId, parts);
    }
  }

  return result;
}

function chooseCanonicalSense(senses) {
  return [...senses].sort((a, b) => {
    const aSimple = a.synt_type === 'N' ? 0 : 1;
    const bSimple = b.synt_type === 'N' ? 0 : 1;
    if (aSimple !== bSimple) return aSimple - bSimple;

    const aWords = a.name.split(/\s+/).length;
    const bWords = b.name.split(/\s+/).length;
    if (aWords !== bWords) return aWords - bWords;

    if (a.name.length !== b.name.length) return a.name.length - b.name.length;
    return a.name.localeCompare(b.name, 'ru');
  })[0];
}

function buildConcepts(byConcept) {
  const concepts = new Map();

  for (const [conceptId, senses] of byConcept.entries()) {
    const canonical = chooseCanonicalSense(senses);
    concepts.set(conceptId, {
      conceptId,
      senses,
      canonical,
      semantic_key: `concept_${conceptId}`,
      parentConceptId: null,
      level: 1
    });
  }

  return concepts;
}

function buildNameToConcepts(concepts) {
  const map = new Map();

  for (const concept of concepts.values()) {
    const candidates = new Set([
      normalizeName(concept.canonical.name),
      normalizeName(concept.canonical.lemma),
      normalizeName(concept.canonical.main_word)
    ]);

    for (const sense of concept.senses) {
      candidates.add(normalizeName(sense.name));
      candidates.add(normalizeName(sense.lemma));
      candidates.add(normalizeName(sense.main_word));
    }

    for (const candidate of candidates) {
      if (!candidate) continue;
      if (!map.has(candidate)) map.set(candidate, []);
      map.get(candidate).push(concept.conceptId);
    }
  }

  return map;
}

function resolveParentConcepts(concepts, composedOfMap) {
  const nameToConcepts = buildNameToConcepts(concepts);

  function pickParentId(candidateIds, selfConceptId) {
    if (!candidateIds || candidateIds.length === 0) return null;
    const filtered = candidateIds.filter((id) => id !== selfConceptId);
    return filtered.length ? filtered[0] : null;
  }

  for (const concept of concepts.values()) {
    const { canonical } = concept;
    let parentConceptId = null;

    const mainWord = normalizeName(canonical.main_word);
    const canonicalName = normalizeName(canonical.name);

    if (mainWord && mainWord !== canonicalName) {
      parentConceptId = pickParentId(nameToConcepts.get(mainWord), concept.conceptId);
    }

    if (!parentConceptId) {
      for (const sense of concept.senses) {
        const parts = composedOfMap.get(sense.id) || [];
        const nounPart = parts.find((part) => normalizeName(part.name) !== normalizeName(sense.name));
        if (!nounPart) continue;

        parentConceptId = pickParentId(nameToConcepts.get(normalizeName(nounPart.name)), concept.conceptId);
        if (parentConceptId) break;
      }
    }

    concept.parentConceptId = parentConceptId || null;
  }
}

function computeConceptLevels(concepts) {
  const visiting = new Set();
  const memo = new Map();

  function visit(conceptId) {
    if (memo.has(conceptId)) return memo.get(conceptId);
    if (visiting.has(conceptId)) return 1;

    visiting.add(conceptId);
    const concept = concepts.get(conceptId);
    let level = 1;

    if (concept?.parentConceptId && concepts.has(concept.parentConceptId)) {
      level = Math.min(5, visit(concept.parentConceptId) + 1);
    }

    visiting.delete(conceptId);
    memo.set(conceptId, level);
    concept.level = level;
    return level;
  }

  for (const conceptId of concepts.keys()) {
    visit(conceptId);
  }
}

function buildSiblingMap(concepts) {
  const byParent = new Map();

  for (const concept of concepts.values()) {
    const parentKey = concept.parentConceptId || '__root__';
    if (!byParent.has(parentKey)) byParent.set(parentKey, []);
    byParent.get(parentKey).push(concept);
  }

  const siblingMap = new Map();

  for (const siblings of byParent.values()) {
    siblings.sort((a, b) => a.canonical.name.localeCompare(b.canonical.name, 'ru'));
    for (const concept of siblings) {
      siblingMap.set(
        concept.conceptId,
        siblings
          .filter((item) => item.conceptId !== concept.conceptId)
          .slice(0, 5)
          .map((item) => item.semantic_key)
      );
    }
  }

  return siblingMap;
}

function buildDataset(concepts) {
  const output = {};
  const siblingMap = buildSiblingMap(concepts);

  output.noun_lexicon = {
    ru: 'Словарь существительных',
    uz: 'Otlar lug‘ati',
    description_ru: 'Крупный иерархический словарь существительных, собранный из RuWordNet.',
    description_uz: 'RuWordNet asosida yig‘ilgan yirik otlar iyerarxik lug‘ati.',
    category: 'noun_lexicon',
    related: [],
    level: 1
  };

  for (const concept of concepts.values()) {
    const canonical = concept.canonical;
    const parent = concept.parentConceptId
      ? concepts.get(concept.parentConceptId)?.semantic_key || 'noun_lexicon'
      : 'noun_lexicon';

    const conceptRelated = new Set();
    if (parent !== 'noun_lexicon') conceptRelated.add(parent);
    for (const sibling of siblingMap.get(concept.conceptId) || []) conceptRelated.add(sibling);
    for (const sense of concept.senses.slice(0, 3)) conceptRelated.add(`sense_${sense.id}`);

    output[concept.semantic_key] = {
      ru: canonical.name,
      uz: transliterateRuToUzLatin(canonical.name),
      parent,
      description_ru: `Семантическая группа существительных вокруг понятия «${canonical.name}» из RuWordNet.`,
      description_uz: `RuWordNetdagi «${transliterateRuToUzLatin(canonical.name)}» tushunchasi atrofidagi otlar guruhi.`,
      category: 'ruwordnet_noun_concept',
      related: [...conceptRelated].slice(0, 8),
      level: concept.level
    };

    const senseLevel = Math.min(6, concept.level + 1);
    for (const sense of concept.senses) {
      const senseKey = `sense_${sense.id}`;
      const related = new Set([concept.semantic_key]);

      for (const siblingSense of concept.senses) {
        if (siblingSense.id !== sense.id) {
          related.add(`sense_${siblingSense.id}`);
        }
        if (related.size >= 8) break;
      }

      output[senseKey] = {
        ru: sense.name,
        uz: transliterateRuToUzLatin(sense.name),
        parent: concept.semantic_key,
        description_ru: `Существительное RuWordNet: «${sense.name}». Концепт: «${canonical.name}». Значение: ${sense.meaning || '1'}.`,
        description_uz: `RuWordNet oti: «${transliterateRuToUzLatin(sense.name)}». Konsept: «${transliterateRuToUzLatin(canonical.name)}». Ma’nosi: ${sense.meaning || '1'}.`,
        category: 'ruwordnet_noun_sense',
        related: [...related].slice(0, 8),
        level: senseLevel
      };
    }
  }

  output.noun_lexicon.related = Object.keys(output)
    .filter((key) => key.startsWith('concept_'))
    .slice(0, 8);

  return output;
}

function computeStats(dataset) {
  const stats = {
    totalNodes: 0,
    conceptNodes: 0,
    senseNodes: 0,
    levelCounts: {}
  };

  for (const [key, node] of Object.entries(dataset)) {
    stats.totalNodes += 1;
    if (key.startsWith('concept_')) stats.conceptNodes += 1;
    if (key.startsWith('sense_')) stats.senseNodes += 1;
    stats.levelCounts[node.level] = (stats.levelCounts[node.level] || 0) + 1;
  }

  return stats;
}

function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const { byConcept } = parseSenses();
  const composedOfMap = parseComposedOf();
  const concepts = buildConcepts(byConcept);

  resolveParentConcepts(concepts, composedOfMap);
  computeConceptLevels(concepts);

  const dataset = buildDataset(concepts);
  const stats = computeStats(dataset);

  fs.writeFileSync(OUTPUT_JSON, `${JSON.stringify(dataset, null, 2)}\n`, 'utf8');
  fs.writeFileSync(OUTPUT_STATS, `${JSON.stringify(stats, null, 2)}\n`, 'utf8');

  console.log('Generated large noun hierarchy');
  console.log(`Output: ${OUTPUT_JSON}`);
  console.log(`Stats: ${OUTPUT_STATS}`);
  console.log(stats);
}

main();
