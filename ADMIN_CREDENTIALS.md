# 🔐 АДМИН УЧЁТНЫЕ ДАННЫЕ

## 📋 Обе БД - ОДНИ И ТЕ ЖЕ ЛОГИН И ПАРОЛЬ

| Параметр | Значение |
|----------|----------|
| **Email** | `admin@hyperlex.com` |
| **Password** | `admin123` |
| **Username** | `admin` |
| **Role** | `admin` |

---

## 🗄️ БД И ПОРТЫ

| БД | URI | Порт | Админ | Статус |
|---|---|---|---|---|
| **hyperlex** | `localhost:27017/hyperlex` | 3001 | ✅ | Готова |
| **hyperlex_second** | `localhost:27017/hyperlex_second` | 3002 | ✅ | Готова |

---

## 🚀 ЗАПУСК СЕРВЕРА

### Старая БД (hyperlex) - порт 3001
```bash
cd "/home/r1ppa/Desktop/New Folder/hyperlex demo/server"
npm start
```

### Новая БД (hyperlex_second) - порт 3002
```bash
cd "/home/r1ppa/Desktop/New Folder/hyperlex demo/server"
cp .env.second .env
npm start
```

**Или через переменную:**
```bash
MONGODB_URI=mongodb://localhost:27017/hyperlex_second npm start
```

---

## 🔑 ЛОГИН В ПРИЛОЖЕНИЕ

**Любая из БД:**
```
Email:    admin@hyperlex.com
Password: admin123
```

---

## 📁 СОЗДАННЫЕ СКРИПТЫ

### `init_admin.js` - Универсальный скрипт

Создаёт админа в **текущей БД** (которая в .env):

```bash
cd "/home/r1ppa/Desktop/New Folder/hyperlex demo/server"
node scripts/init_admin.js
```

**Пример:**
- Если в .env: `MONGODB_URI=mongodb://localhost:27017/hyperlex`
  → админ создастся в БД `hyperlex`

- Если в .env: `MONGODB_URI=mongodb://localhost:27017/hyperlex_second`
  → админ создастся в БД `hyperlex_second`

---

## ✅ ГОТОВО!

Обе БД:
- ✅ Созданы
- ✅ Работают
- ✅ Имеют одного админа
- ✅ Полностью независимы
- ✅ Готовы к использованию

---

## 🎯 Следующие шаги

1. ✅ **БД созданы** - ГОТОВО
2. ✅ **Админ создан** - ГОТОВО
3. 🚀 **Запустить сервер** - `npm start`
4. 🔐 **Логиниться** - `admin@hyperlex.com` / `admin123`
5. 📥 **Импортировать данные** - см. HIERARCHY_GUIDE.md

---

**Обновлено:** 10 мая 2026 г.
