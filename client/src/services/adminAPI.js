/**
 * Сервис для работы с Admin API
 */

const API_URL = 'http://localhost:3001/api/admin';

const getAuthToken = () => localStorage.getItem('token');

const adminAPI = {
    // === ПОЛУЧЕНИЕ СЛОВ ===
    
    /**
     * Получить все слова с пагинацией и фильтрацией
     */
    async getAllWords(params = {}) {
        const query = new URLSearchParams();
        if (params.lang) query.append('lang', params.lang);
        if (params.limit) query.append('limit', params.limit);
        if (params.skip) query.append('skip', params.skip);
        if (params.search) query.append('search', params.search);
        
        const token = getAuthToken();
        if (!token) {
            throw new Error('❌ Требуется авторизация. Пожалуйста, залогиньтесь.');
        }
        
        const response = await fetch(`${API_URL}/words?${query}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Ошибка при получении слов');
        }
        return response.json();
    },
    
    /**
     * Получить одно слово по ID
     */
    async getWord(id) {
        const token = getAuthToken();
        if (!token) throw new Error('❌ Требуется авторизация');
        
        const response = await fetch(`${API_URL}/words/${id}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error || 'Слово не найдено');
        }
        return response.json();
    },
    
    /**
     * Получить дерево связей слова
     */
    async getWordTree(id, depth = 3) {
        const token = getAuthToken();
        if (!token) throw new Error('❌ Требуется авторизация');
        
        const response = await fetch(`${API_URL}/words/${id}/tree?depth=${depth}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error || 'Ошибка при получении дерева');
        }
        return response.json();
    },
    
    // === СОЗДАНИЕ ===
    
    /**
     * Создать новое слово
     */
    async createWord(wordData) {
        const token = getAuthToken();
        if (!token) throw new Error('❌ Требуется авторизация');
        
        const response = await fetch(`${API_URL}/words`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(wordData)
        });
        
        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error || 'Ошибка при создании слова');
        }
        return response.json();
    },
    
    // === ОБНОВЛЕНИЕ ===
    
    /**
     * Обновить слово
     */
    async updateWord(id, wordData) {
        const token = getAuthToken();
        if (!token) throw new Error('❌ Требуется авторизация');
        
        const response = await fetch(`${API_URL}/words/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(wordData)
        });
        
        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error || 'Ошибка при обновлении слова');
        }
        return response.json();
    },
    
    // === УДАЛЕНИЕ ===
    
    /**
     * Удалить слово
     */
    async deleteWord(id) {
        const token = getAuthToken();
        if (!token) throw new Error('❌ Требуется авторизация');
        
        const response = await fetch(`${API_URL}/words/${id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error || 'Ошибка при удалении слова');
        }
        return response.json();
    },
    
    // === АВТОПОИСК ===
    
    /**
     * Автопоиск для hypernyms (для комплита)
     */
    async searchHypernyms(query, lang, limit = 10) {
        const token = getAuthToken();
        if (!token) return { success: true, results: [] };
        
        const params = new URLSearchParams();
        params.append('q', query);
        if (lang) params.append('lang', lang);
        params.append('limit', limit);
        
        try {
            const response = await fetch(`${API_URL}/words/autocomplete/hypernyms?${params}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) return { success: true, results: [] };
            return response.json();
        } catch (err) {
            console.error('Search error:', err);
            return { success: true, results: [] };
        }
    },

    // === УПРАВЛЕНИЕ ПОЛЬЗОВАТЕЛЯМИ ===
    
    /**
     * Получить всех пользователей
     */
    async getAllUsers() {
        const token = getAuthToken();
        if (!token) {
            throw new Error('❌ Требуется авторизация. Пожалуйста, залогиньтесь.');
        }
        
        const response = await fetch('http://localhost:3001/api/auth/users', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error || 'Не удалось получить список пользователей');
        }
        return response.json();
    },
    
    /**
     * Обновить роль пользователя
     */
    async updateUserRole(userId, role) {
        const token = getAuthToken();
        if (!token) {
            throw new Error('❌ Требуется авторизация. Пожалуйста, залогиньтесь.');
        }
        
        const response = await fetch(`http://localhost:3001/api/auth/users/${userId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ role })
        });
        
        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error || 'Ошибка при обновлении пользователя');
        }
        return response.json();
    },
    
    /**
     * Удалить пользователя
     */
    async deleteUser(userId) {
        const token = getAuthToken();
        if (!token) {
            throw new Error('❌ Требуется авторизация. Пожалуйста, залогиньтесь.');
        }
        
        const response = await fetch(`http://localhost:3001/api/auth/users/${userId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error || 'Ошибка при удалении пользователя');
        }
        return response.json();
    }
};

export default adminAPI;
