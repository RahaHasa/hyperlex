/**
 * Preview script for normalizing `_id` values for `Word` documents.
 * Runs in preview mode by default. To perform full migration set PREVIEW=false and confirm.
 * Usage:
 *  PREVIEW=true node server/scripts/normalize_ids_preview.js
 *  PREVIEW=false CONFIRM=true node server/scripts/normalize_ids_preview.js
 */

require('dotenv').config();
const { connectDB, disconnectDB } = require('../config/database');
const Word = require('../models/Word');

function zeroPad(n, width = 6) { return String(n).padStart(width, '0'); }

async function run() {
  await connectDB();
  try {
    console.log('Reading all Word documents (ids only)...');
    const docs = await Word.find({}, { _id: 1, lang: 1 }).lean();
    console.log('Total docs:', docs.length);

    const counters = { lang_ru: 0, lang_uz: 0 };
    const mapping = {}; // oldId -> newId

    for (const d of docs) {
      const oldId = d._id;
      const lang = d.lang === 'lang_uz' ? 'lang_uz' : 'lang_ru';
      counters[lang]++;
      const prefix = lang === 'lang_uz' ? 'uz' : 'ru';
      const newId = `${prefix}_${zeroPad(counters[lang])}`;
      mapping[oldId] = newId;
    }

    const totalRu = counters.lang_ru;
    const totalUz = counters.lang_uz;
    console.log(`Preview: will rename ${totalRu} Russian and ${totalUz} Uzbek documents.`);

    // show first 20 mappings sample
    console.log('\nSample mappings (first 20):');
    let shown = 0;
    for (const oldId of Object.keys(mapping)) {
      console.log(`${oldId} -> ${mapping[oldId]}`);
      shown++;
      if (shown >= 20) break;
    }

    const preview = String(process.env.PREVIEW || 'true').toLowerCase() === 'true';
    if (preview) {
      console.log('\nPreview mode ON — no changes will be made.');
      console.log('To run the migration set PREVIEW=false and ensure you have a backup.');
      await disconnectDB();
      return;
    }

    // If not preview, require explicit confirmation via env CONFIRM=true
    const confirm = String(process.env.CONFIRM || 'false').toLowerCase() === 'true';
    if (!confirm) {
      console.log('\nMigration cancelled — set CONFIRM=true to proceed when ready.');
      await disconnectDB();
      return;
    }

    console.log('\nStarting migration (this will create new docs with new _id and update references)...');

    // Phase 1: create new documents with new _id and store oldId field
    const BATCH = 1000;
    const all = await Word.find({}).lean();
    for (let i = 0; i < all.length; i += BATCH) {
      const slice = all.slice(i, i + BATCH);
      const inserts = slice.map(doc => {
        const oldId = doc._id;
        const newId = mapping[oldId];
        const copy = Object.assign({}, doc);
        copy._id = newId;
        copy.oldId = oldId;
        // keep original relations as-is (they point to oldIds); we'll update in phase 2
        return copy;
      });
      try {
        await Word.insertMany(inserts, { ordered: false });
      } catch (e) {
        // ignore duplicate key errors
      }
      console.log('Inserted batch', i, '-', i + inserts.length);
    }

    // Phase 2: update references in new documents to point to newIds
    console.log('Updating relations to new IDs...');
    const bulk = [];
    const cursor = Word.find({ oldId: { $exists: true } }).cursor();
    for await (const doc of cursor) {
      const newHyper = (doc.hypernyms || []).map(x => mapping[x] || x);
      const newHypo = (doc.hyponyms || []).map(x => mapping[x] || x);
      const newRelated = { ...doc.related };
      if (doc.related) {
        if (doc.related.ru) newRelated.ru = mapping[doc.related.ru] || doc.related.ru;
        if (doc.related.uz) newRelated.uz = mapping[doc.related.uz] || doc.related.uz;
      }
      bulk.push({ updateOne: { filter: { _id: doc._id }, update: { $set: { hypernyms: newHyper, hyponyms: newHypo, related: newRelated } } } });
      if (bulk.length >= 500) {
        await Word.bulkWrite(bulk);
        bulk.length = 0;
      }
    }
    if (bulk.length) await Word.bulkWrite(bulk);

    // Phase 3: remove old documents
    const oldIds = Object.keys(mapping);
    console.log('Removing old documents...');
    for (let i = 0; i < oldIds.length; i += BATCH) {
      const chunk = oldIds.slice(i, i + BATCH);
      await Word.deleteMany({ _id: { $in: chunk } });
      console.log('Deleted old batch', i, '-', i + chunk.length);
    }

    console.log('Migration complete. New docs created, references updated, old docs removed.');
    await disconnectDB();
  } catch (err) {
    console.error('Error:', err);
    await disconnectDB();
    process.exit(1);
  }
}

run();
