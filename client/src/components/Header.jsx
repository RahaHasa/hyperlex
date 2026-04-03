/**
 * Компонент шапки сайта
 * Навигация и логотип
 */

import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import './Header.css';

export default function Header() {
    const location = useLocation();
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [showUserMenu, setShowUserMenu] = useState(false);
    
    const loadUser = () => {
        const userData = localStorage.getItem('user');
        if (userData) {
            setUser(JSON.parse(userData));
        }
    };
    
    useEffect(() => {
        loadUser();
        
        // Слушаем изменения localStorage (из других вкладок или этой же страницы)
        window.addEventListener('storage', loadUser);
        
        // Также слушаем кастомное событие когда меняется пользователь
        window.addEventListener('userUpdated', loadUser);
        
        return () => {
            window.removeEventListener('storage', loadUser);
            window.removeEventListener('userUpdated', loadUser);
        };
    }, []);
    
    // Определяем активный пункт меню
    const isActive = (path) => {
        if (path === '/') return location.pathname === '/';
        return location.pathname.startsWith(path);
    };
    
    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
        setShowUserMenu(false);
        navigate('/');
    };
    
    return (
        <header className="header">
            <div className="header-container">
                {/* Логотип */}
                <Link to="/" className="header-logo">
                    <span className="logo-icon">H</span>
                    <span className="logo-text">
                        <span className="logo-name">HyperLex</span>
                        <span className="logo-tagline">анализ гиперонимов</span>
                    </span>
                </Link>
                
                {/* Навигация */}
                <nav className="header-nav">
                    <Link 
                        to="/" 
                        className={`nav-link ${isActive('/') && location.pathname === '/' ? 'active' : ''}`}
                    >
                        Главная
                    </Link>
                    <Link 
                        to="/search" 
                        className={`nav-link ${isActive('/search') ? 'active' : ''}`}
                    >
                        Поиск
                    </Link>
                    <Link 
                        to="/compare" 
                        className={`nav-link ${isActive('/compare') ? 'active' : ''}`}
                    >
                        Сравнение
                    </Link>
                    
                    {user && user.role === 'admin' && (
                        <Link 
                            to="/admin" 
                            className={`nav-link nav-admin ${isActive('/admin') ? 'active' : ''}`}
                        >
                            Админ
                        </Link>
                    )}
                </nav>
                
                {/* Аутентификация */}
                <div className="header-auth">
                    {user ? (
                        <div className="user-menu-wrapper">
                            <button 
                                className="user-button"
                                onClick={() => setShowUserMenu(!showUserMenu)}
                            >
                                {user.username}
                            </button>
                            
                            {showUserMenu && (
                                <div className="user-menu">
                                    <Link to="/profile" className="user-menu-item">
                                        Профиль
                                    </Link>
                                    {user && user.role === 'admin' && (
                                        <>
                                            <Link to="/admin" className="user-menu-item admin-menu-item">
                                                Админка пользователей
                                            </Link>
                                        </>
                                    )}
                                    <button 
                                        className="user-menu-item logout-btn"
                                        onClick={handleLogout}
                                    >
                                        Выход
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <Link to="/login" className="nav-link nav-login">
                            Войти
                        </Link>
                    )}
                </div>
            </div>
        </header>
    );
}
