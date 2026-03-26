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
    
    const isRussian = word.language === 'ru';
    
    // Обработчик клика по связанному слову
    const handleRelatedClick = () => {
        if (relatedWord && onWordClick) {
            onWordClick(relatedWord.id);
        }
    };
    
    // Обработчик клика по гиперониму/гипониму
    const handleLinkClick = (id) => {
        if (onWordClick) {
            onWordClick(id);
        }
    };
    
    return (
        <div className={`word-card ${compact ? 'compact' : ''} lang-${word.language}`}>
            {/* Заголовок */}
            <div className="word-card-header">
                <span className={`lang-badge ${word.language}`}>
                    {isRussian ? 'RU' : 'UZ'}
                </span>
                <h3 className="word-card-title">{word.word}</h3>
            </div>
            
            {/* Определение */}
            {word.definition && (
                <p className="word-card-definition">{word.definition}</p>
            )}
            
            {/* Перевод / связанное слово */}
            {relatedWord && (
                <div className="word-card-related" onClick={handleRelatedClick}>
                    <span className="related-label">
                        {isRussian ? "O'zbekcha:" : 'Русский:'}
                    </span>
                    <span className="related-word">{relatedWord.word}</span>
                    <span className={`lang-badge small ${relatedWord.language}`}>
                        {relatedWord.language.toUpperCase()}
                    </span>
                </div>
            )}
            
            {/* Связи */}
            {!compact && (
                <div className="word-card-links">
                    {/* Гиперонимы */}
                    {word.hypernyms && word.hypernyms.length > 0 && (
                        <div className="links-section">
                            <span className="links-label">↑ Гиперонимы:</span>
                            <div className="links-list">
                                {word.hypernyms.map(id => (
                                    <button 
                                        key={id}
                                        className="link-btn hypernym"
                                        onClick={() => handleLinkClick(id)}
                                    >
                                        {id}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                    
                    {/* Гипонимы */}
                    {word.hyponyms && word.hyponyms.length > 0 && (
                        <div className="links-section">
                            <span className="links-label">↓ Гипонимы:</span>
                            <div className="links-list">
                                {word.hyponyms.map(id => (
                                    <button 
                                        key={id}
                                        className="link-btn hyponym"
                                        onClick={() => handleLinkClick(id)}
                                    >
                                        {id}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
            
            {/* ID слова */}
            <div className="word-card-id">
                <code>{word.id}</code>
            </div>
        </div>
    );
}
