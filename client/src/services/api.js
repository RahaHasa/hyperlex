/**
 * API сервис для взаимодействия с backend
 * Содержит все методы для работы с данными гиперонимов/гипонимов
 */

import axios from 'axios';

// Базовый URL API
const API_BASE = '/api';

// Создаём инстанс axios с настройками
const api = axios.create({
    baseURL: API_BASE,
    timeout: 10000,
    headers: {
        'Content-Type': 'application/json'
    }
});

// Перехватчик для обработки ошибок
api.interceptors.response.use(
    response => response.data,
    error => {
        console.error('API Error:', error.response?.data || error.message);
        return Promise.reject(error.response?.data || { error: 'Ошибка соединения с сервером' });
    }
);

/**
 * Поиск слов по запросу
 * @param {string} query - Поисковый запрос
 * @param {string} lang - Язык: 'ru', 'uz' или 'both'
 */
export async function searchWords(query, lang = 'both') {
    return api.get('/search', { params: { q: query, lang } });
}

/**
 * Получение слова по ID
 * @param {string} id - ID слова
 */
export async function getWord(id) {
    return api.get(`/word/${id}`);
}

/**
 * Получение дерева слова (гиперонимы + гипонимы)
 * @param {string} id - ID слова
 * @param {number} depth - Глубина дерева
 */
export async function getWordTree(id, depth = 3) {
    return api.get(`/word/${id}/tree`, { params: { depth } });
}

/**
 * Сравнение двух слов
 * @param {string} ruId - ID русского слова
 * @param {string} uzId - ID узбекского слова
 */
export async function compareWords(ruId, uzId) {
    return api.get('/compare', { params: { ru: ruId, uz: uzId } });
}

/**
 * Получение списка языков
 */
export async function getLanguages() {
    return api.get('/languages');
}

/**
 * Получение статистики базы
 */
export async function getStats() {
    return api.get('/stats');
}

// === АДМИН API ===

/**
 * Получение всех слов
 * @param {string} lang - Язык фильтрации
 */
export async function getAllWords(lang = 'both') {
    return api.get('/admin/words', { params: { lang } });
}

/**
 * Добавление нового слова
 * @param {Object} wordData - Данные слова
 */
export async function addWord(wordData) {
    return api.post('/admin/word', wordData);
}

/**
 * Обновление слова
 * @param {string} id - ID слова
 * @param {Object} updates - Обновления
 */
export async function updateWord(id, updates) {
    return api.put(`/admin/word/${id}`, updates);
}

/**
 * Удаление слова
 * @param {string} id - ID слова
 */
export async function deleteWord(id) {
    return api.delete(`/admin/word/${id}`);
}

/**
 * Экспорт всей базы
 */
export async function exportData() {
    return api.get('/admin/export');
}

/**
 * Импорт данных
 * @param {Object} data - Данные для импорта
 */
export async function importData(data) {
    return api.post('/admin/import', data);
}

// Экспорт всех методов как объект
export default {
    searchWords,
    getWord,
    getWordTree,
    compareWords,
    getLanguages,
    getStats,
    getAllWords,
    addWord,
    updateWord,
    deleteWord,
    exportData,
    importData
};
