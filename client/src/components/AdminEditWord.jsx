import React, { useState, useEffect } from 'react';
import adminAPI from '../services/adminAPI';
import './AdminEditWord.css';

/**
 * Форма редактирования слова
 */
export default function AdminEditWord({ word, onSuccess, onCancel }) {
    const [form, setForm] = useState({
        word: '',
        definition: '',
        hypernyms: [],
        hyponyms: []
    });
    
    const [hypernymsInput, setHypernymsInput] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);
    
    // Инициализация формы
    useEffect(() => {
        if (word) {
            setForm({
                word: word.word || '',
                definition: word.definition || '',
                hypernyms: word.hypernyms || [],
                hyponyms: word.hyponyms || []
            });
        }
    }, [word]);
    
    // Обновление основных полей
    function handleChange(e) {
        const { name, value } = e.target;
        setForm(prev => ({ ...prev, [name]: value }));
    }
    
    // Поиск гиперонимов для автозаполнения
    async function handleHypernymsInputChange(e) {
        const query = e.target.value;
        setHypernymsInput(query);
        
        if (query.length < 2) {
            setSuggestions([]);
            return;
        }
        
        try {
            const result = await adminAPI.searchHypernyms(query, word.language, 5);
            setSuggestions(result.results || []);
        } catch (err) {
            console.error('Ошибка при поиске:', err);
        }
    }
    
    // Добавить гипероним
    function addHypernym(hypernym) {
        // Если это объект с _id, берём _id, иначе берём весь объект
        const id = hypernym._id || hypernym;
        if (!form.hypernyms.includes(id)) {
            setForm(prev => ({
                ...prev,
                hypernyms: [...prev.hypernyms, id]
            }));
        }
        setHypernymsInput('');
        setSuggestions([]);
    }
    
    // Удалить гипероним
    function removeHypernym(id) {
        setForm(prev => ({
            ...prev,
            hypernyms: prev.hypernyms.filter(h => h !== id && h._id !== id)
        }));
    }
    
    // Отправка формы
    async function handleSubmit(e) {
        e.preventDefault();
        
        try {
            setLoading(true);
            setError(null);
            
            await adminAPI.updateWord(word._id, form);
            
            setSuccess(true);
            setTimeout(() => {
                setSuccess(false);
                onSuccess();
            }, 1500);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }
    
    if (!word) {
        return <div className="empty">Слово не выбрано</div>;
    }
    
    return (
        <div className="edit-word-form">
            <div className="edit-header">
                <h2>✏️ Редактировать слово</h2>
                <code className="word-id">{word._id}</code>
            </div>
            
            {success && (
                <div className="success-message">
                    ✅ Слово успешно обновлено!
                </div>
            )}
            
            {error && (
                <div className="error-message">
                    ❌ {error}
                </div>
            )}
            
            <form onSubmit={handleSubmit} className="form">
                {/* Само слово */}
                <div className="form-group">
                    <label>Слово</label>
                    <input
                        type="text"
                        name="word"
                        value={form.word}
                        onChange={handleChange}
                        className="form-input"
                    />
                </div>
                
                {/* Язык (не редактируется) */}
                <div className="form-group">
                    <label>Язык</label>
                    <div className="form-static">
                        {word.lang === 'lang_ru' ? '🇷🇺' : '🇺🇿'} {word.lang === 'lang_ru' ? 'RU' : 'UZ'}
                    </div>
                </div>
                
                {/* Определение */}
                <div className="form-group">
                    <label>Определение</label>
                    <textarea
                        name="definition"
                        value={form.definition}
                        onChange={handleChange}
                        className="form-textarea"
                        rows="4"
                    />
                </div>
                
                {/* Гиперонимы */}
                <div className="form-group">
                    <label>Гиперонимы (родительские слова)</label>
                    
                    <div className="hypernyms-input-wrapper">
                        <input
                            type="text"
                            value={hypernymsInput}
                            onChange={handleHypernymsInputChange}
                            placeholder="Начните вводить слово..."
                            className="form-input"
                        />
                        
                        {suggestions.length > 0 && (
                            <ul className="suggestions-list">
                                {suggestions.map(sugg => (
                                    <li
                                        key={sugg._id}
                                        onClick={() => addHypernym(sugg)}
                                        className="suggestion-item"
                                    >
                                        <strong>{sugg.word}</strong>
                                        <span className="lang-badge">
                                            {sugg.language.toUpperCase()}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                    
                    {/* Выбранные гиперонимы */}
                    {form.hypernyms.length > 0 && (
                        <div className="hypernyms-list">
                            {form.hypernyms.map(hypernym => {
                                const id = hypernym._id || hypernym;
                                const displayText = hypernym.word ? 
                                    `${hypernym.word} (${hypernym.language})` : 
                                    id;
                                
                                return (
                                    <span key={id} className="hypernym-tag">
                                        {displayText}
                                        <button
                                            type="button"
                                            onClick={() => removeHypernym(id)}
                                            className="remove-btn"
                                        >
                                            ✕
                                        </button>
                                    </span>
                                );
                            })}
                        </div>
                    )}
                </div>
                
                {/* Гипонимы (только просмотр) */}
                {form.hyponyms.length > 0 && (
                    <div className="form-group">
                        <label>Гипонимы (дочерние слова)</label>
                        <div className="hyponyms-list">
                            {form.hyponyms.map(hyponym => {
                                const id = hyponym._id || hyponym;
                                const displayText = hyponym.word ? 
                                    `${hyponym.word} (${hyponym.language})` : 
                                    id;
                                
                                return (
                                    <span key={id} className="hyponym-tag">
                                        {displayText}
                                    </span>
                                );
                            })}
                        </div>
                        <small>💡 Гипонимы обновляются автоматически при изменении гиперонимов</small>
                    </div>
                )}
                
                {/* Кнопки */}
                <div className="form-actions">
                    <button
                        type="submit"
                        disabled={loading}
                        className="btn btn-primary"
                    >
                        {loading ? '⏳ Сохранение...' : '💾 Обновить'}
                    </button>
                    <button
                        type="button"
                        onClick={onCancel}
                        className="btn btn-secondary"
                    >
                        ❌ Отмена
                    </button>
                </div>
            </form>
        </div>
    );
}
