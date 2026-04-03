import React, { useState, useEffect } from 'react';
import { Search, AlertCircle, Trash2, BarChart3 } from 'lucide-react';
import adminAPI from '../services/adminAPI';
import './AdminUsersList.css';

/**
 * Компонент для управления списком пользователей
 */
export default function AdminUsersList({ refreshTrigger }) {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState('all');
    
    useEffect(() => {
        loadUsers();
    }, [refreshTrigger]);
    
    const loadUsers = async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await adminAPI.getAllUsers();
            setUsers(data.users || []);
        } catch (err) {
            console.error('Error loading users:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };
    
    const handleChangeRole = async (userId, newRole) => {
        try {
            await adminAPI.updateUserRole(userId, newRole);
            // Перезагружаем список
            await loadUsers();
        } catch (err) {
            alert('Ошибка при обновлении роли: ' + err.message);
        }
    };
    
    const handleDeleteUser = async (userId, username) => {
        if (!window.confirm(`Вы уверены, что хотите удалить пользователя "${username}"?`)) {
            return;
        }
        
        try {
            await adminAPI.deleteUser(userId);
            // Перезагружаем список
            await loadUsers();
        } catch (err) {
            alert('Ошибка при удалении пользователя: ' + err.message);
        }
    };
    
    // Фильтрация
    let filtered = users;
    
    if (searchQuery) {
        filtered = filtered.filter(u => 
            u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
            u.email.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }
    
    if (roleFilter !== 'all') {
        filtered = filtered.filter(u => u.role === roleFilter);
    }
    
    if (loading) {
        return (
            <div className="admin-list-container">
                <div className="loading">Загрузка пользователей...</div>
            </div>
        );
    }
    
    if (error) {
        return (
            <div className="admin-list-container">
                <div className="error">
                    <AlertCircle size={20} />
                    {error}
                </div>
            </div>
        );
    }
    
    const adminCount = users.filter(u => u.role === 'admin').length;
    const userCount = users.filter(u => u.role === 'user').length;
    
    return (
        <div className="admin-list-container">
            <div className="admin-filters">
                <div className="filter-group">
                    <div className="filter-input-wrapper">
                        <Search size={18} />
                        <input
                            type="text"
                            placeholder="Поиск по имени или email..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="admin-search-input"
                        />
                    </div>
                </div>
                
                <div className="filter-group">
                    <select
                        value={roleFilter}
                        onChange={(e) => setRoleFilter(e.target.value)}
                        className="admin-role-select"
                    >
                        <option value="all">Все роли</option>
                        <option value="user">Пользователь</option>
                        <option value="admin">Администратор</option>
                    </select>
                </div>
            </div>
            
            {filtered.length === 0 ? (
                <div className="admin-empty-state">
                    <p>Пользователи не найдены</p>
                </div>
            ) : (
                <div className="admin-table-wrapper">
                    <table className="admin-users-table">
                        <thead>
                            <tr>
                                <th>Имя пользователя</th>
                                <th>Email</th>
                                <th>Роль</th>
                                <th>Создан</th>
                                <th>Действия</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(user => (
                                <tr key={user._id} className={`role-${user.role}`}>
                                    <td className="col-username">
                                        <strong>{user.username}</strong>
                                    </td>
                                    <td className="col-email">{user.email}</td>
                                    <td className="col-role">
                                        <select
                                            value={user.role}
                                            onChange={(e) => handleChangeRole(user._id, e.target.value)}
                                            className={`admin-role-input role-${user.role}`}
                                        >
                                            <option value="user">Пользователь</option>
                                            <option value="admin">Администратор</option>
                                        </select>
                                    </td>
                                    <td className="col-date">
                                        {user.createdAt ? new Date(user.createdAt).toLocaleDateString('ru-RU') : '—'}
                                    </td>
                                    <td className="col-actions">
                                        <button
                                            onClick={() => handleDeleteUser(user._id, user.username)}
                                            className="admin-delete-btn"
                                            title="Удалить пользователя"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            
            <div className="admin-stats">
                <div className="stat-item">
                    <BarChart3 size={20} />
                    <span>Всего: <strong>{users.length}</strong></span>
                </div>
                <div className="stat-item">
                    <span>Администраторов: <strong>{adminCount}</strong></span>
                </div>
                <div className="stat-item">
                    <span>Пользователей: <strong>{userCount}</strong></span>
                </div>
            </div>
        </div>
    );
}
