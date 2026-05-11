import React, { useState, useEffect } from 'react';
import { Search, RotateCcw, Edit, Trash2, ChevronLeft, ChevronRight, AlertCircle, RefreshCw } from 'lucide-react';
import adminAPI from '../services/adminAPI';
import './AdminWordsList.css';

/**
 * Список слов в админке
 */
export default function AdminWordsList({ onSelectWord, refreshTrigger }) {
    const [words, setWords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [search, setSearch] = useState('');
    const [language, setLanguage] = useState('');
    const [page, setPage] = useState(0);
    const [total, setTotal] = useState(0);
    const [deleting, setDeleting] = useState(null);
    
    const LIMIT = 20;
    
    // Загрузка слов
    useEffect(() => {
        loadWords();
    }, [page, search, language, refreshTrigger]);
    
    async function loadWords() {
        try {
            setLoading(true);
            setError(null);
            
            const result = await adminAPI.getAllWords({
                skip: page * LIMIT,
                limit: LIMIT,
                search: search || undefined,
                lang: language || undefined
            });
            
            setWords(result.words || []);
            setTotal(result.total || 0);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }
    
    // Удаление слова
    async function handleDelete(word) {
        if (!window.confirm('Вы уверены? Это удалит слово и все его связи.')) {
            return;
        }
        
        try {
            setDeleting(word.semantic_key);
            await adminAPI.deleteWordFromHierarchy(word.semantic_key);
            setWords(words.filter(w => w._id !== word._id));
            setTotal(total - 1);
        } catch (err) {
            alert(`Ошибка: ${err.message}`);
        } finally {
            setDeleting(null);
        }
    }
    
    // Сброс фильтров
    function handleReset() {
        setSearch('');
        setLanguage('');
        setPage(0);
    }
    
    const totalPages = Math.ceil(total / LIMIT);
    
    return (
        <div className="words-list">
            {/* Фильтры */}
            <div className="filters-section">
                <div className="filters-header">
                    <Search size={20} />
                    <h3>Фильтры</h3>
                </div>
                <div className="filters-grid">
                    <div className="filter-group">
                        <label>Поиск слова</label>
                        <input
                            type="text"
                            placeholder="Введите слово..."
                            value={search}
                            onChange={(e) => {
                                setSearch(e.target.value);
                                setPage(0);
                            }}
                            className="filter-input"
                        />
                    </div>
                    
                    <div className="filter-group">
                        <label>Язык</label>
                        <select
                            value={language}
                            onChange={(e) => {
                                setLanguage(e.target.value);
                                setPage(0);
                            }}
                            className="filter-select"
                        >
                            <option value="">Все языки</option>
                            <option value="ru">🇷🇺 Русский</option>
                            <option value="uz">🇺🇿 Узбекский</option>
                        </select>
                    </div>
                    
                    <button onClick={handleReset} className="btn-reset">
                        <RotateCcw size={18} />
                        Сброс
                    </button>
                </div>
                <p className="results-info">
                    Найдено: <strong>{total}</strong> слов
                    {total > LIMIT && ` (показано ${words.length})`}
                </p>
            </div>
            
            {/* Таблица слов */}
            {loading ? (
                <div className="loading">Загрузка...</div>
            ) : error ? (
                <div className="error">
                    <AlertCircle size={20} />
                    {error}
                </div>
            ) : words.length === 0 ? (
                <div className="empty">Слов не найдено</div>
            ) : (
                <>
                    <div className="words-table-container">
                        <table className="words-table">
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Слово (РУ/УЗ)</th>
                                    <th>Язык</th>
                                    <th>Категория</th>
                                    <th>Описание</th>
                                    <th>Гиперонимы</th>
                                    <th>Гипонимы</th>
                                    <th>Действия</th>
                                </tr>
                            </thead>
                            <tbody>
                                {words.map(word => {
                                    // Определяем язык по наличию русского слова
                                    const lang = word.ru && word.ru.match(/[а-яё]/i) ? 'Русский' : 'Узбекский';
                                    return (
                                    <tr key={word._id}>
                                        <td className="col-id">
                                            <code>{word.semantic_key || word._id}</code>
                                        </td>
                                        <td className="col-word">
                                            <strong>{word.ru || '—'}</strong>
                                            <br />
                                            <span style={{color: '#7f8c8d', fontSize: '0.85rem'}}>
                                                {word.uz || '—'}
                                            </span>
                                        </td>
                                        <td className="col-lang">
                                            <span style={{
                                                background: lang === 'Русский' ? 'rgba(45, 90, 39, 0.1)' : 'rgba(179, 90, 58, 0.1)',
                                                color: lang === 'Русский' ? '#2d5a27' : '#b35a3a',
                                                padding: '0.25rem 0.5rem',
                                                borderRadius: '4px',
                                                fontWeight: 500,
                                                fontSize: '0.85rem'
                                            }}>
                                                {lang === 'Русский' ? '🇷🇺' : '🇺🇿'} {lang}
                                            </span>
                                        </td>
                                        <td className="col-category">
                                            <span style={{
                                                background: '#f0f7ed',
                                                color: '#2d5a27',
                                                padding: '0.25rem 0.5rem',
                                                borderRadius: '4px',
                                                fontWeight: 500,
                                                fontSize: '0.85rem'
                                            }}>
                                                {word.category || 'general'}
                                            </span>
                                        </td>
                                        <td className="col-def">
                                            {word.description_ru ? word.description_ru.slice(0, 60) + '...' : '—'}
                                        </td>
                                        <td className="col-count">
                                            {word.children_semantic_keys?.length || 0}
                                        </td>
                                        <td className="col-count">
                                            {word.parent_semantic_key ? 1 : 0}
                                        </td>
                                        <td className="col-actions">
                                            <button
                                                onClick={() => onSelectWord(word)}
                                                className="btn-edit"
                                                title="Редактировать"
                                            >
                                                <Edit size={18} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(word)}
                                                disabled={deleting === word.semantic_key}
                                                className="btn-delete"
                                                title="Удалить"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </td>
                                    </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    
                    {/* Пагинация */}
                    {totalPages > 1 && (
                        <div className="pagination">
                            <button
                                onClick={() => setPage(p => Math.max(0, p - 1))}
                                disabled={page === 0}
                                className="btn-page"
                            >
                                <ChevronLeft size={18} />
                                Предыдущая
                            </button>
                            
                            <span className="page-info">
                                Страница {page + 1} из {totalPages}
                            </span>
                            
                            <button
                                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                                disabled={page >= totalPages - 1}
                                className="btn-page"
                            >
                                Следующая
                                <ChevronRight size={18} />
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
