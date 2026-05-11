/**
 * Initialize Script - Создание новой БД и админ пользователя
 * Использование: node init_hyperlex_second.js
 * 
 * Предварительно убедитесь, что MongoDB запущена:
 * - Локально: mongod
 * - Docker: docker-compose -f docker-compose-mongodb.yml up -d
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

// Новая БД
const MONGODB_URI = process.env.MONGODB_URI_SECOND || 'mongodb://localhost:27017/hyperlex_second';

const adminData = {
    username: 'admin',
    email: 'admin@hyperlex.com',
    password: 'admin123',
    role: 'admin'
};

async function initializeDatabase() {
    try {
        console.log('\n' + '═'.repeat(60));
        console.log('🔧 ИНИЦИАЛИЗАЦИЯ НОВОЙ БД "hyperlex_second"');
        console.log('═'.repeat(60) + '\n');

        // Подключаемся к новой БД
        console.log(`📀 Подключение к MongoDB...`);
        console.log(`   URI: ${MONGODB_URI}`);
        
        await mongoose.connect(MONGODB_URI, {
            serverSelectionTimeoutMS: 5000
        });
        
        console.log('✅ БД подключена успешно\n');

        // Получаем информацию о БД
        const db = mongoose.connection;
        console.log(`🎯 БД: ${db.name}`);
        console.log(`🌐 Хост: ${db.host}\n`);

        // Проверяем, существует ли уже админ
        console.log('🔍 Проверка существующего админа...');
        const existingAdmin = await User.findOne({ email: adminData.email });
        
        if (existingAdmin) {
            console.log(`❌ Админ уже существует: ${adminData.email}`);
            console.log('\n⚠️  Если хотите пересоздать админа:');
            console.log('   1. Удалите пользователя из БД');
            console.log('   2. Запустите скрипт снова');
            process.exit(1);
        }
        
        console.log('✅ Админ не найден\n');

        // Создаём админ пользователя
        console.log('👤 Создание админ пользователя...');
        const admin = new User(adminData);
        
        await admin.save();
        console.log('✅ Админ создан успешно!\n');

        // Выводим информацию
        console.log('═'.repeat(60));
        console.log('📋 ИНФОРМАЦИЯ О НОВОЙ БД:');
        console.log('═'.repeat(60));
        console.log(`\n📀 Имя БД:          hyperlex_second`);
        console.log(`🌐 MongoDB URI:     ${MONGODB_URI}`);
        console.log(`\n👤 АДМИН ПОЛЬЗОВАТЕЛЬ:`);
        console.log(`   ├─ Email:       ${admin.email}`);
        console.log(`   ├─ Username:    ${admin.username}`);
        console.log(`   ├─ Role:        ${admin.role}`);
        console.log(`   └─ Created:     ${admin.createdAt.toLocaleString('ru-RU')}`);
        console.log(`\n🔐 ДАННЫЕ ДЛЯ ЛОГИНА:`);
        console.log(`   ├─ Email:       ${admin.email}`);
        console.log(`   └─ Password:    ${adminData.password}`);
        console.log('\n═'.repeat(60));

        // Инструкции по использованию
        console.log('\n⚙️  ИНСТРУКЦИИ ПО ИСПОЛЬЗОВАНИЮ:\n');
        
        console.log('1️⃣  ЕСЛИ MongoDB ЗАПУЩЕНА ЛОКАЛЬНО (mongod):');
        console.log(`   Просто используйте новый .env.second файл\n`);
        
        console.log('2️⃣  ЗАПУСК СЕРВЕРА С НОВОЙ БД:\n');
        console.log('   Вариант A - через .env файл:');
        console.log('   $ cp .env.second .env');
        console.log('   $ npm start\n');
        
        console.log('   Вариант B - через переменную окружения:');
        console.log(`   $ MONGODB_URI=${MONGODB_URI} npm start\n`);
        
        console.log('3️⃣  ЕСЛИ MongoDB ИЩЕ НЕ ЗАПУЩЕНА (Docker):');
        console.log('   $ docker-compose -f docker-compose-mongodb.yml up -d');
        console.log('   Затем повторите скрипт инициализации\n');
        
        console.log('4️⃣  ЛОГИН В ПРИЛОЖЕНИЕ:');
        console.log(`   Email:    ${admin.email}`);
        console.log(`   Password: ${adminData.password}\n`);

        console.log('═'.repeat(60));
        console.log('✅ ✅ ✅ ИНИЦИАЛИЗАЦИЯ ЗАВЕРШЕНА ✅ ✅ ✅');
        console.log('═'.repeat(60) + '\n');

        process.exit(0);

    } catch (error) {
        console.error('\n' + '═'.repeat(60));
        console.error('❌ ОШИБКА ПОДКЛЮЧЕНИЯ:');
        console.error('═'.repeat(60));
        console.error(`\n${error.message}\n`);

        if (error.message.includes('ECONNREFUSED')) {
            console.log('💡 MongoDB не запущена!\n');
            console.log('   Запустите MongoDB одним из способов:\n');
            console.log('   1️⃣  Локально (macOS/Linux):');
            console.log('       $ mongod\n');
            console.log('   2️⃣  Docker Compose:');
            console.log('       $ docker-compose -f docker-compose-mongodb.yml up -d\n');
            console.log('   3️⃣  Docker:');
            console.log('       $ docker run -d -p 27017:27017 --name mongodb mongo\n');
        }

        if (error.stack) {
            console.log('Stack trace:');
            console.error(error.stack);
        }
        
        process.exit(1);
    }
}

// Запускаем инициализацию
initializeDatabase();
