/**
 * Страница гиперонимических слов
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Words.css';

export default function Words() {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const userData = localStorage.getItem('user');
        const token = localStorage.getItem('token');
        
        if (!token) {
            navigate('/login');
            return;
        }

        if (userData) {
            setUser(JSON.parse(userData));
        }
        setLoading(false);
    }, [navigate]);

    if (loading) {
        return <div className="words-page"><div className="loading">Загрузка...</div></div>;
    }

    if (!user) {
        return <div className="words-page"><div className="error-message">Требуется вход</div></div>;
    }

    return (
        <div className="words-page">
            <div className="words-container">
                <div className="words-header">
                    <h1>Гиперонимические слова</h1>
                    <p className="words-subtitle">Управление вашей коллекцией слов</p>
                </div>

                <div className="words-content">
                    <div className="words-empty">
                        <div className="empty-icon">📚</div>
                        <h2>Коллекция пуста</h2>
                        <p>Здесь будут ваши избранные гиперонимические слова</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
