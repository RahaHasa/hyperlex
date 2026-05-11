/**
 * Initialize Admin - Создание админ пользователя в текущей БД
 * Использование: node init_admin.js
 * 
 * Создаёт админа в БД, указанной в .env (MONGODB_URI)
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const adminData = {
    username: 'admin',
    email: 'admin@hyperlex.com',
    password: 'admin123',
    role: 'admin'
};

async function initializeAdmin() {
    try {
        console.log('\n' + '═'.repeat(60));
        console.log('👤 СОЗДАНИЕ АДМИН ПОЛЬЗОВАТЕЛЯ');
        console.log('═'.repeat(60) + '\n');

        const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/hyperlex';
        
        console.log(`📀 Подключение к MongoDB...`);
        console.log(`   URI: ${mongoUri}`);
        
        await mongoose.connect(mongoUri, {
            serverSelectionTimeoutMS: 5000
        });
        
        const db = mongoose.connection;
        console.log(`✅ Подключено к БД: ${db.name}\n`);

        // Проверяем существование админа
        console.log('🔍 Проверка существующего админа...');
        const existingAdmin = await User.findOne({ email: adminData.email });
        
        if (existingAdmin) {
            console.log(`\n⚠️  Админ уже существует!`);
            console.log(`   Email: ${existingAdmin.email}`);
            console.log(`   Role: ${existingAdmin.role}`);
            console.log(`   Created: ${existingAdmin.createdAt.toLocaleString('ru-RU')}\n`);
            process.exit(0);
        }
        
        console.log('✅ Админ не найден\n');

        // Создаём админа
        console.log('👤 Создание админ пользователя...');
        const admin = new User(adminData);
        
        await admin.save();
        console.log('✅ Админ создан успешно!\n');

        // Вывод информации
        console.log('═'.repeat(60));
        console.log('📋 АДМИН ПОЛЬЗОВАТЕЛЬ:');
        console.log('═'.repeat(60));
        console.log(`\n📀 БД:              ${db.name}`);
        console.log(`\n👤 Учётные данные:`);
        console.log(`   ├─ Email:       ${admin.email}`);
        console.log(`   ├─ Username:    ${admin.username}`);
        console.log(`   ├─ Role:        ${admin.role}`);
        console.log(`   └─ Created:     ${admin.createdAt.toLocaleString('ru-RU')}`);
        console.log(`\n🔐 Пароль:         ${adminData.password}`);
        console.log('\n═'.repeat(60));
        console.log('✅ ✅ ✅ АДМИН УСПЕШНО СОЗДАН ✅ ✅ ✅');
        console.log('═'.repeat(60) + '\n');

        process.exit(0);

    } catch (error) {
        console.error('\n' + '═'.repeat(60));
        console.error('❌ ОШИБКА:');
        console.error('═'.repeat(60));
        console.error(`\n${error.message}\n`);

        if (error.message.includes('ECONNREFUSED')) {
            console.log('💡 MongoDB не запущена!\n');
            console.log('   Запустите MongoDB:');
            console.log('   $ docker run -d -p 27017:27017 --name hyperlex-mongodb mongo:latest\n');
        }

        process.exit(1);
    }
}

initializeAdmin();
