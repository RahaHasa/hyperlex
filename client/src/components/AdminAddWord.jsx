import React, { useState } from 'react';
import adminAPI from '../services/adminAPI';
import './AdminAddWord.css';

/**
 * Форма добавления нового слова
 */
export default function AdminAddWord({ onSuccess }) {
    const [form, setForm] = useState({
        _id: '',
        word: '',
        lang: 'lang_ru',
        definition: '',
        hypernyms: []
    });
    
    const [hypernymsInput, setHypernymsInput] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);
    
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
            const result = await adminAPI.searchHypernyms(query, form.lang, 5);
            setSuggestions(result.results || []);
        } catch (err) {
            console.error('Ошибка при поиске:', err);
        }
    }
    
    // Добавить гипероним
    function addHypernym(hypernym) {
        if (!form.hypernyms.includes(hypernym._id)) {
            setForm(prev => ({
                ...prev,
                hypernyms: [...prev.hypernyms, hypernym._id]
            }));
        }
        setHypernymsInput('');
        setSuggestions([]);
    }
    
    // Удалить гипероним
    function removeHypernym(id) {
        setForm(prev => ({
            ...prev,
            hypernyms: prev.hypernyms.filter(h => h !== id)
        }));
    }
    
    // Отправка формы
    async function handleSubmit(e) {
        e.preventDefault();
        
        // Валидация
        if (!form._id.trim() || !form.word.trim()) {
            setError('ID и слово обязательны');
            return;
        }
        
        try {
            setLoading(true);
            setError(null);
            
            await adminAPI.createWord(form);
            
            setSuccess(true);
            setTimeout(() => {
                setForm({
                    _id: '',
                    word: '',
                    lang: 'lang_ru',
                    definition: '',
                    hypernyms: []
                });
                setSuccess(false);
                onSuccess();
            }, 1500);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }
    
    return (
        <div className="add-word-form">
            <h2>➕ Добавить новое слово</h2>
            
            {success && (
                <div className="success-message">
                    ✅ Слово успешно добавлено!
                </div>
            )}
            
            {error && (
                <div className="error-message">
                    ❌ {error}
                </div>
            )}
            
            <form onSubmit={handleSubmit} className="form">
                {/* ID */}
                <div className="form-group">
                    <label>ID слова *</label>
                    <input
                        type="text"
                        name="_id"
                        value={form._id}
                        onChange={handleChange}
                        placeholder="ru_001"
                        className="form-input"
                        required
                    />
                    <small>Формат: ru_001, uz_002 и т.д.</small>
                </div>
                
                {/* Само слово */}
                <div className="form-group">
                    <label>Слово *</label>
                    <input
                        type="text"
                        name="word"
                        value={form.word}
                        onChange={handleChange}
                        placeholder="собака"
                        className="form-input"
                        required
                    />
                </div>
                
                {/* Язык */}
                <div className="form-group">
                    <label>Язык *</label>
                    <select
                        name="lang"
                        value={form.lang}
                        onChange={handleChange}
                        className="form-select"
                    >
                        <option value="lang_ru">🇷🇺 Русский</option>
                        <option value="lang_uz">🇺🇿 Узбекский</option>
                    </select>
                </div>
                
                {/* Определение */}
                <div className="form-group">
                    <label>Определение</label>
                    <textarea
                        name="definition"
                        value={form.definition}
                        onChange={handleChange}
                        placeholder="Описание слова..."
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
                                            {sugg.lang?.replace('lang_', '').toUpperCase()}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                    
                    {/* Выбранные гиперонимы */}
                    {form.hypernyms.length > 0 && (
                        <div className="hypernyms-list">
                            {form.hypernyms.map(id => (
                                <span key={id} className="hypernym-tag">
                                    {id}
                                    <button
                                        type="button"
                                        onClick={() => removeHypernym(id)}
                                        className="remove-btn"
                                    >
                                        ✕
                                    </button>
                                </span>
                            ))}
                        </div>
                    )}
                </div>
                
                {/* Кнопки */}
                <div className="form-actions">
                    <button
                        type="submit"
                        disabled={loading}
                        className="btn btn-primary"
                    >
                        {loading ? '⏳ Сохранение...' : '💾 Добавить слово'}
                    </button>
                </div>
            </form>
        </div>
    );
}
