/**
 * Компонент поисковой строки
 * Поиск слов с выбором языка
 */

import { useState, useEffect } from 'react';
import './SearchBar.css';

export default function SearchBar({ 
    onSearch, 
    initialQuery = '', 
    initialLang = 'both',
    loading = false,
    size = 'normal' // 'normal' | 'large'
}) {
    const [query, setQuery] = useState(initialQuery);
    const [lang, setLang] = useState(initialLang);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 640);
    
    // Отслеживаем размер экрана
    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth < 640);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);
    
    // Обработка отправки формы
    const handleSubmit = (e) => {
        e.preventDefault();
        if (query.trim() && onSearch) {
            onSearch(query.trim(), lang);
        }
    };
    
    // Языки для переключателя
    const languages = [
        { code: 'both', label: 'Оба', short: 'все' },
        { code: 'ru', label: 'Русский', short: 'ru' },
        { code: 'uz', label: "O'zbek", short: 'uz' }
    ];
    
    return (
        <form 
            className={`search-bar ${size === 'large' ? 'search-bar-large' : ''}`}
            onSubmit={handleSubmit}
        >
            {/* Поле ввода */}
            <div className="search-input-wrap">
                <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="8"/>
                    <path d="M21 21l-4.35-4.35"/>
                </svg>
                <input
                    type="text"
                    className="search-input"
                    placeholder="Введите слово для поиска..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    disabled={loading}
                    autoFocus={size === 'large'}
                />
                {query && (
                    <button 
                        type="button" 
                        className="search-clear"
                        onClick={() => setQuery('')}
                        aria-label="Очистить"
                    >
                        ×
                    </button>
                )}
            </div>
            
            {/* Переключатель языка */}
            <div className="search-lang-switch">
                {languages.map(l => (
                    <button
                        key={l.code}
                        type="button"
                        className={`lang-btn ${lang === l.code ? 'active' : ''} ${l.code}`}
                        onClick={() => setLang(l.code)}
                        disabled={loading}
                        title={l.label}
                    >
                        {isMobile || size !== 'large' ? l.short : l.label}
                    </button>
                ))}
            </div>
            
            {/* Кнопка поиска */}
            <button 
                type="submit" 
                className="search-btn"
                disabled={loading || !query.trim()}
            >
                {loading ? (
                    <span className="loader"></span>
                ) : (
                    <svg className="search-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="11" cy="11" r="8"/>
                        <path d="M21 21l-4.35-4.35"/>
                    </svg>
                )}
            </button>
        </form>
    );
}
