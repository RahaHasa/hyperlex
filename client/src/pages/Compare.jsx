/**
 * Страница сравнения
 * Параллельное отображение деревьев русского и узбекского языков
 */

import { useState } from 'react';
import SearchBar from '../components/SearchBar';
import GraphView from '../components/GraphView';
import WordCard from '../components/WordCard';
import { searchWords, compareWords, getWordTree } from '../services/api';
import './Compare.css';

export default function Compare() {
    // Состояния для русского
    const [ruSearch, setRuSearch] = useState('');
    const [ruResults, setRuResults] = useState([]);
    const [ruWord, setRuWord] = useState(null);
    const [ruTree, setRuTree] = useState(null);
    
    // Состояния для узбекского
    const [uzSearch, setUzSearch] = useState('');
    const [uzResults, setUzResults] = useState([]);
    const [uzWord, setUzWord] = useState(null);
    const [uzTree, setUzTree] = useState(null);
    
    const [loading, setLoading] = useState(false);
    
    // Поиск слова на русском
    const handleRuSearch = async (query) => {
        setLoading(true);
        try {
            const data = await searchWords(query, 'ru');
            setRuResults(data.results || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };
    
    // Поиск слова на узбекском
    const handleUzSearch = async (query) => {
        setLoading(true);
        try {
            const data = await searchWords(query, 'uz');
            setUzResults(data.results || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };
    
    // Выбор русского слова
    const selectRuWord = async (word) => {
        setRuWord(word);
        setRuResults([]);
        
        try {
            const treeData = await getWordTree(word.id, 3);
            setRuTree(treeData.tree);
            
            // Если есть связанное узбекское слово — загружаем его
            if (word.related_uz && !uzWord) {
                const uzTreeData = await getWordTree(word.related_uz, 3);
                if (uzTreeData.tree) {
                    setUzWord(uzTreeData.tree.center);
                    setUzTree(uzTreeData.tree);
                }
            }
        } catch (err) {
            console.error(err);
        }
    };
    
    // Выбор узбекского слова
    const selectUzWord = async (word) => {
        setUzWord(word);
        setUzResults([]);
        
        try {
            const treeData = await getWordTree(word.id, 3);
            setUzTree(treeData.tree);
            
            // Если есть связанное русское слово — загружаем его
            if (word.related_ru && !ruWord) {
                const ruTreeData = await getWordTree(word.related_ru, 3);
                if (ruTreeData.tree) {
                    setRuWord(ruTreeData.tree.center);
                    setRuTree(ruTreeData.tree);
                }
            }
        } catch (err) {
            console.error(err);
        }
    };
    
    // Клик по узлу в русском графе
    const handleRuNodeClick = async (nodeId) => {
        const treeData = await getWordTree(nodeId, 3);
        if (treeData.tree) {
            setRuWord(treeData.tree.center);
            setRuTree(treeData.tree);
        }
    };
    
    // Клик по узлу в узбекском графе
    const handleUzNodeClick = async (nodeId) => {
        const treeData = await getWordTree(nodeId, 3);
        if (treeData.tree) {
            setUzWord(treeData.tree.center);
            setUzTree(treeData.tree);
        }
    };
    
    // Сброс
    const handleReset = () => {
        setRuWord(null);
        setRuTree(null);
        setUzWord(null);
        setUzTree(null);
        setRuResults([]);
        setUzResults([]);
    };
    
    return (
        <div className="compare-page">
            <div className="compare-header">
                <h1>Сравнение языков</h1>
                <p>Сопоставьте структуры гиперонимов русского и узбекского языков</p>
                {(ruWord || uzWord) && (
                    <button className="btn btn-secondary" onClick={handleReset}>
                        Сбросить
                    </button>
                )}
            </div>
            
            <div className="compare-grid">
                {/* Русский */}
                <div className="compare-column ru">
                    <div className="column-header">
                        <span className="lang-badge ru">RU</span>
                        <h2>Русский</h2>
                    </div>
                    
                    {/* Поиск */}
                    <div className="column-search">
                        <input
                            type="text"
                            placeholder="Введите слово..."
                            value={ruSearch}
                            onChange={(e) => setRuSearch(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleRuSearch(ruSearch)}
                        />
                        <button 
                            className="btn btn-primary"
                            onClick={() => handleRuSearch(ruSearch)}
                            disabled={!ruSearch.trim()}
                        >
                            Найти
                        </button>
                    </div>
                    
                    {/* Результаты поиска */}
                    {ruResults.length > 0 && (
                        <div className="search-results">
                            {ruResults.map(w => (
                                <button 
                                    key={w.id} 
                                    className="result-btn"
                                    onClick={() => selectRuWord(w)}
                                >
                                    {w.word}
                                </button>
                            ))}
                        </div>
                    )}
                    
                    {/* Карточка */}
                    {ruWord && (
                        <WordCard word={ruWord} compact onWordClick={handleRuNodeClick} />
                    )}
                    
                    {/* Граф */}
                    <div className="column-graph">
                        <GraphView 
                            treeData={ruTree}
                            onNodeClick={handleRuNodeClick}
                            height={400}
                        />
                    </div>
                </div>
                
                {/* Узбекский */}
                <div className="compare-column uz">
                    <div className="column-header">
                        <span className="lang-badge uz">UZ</span>
                        <h2>O'zbek</h2>
                    </div>
                    
                    {/* Поиск */}
                    <div className="column-search">
                        <input
                            type="text"
                            placeholder="So'z kiriting..."
                            value={uzSearch}
                            onChange={(e) => setUzSearch(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleUzSearch(uzSearch)}
                        />
                        <button 
                            className="btn btn-primary"
                            onClick={() => handleUzSearch(uzSearch)}
                            disabled={!uzSearch.trim()}
                        >
                            Izlash
                        </button>
                    </div>
                    
                    {/* Результаты поиска */}
                    {uzResults.length > 0 && (
                        <div className="search-results">
                            {uzResults.map(w => (
                                <button 
                                    key={w.id} 
                                    className="result-btn"
                                    onClick={() => selectUzWord(w)}
                                >
                                    {w.word}
                                </button>
                            ))}
                        </div>
                    )}
                    
                    {/* Карточка */}
                    {uzWord && (
                        <WordCard word={uzWord} compact onWordClick={handleUzNodeClick} />
                    )}
                    
                    {/* Граф */}
                    <div className="column-graph">
                        <GraphView 
                            treeData={uzTree}
                            onNodeClick={handleUzNodeClick}
                            height={400}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
