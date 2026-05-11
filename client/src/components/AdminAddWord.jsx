import React, { useState, useEffect } from 'react';
import adminAPI from '../services/adminAPI';
import './AdminAddWord.css';

/**
 * Генерирует semantic_key из русского и узбекского слов
 */
function generateSemanticKey(ru, uz) {
    if (!ru || !uz) return '';
    
    // Берём первые 3 символа русского слова (или меньше если короче)
    const ruPrefix = ru.toLowerCase().substring(0, 3).padEnd(3, '_');
    
    // Уникальный идентификатор (timestamp + случайное число)
    const timestamp = Date.now().toString(36).substring(2, 8);
    const random = Math.random().toString(36).substring(2, 5);
    
    return `${ruPrefix}_${timestamp}_${random}`;
}

/**
 * Форма добавления нового слова в иерархию
 */
export default function AdminAddWord({ onSuccess }) {
    const [form, setForm] = useState({
        ru: '',
        uz: '',
        description_ru: '',
        description_uz: '',
        category: 'general',
        parent_ru: '',
        related: []
    });
    
    const [availableWords, setAvailableWords] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [semanticKey, setSemanticKey] = useState('');
    
    // Загрузить список существующих слов для выбора родителя
    useEffect(() => {
        loadWords();
    }, []);
    
    // Обновить semantic_key при изменении ru/uz
    useEffect(() => {
        if (form.ru && form.uz) {
            const key = generateSemanticKey(form.ru, form.uz);
            setSemanticKey(key);
        } else {
            setSemanticKey('');
        }
    }, [form.ru, form.uz]);
    
    async function loadWords() {
        try {
            const result = await adminAPI.getHierarchyStructure();
            const words = flattenWords(result.data || []);
            setAvailableWords(words);
        } catch (err) {
            console.error('Ошибка загрузки слов:', err);
        }
    }
    
    // Преобразует иерархию в плоский список
    function flattenWords(words, prefix = '') {
        let result = [];
        for (const word of words) {
            result.push({
                ru: word.ru,
                label: prefix ? `${prefix} → ${word.ru}` : word.ru
            });
            if (word.children && word.children.length > 0) {
                result = result.concat(
                    flattenWords(
                        word.children,
                        prefix ? `${prefix} → ${word.ru}` : word.ru
                    )
                );
            }
        }
        return result;
    }
    
    function handleChange(e) {
        const { name, value } = e.target;
        setForm(prev => ({
            ...prev,
            [name]: value
        }));
    }
    
    async function handleSubmit(e) {
        e.preventDefault();
        setError('');
        setSuccess('');
        
        // Валидация
        if (!form.ru.trim()) {
            setError('❌ Введите русское слово');
            return;
        }
        if (!form.uz.trim()) {
            setError('❌ Введите узбекское слово');
            return;
        }
        
        setLoading(true);
        
        try {
            const payload = {
                ru: form.ru.trim(),
                uz: form.uz.trim(),
                description_ru: form.description_ru.trim() || undefined,
                description_uz: form.description_uz.trim() || undefined,
                category: form.category.trim() || 'general',
                parent_ru: form.parent_ru.trim() || undefined,
                related: form.related.filter(r => r.trim())
            };
            
            await adminAPI.addWordToHierarchy(payload);
            
            setSuccess(`✅ Слово "${form.ru}" успешно добавлено!`);
            
            // Очистить форму
            setForm({
                ru: '',
                uz: '',
                description_ru: '',
                description_uz: '',
                category: 'general',
                parent_ru: '',
                related: []
            });
            setSemanticKey('');
            
            // Перезагрузить список слов
            await loadWords();
            
            // Callback
            if (onSuccess) onSuccess();
            
            // Очистить успех через 3 сек
            setTimeout(() => setSuccess(''), 3000);
        } catch (err) {
            setError(`❌ Ошибка: ${err.response?.data?.message || err.message}`);
        } finally {
            setLoading(false);
        }
    }
    
    return (
        <div className="admin-add-word-container">
            <div className="admin-add-word-form-wrapper">
                {/* Левая часть - информация */}
                <div className="admin-add-word-info">
                    <h3>📋 Ключ слова</h3>
                    <div className="semantic-key-display">
                        {semanticKey ? (
                            <>
                                <code>{semanticKey}</code>
                                <p className="info-text">
                                    Генерируется автоматически из русского и узбекского слов.
                                    Уникально идентифицирует это слово в иерархии.
                                </p>
                            </>
                        ) : (
                            <p className="info-placeholder">Введите русское и узбекское слово для генерации ключа</p>
                        )}
                    </div>
                </div>

                {/* Правая часть - форма */}
                <form onSubmit={handleSubmit} className="admin-add-word-form">
                    <h2>➕ Добавить новое слово</h2>

                    {/* Сообщения */}
                    {error && (
                        <div className="admin-add-word-message error">
                            {error}
                        </div>
                    )}
                    {success && (
                        <div className="admin-add-word-message success">
                            {success}
                        </div>
                    )}

                    {/* Основные поля */}
                    <div className="form-group">
                        <label htmlFor="ru">
                            🇷🇺 Русское слово <span className="required">*</span>
                        </label>
                        <input
                            type="text"
                            id="ru"
                            name="ru"
                            value={form.ru}
                            onChange={handleChange}
                            placeholder="например: Животное"
                            disabled={loading}
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="uz">
                            🇺🇿 Узбекское слово <span className="required">*</span>
                        </label>
                        <input
                            type="text"
                            id="uz"
                            name="uz"
                            value={form.uz}
                            onChange={handleChange}
                            placeholder="например: Hayvon"
                            disabled={loading}
                        />
                    </div>

                    {/* Описания */}
                    <div className="form-row">
                        <div className="form-group">
                            <label htmlFor="description_ru">
                                📝 Описание на русском
                            </label>
                            <textarea
                                id="description_ru"
                                name="description_ru"
                                value={form.description_ru}
                                onChange={handleChange}
                                placeholder="Дополнительное описание или определение"
                                rows="3"
                                disabled={loading}
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="description_uz">
                                📝 Описание на узбекском
                            </label>
                            <textarea
                                id="description_uz"
                                name="description_uz"
                                value={form.description_uz}
                                onChange={handleChange}
                                placeholder="Qoʻshimcha tavsif yoki taʼrif"
                                rows="3"
                                disabled={loading}
                            />
                        </div>
                    </div>

                    {/* Категория и родитель */}
                    <div className="form-row">
                        <div className="form-group">
                            <label htmlFor="category">
                                🏷️ Категория
                            </label>
                            <input
                                type="text"
                                id="category"
                                name="category"
                                value={form.category}
                                onChange={handleChange}
                                placeholder="например: biology"
                                disabled={loading}
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="parent_ru">
                                👨‍👧 Родитель (слово)
                            </label>
                            <select
                                id="parent_ru"
                                name="parent_ru"
                                value={form.parent_ru}
                                onChange={handleChange}
                                disabled={loading}
                            >
                                <option value="">— Не выбран —</option>
                                {availableWords.map((word, idx) => (
                                    <option key={idx} value={word.ru}>
                                        {word.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Кнопки */}
                    <div className="form-actions">
                        <button
                            type="submit"
                            className="btn-primary"
                            disabled={loading || !form.ru || !form.uz}
                        >
                            {loading ? '⏳ Добавляю...' : '✅ Добавить слово'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
