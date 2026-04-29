#!/usr/bin/env node
/**
 * Перевод 70k узбекских слов на русский через OpenAI API
 * и создание полных двусторонних пар
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Word = require('../models/Word');
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/hyperlex';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

if (!OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY не установлен в .env');
    process.exit(1);
}

/**
 * Запрос к OpenAI для перевода батча узбекских слов
 */
async function translateBatchOpenAI(words) {
    const systemPrompt = `You are a professional translator specializing in Uzbek-Russian translation.
Your task is to provide accurate Russian translations for given Uzbek words.
Return STRICT JSON ONLY in this format:
{
  "translations": [
    {"uz_word": "узбекское_слово", "ru_word": "русское_слово", "is_valid": true}
  ]
}
Rules:
- Only translate single words (no phrases)
- Provide the most common/natural translation
- Set is_valid=false if word is untranslatable or ambiguous
- Never add explanations or extra text
- Return valid JSON only`;

    const userPrompt = `Translate these Uzbek words to Russian:\n${words.map(w => `- ${w}`).join('\n')}`;

    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: OPENAI_MODEL,
                temperature: 0.1,
                response_format: { type: 'json_object' },
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ]
            })
        });

        const payload = await response.json();
        
        if (!response.ok) {
            const errorMsg = payload?.error?.message || `OpenAI error ${response.status}`;
            throw new Error(errorMsg);
        }

        const content = payload?.choices?.[0]?.message?.content;
        if (!content) {
            throw new Error('Empty response from OpenAI');
        }

        const parsed = JSON.parse(content);
        if (!parsed.translations || !Array.isArray(parsed.translations)) {
            throw new Error('Invalid response format from OpenAI');
        }

        return parsed.translations;
    } catch (error) {
        console.error(`❌ OpenAI error: ${error.message}`);
        throw error;
    }
}

async function processTranslationBatch(batch, options) {
    const {
        nextRuNumberRef,
        createdRef,
        skippedRef,
        existingRuIds
    } = options;

    if (batch.length === 0) {
        return;
    }

    try {
        const translations = await translateBatchOpenAI(batch.map(word => word.word));

        for (let j = 0; j < batch.length; j++) {
            const uzWord = batch[j];
            const translation = translations[j];

            if (!translation || !translation.is_valid) {
                console.log(`   ⏭️  Пропущено: "${uzWord.word}" (не переводимо)`);
                skippedRef.value++;
                continue;
            }

            try {
                const ruWordText = translation.ru_word.trim();
                const preferredRuId = uzWord.related?.ru && !existingRuIds.has(uzWord.related.ru)
                    ? uzWord.related.ru
                    : null;

                let ruWord = await Word.findOne({ word: ruWordText, lang: 'lang_ru' });

                if (!ruWord) {
                    const ruId = preferredRuId || `ru_${String(nextRuNumberRef.value).padStart(6, '0')}`;
                    ruWord = new Word({
                        _id: ruId,
                        word: ruWordText,
                        lang: 'lang_ru',
                        definition: '',
                        related: { uz: uzWord._id }
                    });
                    await ruWord.save();
                    if (!preferredRuId) {
                        nextRuNumberRef.value++;
                    }
                    existingRuIds.add(ruWord._id);
                } else {
                    ruWord.related.uz = uzWord._id;
                    await ruWord.save();
                    existingRuIds.add(ruWord._id);
                }

                await Word.updateOne(
                    { _id: uzWord._id },
                    { $set: { 'related.ru': ruWord._id } }
                );

                createdRef.value++;
            } catch (wordError) {
                console.log(`   ⚠️  Ошибка "${uzWord.word}": ${wordError.message}`);
                skippedRef.value++;
            }
        }

        return;
    } catch (batchError) {
        if (batch.length <= 250) {
            throw batchError;
        }

        const mid = Math.floor(batch.length / 2);
        await processTranslationBatch(batch.slice(0, mid), options);
        await processTranslationBatch(batch.slice(mid), options);
    }
}

async function main() {
    try {
        console.log('🔗 Подключение к MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Подключено\n');

        const existingRuIds = new Set(
            (await Word.find({ lang: 'lang_ru' }).select('_id').lean()).map(word => word._id)
        );

        // Получаем все УЗ слова БЕЗ РУ пары или с битой РУ-ссылкой
        console.log('📖 Загрузка УЗ слов без RU-пары или с битой RU-ссылкой...');
        const uzWordsWithoutRu = (await Word.find({ lang: 'lang_uz' })
            .select('_id word related')
            .lean()).filter(word => {
                const ruId = word.related?.ru;
                return !ruId || !existingRuIds.has(ruId);
            });

        console.log(`   Найдено: ${uzWordsWithoutRu.length}\n`);

        if (uzWordsWithoutRu.length === 0) {
            console.log('ℹ️  Все УЗ слова уже имеют РУ пары');
            await mongoose.connection.close();
            process.exit(0);
        }

        // Параметры батча
        const BATCH_SIZE = 2000;
        const DELAY_BETWEEN_BATCHES = 0;

        let created = 0;
        let skipped = 0;
        let nextRuNumber = 1;
    const createdRef = { value: 0 };
    const skippedRef = { value: 0 };
    const nextRuNumberRef = { value: 1 };

        // Получаем максимальный номер РУ слова
        const lastRuWord = await Word.findOne({ lang: 'lang_ru' }).sort({ _id: -1 }).select('_id');
        if (lastRuWord && lastRuWord._id.startsWith('ru_')) {
            const num = parseInt(lastRuWord._id.replace('ru_', ''), 10);
            if (!isNaN(num)) {
                nextRuNumber = num + 1;
            }
        }

        console.log('🚀 ПЕРЕВОД И СОЗДАНИЕ ПАР\n');

        // Батчим УЗ слова
        for (let i = 0; i < uzWordsWithoutRu.length; i += BATCH_SIZE) {
            const batch = uzWordsWithoutRu.slice(i, i + BATCH_SIZE);
            const batchWords = batch.map(w => w.word);

            console.log(`📦 Батч ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(uzWordsWithoutRu.length / BATCH_SIZE)} (слова ${i + 1}-${Math.min(i + BATCH_SIZE, uzWordsWithoutRu.length)})`);

            try {
                // Переводим батч
                const translations = await translateBatchOpenAI(batchWords);

                // Обрабатываем переводы
                for (let j = 0; j < batch.length; j++) {
                    const uzWord = batch[j];
                    const translation = translations[j];

                    if (!translation || !translation.is_valid) {
                        console.log(`   ⏭️  Пропущено: "${uzWord.word}" (не переводимо)`);
                        skipped++;
                        continue;
                    }

                    try {
                        const ruWordText = translation.ru_word.trim();
                        const preferredRuId = uzWord.related?.ru && !existingRuIds.has(uzWord.related.ru)
                            ? uzWord.related.ru
                            : null;

                        // Проверяем, нет ли уже такого РУ слова
                        let ruWord = await Word.findOne({ word: ruWordText, lang: 'lang_ru' });

                        if (!ruWord) {
                            // Создаем новое РУ слово
                            const ruId = preferredRuId || `ru_${String(nextRuNumber).padStart(6, '0')}`;
                            ruWord = new Word({
                                _id: ruId,
                                word: ruWordText,
                                lang: 'lang_ru',
                                definition: '',
                                related: { uz: uzWord._id }
                            });
                            await ruWord.save();
                            if (!preferredRuId) {
                                nextRuNumber++;
                            }
                            existingRuIds.add(ruWord._id);
                        } else {
                            // Обновляем существующее РУ слово
                            ruWord.related.uz = uzWord._id;
                            await ruWord.save();
                            existingRuIds.add(ruWord._id);
                        }

                        // Обновляем УЗ слово со ссылкой на РУ
                        await Word.updateOne(
                            { _id: uzWord._id },
                            { $set: { 'related.ru': ruWord._id } }
                        );

                        created++;
                    } catch (wordError) {
                        console.log(`   ⚠️  Ошибка "${uzWord.word}": ${wordError.message}`);
                                        // Переводим и обрабатываем батч, при слишком большом ответе OpenAI дробим автоматически
                                        await processTranslationBatch(batch, {
                                            nextRuNumberRef,
                                            createdRef,
                                            skippedRef,
                                            existingRuIds
                                        });
                        skipped++;
                    }
                }

                console.log(`   ✅ Обработано ${batch.length}, создано пар: ${created}, пропущено: ${skipped}\n`);
                console.log(`   ✅ Обработано ${batch.length}, создано пар: ${createdRef.value}, пропущено: ${skippedRef.value}\n`);

                // Задержка между батчами для соблюдения rate limits
                if (i + BATCH_SIZE < uzWordsWithoutRu.length) {
                    await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
                }
            } catch (batchError) {
                console.error(`   ❌ Ошибка батча: ${batchError.message}`);
                console.error(`   ⏭️  Пропускаю батч из ${batch.length} слов\n`);
                skipped += batch.length;
                            skippedRef.value += batch.length;
            }
        }

        console.log('\n📊 ОЧИСТКА НЕПАРНЫХ СЛОВ');

        // Удаляем УЗ слова БЕЗ РУ пары
        const uzUnpaired = await Word.deleteMany({
            lang: 'lang_uz',
            $or: [
                { 'related.ru': null },
                { 'related.ru': undefined }
            ]
        });
        console.log(`   🗑️  Удалено УЗ без пары: ${uzUnpaired.deletedCount}`);

        // Удаляем РУ слова БЕЗ УЗ пары
        const ruUnpaired = await Word.deleteMany({
            lang: 'lang_ru',
            $or: [
                { 'related.uz': null },
                { 'related.uz': undefined }
            ]
        });
        console.log(`   🗑️  Удалено РУ без пары: ${ruUnpaired.deletedCount}\n`);

        // Финальная статистика
        const finalUz = await Word.countDocuments({ lang: 'lang_uz' });
        const finalRu = await Word.countDocuments({ lang: 'lang_ru' });
        const pairedUz = await Word.countDocuments({
            lang: 'lang_uz',
            'related.ru': { $ne: null }
        });
        const pairedRu = await Word.countDocuments({
            lang: 'lang_ru',
            'related.uz': { $ne: null }
        });

        console.log('📊 ФИНАЛЬНАЯ СТАТИСТИКА');
        console.log(`   УЗ слов в базе: ${finalUz}`);
        console.log(`   РУ слов в базе: ${finalRu}`);
        console.log(`   УЗ с полными парами: ${pairedUz}`);
        console.log(`   РУ с полными парами: ${pairedRu}`);
        console.log(`   Создано пар: ${created}`);
        console.log(`   Пропущено: ${skipped}`);
    console.log(`   Создано пар: ${createdRef.value}`);
    console.log(`   Пропущено: ${skippedRef.value}`);

        if (finalUz === finalRu && finalUz === pairedUz && finalRu === pairedRu) {
            console.log(`\n✅ Идеально! Все слова имеют взаимные пары!`);
        } else {
            console.log(`\n⚠️  Внимание: Есть непарные слова. Проверьте данные.`);
        }

        console.log(`\n✅ Перевод завершен!`);

        await mongoose.connection.close();
        process.exit(0);
    } catch (error) {
        console.error('❌ Критическая ошибка:', error.message);
        await mongoose.connection.close();
        process.exit(1);
    }
}

main();
