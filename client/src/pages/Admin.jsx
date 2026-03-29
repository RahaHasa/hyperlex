/**
 * Admin Dashboard - управление пользователями
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Admin.css';

export default function Admin() {
    const navigate = useNavigate();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

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
                    setError('У вас нет доступа к админ панели');
                    setLoading(false);
                    return;
                }
            } catch (e) {
                console.error('Parse user error:', e);
            }
        }
        
        loadUsers();
    }, [navigate]);

    const loadUsers = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            const response = await fetch('http://localhost:3001/api/auth/users', {
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Ошибка: ${response.status}`);
            }

            const data = await response.json();
            setUsers(data.users || []);
            setError('');
        } catch (err) {
            console.error('Load users error:', err);
            setError('Ошибка загрузки пользователей: ' + err.message);
            setUsers([]);
        } finally {
            setLoading(false);
        }
    };

    const changeRole = async (userId, newRole) => {
        try {
            setError('');
            const token = localStorage.getItem('token');
            const response = await fetch(`http://localhost:3001/api/auth/users/${userId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ role: newRole })
            });

            if (!response.ok) {
                throw new Error('Ошибка при обновлении пользователя');
            }

            setSuccess('Роль пользователя обновлена');
            loadUsers();
        } catch (err) {
            setError(err.message);
        }
    };

    const deleteUserById = async (userId) => {
        if (!confirm('Вы уверены, что хотите удалить этого пользователя?')) return;

        try {
            setError('');
            const token = localStorage.getItem('token');
            const response = await fetch(`http://localhost:3001/api/auth/users/${userId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                throw new Error('Ошибка при удалении пользователя');
            }

            setSuccess('Пользователь удалён');
            loadUsers();
        } catch (err) {
            setError(err.message);
        }
    };

    if (loading) {
        return <div className="admin-page"><div className="loading">Загрузка...</div></div>;
    }

    return (
        <div className="admin-page">
            <div className="admin-container">
                <div className="admin-header">
                    <div className="admin-title-section">
                        <div className="admin-icon">⚙️</div>
                        <div>
                            <h1>Панель администратора</h1>
                            <p className="admin-subtitle">Управление пользователями и ролями</p>
                        </div>
                    </div>
                </div>

                {error && (
                    <div className="alert alert-error">
                        <span>❌</span>
                        <span>{error}</span>
                    </div>
                )}
                {success && (
                    <div className="alert alert-success">
                        <span>✅</span>
                        <span>{success}</span>
                    </div>
                )}

                <div className="stats">
                    <div className="stat-card">
                        <div className="stat-icon">👥</div>
                        <div className="stat-content">
                            <h3>Всего пользователей</h3>
                            <p className="stat-number">{users.length}</p>
                        </div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-icon">👑</div>
                        <div className="stat-content">
                            <h3>Администраторов</h3>
                            <p className="stat-number">{users.filter(u => u.role === 'admin').length}</p>
                        </div>
                    </div>
                </div>

                {!loading && users.length > 0 && (
                    <div className="table-wrapper">
                        <div className="table-header">
                            <h2>Список пользователей</h2>
                            <button className="refresh-btn-icon" onClick={loadUsers} title="Обновить">
                                🔄 Обновить
                            </button>
                        </div>
                        <table className="users-table">
                            <thead>
                                <tr>
                                    <th>Имя пользователя</th>
                                    <th>Email</th>
                                    <th>Роль</th>
                                    <th>Дата создания</th>
                                    <th>Действия</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map(user => (
                                    <tr key={user._id}>
                                        <td><strong>{user.username}</strong></td>
                                        <td>{user.email}</td>
                                        <td>
                                            <select 
                                                value={user.role}
                                                onChange={(e) => changeRole(user._id, e.target.value)}
                                                className={`role-select role-${user.role}`}
                                            >
                                                <option value="user">👤 Пользователь</option>
                                                <option value="admin">👑 Администратор</option>
                                            </select>
                                        </td>
                                        <td>{new Date(user.createdAt).toLocaleDateString('ru-RU')}</td>
                                        <td>
                                            <button 
                                                className="delete-btn"
                                                onClick={() => deleteUserById(user._id)}
                                                title="Удалить пользователя"
                                            >
                                                🗑️ Удалить
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {!loading && users.length === 0 && (
                    <div className="empty-state">
                        <div className="empty-icon">📭</div>
                        <h2>Нет пользователей</h2>
                        <p>Пока в системе нет зарегистрированных пользователей</p>
                    </div>
                )}

                {loading && (
                    <div className="loading-state">
                        <div className="spinner"></div>
                        <p>Загрузка данных...</p>
                    </div>
                )}
            </div>
        </div>
    );
}
