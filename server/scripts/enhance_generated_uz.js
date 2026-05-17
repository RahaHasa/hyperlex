const fs = require('fs');
const path = require('path');
const {
  GENERATED_DIR,
  normalizeRu,
  getUzTranslation,
  buildCuratedTranslationMap
} = require('./daily_core_shared');

const FILES = [
  path.join(GENERATED_DIR, 'common_noun_index_97k.json'),
  path.join(GENERATED_DIR, 'ruwordnet_nouns_106k.json')
];

function rewriteDescriptionUz(node, uz) {
  if (node.category === 'common_noun_entry') {
    return `«${uz}» otining qidiruv uchun qulay shakli.`;
  }

  if (node.category === 'common_noun_wordform') {
    return `«${uz}» otining bir so‘zli tez-tez ishlatiladigan shakli.`;
  }

  if (node.category === 'common_noun_lemma') {
    return `«${uz}» otining lemmalashgan shakli.`;
  }

  if (node.category === 'common_noun_phrase') {
    return `«${uz}» ot birikmasining qidiruv uchun qulay shakli.`;
  }

  return node.description_uz || '';
}

function shouldImproveNode(key, node) {
  if (!node || !node.ru) return false;
  if (key === 'common_noun_index' || key === 'noun_lexicon') return false;
  return true;
}

function improveFile(filePath, curatedMap) {
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  let updated = 0;
  let matchedCurated = 0;

  for (const [key, node] of Object.entries(data)) {
    if (!shouldImproveNode(key, node)) continue;

    const normalized = normalizeRu(node.ru);
    const hasCurated = curatedMap.has(normalized);
    const nextUz = getUzTranslation(node.ru, curatedMap);

    if (nextUz && nextUz !== node.uz) {
      node.uz = nextUz;
      updated += 1;
      if (hasCurated) matchedCurated += 1;
    }

    const nextDescription = rewriteDescriptionUz(node, nextUz);
    if (nextDescription && nextDescription !== node.description_uz) {
      node.description_uz = nextDescription;
    }
  }

  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  return { filePath, updated, matchedCurated };
}

function main() {
  const curatedMap = buildCuratedTranslationMap();
  const results = FILES
    .filter((filePath) => fs.existsSync(filePath))
    .map((filePath) => improveFile(filePath, curatedMap));

  const stats = {
    curatedMapSize: curatedMap.size,
    files: results,
    updatedTotal: results.reduce((sum, item) => sum + item.updated, 0),
    matchedCuratedTotal: results.reduce((sum, item) => sum + item.matchedCurated, 0)
  };

  const statsPath = path.join(GENERATED_DIR, 'uz_quality_enhancement.stats.json');
  fs.writeFileSync(statsPath, `${JSON.stringify(stats, null, 2)}\n`, 'utf8');

  console.log(stats);
}

main();
