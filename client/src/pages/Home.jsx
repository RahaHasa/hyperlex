/**
 * Главная страница
 * Поиск слов и описание проекта
 */

import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import SearchBar from '../components/SearchBar';
import { getStats } from '../services/api';
import './Home.css';

export default function Home() {
    const navigate = useNavigate();
    const [stats, setStats] = useState(null);
    const [user, setUser] = useState(null);
    
    // Загрузка информации о пользователе и статистики
    useEffect(() => {
        const userData = localStorage.getItem('user');
        if (userData) {
            setUser(JSON.parse(userData));
        }
        
        getStats()
            .then(data => setStats(data.stats))
            .catch(console.error);
    }, []);
    
    // Обработка поиска
    const handleSearch = (query, lang) => {
        navigate(`/search?q=${encodeURIComponent(query)}&lang=${lang}`);
    };
    
    return (
        <div className="home-page">
            {/* Админ панель быстрого доступа */}
            {user && user.role === 'admin' && (
                <section className="admin-quick-access">
                    <div className="admin-banner">
                        <div className="admin-banner-content">
                            <div className="admin-banner-icon"></div>
                            <div className="admin-banner-text">
                                <h3>Панель управления</h3>
                                <p>Управляйте пользователями и ролями в системе</p>
                            </div>
                            <Link to="/admin" className="admin-banner-btn">
                                Открыть панель →
                            </Link>
                        </div>
                    </div>
                </section>
            )}
            
            {/* Герой */}
            <section className="hero">
                <div className="hero-decoration"></div>
                
                <h1 className="hero-title">HyperLex</h1>
                <p className="hero-subtitle">
                    Платформа для анализа гиперонимо-гипонимических<br/>
                    отношений в русском и узбекском языках
                </p>
                
                {/* Поиск */}
                <div className="hero-search">
                    <SearchBar onSearch={handleSearch} size="large" />
                </div>
                
                {/* Примеры */}
                <div className="hero-examples">
                    <span>Попробуйте:</span>
                    <button onClick={() => handleSearch('собака', 'ru')}>собака</button>
                    <button onClick={() => handleSearch('животное', 'ru')}>животное</button>
                    <button onClick={() => handleSearch('it', 'uz')}>it</button>
                    <button onClick={() => handleSearch('qush', 'uz')}>qush</button>
                </div>
            </section>
            
            {/* Описание */}
            <section className="about">
                <div className="about-grid">
                    <div className="about-card">
                        <div className="about-icon"></div>
                        <h3>Поиск связей</h3>
                        <p>
                            Введите любое слово и мгновенно увидите его 
                            гиперонимы (родовые понятия) и гипонимы (видовые понятия).
                        </p>
                    </div>
                    
                    <div className="about-card">
                        <div className="about-icon"></div>
                        <h3>Визуализация</h3>
                        <p>
                            Интерактивный граф показывает иерархию понятий. 
                            Перетаскивайте узлы, масштабируйте и исследуйте.
                        </p>
                    </div>
                    
                    <div className="about-card">
                        <div className="about-icon"></div>
                        <h3>Сравнение языков</h3>
                        <p>
                            Сопоставляйте структуры русского и узбекского языков. 
                            Находите сходства и различия.
                        </p>
                    </div>
                </div>
            </section>
            
            {/* Статистика */}
            {stats && (
                <section className="stats">
                    <div className="stats-card">
                        <div className="stats-number">{stats.russian.totalWords}</div>
                        <div className="stats-label">слов на русском</div>
                    </div>
                    <div className="stats-divider\"></div>
                    <div className="stats-card">
                        <div className="stats-number">{stats.uzbek.totalWords}</div>
                        <div className="stats-label">слов на узбекском</div>
                    </div>
                </section>
            )}
            
            {/* Что такое гипероним */}
            <section className="info">
                <h2>Что такое гипероним и гипоним?</h2>
                
                <div className="info-content">
                    <div className="info-block">
                        <h4>Гипероним ↑</h4>
                        <p>
                            Слово с более широким значением, обозначающее родовое понятие. 
                            Например, <em>«животное»</em> — гипероним для <em>«собаки»</em>.
                        </p>
                    </div>
                    
                    <div className="info-block">
                        <h4>Гипоним ↓</h4>
                        <p>
                            Слово с более узким значением, обозначающее видовое понятие. 
                            Например, <em>«овчарка»</em> — гипоним для <em>«собаки»</em>.
                        </p>
                    </div>
                </div>
                
                <div className="info-example">
                    <code>существо → животное → млекопитающее → собака → овчарка</code>
                </div>
            </section>
        </div>
    );
}
