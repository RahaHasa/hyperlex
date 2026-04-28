import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Users, Plus, Edit, AlertCircle, Upload, Wand2, FileText } from 'lucide-react';
import './Admin.css';
import adminAPI from '../services/adminAPI';
import AdminWordsList from '../components/AdminWordsList';
import AdminAddWord from '../components/AdminAddWord';
import AdminEditWord from '../components/AdminEditWord';
import AdminImport from '../components/AdminImport';

/**
 * Admin Words Dashboard - управление словами
 */
export default function AdminWords() {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('list'); // list, add, edit, import
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
    
    const [generatingAI, setGeneratingAI] = useState(false);

    const handleAIGenerateDescriptions = async () => {
        if (!window.confirm('Попросить ИИ сгенерировать описания для русских и узбекских слов?\n(Убедитесь что в .env указан OPENAI_API_KEY)')) return;
        try {
            setGeneratingAI(true);
            const [ruRes, uzRes] = await Promise.all([
                adminAPI.aiGenerateDescriptions({ lang: 'lang_ru', limit: 50 }),
                adminAPI.aiGenerateDescriptions({ lang: 'lang_uz', limit: 50 })
            ]);

            const totalApplied = (ruRes.appliedCount || 0) + (uzRes.appliedCount || 0);

            alert(
                `✅ ИИ-описания готовы\n` +
                `RU: ${ruRes.appliedCount} из ${ruRes.targetCount}\n` +
                `UZ: ${uzRes.appliedCount} из ${uzRes.targetCount}\n` +
                `Всего: ${totalApplied}`
            );
            setRefreshTrigger(prev => prev + 1);
        } catch (err) {
            alert('Ошибка ИИ генерации: ' + err.message);
        } finally {
            setGeneratingAI(false);
        }
    };

    const handleAILinkHyponyms = async () => {
        if (!window.confirm('Попросить ИИ связать гипонимы-гиперонимы по смыслу?\nВнимание: Это запустит реальное связывание (не dryRun).')) return;
        try {
            setGeneratingAI(true);
            const res = await adminAPI.aiLinkHyponyms({ lang: 'lang_ru', limit: 200, dryRun: false });
            alert(`✅ Успешно создано новых связей: ${res.acceptedCount} (отклонено: ${res.rejectedCount})`);
            setRefreshTrigger(prev => prev + 1);
        } catch (err) {
            alert('Ошибка ИИ связывания: ' + err.message);
        } finally {
            setGeneratingAI(false);
        }
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
                <button
                    className={`admin-tab ${activeTab === 'import' ? 'active' : ''}`}
                    onClick={() => setActiveTab('import')}
                >
                    <Upload size={18} />
                    Массовый импорт
                </button>
                
                {/* AI кнопки */}
                <button
                    className="admin-tab"
                    onClick={handleAIGenerateDescriptions}
                    disabled={generatingAI}
                    title="Сгенерировать описания (definitions) для слов через OpenAI"
                >
                    <FileText size={18} className={generatingAI ? 'pulse' : ''} />
                    ИИ: Описания
                </button>

                <button
                    className="admin-tab"
                    onClick={handleAILinkHyponyms}
                    disabled={generatingAI}
                    title="Установить гиперонимы и гипонимы нейросетью"
                >
                    <Wand2 size={18} className={generatingAI ? 'pulse' : ''} />
                    ИИ: Связи
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

                {activeTab === 'import' && (
                    <AdminImport
                        onSuccess={handleWordChanged}
                        onCancel={() => setActiveTab('list')}
                    />
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
