const fs = require('fs');
const path = require('path');

const CURATED_DATA_DIR = path.join(__dirname, '../data/data');
const GENERATED_DIR = path.join(__dirname, '../data/generated');

const DAILY_CATEGORIES = {
  home: {
    ru: 'Дом и быт',
    uz: 'Uy va ro‘zg‘or',
    description_ru: 'Базовые слова о доме, комнатах, мебели и бытовых предметах.',
    description_uz: 'Uy, xonalar, mebel va ro‘zg‘or buyumlariga oid asosiy so‘zlar.'
  },
  family: {
    ru: 'Семья и люди',
    uz: 'Oila va odamlar',
    description_ru: 'Члены семьи, близкие люди и повседневное общение.',
    description_uz: 'Oila a’zolari, yaqinlar va kundalik muloqot.'
  },
  food: {
    ru: 'Еда и кухня',
    uz: 'Ovqat va oshxona',
    description_ru: 'Продукты, напитки, посуда и всё, что связано с питанием.',
    description_uz: 'Taom, ichimlik, idish-tovoq va ovqatlanishga oid so‘zlar.'
  },
  education: {
    ru: 'Школа и учеба',
    uz: 'Maktab va o‘qish',
    description_ru: 'Школа, университет, предметы и учебные вещи.',
    description_uz: 'Maktab, universitet, fanlar va o‘qish buyumlari.'
  },
  work: {
    ru: 'Работа и дело',
    uz: 'Ish va kasb',
    description_ru: 'Работа, профессии, документы и деловая среда.',
    description_uz: 'Ish, kasblar, hujjatlar va mehnat muhitiga oid so‘zlar.'
  },
  city: {
    ru: 'Город и места',
    uz: 'Shahar va joylar',
    description_ru: 'Городские места, здания, улицы и службы.',
    description_uz: 'Shahar joylari, binolar, ko‘chalar va xizmatlar.'
  },
  shopping: {
    ru: 'Покупки и деньги',
    uz: 'Savdo va pul',
    description_ru: 'Магазины, покупки, деньги и товары.',
    description_uz: 'Do‘konlar, xarid, pul va mahsulotlar.'
  },
  health: {
    ru: 'Здоровье и медицина',
    uz: 'Salomatlik va tibbiyot',
    description_ru: 'Врачи, лекарства, части тела и здоровье.',
    description_uz: 'Shifokorlar, dorilar, tana a’zolari va sog‘liq.'
  },
  transport: {
    ru: 'Транспорт',
    uz: 'Transport',
    description_ru: 'Машины, дорога, поездки и виды транспорта.',
    description_uz: 'Mashina, yo‘l, safar va transport turlari.'
  },
  nature: {
    ru: 'Природа и погода',
    uz: 'Tabiat va ob-havo',
    description_ru: 'Природа, животные, растения и погодные явления.',
    description_uz: 'Tabiat, hayvonlar, o‘simliklar va ob-havo hodisalari.'
  },
  clothing: {
    ru: 'Одежда и вещи',
    uz: 'Kiyim va buyumlar',
    description_ru: 'Одежда, обувь и личные вещи.',
    description_uz: 'Kiyim, poyabzal va shaxsiy buyumlar.'
  },
  time: {
    ru: 'Время и календарь',
    uz: 'Vaqt va taqvim',
    description_ru: 'Дни, месяцы, время и повседневные временные понятия.',
    description_uz: 'Kunlar, oylar, vaqt va kundalik vaqt tushunchalari.'
  },
  communication: {
    ru: 'Общение и язык',
    uz: 'Muloqot va til',
    description_ru: 'Речь, письмо, книги, вопросы и общение.',
    description_uz: 'Nutq, yozuv, kitoblar, savollar va muloqot.'
  },
  general: {
    ru: 'Простые слова',
    uz: 'Oddiy so‘zlar',
    description_ru: 'Большой набор простых существительных для повседневного поиска.',
    description_uz: 'Kundalik qidiruv uchun oddiy otlarning katta to‘plami.'
  }
};

const MANUAL_UZ_OVERRIDES = {
  'дом': 'Uy',
  'квартира': 'Kvartira',
  'комната': 'Xona',
  'кухня': 'Oshxona',
  'ванная': 'Hammom',
  'ванна': 'Vanna',
  'дверь': 'Eshik',
  'окно': 'Deraza',
  'стена': 'Devor',
  'пол': 'Pol',
  'потолок': 'Shift',
  'крыша': 'Tom',
  'лестница': 'Zina',
  'лифт': 'Lift',
  'стол': 'Stol',
  'стул': 'Stul',
  'кровать': 'Karavot',
  'диван': 'Divan',
  'шкаф': 'Shkaf',
  'зеркало': 'Ko‘zgu',
  'лампа': 'Chiroq',
  'телевизор': 'Televizor',
  'холодильник': 'Muzlatgich',
  'печь': 'Pech',
  'плита': 'Plita',
  'чашка': 'Piyola',
  'тарелка': 'Tarelka',
  'ложка': 'Qoshiq',
  'вилка': 'Sanchqi',
  'нож': 'Pichoq',
  'полотенце': 'Sochiq',
  'мыло': 'Sovun',
  'щетка': 'Cho‘tka',
  'семья': 'Oila',
  'родитель': 'Ota-ona',
  'мать': 'Ona',
  'отец': 'Ota',
  'мама': 'Ona',
  'папа': 'Dada',
  'сын': 'O‘g‘il',
  'дочь': 'Qiz',
  'ребенок': 'Bola',
  'дети': 'Bolalar',
  'брат': 'Aka-uka',
  'сестра': 'Opa-singil',
  'дедушка': 'Bobo',
  'бабушка': 'Buvi',
  'друг': 'Do‘st',
  'подруга': 'Qiz do‘st',
  'сосед': 'Qo‘shni',
  'муж': 'Er',
  'жена': 'Xotin',
  'еда': 'Ovqat',
  'завтрак': 'Nonushta',
  'обед': 'Tushlik',
  'ужин': 'Kechki ovqat',
  'хлеб': 'Non',
  'молоко': 'Sut',
  'вода': 'Suv',
  'чай': 'Choy',
  'кофе': 'Qahva',
  'сок': 'Sharbat',
  'суп': 'Sho‘rva',
  'мясо': 'Go‘sht',
  'рыба': 'Baliq',
  'курица': 'Tovuq',
  'яйцо': 'Tuxum',
  'сыр': 'Pishloq',
  'масло': 'Yog‘',
  'сахар': 'Shakar',
  'соль': 'Tuz',
  'рис': 'Guruch',
  'картофель': 'Kartoshka',
  'картошка': 'Kartoshka',
  'морковь': 'Sabzi',
  'лук': 'Piyoz',
  'помидор': 'Pomidor',
  'огурец': 'Bodring',
  'яблоко': 'Olma',
  'банан': 'Banan',
  'апельсин': 'Apelsin',
  'магазин': 'Do‘kon',
  'рынок': 'Bozor',
  'товар': 'Mahsulot',
  'цена': 'Narx',
  'деньги': 'Pul',
  'кошелек': 'Hamyon',
  'пакет': 'Paket',
  'работа': 'Ish',
  'профессия': 'Kasb',
  'офис': 'Ofis',
  'директор': 'Direktor',
  'учитель': 'O‘qituvchi',
  'студент': 'Talaba',
  'инженер': 'Muhandis',
  'врач': 'Shifokor',
  'медсестра': 'Hamshira',
  'школа': 'Maktab',
  'университет': 'Universitet',
  'универ': 'Universitet',
  'класс': 'Sinf',
  'урок': 'Dars',
  'книга': 'Kitob',
  'тетрадь': 'Daftar',
  'ручка': 'Ruchka',
  'карандаш': 'Qalam',
  'доска': 'Doska',
  'экзамен': 'Imtihon',
  'город': 'Shahar',
  'улица': 'Ko‘cha',
  'дорога': 'Yo‘l',
  'район': 'Tuman',
  'парк': 'Bog‘',
  'площадь': 'Maydon',
  'мост': 'Ko‘prik',
  'вокзал': 'Vokzal',
  'станция': 'Bekat',
  'больница': 'Kasalxona',
  'аптека': 'Dorixona',
  'банк': 'Bank',
  'почта': 'Pochta',
  'машина': 'Mashina',
  'автомобиль': 'Avtomobil',
  'автобус': 'Avtobus',
  'поезд': 'Poyezd',
  'самолет': 'Samolyot',
  'велосипед': 'Velosiped',
  'такси': 'Taksi',
  'билет': 'Bilet',
  'водитель': 'Haydovchi',
  'голова': 'Bosh',
  'рука': 'Qo‘l',
  'нога': 'Oyoq',
  'глаз': 'Ko‘z',
  'нос': 'Burun',
  'рот': 'Og‘iz',
  'зуб': 'Tish',
  'сердце': 'Yurak',
  'лекарство': 'Dori',
  'таблетка': 'Tabletka',
  'одежда': 'Kiyim',
  'рубашка': 'Ko‘ylak',
  'брюки': 'Shim',
  'платье': 'Ko‘ylak',
  'обувь': 'Oyoq kiyim',
  'куртка': 'Kurtka',
  'шапка': 'Shapka',
  'сумка': 'Sumka',
  'природа': 'Tabiat',
  'дерево': 'Daraxt',
  'цветок': 'Gul',
  'трава': 'Maysa',
  'река': 'Daryo',
  'озеро': 'Ko‘l',
  'море': 'Dengiz',
  'гора': 'Tog‘',
  'солнце': 'Quyosh',
  'луна': 'Oy',
  'дождь': 'Yomg‘ir',
  'снег': 'Qor',
  'ветер': 'Shamol',
  'время': 'Vaqt',
  'день': 'Kun',
  'ночь': 'Tun',
  'утро': 'Tong',
  'вечер': 'Kechqurun',
  'неделя': 'Hafta',
  'месяц': 'Oy',
  'год': 'Yil',
  'сегодня': 'Bugun',
  'завтра': 'Ertaga',
  'вчера': 'Kecha',
  'слово': 'So‘z',
  'язык': 'Til',
  'разговор': 'Suhbat',
  'вопрос': 'Savol',
  'ответ': 'Javob',
  'письмо': 'Xat',
  'сообщение': 'Xabar',
  'телефон': 'Telefon',
  'номер': 'Raqam',
  'имя': 'Ism',
  'фамилия': 'Familiya',
  'человек': 'Odam',
  'мужчина': 'Erkak',
  'женщина': 'Ayol',
  'девочка': 'Qizcha',
  'мальчик': 'O‘g‘il bola',
  'гость': 'Mehmon'
};

const MANUAL_CATEGORY_WORDS = {
  home: ['дом', 'квартира', 'комната', 'кухня', 'ванная', 'дверь', 'окно', 'стена', 'пол', 'крыша', 'стол', 'стул', 'кровать', 'диван', 'шкаф', 'зеркало', 'лампа', 'телевизор', 'холодильник', 'полотенце'],
  family: ['семья', 'родитель', 'мать', 'отец', 'мама', 'папа', 'сын', 'дочь', 'ребенок', 'дети', 'брат', 'сестра', 'дедушка', 'бабушка', 'друг', 'подруга', 'сосед', 'муж', 'жена', 'человек'],
  food: ['еда', 'завтрак', 'обед', 'ужин', 'хлеб', 'молоко', 'вода', 'чай', 'кофе', 'сок', 'суп', 'мясо', 'рыба', 'курица', 'яйцо', 'сыр', 'сахар', 'соль', 'рис', 'картошка'],
  education: ['школа', 'университет', 'класс', 'урок', 'книга', 'тетрадь', 'ручка', 'карандаш', 'доска', 'экзамен', 'студент', 'учитель'],
  work: ['работа', 'профессия', 'офис', 'директор', 'инженер', 'документ', 'проект', 'договор', 'касса', 'зарплата'],
  city: ['город', 'улица', 'дорога', 'район', 'парк', 'площадь', 'мост', 'вокзал', 'станция', 'банк', 'почта'],
  shopping: ['магазин', 'рынок', 'товар', 'цена', 'деньги', 'кошелек', 'пакет', 'чек', 'скидка', 'покупка'],
  health: ['врач', 'медсестра', 'больница', 'аптека', 'голова', 'рука', 'нога', 'глаз', 'нос', 'рот', 'зуб', 'сердце', 'лекарство', 'таблетка'],
  transport: ['машина', 'автомобиль', 'автобус', 'поезд', 'самолет', 'велосипед', 'такси', 'билет', 'водитель'],
  nature: ['природа', 'дерево', 'цветок', 'трава', 'река', 'озеро', 'море', 'гора', 'солнце', 'луна', 'дождь', 'снег', 'ветер'],
  clothing: ['одежда', 'рубашка', 'брюки', 'платье', 'обувь', 'куртка', 'шапка', 'сумка'],
  time: ['время', 'день', 'ночь', 'утро', 'вечер', 'неделя', 'месяц', 'год', 'сегодня', 'завтра', 'вчера'],
  communication: ['слово', 'язык', 'разговор', 'вопрос', 'ответ', 'письмо', 'сообщение', 'телефон', 'номер', 'имя', 'фамилия']
};

function normalizeRu(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/\s+/g, ' ');
}

function transliterateRuToUzLatin(text) {
  const map = {
    А: 'A', а: 'a', Б: 'B', б: 'b', В: 'V', в: 'v', Г: 'G', г: 'g',
    Д: 'D', д: 'd', Е: 'E', е: 'e', Ё: 'Yo', ё: 'yo', Ж: 'J', ж: 'j',
    З: 'Z', з: 'z', И: 'I', и: 'i', Й: 'Y', й: 'y', К: 'K', к: 'k',
    Л: 'L', л: 'l', М: 'M', м: 'm', Н: 'N', н: 'n', О: 'O', о: 'o',
    П: 'P', п: 'p', Р: 'R', р: 'r', С: 'S', с: 's', Т: 'T', т: 't',
    У: 'U', у: 'u', Ф: 'F', ф: 'f', Х: 'X', х: 'x', Ц: 'Ts', ц: 'ts',
    Ч: 'Ch', ч: 'ch', Ш: 'Sh', ш: 'sh', Щ: 'Sh', щ: 'sh',
    Ъ: '', ъ: '', Ы: 'I', ы: 'i', Ь: '', ь: '', Э: 'E', э: 'e',
    Ю: 'Yu', ю: 'yu', Я: 'Ya', я: 'ya'
  };

  return String(text || '')
    .split('')
    .map((char) => map[char] !== undefined ? map[char] : char)
    .join('');
}

function toTitleCase(text) {
  return String(text || '')
    .trim()
    .toLowerCase()
    .replace(/(^|[\s-])([a-zа-яёʻ’'o])/giu, (match, start, char) => `${start}${char.toUpperCase()}`);
}

function getUzTranslation(ru, curatedMap = new Map()) {
  const normalized = normalizeRu(ru);
  return MANUAL_UZ_OVERRIDES[normalized]
    || curatedMap.get(normalized)
    || toTitleCase(transliterateRuToUzLatin(ru));
}

function buildCuratedTranslationMap() {
  const map = new Map();

  if (!fs.existsSync(CURATED_DATA_DIR)) {
    return map;
  }

  for (const file of fs.readdirSync(CURATED_DATA_DIR).filter((name) => name.endsWith('.json'))) {
    const fullPath = path.join(CURATED_DATA_DIR, file);
    const json = JSON.parse(fs.readFileSync(fullPath, 'utf8'));

    for (const value of Object.values(json)) {
      if (!value || typeof value !== 'object') continue;
      if (!value.ru || !value.uz) continue;

      const normalized = normalizeRu(value.ru);
      if (!map.has(normalized)) {
        map.set(normalized, value.uz.trim());
      }
    }
  }

  for (const [ru, uz] of Object.entries(MANUAL_UZ_OVERRIDES)) {
    map.set(normalizeRu(ru), uz);
  }

  return map;
}

function slugifyRu(value) {
  return normalizeRu(value)
    .replace(/[^a-zа-я0-9]+/gi, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);
}

module.exports = {
  CURATED_DATA_DIR,
  GENERATED_DIR,
  DAILY_CATEGORIES,
  MANUAL_UZ_OVERRIDES,
  MANUAL_CATEGORY_WORDS,
  normalizeRu,
  transliterateRuToUzLatin,
  toTitleCase,
  getUzTranslation,
  buildCuratedTranslationMap,
  slugifyRu
};
