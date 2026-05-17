const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Word = require('../models/Word');
const semanticHelper = require('../utils/semanticHelper');

async function loadAndLinkData() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/hyperlexdemo';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB:', mongoUri);

    const dataDir = path.join(__dirname, '../data/data');
    const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.json'));
    
    console.log(`\nFound ${files.length} JSON files to load.\n`);
    
    let allEntries = [];

    // Load all JSONs
    for (const file of files) {
      const filePath = path.join(dataDir, file);
      try {
        const rawData = fs.readFileSync(filePath, 'utf8');
        const data = JSON.parse(rawData);
        
        let fileEntries = [];
        if (Array.isArray(data)) {
            fileEntries = data;
        } else if (typeof data === 'object') {
            fileEntries = Object.entries(data).map(([key, value]) => {
                return {
                    semantic_key: key,
                    ...value
                };
            });
        }
        allEntries = allEntries.concat(fileEntries);
        console.log(`Read ${fileEntries.length} entries from ${file}`);
      } catch (err) {
        console.error(`Error processing ${file}:`, err.message);
      }
    }
    
    console.log(`\nTotal parsed entries from files: ${allEntries.length}`);

    // Build the semantic graph to resolve parents, children, and related references
    console.log('\nBuilding semantic graph and resolving links...');
    const graph = semanticHelper.buildSemanticGraph(allEntries);
    
    const graphKeys = Object.keys(graph);
    console.log(`Graph built with ${graphKeys.length} nodes (unique semantic keys).`);

    let insertedCount = 0;
    
    // Clear words before loading to ensure clean state
    await Word.deleteMany({});
    console.log('Cleared existing Word collection before bulk insert.');

    for (const key of graphKeys) {
        let node = graph[key];
        try {
            await Word.create(node);
            insertedCount++;
        } catch (err) {
            console.error(`Error inserting node ${key}:`, err.message);
        }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('SUMMARY');
    console.log('='.repeat(60));
    console.log(`Fully linked words loaded & saved: ${insertedCount}`);
    
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

loadAndLinkData();
