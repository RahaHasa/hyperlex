#!/usr/bin/env node
require('dotenv').config();
const mongoose = require('mongoose');
const path = require('path');

async function main() {
  try {
    const controller = require(path.join(__dirname, '..', 'controllers', 'wordAdminController'));
    const Word = require(path.join(__dirname, '..', 'models', 'Word'));

    const MONGO = process.env.MONGO_URI || process.env.MONGODB_URI || process.env.MONGO_URL || 'mongodb://localhost:27017/hyperlex';
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGO, { });

    // Build fake req/res
    const req = {
      body: {
        batchSize: Number(process.env.AI_LINK_BATCH || 100),
        minConfidence: Number(process.env.AI_LINK_MIN_CONF || 0.75),
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        depth: Number(process.env.AI_LINK_DEPTH || 3)
      }
    };

    let ended = false;
    const events = [];

    const res = {
      headers: {},
      setHeader(k, v) { this.headers[k] = v; },
      write(chunk) {
        try {
          const line = String(chunk).trim();
          if (!line) return;
          const obj = JSON.parse(line);
          events.push(obj);
          if (obj.type === 'progress') {
            console.log(`PROGRESS: ${obj.completedRequests || ''} ${obj.message || ''}`);
          } else if (obj.type === 'start') {
            console.log(`START: totalCount=${obj.totalCount} batchSize=${obj.batchSize}`);
          } else if (obj.type === 'complete') {
            console.log(`COMPLETE: ${obj.totalProcessedWords || obj.totalCount} words, ${obj.totalAppliedLinks || obj.applied || 0} links`);
          } else if (obj.type === 'batch-error' || obj.type === 'error') {
            console.error('ERROR EVENT:', obj.error || obj.message || obj);
          }
        } catch (e) {
          console.log('RAW:', String(chunk));
        }
      },
      end() {
        ended = true;
      }
    };

    console.log('Starting AI linking (this may take long; uses OpenAI API key from .env)');

    await controller.aiLinkHyponymsStream(req, res);

    await new Promise(r => setTimeout(r, 500));

    const start = events.find(e => e.type === 'start');
    const complete = events.reverse().find(e => e.type === 'complete');
    console.log('--- SUMMARY ---');
    if (start) console.log('Total words (approx):', start.totalCount);
    if (complete) console.log('Processed words:', complete.totalProcessedWords, 'Applied links:', complete.totalAppliedLinks);
    console.log('Events captured:', events.length);

    await mongoose.disconnect();
    console.log('Done. Disconnected.');
  } catch (err) {
    console.error('Fatal error:', err && err.message ? err.message : err);
    process.exit(1);
  }
}

main();
