import React, { useState, useEffect } from 'react';
import './Admin.css';
import AdminWordsList from '../components/AdminWordsList';
import AdminAddWord from '../components/AdminAddWord';
import AdminEditWord from '../components/AdminEditWord';

/**
 * Admin Dashboard - главная страница админки
 */
export default function Admin() {
    const [activeTab, setActiveTab] = useState('list'); // list, add, edit
    const [selectedWord, setSelectedWord] = useState(null);
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    
    // При выборе слова для редактирования
    const handleSelectWord = (word) => {
        setSelectedWord(word);
        setActiveTab('edit');
    };
    
    // После создания/обновления слова
    const handleWordChanged = () => {
        setRefreshTrigger(prev => prev + 1);
        setActiveTab('list');
    };
    
    return (
        <div className="admin-container">
            <header className="admin-header">
                <h1>⚙️ Администраторская панель</h1>
                <p className="admin-subtitle">Управление словами и связями</p>
            </header>
            
            <div className="admin-tabs">
                <button
                    className={`admin-tab ${activeTab === 'list' ? 'active' : ''}`}
                    onClick={() => setActiveTab('list')}
                >
                    📋 Список слов
                </button>
                <button
                    className={`admin-tab ${activeTab === 'add' ? 'active' : ''}`}
                    onClick={() => setActiveTab('add')}
                >
                    ➕ Добавить слово
                </button>
                {selectedWord && (
                    <button
                        className={`admin-tab ${activeTab === 'edit' ? 'active' : ''}`}
                        onClick={() => setActiveTab('edit')}
                    >
                        ✏️ Редактировать
                    </button>
                )}
            </div>
            
            <div className="admin-content">
                {activeTab === 'list' && (
                    <AdminWordsList 
                        onSelectWord={handleSelectWord}
                        refreshTrigger={refreshTrigger}
                    />
                )}
                
                {activeTab === 'add' && (
                    <AdminAddWord onSuccess={handleWordChanged} />
                )}
                
                {activeTab === 'edit' && selectedWord && (
                    <AdminEditWord 
                        word={selectedWord}
                        onSuccess={handleWordChanged}
                        onCancel={() => {
                            setSelectedWord(null);
                            setActiveTab('list');
                        }}
                    />
                )}
            </div>
        </div>
    );
}
