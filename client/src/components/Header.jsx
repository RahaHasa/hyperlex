/**
 * Компонент шапки сайта
 * Навигация и логотип
 */

import { Link, useLocation } from 'react-router-dom';
import './Header.css';

export default function Header() {
    const location = useLocation();
    
    // Определяем активный пункт меню
    const isActive = (path) => {
        if (path === '/') return location.pathname === '/';
        return location.pathname.startsWith(path);
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
                    <Link 
                        to="/admin" 
                        className={`nav-link nav-admin ${isActive('/admin') ? 'active' : ''}`}
                    >
                        Админ
                    </Link>
                </nav>
            </div>
        </header>
    );
}
