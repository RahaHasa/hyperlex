import React, { useState, useEffect } from 'react';
import { Search, RotateCcw, Edit, Trash2, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react';
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
    async function handleDelete(id) {
        if (!window.confirm('Вы уверены? Это удалит слово и все его связи.')) {
            return;
        }
        
        try {
            setDeleting(id);
            await adminAPI.deleteWord(id);
            setWords(words.filter(w => w._id !== id));
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
    const getLanguageClass = (lang) => lang === 'lang_ru' ? 'lang-ru' : 'lang-uz';
    const getLanguageLabel = (lang) => lang === 'lang_ru' ? 'Русский' : 'Узбекский';
    
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
                            <option value="lang_ru">🇷🇺 Русский</option>
                            <option value="lang_uz">🇺🇿 Узбекский</option>
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
                                    <th>Слово</th>
                                    <th>Язык</th>
                                    <th>Определение</th>
                                    <th>Гиперонимы</th>
                                    <th>Гипонимы</th>
                                    <th>Действия</th>
                                </tr>
                            </thead>
                            <tbody>
                                {words.map(word => (
                                    <tr key={word._id} className={`word-row ${getLanguageClass(word.lang)}`}>
                                        <td className="col-id">
                                            <code>{word._id}</code>
                                        </td>
                                        <td className="col-word">
                                            <strong>{word.word}</strong>
                                        </td>
                                        <td className={`col-lang ${getLanguageClass(word.lang)}`}>
                                            <span className="lang-badge">{getLanguageLabel(word.lang)}</span>
                                        </td>
                                        <td className="col-def">
                                            {word.definition ? word.definition.slice(0, 50) + '...' : '—'}
                                        </td>
                                        <td className="col-count">
                                            {word.hypernyms?.length || 0}
                                        </td>
                                        <td className="col-count">
                                            {word.hyponyms?.length || 0}
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
                                                onClick={() => handleDelete(word._id)}
                                                disabled={deleting === word._id}
                                                className="btn-delete"
                                                title="Удалить"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
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
