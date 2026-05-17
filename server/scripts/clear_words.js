const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Word = require('../models/Word');

async function clearWords() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/hyperlexdemo';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB:', mongoUri);

    // Get count before deletion
    const countBefore = await Word.countDocuments();
    console.log(`\nWords in database before: ${countBefore}`);

    // Delete all documents
    const result = await Word.deleteMany({});
    console.log(`\nDeleted ${result.deletedCount} documents`);

    // Get count after deletion
    const countAfter = await Word.countDocuments();
    console.log(`Words in database after: ${countAfter}`);

    await mongoose.disconnect();
    console.log('\nDatabase connection closed.');
    console.log('\n✓ Word collection cleared successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

clearWords();
