# Система иерархических слов (HyperLex Hierarchy)

## 📋 Обзор

Новая система для управления семантическими иерархиями (гиперним-гипоним отношениями) в HyperLex.

### Ключевые особенности:

✅ **Семантические ключи** - уникальные идентификаторы для концептов  
✅ **Автоматическая нормализация** - удаление склонений и ударений  
✅ **Parent-child иерархия** - правильные отношения между понятиями  
✅ **Семантический граф** - связи между словами в одной категории  
✅ **Bi-lingual** - русский и узбекский связаны одним semantic key  

---

## 📐 JSON Формат

### Структура одного элемента:

```json
{
  "ru": "Животное",
  "uz": "Hayvon",
  "description_ru": "Живой организм, способный двигаться и питаться.",
  "description_uz": "Harakatlana oladigan tirik mavjudot.",
  "category": "biology",
  "parent_ru": "Организм",
  "related": [
    "Собака",
    "Кошка",
    "Растение"
  ]
}
```

### Поля:

| Поле | Обязательный | Тип | Описание |
|------|:-----:|------|---------|
| `ru` | ✅ | string | Русское слово |
| `uz` | ✅ | string | Узбекское слово |
| `description_ru` | ❌ | string | Описание на русском |
| `description_uz` | ❌ | string | Описание на узбекском |
| `category` | ❌ | string | Категория (по умолчанию "general") |
| `parent_ru` | ❌ | string | Русское слово родителя в иерархии |
| `related` | ❌ | array | Массив связанных слов (русские слова) |

### Правила:

1. **Русское и узбекское связаны одним semantic_key**
   - Не создавайте отдельные элементы для каждого языка
   - Одна запись = одна концепция (concept)

2. **Иерархия строится через parent_ru**
   - Используйте русское слово родителя
   - Сервер автоматически найдёт правильный semantic_key

3. **Related - это слова в одной категории**
   - Укажите русские названия слов
   - Это создаст семантический граф

4. **Категория нужна для группировки**
   - biology, transport, medicine, etc.

---

## 🚀 Использование

### Способ 1: CLI скрипт

```bash
cd server
node scripts/import_hierarchy.js ../data/hierarchy_example.json
```

**Вывод:**

```
📥 Импорт иерархических данных...

✅ БД подключена

🔍 Валидация данных...
✅ Данные валидны

📊 Построение семантического графа...
✅ Создано 18 концептов

🗑️  Очистка коллекции Words...
✅ Коллекция очищена

💾 Сохранение в БД...
✅ Сохранено 18 слов

📈 СТАТИСТИКА:
   • Всего концептов: 18
   • Root концептов: 2
   • Категории: biology, transport

🌳 ПРИМЕРЫ ИЕРАРХИИ:

Животное (Hayvon)
  └── Собака (It)
      └── Бульдог (Buldog)
      └── Хаски (Haskiy)
      └── Овчарка (Cho'ban iti)
  └── Кошка (Mushuk)
      └── Лев (Sher)

Растение (O'simlik)
  └── Цветок (Gul)
      └── Роза (Gul)
  └── Дерево (Daraxt)
      └── Дуб (Buloq)

Транспорт (Transport)
  └── Машина (Mashina)
      └── Седан (Sedan)
      └── Грузовик (Yuk mashinasi)
  └── Велосипед (Velosiped)
      └── Мотоцикл (Mototsikl)

✅ ✅ ✅ Импорт завершён успешно! ✅ ✅ ✅
```

### Способ 2: API эндпоинты

#### Импорт иерархии

```http
POST /api/admin/import/hierarchy
Content-Type: application/json
Authorization: Bearer <token>

{
  "data": [
    {
      "ru": "Животное",
      "uz": "Hayvon",
      ...
    }
  ]
}
```

**Ответ:**

```json
{
  "success": true,
  "message": "Successfully imported 18 concepts",
  "statistics": {
    "totalConcepts": 18,
    "rootConcepts": 2,
    "categories": ["biology", "transport"],
    "timestamp": "2026-05-10T10:30:45.123Z"
  }
}
```

#### Получить полную иерархию

```http
GET /api/admin/hierarchy/structure
Authorization: Bearer <token>
```

**Ответ:**

```json
{
  "success": true,
  "totalRoots": 2,
  "hierarchies": [
    {
      "semantic_key": "zhivhay_t1g2h3i4",
      "ru": "Животное",
      "uz": "Hayvon",
      "category": "biology",
      "description_ru": "...",
      "description_uz": "...",
      "children": [
        {
          "semantic_key": "sobita_t1g2h3i5",
          "ru": "Собака",
          "uz": "It",
          "children": [
            {
              "semantic_key": "bulbul_t1g2h3i6",
              "ru": "Бульдог",
              "uz": "Buldog",
              "children": []
            }
          ]
        }
      ]
    }
  ]
}
```

#### Получить дерево для одного слова

```http
GET /api/admin/hierarchy/tree/:semantic_key
Authorization: Bearer <token>

# Пример:
GET /api/admin/hierarchy/tree/sobita_t1g2h3i5
```

#### Получить статистику

```http
GET /api/admin/hierarchy/stats
Authorization: Bearer <token>
```

**Ответ:**

```json
{
  "success": true,
  "statistics": {
    "totalConcepts": 18,
    "rootConcepts": 2,
    "averageChildrenPerWord": 1.5,
    "categories": [
      { "name": "biology", "count": 12 },
      { "name": "transport", "count": 6 }
    ]
  }
}
```

#### Добавить слово

```http
POST /api/admin/hierarchy/add-word
Content-Type: application/json
Authorization: Bearer <token>

{
  "ru": "Кабриолет",
  "uz": "Kabriole",
  "description_ru": "Легковой автомобиль без крыши.",
  "description_uz": "Tomisiz avtomobil.",
  "category": "transport",
  "parent_semantic_key": "sed1234567890",
  "related": ["Купе", "Седан"]
}
```

#### Удалить слово

```http
DELETE /api/admin/hierarchy/:semantic_key
Authorization: Bearer <token>

# Пример:
DELETE /api/admin/hierarchy/sobita_t1g2h3i5
```

---

## 📊 Структура в БД

### Word документ

```javascript
{
  _id: ObjectId("..."),
  
  // Идентификаторы
  semantic_key: "sobita_t1g2h3i5",      // уникальный ключ концепта
  
  // Основные данные
  ru: "Собака",
  uz: "It",
  
  // Нормализованные (для поиска)
  normalized_ru: "sobaka",
  normalized_uz: "it",
  
  // Описания
  description_ru: "Домашнее животное...",
  description_uz: "Uy hayvoni...",
  
  // Иерархия
  category: "biology",
  parent_semantic_key: "zhivhay_t1g2h3i4",
  children_semantic_keys: [
    "bulbul_t1g2h3i6",
    "haskiy_t1g2h3i7",
    "ovch_t1g2h3i8"
  ],
  
  // Граф
  related: [
    "koshkat_t1g2h3i9",
    "lvensher_t1g2h3i10"
  ],
  
  // Метаданные
  createdAt: ISODate("2026-05-10T10:30:45.123Z"),
  updatedAt: ISODate("2026-05-10T10:30:45.123Z")
}
```

---

## 🔍 Примеры использования

### Получить всех "потомков" слова

```javascript
const word = await Word.findOne({ semantic_key: "sobita_t1g2h3i5" });
const allDescendants = await word.getHierarchyDown();
// Вернёт: [Собака, Бульдог, Хаски, Овчарка]
```

### Получить полный путь от root до слова

```javascript
const word = await Word.findOne({ semantic_key: "bulbul_t1g2h3i6" });
const path = await word.getHierarchyUp();
// Вернёт: [Животное, Собака, Бульдог]
```

### Получить дерево в JSON

```javascript
const word = await Word.findOne({ semantic_key: "sobita_t1g2h3i5" });
const tree = await word.getTreeStructure();
// Вернёт полное дерево от Собаки со всеми потомками
```

### Поиск слова по нормализованной форме

```javascript
const word = await Word.findOne({ normalized_ru: "sobaka" });
// Найдёт "Собака" даже если искали "собака" или "Собаки"
```

---

## 📝 Примечания

### Особенности:

1. **semantic_key уникален** - один концепт = один ключ
2. **Иерархия гибкая** - можно изменять через parent_semantic_key
3. **Нормализация автоматична** - при импорте и при добавлении
4. **Граф семантический** - related создаёт связи в категории

### Миграция со старой системы:

Если у вас есть старая БД с другим форматом:

```javascript
const oldWord = await OldWord.findOne();
const newWord = {
  semantic_key: generateSemanticKey(oldWord.ru, oldWord.uz),
  ru: oldWord.ru,
  uz: oldWord.uz,
  normalized_ru: normalizeWord(oldWord.ru, 'ru'),
  normalized_uz: normalizeWord(oldWord.uz, 'uz'),
  // ... другие поля
};
```

---

## ⚠️ Важно!

- **JSON должен быть валидным** перед импортом
- **parent_ru должны существовать в JSON** (иначе будут root)
- **Удаление word** автоматически переместит детей к родителю
- **Related не влияет на иерархию** - это просто граф связей

---

## 📞 Помощь

- Проверьте форматирование JSON (используйте jsonlint.com)
- Убедитесь, что все parent_ru указывают на существующие слова
- Смотрите логи импорта для деталей ошибок
