/**
 * Страница поиска
 * Результаты поиска, карточка слова и граф
 */

import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import SearchBar from '../components/SearchBar';
import WordCard from '../components/WordCard';
import GraphView from '../components/GraphView';
import { searchWords, getWord, getWordTree } from '../services/api';
import { createBreadcrumb } from '../utils/graphHelpers';
import './Search.css';

export default function Search() {
    const [searchParams, setSearchParams] = useSearchParams();
    
    // Состояния
    const [loading, setLoading] = useState(false);
    const [searchResults, setSearchResults] = useState([]);
    const [selectedWord, setSelectedWord] = useState(null);
    const [relatedWord, setRelatedWord] = useState(null);
    const [treeData, setTreeData] = useState(null);
    const [breadcrumb, setBreadcrumb] = useState([]);
    const [error, setError] = useState(null);
    
    // Параметры из URL
    const query = searchParams.get('q') || '';
    const lang = searchParams.get('lang') || 'both';
    
    // Поиск при изменении параметров
    useEffect(() => {
        if (query) {
            performSearch(query, lang);
        }
    }, [query, lang]);
    
    // Функция поиска
    const performSearch = async (q, l) => {
        setLoading(true);
        setError(null);
        setSelectedWord(null);
        setTreeData(null);
        
        try {
            const data = await searchWords(q, l);
            setSearchResults(data.results || []);
            
            // Если найдено одно слово — сразу показываем его
            if (data.results && data.results.length === 1) {
                handleWordSelect(data.results[0].id);
            }
        } catch (err) {
            setError('Ошибка при поиске. Проверьте соединение с сервером.');
            setSearchResults([]);
        } finally {
            setLoading(false);
        }
    };
    
    // Обработка нового поиска
    const handleSearch = (q, l) => {
        setSearchParams({ q, lang: l });
    };
    
    // Выбор слова из результатов
    const handleWordSelect = async (wordId) => {
        setLoading(true);
        
        try {
            // Загружаем слово
            const wordData = await getWord(wordId);
            setSelectedWord(wordData.word);
            setRelatedWord(wordData.relatedWord);
            
            // Загружаем дерево
            const treeResult = await getWordTree(wordId, 3);
            setTreeData(treeResult.tree);
            
            // Формируем breadcrumb
            if (treeResult.tree) {
                const bc = createBreadcrumb(
                    treeResult.tree.hypernyms, 
                    treeResult.tree
                );
                setBreadcrumb(bc);
            }
        } catch (err) {
            setError('Не удалось загрузить данные слова.');
        } finally {
            setLoading(false);
        }
    };
    
    // Клик по узлу графа
    const handleNodeClick = (nodeId) => {
        handleWordSelect(nodeId);
    };
    
    return (
        <div className="search-page">
            {/* Поиск */}
            <div className="search-header">
                <SearchBar 
                    onSearch={handleSearch}
                    initialQuery={query}
                    initialLang={lang}
                    loading={loading}
                />
            </div>
            
            {/* Ошибка */}
            {error && (
                <div className="search-error">
                    <span>⚠️</span> {error}
                </div>
            )}
            
            {/* Контент */}
            <div className="search-content">
                {/* Левая колонка — результаты и карточка */}
                <div className="search-sidebar">
                    {/* Результаты поиска */}
                    {searchResults.length > 0 && (
                        <div className="results-section">
                            <h3 className="section-title">
                                Найдено: {searchResults.length}
                            </h3>
                            <div className="results-list">
                                {searchResults.map(word => (
                                    <button
                                        key={word.id}
                                        className={`result-item ${selectedWord?.id === word.id ? 'active' : ''}`}
                                        onClick={() => handleWordSelect(word.id)}
                                    >
                                        <span className={`lang-badge ${word.language}`}>
                                            {word.language.toUpperCase()}
                                        </span>
                                        <span className="result-word">{word.word}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                    
                    {/* Карточка выбранного слова */}
                    {selectedWord && (
                        <div className="word-section">
                            <WordCard 
                                word={selectedWord}
                                relatedWord={relatedWord}
                                onWordClick={handleWordSelect}
                            />
                        </div>
                    )}
                    
                    {/* Пустой результат */}
                    {!loading && query && searchResults.length === 0 && (
                        <div className="no-results">
                            <p>По запросу «{query}» ничего не найдено</p>
                            <p className="no-results-hint">
                                Попробуйте другое слово или измените язык поиска
                            </p>
                        </div>
                    )}
                </div>
                
                {/* Правая колонка — граф */}
                <div className="search-main">
                    {/* Breadcrumb */}
                    {breadcrumb.length > 0 && (
                        <div className="breadcrumb">
                            {breadcrumb.map((item, index) => (
                                <span key={item.id}>
                                    {index > 0 && <span className="breadcrumb-sep">→</span>}
                                    <button
                                        className={`breadcrumb-item ${item.current ? 'current' : ''}`}
                                        onClick={() => !item.current && handleWordSelect(item.id)}
                                        disabled={item.current}
                                    >
                                        {item.word}
                                    </button>
                                </span>
                            ))}
                        </div>
                    )}
                    
                    {/* Граф */}
                    <GraphView 
                        treeData={treeData}
                        onNodeClick={handleNodeClick}
                    />
                </div>
            </div>
        </div>
    );
}
