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
    const [descriptionProgress, setDescriptionProgress] = useState(null);

    const handleAIGenerateDescriptions = async () => {
        if (!window.confirm('Запустить автоматическую генерацию описаний пакетами по 200 слов?\nСервер будет идти батчами до конца и показывать прогресс.')) return;
        try {
            setGeneratingAI(true);
            const status = await adminAPI.getDescriptionGenerationStatus();
            const initialProgress = {
                status: 'running',
                totalCount: status.totalCount || 0,
                processedCount: 0,
                appliedCount: 0,
                batchSize: 200,
                lastMessage: status.totalCount ? `0/${status.totalCount}` : 'Нет слов без описания',
                perLanguage: status.perLanguage || {
                    lang_ru: { total: 0, processed: 0, applied: 0 },
                    lang_uz: { total: 0, processed: 0, applied: 0 }
                }
            };
            setDescriptionProgress(initialProgress);

            if (!status.totalCount) {
                setDescriptionProgress(prev => ({
                    ...prev,
                    status: 'done',
                    lastMessage: 'Нет слов без описания'
                }));
                alert('✅ Нет слов без описания');
                return;
            }

            const progressState = {
                ...initialProgress,
                perLanguage: {
                    lang_ru: { ...(initialProgress.perLanguage.lang_ru || { total: 0, processed: 0, applied: 0 }) },
                    lang_uz: { ...(initialProgress.perLanguage.lang_uz || { total: 0, processed: 0, applied: 0 }) }
                }
            };

            const pushProgress = (message) => {
                setDescriptionProgress({
                    status: 'running',
                    totalCount: progressState.totalCount,
                    processedCount: progressState.processedCount,
                    appliedCount: progressState.appliedCount,
                    batchSize: progressState.batchSize,
                    lastMessage: message,
                    perLanguage: {
                        lang_ru: { ...progressState.perLanguage.lang_ru },
                        lang_uz: { ...progressState.perLanguage.lang_uz }
                    }
                });
            };

            const runLanguageBatches = async (lang) => {
                while (true) {
                    try {
                        const res = await adminAPI.aiGenerateDescriptions({ lang, limit: 200 });
                        const batchProcessed = res.targetCount || 0;
                        const batchApplied = res.appliedCount || 0;

                        progressState.processedCount += batchProcessed;
                        progressState.appliedCount += batchApplied;
                        progressState.perLanguage[lang].processed += batchProcessed;
                        progressState.perLanguage[lang].applied += batchApplied;

                        pushProgress(`${progressState.processedCount}/${progressState.totalCount}`);

                        if ((res.pendingCount || 0) <= batchProcessed) {
                            break;
                        }
                    } catch (err) {
                        if (err.message.includes('Нет слов без описания')) {
                            break;
                        }
                        throw err;
                    }
                }
            };

            await runLanguageBatches('lang_ru');
            await runLanguageBatches('lang_uz');

            const result = {
                processedCount: progressState.processedCount,
                totalCount: progressState.totalCount,
                appliedCount: progressState.appliedCount
            };

            setDescriptionProgress({
                status: 'done',
                totalCount: progressState.totalCount,
                processedCount: progressState.processedCount,
                appliedCount: progressState.appliedCount,
                batchSize: progressState.batchSize,
                lastMessage: `Готово: ${progressState.processedCount}/${progressState.totalCount}`,
                perLanguage: {
                    lang_ru: { ...progressState.perLanguage.lang_ru },
                    lang_uz: { ...progressState.perLanguage.lang_uz }
                }
            });

            alert(
                `✅ ИИ-описания готовы\n` +
                `Обработано: ${result.processedCount || 0}/${result.totalCount || 0}\n` +
                `Добавлено описаний: ${result.appliedCount || 0}`
            );
            setRefreshTrigger(prev => prev + 1);
        } catch (err) {
            setDescriptionProgress(prev => ({
                ...(prev || {}),
                status: 'error',
                lastMessage: err.message
            }));
            alert('Ошибка ИИ генерации: ' + err.message);
        } finally {
            setGeneratingAI(false);
        }
    };

    const [linkingHyponyms, setLinkingHyponyms] = useState(false);
    const [linkProgress, setLinkProgress] = useState(null);
    const [linkDepth, setLinkDepth] = useState(3);

    const handleAILinkHyponyms = async () => {
        if (!window.confirm(`Запустить AI связывание гиперонимов/гипонимов для ВСЕ данных?\nГлубина связей: ${linkDepth} слоя(ов).\nСервер будет обрабатывать пакетами и показывать прогресс.`)) return;
        try {
            setLinkingHyponyms(true);
            setLinkProgress({
                status: 'running',
                totalCount: 0,
                totalProcessedWords: 0,
                totalAppliedLinks: 0,
                totalRequests: 0,
                completedRequests: 0,
                batchSize: 100,
                depth: linkDepth,
                lastMessage: 'Инициализация...',
                perLanguage: {
                    lang_ru: { total: 0, processed: 0, appliedLinks: 0 },
                    lang_uz: { total: 0, processed: 0, appliedLinks: 0 }
                }
            });

            await adminAPI.linkHyponymsAIStream(
                { batchSize: 100, minConfidence: 0.75, depth: linkDepth },
                {
                    onStart: (event) => {
                        setLinkProgress(prev => ({
                            ...prev,
                            totalCount: event.totalCount,
                            totalRequests: event.totalRequests || 0,
                            status: 'running',
                            lastMessage: 'Начало обработки...',
                            perLanguage: event.perLanguage || prev.perLanguage
                        }));
                    },
                    onProgress: (event) => {
                        setLinkProgress(prev => ({
                            ...prev,
                            totalProcessedWords: event.totalProcessedWords,
                            totalAppliedLinks: event.totalAppliedLinks,
                            completedRequests: event.completedRequests || prev.completedRequests,
                            totalRequests: event.totalRequests || prev.totalRequests,
                            lastMessage: event.message || 'Обработка...',
                            perLanguage: event.perLanguage || prev.perLanguage
                        }));
                    },
                    onComplete: (event) => {
                        setLinkProgress(prev => ({
                            ...prev,
                            status: 'done',
                            totalProcessedWords: event.totalProcessedWords,
                            totalAppliedLinks: event.totalAppliedLinks,
                            lastMessage: event.message || 'Готово'
                        }));
                    },
                    onError: (event) => {
                        setLinkProgress(prev => ({
                            ...prev,
                            status: 'error',
                            lastMessage: event.message || 'Ошибка обработки'
                        }));
                    }
                }
            );

            alert(
                `✅ AI Связывание завершено\n` +
                `Обработано слов: ${linkProgress.totalProcessedWords || 0}\n` +
                `Создано связей: ${linkProgress.totalAppliedLinks || 0}\n` +
                `AI запросов: ${linkProgress.completedRequests || 0}/${linkProgress.totalRequests || 0}`
            );
            setRefreshTrigger(prev => prev + 1);
        } catch (err) {
            setLinkProgress(prev => ({
                ...(prev || {}),
                status: 'error',
                lastMessage: err.message
            }));
            alert('Ошибка AI связывания: ' + err.message);
        } finally {
            setLinkingHyponyms(false);
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
                {/*
                <button
                    className="admin-tab"
                    onClick={handleAIGenerateDescriptions}
                    disabled={generatingAI}
                    title="Сгенерировать описания (definitions) для слов через OpenAI"
                >
                    <FileText size={18} className={generatingAI ? 'pulse' : ''} />
                    ИИ: Описания
                </button>
                */}

                <button
                    className="admin-tab"
                    onClick={handleAILinkHyponyms}
                    disabled={generatingAI || linkingHyponyms}
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

            {/*
            {descriptionProgress && (
                <div className="ai-progress-panel">
                    <div className="ai-progress-header">
                        <strong>ИИ: Описания</strong>
                        <span className={`ai-progress-status ${descriptionProgress.status}`}>
                            {descriptionProgress.status === 'running' ? 'В процессе' :
                             descriptionProgress.status === 'done' ? 'Готово' :
                             descriptionProgress.status === 'error' ? 'Ошибка' : 'Запуск'}
                        </span>
                    </div>
                    <div className="ai-progress-main">
                        {descriptionProgress.processedCount}/{descriptionProgress.totalCount} обработано
                    </div>
                    <div className="ai-progress-sub">
                        Добавлено описаний: {descriptionProgress.appliedCount || 0}
                    </div>
                    <div className="ai-progress-sub">
                        Последний статус: {descriptionProgress.lastMessage}
                    </div>
                    {descriptionProgress.status === 'running' && (
                        <div className="ai-progress-sub">
                            Идет обработка пакетами по {descriptionProgress.batchSize} слов...
                        </div>
                    )}
                    <div className="ai-progress-langs">
                        <div>RU: {(descriptionProgress.perLanguage?.lang_ru?.processed || 0)}/{(descriptionProgress.perLanguage?.lang_ru?.total || 0)}</div>
                        <div>UZ: {(descriptionProgress.perLanguage?.lang_uz?.processed || 0)}/{(descriptionProgress.perLanguage?.lang_uz?.total || 0)}</div>
                    </div>
                </div>
            )}
            */}

            {linkProgress && (
                <div className="ai-progress-panel">
                    <div className="ai-progress-header">
                        <strong>ИИ: Связи гиперонимов</strong>
                        <span className={`ai-progress-status ${linkProgress.status}`}>
                            {linkProgress.status === 'running' ? 'В процессе' :
                             linkProgress.status === 'done' ? 'Готово' :
                             linkProgress.status === 'error' ? 'Ошибка' : 'Запуск'}
                        </span>
                    </div>
                    <div className="ai-progress-main">
                        {linkProgress.totalProcessedWords}/{linkProgress.totalCount} слов обработано
                    </div>
                    <div className="ai-progress-sub">
                        Создано связей: {linkProgress.totalAppliedLinks || 0}
                    </div>
                    <div className="ai-progress-sub">
                        AI запросы: {linkProgress.completedRequests || 0}/{linkProgress.totalRequests || 0}
                    </div>
                
                    <div className="ai-progress-sub">
                        Статус: {linkProgress.lastMessage}
                    </div>
                    {linkProgress.status === 'running' && (
                        <div className="ai-progress-sub">
                            Идет пакетная обработка связей по {linkProgress.batchSize} слов на запрос...
                        </div>
                    )}
                    <div className="ai-progress-langs">
                        <div>RU: {(linkProgress.perLanguage?.lang_ru?.processed || 0)}/{(linkProgress.perLanguage?.lang_ru?.total || 0)} ({(linkProgress.perLanguage?.lang_ru?.appliedLinks || 0)} связей)</div>
                        <div>UZ: {(linkProgress.perLanguage?.lang_uz?.processed || 0)}/{(linkProgress.perLanguage?.lang_uz?.total || 0)} ({(linkProgress.perLanguage?.lang_uz?.appliedLinks || 0)} связей)</div>
                    </div>
                </div>
            )}

           
            
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
