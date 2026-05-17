const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Word = require('../models/Word');

async function loadAllData() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/hyperlexdemo';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB:', mongoUri);

    const dataDir = path.join(__dirname, '../data/data');
    const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.json'));
    
    console.log(`\nFound ${files.length} JSON files to load:\n`);
    
    let totalLoaded = 0;
    const results = [];

    for (const file of files) {
      const filePath = path.join(dataDir, file);
      console.log(`Loading: ${file}...`);
      
      try {
        const rawData = fs.readFileSync(filePath, 'utf8');
        const data = JSON.parse(rawData);
        
        let entries = [];
        if (Array.isArray(data)) {
          entries = data;
        } else if (typeof data === 'object') {
          entries = Object.entries(data).map(([key, value]) => {
            return {
              semantic_key: key,
              ...value
            };
          });
        }
        
        if (entries.length === 0) {
          console.log(`  ⚠️  No entries found in ${file}\n`);
          results.push({ file, count: 0, status: 'empty' });
          continue;
        }
        
        // Insert or update words
        let insertedCount = 0;
        for (const entry of entries) {
          try {
            // Ensure semantic_key is set
            if (!entry.semantic_key && entry.semantic_key !== '') {
              console.warn(`  Warning: No semantic_key in entry from ${file}:`, entry);
              continue;
            }
            
            await Word.findOneAndUpdate(
              { semantic_key: entry.semantic_key },
              { $set: entry },
              { upsert: true, new: true }
            );
            insertedCount++;
          } catch (err) {
            console.error(`  Error inserting entry:`, err.message);
          }
        }
        
        totalLoaded += insertedCount;
        console.log(`  ✓ Loaded ${insertedCount} entries from ${file}`);
        results.push({ file, count: insertedCount, status: 'success' });
      } catch (err) {
        console.error(`  ✗ Error processing ${file}:`, err.message);
        results.push({ file, count: 0, status: 'error', error: err.message });
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('SUMMARY');
    console.log('='.repeat(60));
    
    for (const result of results) {
      const icon = result.status === 'success' ? '✓' : result.status === 'empty' ? '⚠' : '✗';
      console.log(`${icon} ${result.file.padEnd(30)} ${result.count} entries`);
    }
    
    console.log('='.repeat(60));
    console.log(`Total words loaded: ${totalLoaded}`);
    
    // Verify count in database
    const dbCount = await Word.countDocuments();
    console.log(`Total words in database: ${dbCount}`);
    
    await mongoose.disconnect();
    console.log('\nDatabase connection closed.');
    process.exit(0);
  } catch (err) {
    console.error('Fatal error:', err);
    process.exit(1);
  }
}

loadAllData();
