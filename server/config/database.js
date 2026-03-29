/**
 * MongoDB Connection Configuration
 */

const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/hyperlex';

async function connectDB() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('✓ Connected to MongoDB');
        return mongoose.connection;
    } catch (error) {
        console.error('✗ MongoDB connection error:', error.message);
        process.exit(1);
    }
}

function disconnectDB() {
    return mongoose.disconnect();
}

module.exports = {
    connectDB,
    disconnectDB,
    mongoose
};
