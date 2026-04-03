import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Admin.css';
import AdminUsersList from '../components/AdminUsersList';

/**
 * Admin Users Dashboard - управление пользователями
 */
export default function AdminUsers() {
    const navigate = useNavigate();
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
    
    if (loading) {
        return <div style={{ textAlign: 'center', padding: '40px', fontSize: '1.2rem' }}>⏳ Загрузка...</div>;
    }
    
    if (!isAdmin) {
        return <div style={{ textAlign: 'center', padding: '40px', fontSize: '1.2rem' }}>❌ У вас нет доступа к админ панели</div>;
    }
    
    return (
        <div className="admin-container">
            <header className="admin-header">
                <h1>⚙️ Администраторская панель</h1>
                <p className="admin-subtitle">Управление пользователями и ролями</p>
            </header>
            
            <div className="admin-nav-buttons">
                <button 
                    className="admin-nav-btn active"
                    onClick={() => navigate('/admin')}
                >
                    👥 Пользователи
                </button>
                <button 
                    className="admin-nav-btn"
                    onClick={() => navigate('/admin/words')}
                >
                    📚 Управление словами
                </button>
            </div>
            
            <div className="admin-content">
                <AdminUsersList refreshTrigger={refreshTrigger} />
            </div>
        </div>
    );
}
