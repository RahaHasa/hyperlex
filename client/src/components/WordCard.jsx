/**
 * Компонент карточки слова
 * Отображает информацию о слове: определение, переводы, связи
 */

import './WordCard.css';

export default function WordCard({ 
    word, 
    relatedWord = null,
    onWordClick,
    compact = false 
}) {
    if (!word) return null;
    
    const isRussian = word.ru && word.ru.match(/[а-яё]/i);
    
    // Обработчик клика по связанному слову
    const handleRelatedClick = () => {
        if (relatedWord && onWordClick) {
            onWordClick(relatedWord);
        }
    };
    
    // Обработчик клика по гиперониму/гипониму
    const handleLinkClick = (semanticKey) => {
        if (onWordClick) {
            onWordClick(semanticKey);
        }
    };

    return (
        <div className={`word-card ${compact ? 'compact' : ''}`}>
            {/* Заголовок */}
            <div className="word-card-header">
                <span style={{
                    background: isRussian ? 'rgba(45, 90, 39, 0.1)' : 'rgba(179, 90, 58, 0.1)',
                    color: isRussian ? '#2d5a27' : '#b35a3a',
                    padding: '0.25rem 0.5rem',
                    borderRadius: '4px',
                    fontWeight: 500,
                    fontSize: '0.85rem'
                }}>
                    {isRussian ? '🇷🇺 RU' : '🇺🇿 UZ'}
                </span>
                <h3 className="word-card-title">
                    <strong>{word.ru || '—'}</strong>
                    {word.uz && <span style={{color: '#7f8c8d', fontSize: '0.9rem', marginLeft: '0.5rem'}}>({word.uz})</span>}
                </h3>
            </div>
            
            {/* Категория */}
            <div style={{marginBottom: '1rem'}}>
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
            </div>
            
            {/* Определение */}
            {word.description_ru && (
                <p className="word-card-definition">{word.description_ru}</p>
            )}
            
            {/* Связи */}
            {!compact && (
                <div className="word-card-links">
                    {/* Гипонимы (дочерние слова) */}
                    {word.children_semantic_keys && word.children_semantic_keys.length > 0 && (
                        <div className="links-section">
                            <span className="links-label">↓ Частные виды ({word.children_semantic_keys.length}):</span>
                            <div className="links-list">
                                {word.children_semantic_keys.slice(0, 5).map(key => (
                                    <button 
                                        key={key}
                                        className="link-btn hyponym"
                                        onClick={() => handleLinkClick(key)}
                                    >
                                        {key}
                                    </button>
                                ))}
                                {word.children_semantic_keys.length > 5 && (
                                    <span style={{fontSize: '0.85rem', color: '#7f8c8d'}}>
                                        +{word.children_semantic_keys.length - 5} ещё
                                    </span>
                                )}
                            </div>
                        </div>
                    )}
                    
                    {/* Гиперонимы (родительское слово) */}
                    {word.parent_semantic_key && (
                        <div className="links-section">
                            <span className="links-label">↑ Общее понятие:</span>
                            <div className="links-list">
                                <button 
                                    className="link-btn hypernym"
                                    onClick={() => handleLinkClick(word.parent_semantic_key)}
                                >
                                    {word.parent_semantic_key}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
            
            {/* ID слова */}
            <div className="word-card-id">
                <code>{word.semantic_key || word._id}</code>
            </div>
        </div>
    );
}
