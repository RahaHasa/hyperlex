import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Users, Plus, Edit, AlertCircle } from 'lucide-react';
import './Admin.css';
import AdminWordsList from '../components/AdminWordsList';
import AdminAddWord from '../components/AdminAddWord';
import AdminEditWord from '../components/AdminEditWord';

/**
 * Admin Words Dashboard - управление словами
 */
export default function AdminWords() {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('list'); // list, add, edit
    const [selectedWord, setSelectedWord] = useState(null);
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [isAdmin, setIsAdmin] = useState(false);
    const [loading, setLoading] = useState(true);
    
    // Проверка прав доступа
    useEffect(() => {
        const token = localStorage.getItem('token');
        const userData = localStorage.getItem('user');
        
        if (!token) {
            navigate('/login');
            return;
        }
        
        // Проверяем админ статус
        if (userData) {
            try {
                const user = JSON.parse(userData);
                if (user.role !== 'admin') {
                    navigate('/');
                    return;
                }
                setIsAdmin(true);
            } catch (e) {
                console.error('Parse user error:', e);
                navigate('/login');
            }
        }
        setLoading(false);
    }, [navigate]);
    
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
    
    if (loading) {
        return (
            <div className="admin-loading">
                <div>Загрузка...</div>
            </div>
        );
    }
    
    if (!isAdmin) {
        return (
            <div className="admin-error-page">
                <AlertCircle size={48} />
                <div>У вас нет доступа к админ панели</div>
            </div>
        );
    }
    
    return (
        <div className="admin-container">
            <header className="admin-header">
                <div className="admin-header-content">
                    <BookOpen size={32} className="admin-icon" />
                    <div>
                        <h1>Управление словами</h1>
                        <p className="admin-subtitle">Создание и редактирование связей гиперонимов</p>
                    </div>
                </div>
            </header>
            
            <nav className="admin-nav-buttons">
                <button 
                    className="admin-nav-btn"
                    onClick={() => navigate('/admin')}
                >
                    <Users size={20} />
                    Пользователи
                </button>
                <button 
                    className="admin-nav-btn active"
                    onClick={() => navigate('/admin/words')}
                >
                    <BookOpen size={20} />
                    Управление словами
                </button>
            </nav>
            
            <div className="admin-tabs">
                <button
                    className={`admin-tab ${activeTab === 'list' ? 'active' : ''}`}
                    onClick={() => setActiveTab('list')}
                >
                    <BookOpen size={18} />
                    Список слов
                </button>
                <button
                    className={`admin-tab ${activeTab === 'add' ? 'active' : ''}`}
                    onClick={() => setActiveTab('add')}
                >
                    <Plus size={18} />
                    Добавить слово
                </button>
                {selectedWord && (
                    <button
                        className={`admin-tab ${activeTab === 'edit' ? 'active' : ''}`}
                        onClick={() => setActiveTab('edit')}
                    >
                        <Edit size={18} />
                        Редактировать
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
