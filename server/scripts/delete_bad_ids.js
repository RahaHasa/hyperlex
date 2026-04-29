/**
 * Delete Word documents with bad/non-normalized IDs (containing slugs like ru_NNN_word or uz_NNN_word)
 * Preview mode by default. Set DELETE=true to actually delete.
 * Usage:
 *  node server/scripts/delete_bad_ids.js
 *  DELETE=true node server/scripts/delete_bad_ids.js
 */

require('dotenv').config();
const { connectDB, disconnectDB } = require('../config/database');
const Word = require('../models/Word');

async function run() {
  await connectDB();
  try {
    // Pattern for bad IDs: ru_NNN_* or uz_NNN_* (they have slug suffix)
    // Good IDs: ru_000001 or uz_000001 (just prefix_number)
    const badIdPattern = /^(ru|uz)_\d+_/;
    
    console.log('Finding documents with bad IDs...');
    const docs = await Word.find({}).select('_id lang').lean();
    
    const badIds = [];
    for (const doc of docs) {
      if (badIdPattern.test(doc._id)) {
        badIds.push(doc._id);
      }
    }
    
    console.log(`Found ${badIds.length} documents with bad IDs out of ${docs.length} total.`);
    console.log(`\nSample bad IDs (first 10):`);
    badIds.slice(0, 10).forEach(id => console.log(`  ${id}`));
    
    const deleteMode = String(process.env.DELETE || 'false').toLowerCase() === 'true';
    if (!deleteMode) {
      console.log('\nPreview mode ON — no deletions will be made.');
      console.log('To delete these documents, run: DELETE=true node server/scripts/delete_bad_ids.js');
      await disconnectDB();
      return;
    }
    
    // Actually delete
    console.log('\nDeleting bad ID documents...');
    const BATCH = 1000;
    for (let i = 0; i < badIds.length; i += BATCH) {
      const chunk = badIds.slice(i, i + BATCH);
      const result = await Word.deleteMany({ _id: { $in: chunk } });
      console.log(`Deleted batch ${i}-${i + chunk.length}: ${result.deletedCount} documents`);
    }
    
    const finalCount = await Word.countDocuments();
    console.log(`\n✅ Deletion complete. Documents remaining in DB: ${finalCount}`);
    await disconnectDB();
  } catch (err) {
    console.error('Error:', err);
    await disconnectDB();
    process.exit(1);
  }
}

run();
