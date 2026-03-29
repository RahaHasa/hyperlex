/**
 * Страница профиля пользователя
 */

import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import './Profile.css';

export default function Profile() {
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
        return <div className="profile-page"><div className="loading">Загрузка...</div></div>;
    }

    if (!user) {
        return <div className="profile-page"><div className="error-message">Профиль не найден</div></div>;
    }

    return (
        <div className="profile-page">
            <div className="profile-container">
                <div className="profile-card">
                    <div className="profile-header">
                        <div className="profile-avatar"></div>
                        <div className="profile-title">
                            <h1>{user.username}</h1>
                            <p className="profile-role">
                                {user.role === 'admin' ? 'Администратор' : 'Пользователь'}
                            </p>
                        </div>
                    </div>

                    <div className="profile-content">
                        <div className="profile-section">
                            <h2>Информация профиля</h2>
                            <div className="info-group">
                                <div className="info-item">
                                    <label>Имя пользователя</label>
                                    <p>{user.username}</p>
                                </div>
                                <div className="info-item">
                                    <label>Email</label>
                                    <p>{user.email}</p>
                                </div>
                                <div className="info-item">
                                    <label>Роль</label>
                                    <p>
                                        <span className={`role-badge ${user.role}`}>
                                            {user.role === 'admin' ? 'Администратор' : 'Пользователь'}
                                        </span>
                                    </p>
                                </div>
                            </div>
                        </div>

                        {user.role === 'admin' && (
                            <div className="profile-admin">
                                <h2>Доступ администратора</h2>
                                <p>У вас есть права администратора. Вы можете управлять пользователями и ролями в системе.</p>
                                <Link to="/admin" className="admin-panel-btn">
                                    Открыть панель управления
                                </Link>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
