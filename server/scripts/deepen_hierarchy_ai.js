const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../data/data');

const FILE_CONFIGS = {
  food: {
    rootKey: 'food',
    rootNode: {
      ru: 'Еда',
      uz: 'Oziq-ovqat',
      description_ru: 'Общая категория продуктов питания и напитков.',
      description_uz: 'Oziq-ovqat va ichimliklarning umumiy toifasi.',
      category: 'food',
      related: ['fruits', 'vegetables', 'meat', 'dairy', 'grains', 'drinks'],
      level: 1
    }
  },
  technology: {
    rootKey: 'technology',
    rootNode: {
      ru: 'Технологии',
      uz: 'Texnologiyalar',
      description_ru: 'Общая категория устройств, систем и цифровых решений.',
      description_uz: 'Qurilmalar, tizimlar va raqamli yechimlarning umumiy toifasi.',
      category: 'technology',
      related: [
        'internet',
        'electricity',
        'computer_technology',
        'media_technology',
        'ai_technology',
        'automation_technology'
      ],
      level: 1
    },
    additionalNodes: {
      computer_technology: {
        ru: 'Компьютерные технологии',
        uz: 'Kompyuter texnologiyalari',
        parent: 'technology',
        description_ru: 'Технологии, связанные с компьютерами и вычислительными устройствами.',
        description_uz: 'Kompyuterlar va hisoblash qurilmalari bilan bog‘liq texnologiyalar.',
        category: 'technology',
        related: ['laptop_device', 'tablet_device', 'printer', 'scanner'],
        level: 2
      },
      transport_technology: {
        ru: 'Транспортные технологии',
        uz: 'Transport texnologiyalari',
        parent: 'technology',
        description_ru: 'Технологии, применяемые в транспорте и навигации.',
        description_uz: 'Transport va navigatsiyada qo‘llaniladigan texnologiyalar.',
        category: 'technology',
        related: ['gps', 'mobile_network'],
        level: 2
      },
      security_technology: {
        ru: 'Технологии безопасности',
        uz: 'Xavfsizlik texnologiyalari',
        parent: 'technology',
        description_ru: 'Технологии для защиты людей, данных и объектов.',
        description_uz: 'Odamlar, ma’lumotlar va obyektlarni himoya qiluvchi texnologiyalar.',
        category: 'technology',
        related: [],
        level: 2
      },
      industrial_technology: {
        ru: 'Промышленные технологии',
        uz: 'Sanoat texnologiyalari',
        parent: 'technology',
        description_ru: 'Технологии для производства и промышленной автоматизации.',
        description_uz: 'Ishlab chiqarish va sanoat avtomatlashtirish texnologiyalari.',
        category: 'technology',
        related: ['automation_technology'],
        level: 2
      },
      educational_technology: {
        ru: 'Образовательные технологии',
        uz: 'Ta’lim texnologiyalari',
        parent: 'technology',
        description_ru: 'Цифровые и технические решения для обучения.',
        description_uz: 'Ta’lim uchun raqamli va texnik yechimlar.',
        category: 'technology',
        related: [],
        level: 2
      },
      media_technology: {
        ru: 'Медиатехнологии',
        uz: 'Media texnologiyalari',
        parent: 'technology',
        description_ru: 'Технологии для создания, передачи и потребления медиа.',
        description_uz: 'Media yaratish, uzatish va iste’mol qilish texnologiyalari.',
        category: 'technology',
        related: ['television', 'internet'],
        level: 2
      },
      cloud_technology: {
        ru: 'Облачные технологии',
        uz: 'Bulutli texnologiyalar',
        parent: 'technology',
        description_ru: 'Технологии хранения, обработки и запуска сервисов в облаке.',
        description_uz: 'Bulutda saqlash, qayta ishlash va servislarni ishga tushirish texnologiyalari.',
        category: 'technology',
        related: ['internet'],
        level: 2
      },
      ai_technology: {
        ru: 'Искусственный интеллект',
        uz: 'Sun’iy intellekt',
        parent: 'technology',
        description_ru: 'Технологии машинного обучения, анализа и интеллектуальной автоматизации.',
        description_uz: 'Mashinali o‘rganish, tahlil va aqlli avtomatlashtirish texnologiyalari.',
        category: 'technology',
        related: ['robotics', 'automation_technology'],
        level: 2
      },
      robotics: {
        ru: 'Робототехника',
        uz: 'Robototexnika',
        parent: 'technology',
        description_ru: 'Технологии создания и управления роботами.',
        description_uz: 'Robotlarni yaratish va boshqarish texnologiyalari.',
        category: 'technology',
        related: ['ai_technology', 'automation_technology'],
        level: 2
      },
      biotechnology: {
        ru: 'Биотехнологии',
        uz: 'Biotexnologiya',
        parent: 'technology',
        description_ru: 'Технологии на стыке биологии, медицины и инженерии.',
        description_uz: 'Biologiya, tibbiyot va muhandislik kesishmasidagi texnologiyalar.',
        category: 'technology',
        related: [],
        level: 2
      },
      nanotechnology: {
        ru: 'Нанотехнологии',
        uz: 'Nanotexnologiya',
        parent: 'technology',
        description_ru: 'Технологии работы с материалами на наноуровне.',
        description_uz: 'Materiallar bilan nano darajada ishlash texnologiyalari.',
        category: 'technology',
        related: [],
        level: 2
      },
      construction_technology: {
        ru: 'Строительные технологии',
        uz: 'Qurilish texnologiyalari',
        parent: 'technology',
        description_ru: 'Технологии, применяемые в строительстве и инфраструктуре.',
        description_uz: 'Qurilish va infratuzilmada qo‘llaniladigan texnologiyalar.',
        category: 'technology',
        related: [],
        level: 2
      },
      space_technology: {
        ru: 'Космические технологии',
        uz: 'Kosmik texnologiyalar',
        parent: 'technology',
        description_ru: 'Технологии исследования космоса и спутниковых систем.',
        description_uz: 'Kosmosni o‘rganish va sun’iy yo‘ldosh tizimlari texnologiyalari.',
        category: 'technology',
        related: ['gps'],
        level: 2
      },
      gaming_technology: {
        ru: 'Игровые технологии',
        uz: 'O‘yin texnologiyalari',
        parent: 'technology',
        description_ru: 'Технологии для видеоигр, игровых платформ и интерактивных систем.',
        description_uz: 'Videoo‘yinlar, platformalar va interaktiv tizimlar texnologiyalari.',
        category: 'technology',
        related: [],
        level: 2
      },
      blockchain_technology: {
        ru: 'Блокчейн-технологии',
        uz: 'Blokcheyn texnologiyalari',
        parent: 'technology',
        description_ru: 'Технологии распределённых реестров и цифровых транзакций.',
        description_uz: 'Taqsimlangan reyestr va raqamli tranzaksiya texnologiyalari.',
        category: 'technology',
        related: [],
        level: 2
      },
      automation_technology: {
        ru: 'Технологии автоматизации',
        uz: 'Avtomatlashtirish texnologiyalari',
        parent: 'technology',
        description_ru: 'Технологии для автоматического выполнения процессов и задач.',
        description_uz: 'Jarayon va vazifalarni avtomatik bajarish texnologiyalari.',
        category: 'technology',
        related: ['industrial_technology', 'ai_technology', 'robotics'],
        level: 2
      },
      home_appliance_technology: {
        ru: 'Бытовая техника',
        uz: 'Maishiy texnologiyalar',
        parent: 'technology',
        description_ru: 'Домашние электрические устройства для повседневного использования.',
        description_uz: 'Kundalik foydalanish uchun uy elektr qurilmalari.',
        category: 'technology',
        related: ['refrigerator', 'washing_machine', 'vacuum_cleaner', 'microwave'],
        level: 2
      },
      medical_technology: {
        ru: 'Медицинские технологии',
        uz: 'Tibbiy texnologiyalar',
        parent: 'technology',
        description_ru: 'Технологии диагностики, мониторинга и лечения в медицине.',
        description_uz: 'Tibbiyotda diagnostika, monitoring va davolash texnologiyalari.',
        category: 'technology',
        related: ['mri_machine', 'ultrasound_machine', 'blood_pressure_monitor', 'glucose_meter'],
        level: 2
      }
    },
    parentOverrides: {
      television: 'media_technology',
      refrigerator: 'home_appliance_technology',
      washing_machine: 'home_appliance_technology',
      vacuum_cleaner: 'home_appliance_technology',
      mri_machine: 'medical_technology',
      ultrasound_machine: 'medical_technology',
      blood_pressure_monitor: 'medical_technology',
      glucose_meter: 'medical_technology'
    }
  },
  medicine: {
    rootKey: 'medicine',
    rootNode: {
      ru: 'Медицина',
      uz: 'Tibbiyot',
      description_ru: 'Наука о здоровье, профилактике, диагностике и лечении болезней.',
      description_uz: 'Sog‘liq, profilaktika, tashxis va davolash haqidagi fan.',
      category: 'medicine',
      related: ['medical_fields', 'medications', 'medical_equipment'],
      level: 1
    }
  },
  home_daily_life: {
    additionalNodes: {
      desk: {
        ru: 'Письменный стол',
        uz: 'Yozuv stoli',
        parent: 'furniture',
        description_ru: 'Стол для работы, учёбы и размещения техники.',
        description_uz: 'Ish, o‘qish va texnika joylashtirish uchun stol.',
        category: 'daily_life',
        related: ['table', 'chair', 'computer', 'lamp'],
        level: 3
      }
    }
  }
};

const RELATED_ALIAS_MAP = {
  market: 'store',
  payment: 'money',
  card: 'money',
  wallet: 'money'
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function dedupe(list) {
  const seen = new Set();
  const result = [];

  for (const item of list) {
    if (!seen.has(item)) {
      seen.add(item);
      result.push(item);
    }
  }

  return result;
}

function loadFiles() {
  const files = fs.readdirSync(dataDir).filter((file) => file.endsWith('.json')).sort();
  const datasets = new Map();

  for (const file of files) {
    const fullPath = path.join(dataDir, file);
    datasets.set(file, JSON.parse(fs.readFileSync(fullPath, 'utf8')));
  }

  return datasets;
}

function ensureNode(data, key, node) {
  if (!data[key]) {
    data[key] = clone(node);
    return true;
  }

  return false;
}

function sanitizeKeys(file, data) {
  const changes = [];

  for (const key of Object.keys(data)) {
    if (typeof key === 'string' && key.trim() === '') {
      delete data[key];
      changes.push(`${file}: removed empty key entry`);
    }
  }

  return changes;
}

function applyFileConfig(file, data) {
  const baseName = path.basename(file, '.json');
  const config = FILE_CONFIGS[baseName];
  const changes = [];

  if (!config) {
    return changes;
  }

  if (config.rootKey && config.rootNode) {
    if (ensureNode(data, config.rootKey, config.rootNode)) {
      changes.push(`created root "${config.rootKey}"`);
    }

    const root = data[config.rootKey];
    for (const [field, value] of Object.entries(config.rootNode)) {
      if (root[field] === undefined || root[field] === null || root[field] === '') {
        root[field] = clone(value);
        changes.push(`filled root field "${config.rootKey}.${field}"`);
      }
    }

    delete root.parent;

    for (const [key, node] of Object.entries(data)) {
      if (key === config.rootKey) {
        continue;
      }

      if (!node.parent) {
        node.parent = config.rootKey;
        changes.push(`attached "${key}" to root "${config.rootKey}"`);
      }
    }
  }

  if (config.additionalNodes) {
    for (const [key, node] of Object.entries(config.additionalNodes)) {
      if (ensureNode(data, key, node)) {
        changes.push(`created helper node "${key}"`);
      }
    }
  }

  if (config.parentOverrides) {
    for (const [key, parent] of Object.entries(config.parentOverrides)) {
      if (data[key] && data[key].parent !== parent) {
        data[key].parent = parent;
        changes.push(`reparented "${key}" -> "${parent}"`);
      }
    }
  }

  return changes;
}

function normalizeParentChains(file, data) {
  const baseName = path.basename(file, '.json');
  const config = FILE_CONFIGS[baseName];
  const rootKey = config && config.rootKey;
  const changes = [];

  for (const [key, node] of Object.entries(data)) {
    if (!Array.isArray(node.related)) {
      node.related = [];
      changes.push(`fixed related array for "${key}"`);
    }

    if (key === rootKey) {
      delete node.parent;
      continue;
    }

    if (node.parent && !data[node.parent] && rootKey) {
      node.parent = rootKey;
      changes.push(`relinked broken parent for "${key}" -> "${rootKey}"`);
    }
  }

  return changes;
}

function normalizeRelatedAcrossDatasets(datasets) {
  const globalKeys = new Set();

  for (const data of datasets.values()) {
    for (const key of Object.keys(data)) {
      globalKeys.add(key);
    }
  }

  const changes = [];

  for (const [file, data] of datasets.entries()) {
    for (const [key, node] of Object.entries(data)) {
      const original = Array.isArray(node.related) ? node.related : [];
      const normalized = [];

      for (const relatedKey of original) {
        const target = RELATED_ALIAS_MAP[relatedKey] || relatedKey;
        if (target !== key && globalKeys.has(target)) {
          normalized.push(target);
        }
      }

      const unique = dedupe(normalized);
      if (JSON.stringify(unique) !== JSON.stringify(original)) {
        node.related = unique;
        changes.push(`${file}: normalized related for "${key}"`);
      }
    }
  }

  return changes;
}

function buildChildrenMap(data) {
  const childrenMap = new Map();

  for (const key of Object.keys(data)) {
    childrenMap.set(key, []);
  }

  for (const [key, node] of Object.entries(data)) {
    if (node.parent && childrenMap.has(node.parent)) {
      childrenMap.get(node.parent).push(key);
    }
  }

  for (const children of childrenMap.values()) {
    children.sort((a, b) => a.localeCompare(b));
  }

  return childrenMap;
}

function enrichRelated(data) {
  const childrenMap = buildChildrenMap(data);
  const changes = [];

  for (const [key, node] of Object.entries(data)) {
    const original = Array.isArray(node.related) ? node.related : [];
    const candidatePool = [...original];

    if (node.parent && data[node.parent]) {
      candidatePool.push(node.parent);

      const siblings = (childrenMap.get(node.parent) || []).filter((child) => child !== key);
      candidatePool.push(...siblings.slice(0, 4));
    }

    const children = childrenMap.get(key) || [];
    candidatePool.push(...children.slice(0, 4));

    if (node.parent && data[node.parent] && data[node.parent].parent) {
      candidatePool.push(data[node.parent].parent);
    }

    const normalized = dedupe(candidatePool.filter((item) => item !== key && data[item])).slice(0, 8);

    if (JSON.stringify(normalized) !== JSON.stringify(original)) {
      node.related = normalized;
      changes.push(`enriched related for "${key}"`);
    }
  }

  return changes;
}

function recomputeLevels(data) {
  const memo = new Map();
  const visiting = new Set();

  function visit(key) {
    if (memo.has(key)) {
      return memo.get(key);
    }

    if (visiting.has(key)) {
      memo.set(key, 1);
      return 1;
    }

    visiting.add(key);
    const node = data[key];
    let level = 1;

    if (node.parent && data[node.parent]) {
      level = Math.min(6, visit(node.parent) + 1);
    }

    visiting.delete(key);
    memo.set(key, level);
    return level;
  }

  for (const key of Object.keys(data)) {
    data[key].level = visit(key);
  }
}

function sortData(data) {
  return Object.fromEntries(
    Object.entries(data).sort((a, b) => {
      const levelDiff = (a[1].level || 0) - (b[1].level || 0);
      if (levelDiff !== 0) {
        return levelDiff;
      }

      return a[0].localeCompare(b[0]);
    })
  );
}

function normalizeNodeShape(data) {
  const ordered = {};

  for (const [key, node] of Object.entries(data)) {
    ordered[key] = {
      ru: node.ru,
      uz: node.uz,
      ...(node.parent ? { parent: node.parent } : {}),
      description_ru: node.description_ru,
      description_uz: node.description_uz,
      category: node.category,
      related: Array.isArray(node.related) ? node.related : [],
      level: node.level
    };
  }

  return ordered;
}

function writeDatasets(datasets) {
  for (const [file, data] of datasets.entries()) {
    const fullPath = path.join(dataDir, file);
    const sorted = sortData(data);
    const normalized = normalizeNodeShape(sorted);
    fs.writeFileSync(fullPath, `${JSON.stringify(normalized, null, 2)}\n`, 'utf8');
  }
}

function validateDatasets(datasets) {
  const globalKeys = new Set();
  for (const data of datasets.values()) {
    for (const key of Object.keys(data)) {
      globalKeys.add(key);
    }
  }

  const issues = [];

  for (const [file, data] of datasets.entries()) {
    for (const [key, node] of Object.entries(data)) {
      if (node.parent && !data[node.parent]) {
        issues.push(`${file}: "${key}" has missing local parent "${node.parent}"`);
      }

      for (const relatedKey of node.related || []) {
        if (!globalKeys.has(relatedKey)) {
          issues.push(`${file}: "${key}" has missing related "${relatedKey}"`);
        }
      }
    }
  }

  return issues;
}

function run() {
  const datasets = loadFiles();
  const logs = [];

  for (const [file, data] of datasets.entries()) {
    logs.push(...sanitizeKeys(file, data));
    logs.push(...applyFileConfig(file, data).map((item) => `${file}: ${item}`));
    logs.push(...normalizeParentChains(file, data).map((item) => `${file}: ${item}`));
    recomputeLevels(data);
  }

  logs.push(...normalizeRelatedAcrossDatasets(datasets));

  for (const [file, data] of datasets.entries()) {
    logs.push(...enrichRelated(data).map((item) => `${file}: ${item}`));
    recomputeLevels(data);
  }

  const issues = validateDatasets(datasets);
  writeDatasets(datasets);

  for (const line of logs) {
    console.log(`• ${line}`);
  }

  if (issues.length > 0) {
    console.log('\nValidation issues:');
    for (const issue of issues) {
      console.log(`- ${issue}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log('\nAll JSON files were normalized successfully.');
}

run();
