# 🚀 БЫСТРЫЙ СТАРТ: Новая система иерархии HyperLex

## Что создано

### 📦 Новые файлы и папки:

```
server/
├── models/Word.js                   ✨ Обновлённая модель (semantic_key, иерархия)
├── controllers/hierarchyController.js   📄 API контроллер для иерархии
├── utils/semanticHelper.js          🔧 Утилиты (нормализация, графы, валидация)
├── scripts/
│   ├── import_hierarchy.js          📥 Скрипт импорта JSON
│   └── test_hierarchy.js            ✅ Тестирование системы
├── routes/admin.js                  🔄 Обновлены с новыми endpoints
└── data/
    └── hierarchy_example.json       📋 Пример JSON (18 слов с 3 категориями)

HIERARCHY_GUIDE.md                   📚 Полная документация
SETUP_HIERARCHY.md                   ⚡ Этот файл
```

---

## ⚡ Быстрая установка

### 1. Удостовериться, что зависимости установлены

```bash
cd server
npm install
# Должны быть: mongoose, express, cors, dotenv
```

### 2. Запустить тест (опционально)

```bash
node scripts/test_hierarchy.js
```

Ожидаемый результат: **5/5 тестов пройдены** ✅

---

## 🎯 Использование

### Вариант A: Импорт примера (быстро)

```bash
cd server
node scripts/import_hierarchy.js ./data/hierarchy_example.json
```

**Результат в консоли:**
```
✅ БД подключена
✅ Данные валидны
✅ Создано 18 концептов
✅ Сохранено 18 слов

📈 СТАТИСТИКА:
   • Всего концептов: 18
   • Root концептов: 3
   • Категории: biology, transport

🌳 ПРИМЕРЫ ИЕРАРХИИ:
Животное (Hayvon)
  └── Собака (It)
      └── Бульдог (Buldog)
      └── Хаски (Haskiy)
...
```

### Вариант B: Импорт своего JSON (через API)

1. **Подготовьте JSON файл** со своими данными (формат: см. ниже)

2. **Отправьте POST запрос:**

```bash
curl -X POST http://localhost:3001/api/admin/import/hierarchy \
  -H "Authorization: Bearer <ВАШ_ТОКЕН>" \
  -H "Content-Type: application/json" \
  -d '{
    "data": [
      {
        "ru": "Животное",
        "uz": "Hayvon",
        "description_ru": "...",
        "description_uz": "...",
        "category": "biology"
      },
      ...
    ]
  }'
```

3. **Получите ответ:**

```json
{
  "success": true,
  "message": "Successfully imported 18 concepts",
  "statistics": {
    "totalConcepts": 18,
    "rootConcepts": 2,
    "categories": ["biology", "transport"]
  }
}
```

---

## 📋 Формат JSON

### Обязательные поля:
```json
{
  "ru": "Собака",           // Русское название
  "uz": "It"                // Узбекское название
}
```

### Опциональные поля:
```json
{
  "ru": "Собака",
  "uz": "It",
  "description_ru": "Домашнее животное...",    // Описание на русском
  "description_uz": "Uy hayvoni...",            // Описание на узбекском
  "category": "biology",                         // Категория
  "parent_ru": "Животное",                       // Родитель (русское слово)
  "related": ["Кошка", "Хаски"]                 // Связанные слова (русские)
}
```

### Правила:

✅ **ДО:**
```json
[
  { "ru": "Животное", "uz": "Hayvon", "category": "biology" },
  { "ru": "Собака", "uz": "It", "parent_ru": "Животное" }
]
```

❌ **НЕ:ТАК:**
```json
[
  { "ru": "Животное", "lang": "ru" },  // Нужен uz!
  { "ru": "It" },                       // Нужен uz!
  { "parent_id": "12345" }              // Нужен parent_ru!
]
```

---

## 🔍 Что происходит при импорте

### 1️⃣ Валидация
- Проверка обязательных полей (ru, uz)
- Проверка типов данных

### 2️⃣ Нормализация
- Приведение к lowercase: `Собака` → `собака`
- Удаление лишних пробелов

### 3️⃣ Генерация семантических ключей
```
Собака (It) → собит_мозж5тпкепсвж
Бульдог (Buldog) → булбул_мозж5тпке5х44
```

### 4️⃣ Построение иерархии
```
Животное (root)
  └── Собака (parent_semantic_key = животное_key)
      └── Бульдог (parent_semantic_key = собака_key)
      └── Хаски
      └── Овчарка
```

### 5️⃣ Создание графа связей
- Каждое слово из `related` находит свой semantic_key
- Создаются двусторонние связи

### 6️⃣ Сохранение в БД
- Удаляется старая коллекция Words
- Вставляются новые документы с полной иерархией

---

## 📊 API Endpoints

### Импорт
```
POST /api/admin/import/hierarchy
```

### Просмотр иерархии
```
GET /api/admin/hierarchy/structure              # Вся иерархия
GET /api/admin/hierarchy/tree/:semantic_key     # Дерево одного слова
GET /api/admin/hierarchy/stats                  # Статистика
```

### Управление словами
```
POST /api/admin/hierarchy/add-word              # Добавить слово
DELETE /api/admin/hierarchy/:semantic_key       # Удалить слово
```

---

## 🎓 Примеры структур

### Для биологии:
```json
{
  "ru": "Млекопитающие",
  "uz": "Sutemizuvchilar",
  "category": "biology",
  "description_ru": "Класс позвоночных животных...",
  "description_uz": "O'simlik faqatgina..."
}
```

### Для транспорта:
```json
{
  "ru": "Самолёт",
  "uz": "Samolyot",
  "parent_ru": "Транспорт",
  "category": "transport",
  "related": ["Вертолёт", "Дрон"]
}
```

### Для медицины:
```json
{
  "ru": "Инсульт",
  "uz": "Surunchoq",
  "parent_ru": "Болезни мозга",
  "category": "medicine",
  "description_ru": "Острое нарушение мозгового кровообращения..."
}
```

---

## ✅ Чек-лист перед импортом

- [ ] JSON файл валидный (проверьте на jsonlint.com)
- [ ] Все `ru` и `uz` поля заполнены
- [ ] Все `parent_ru` указывают на существующие слова в JSON
- [ ] Нет дублей русских слов (каждое слово должно быть уникально)
- [ ] Категории согласованы (используйте одинаковые названия)
- [ ] Связи (related) логичны и двусторонни

---

## 🐛 Если что-то пошло не так

### Ошибка: "Missing or invalid 'ru' field"
```
❌ Решение: Убедитесь, что каждый объект имеет "ru" и "uz"
```

### Ошибка: "Parent word not found"
```
❌ Решение: Проверьте, что parent_ru указывает на существующее слово в JSON
```

### Ошибка: "Duplicate key error"
```
❌ Решение: Нет дублей русских слов (каждое слово должно быть уникально)
```

### Скрипт не запускается
```bash
# Проверьте переменные окружения
cat .env

# Убедитесь в пути к БД
# Проверьте, что MongoDB запущена
```

---

## 📞 Дальнейшие шаги

1. **Подготовить свой JSON** с вашими данными
2. **Протестировать на примере** (уже есть в `/data/hierarchy_example.json`)
3. **Импортировать в БД** (через скрипт или API)
4. **Использовать API endpoints** для работы с иерархией
5. **Интегрировать с фронтенду** для визуализации

---

## 📚 Дополнительно

- Полная документация: **HIERARCHY_GUIDE.md**
- Пример JSON: **server/data/hierarchy_example.json**
- Тестирование: **node scripts/test_hierarchy.js**

✅ **Система готова к использованию!**
