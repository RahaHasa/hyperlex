/**
 * Сервис для работы с Admin API
 */

const API_URL = '/api/admin';

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
        if (!token) {
            throw new Error('❌ Требуется авторизация. Пожалуйста, залогиньтесь.');
        }
        
        try {
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
                console.error('API Error Response:', error);
                throw new Error(error.error || `Error: ${response.status} ${response.statusText}`);
            }
            return response.json();
        } catch (error) {
            console.error('Create word error:', error);
            throw error;
        }
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
    // === СИНХРОНИЗАЦИЯ ===
    
    /**
     * Авто-связывание всех гиперо-гипонимов в базе
     */
    async syncRelations() {
        const token = getAuthToken();
        if (!token) throw new Error('❌ Требуется авторизация');
        
        const response = await fetch(`${API_URL}/words/sync-relations`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Ошибка при синхронизации связей');
        }
        return response.json();
    },

    // === ИСКУССТВЕННЫЙ ИНТЕЛЛЕКТ ===

    /**
     * AI-связывание гиперонимов и гипонимов
     */
    async aiLinkHyponyms(options) {
        const token = getAuthToken();
        if (!token) throw new Error('❌ Требуется авторизация');
        
        const response = await fetch(`${API_URL}/ai/link-hyponyms`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(options)
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Ошибка при AI-связывании');
        }
        return response.json();
    },

    /**
     * AI-генерация описаний слов
     */
    async aiGenerateDescriptions(options) {
        const token = getAuthToken();
        if (!token) throw new Error('❌ Требуется авторизация');
        
        const response = await fetch(`${API_URL}/ai/generate-descriptions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(options)
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Ошибка при генерации описаний');
        }
        return response.json();
    },

    async getDescriptionGenerationStatus() {
        const token = getAuthToken();
        if (!token) throw new Error('❌ Требуется авторизация');

        const response = await fetch(`${API_URL}/ai/generate-descriptions/status`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error || 'Ошибка при получении статуса генерации');
        }

        return response.json();
    },

    async aiGenerateDescriptionsStream(options, handlers = {}) {
        const token = getAuthToken();
        if (!token) throw new Error('❌ Требуется авторизация');

        const response = await fetch(`${API_URL}/ai/generate-descriptions/stream`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(options)
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error || 'Ошибка при пакетной генерации описаний');
        }

        if (!response.body) {
            throw new Error('Потоковый ответ не поддерживается браузером');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let finalEvent = null;

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed) continue;

                const event = JSON.parse(trimmed);
                finalEvent = event;

                if (event.type === 'progress' && handlers.onProgress) {
                    handlers.onProgress(event);
                } else if (event.type === 'start' && handlers.onStart) {
                    handlers.onStart(event);
                } else if (event.type === 'complete' && handlers.onComplete) {
                    handlers.onComplete(event);
                } else if (event.type === 'error' && handlers.onError) {
                    handlers.onError(event);
                }
            }
        }

        if (buffer.trim()) {
            finalEvent = JSON.parse(buffer.trim());
        }

        if (finalEvent?.type === 'error') {
            throw new Error(finalEvent.error || 'Ошибка при пакетной генерации описаний');
        }

        return finalEvent;
    },

    /**
     * Массовый импорт слов
     */
    async importData(formData) {
        const token = getAuthToken();
        if (!token) throw new Error('❌ Требуется авторизация');

        const response = await fetch(`${API_URL}/import`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(data.error || 'Ошибка при импорте');
        }
        return data;
    },

    async enrichImportRows(rows, method = 'openai') {
        const token = getAuthToken();
        if (!token) throw new Error('❌ Требуется авторизация');

        const response = await fetch(`${API_URL}/ai/enrich-import-rows`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ rows, method })
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(data.error || 'Ошибка AI-дозаполнения строк');
        }

        return data;
    },

    /**
     * AI-связывание гиперонимов/гипонимов
     */
    async linkHyponymsAI(payload) {
        const token = getAuthToken();
        if (!token) throw new Error('❌ Требуется авторизация');

        const response = await fetch(`${API_URL}/ai/link-hyponyms`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload || {})
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(data.error || 'Ошибка AI-связывания');
        }
        return data;
    },

    /**
     * AI-связывание гиперонимов/гипонимов всех данных потоком
     */
    async linkHyponymsAIStream(options, handlers = {}) {
        const token = getAuthToken();
        if (!token) throw new Error('❌ Требуется авторизация');

        const response = await fetch(`${API_URL}/ai/link-hyponyms/stream`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(options || {})
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error || 'Ошибка при пакетной связи гиперонимов');
        }

        if (!response.body) {
            throw new Error('Потоковый ответ не поддерживается браузером');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let finalEvent = null;

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed) continue;

                try {
                    const event = JSON.parse(trimmed);
                    finalEvent = event;

                    if (event.type === 'progress' && handlers.onProgress) {
                        handlers.onProgress(event);
                    } else if (event.type === 'start' && handlers.onStart) {
                        handlers.onStart(event);
                    } else if (event.type === 'complete' && handlers.onComplete) {
                        handlers.onComplete(event);
                    } else if ((event.type === 'error' || event.type === 'batch-error') && handlers.onError) {
                        handlers.onError(event);
                    }
                } catch (e) {
                    console.error('Error parsing event:', e);
                }
            }
        }

        if (buffer.trim()) {
            try {
                finalEvent = JSON.parse(buffer.trim());
            } catch (e) {
                console.error('Error parsing final event:', e);
            }
        }

        if (finalEvent?.type === 'error') {
            throw new Error(finalEvent.error || 'Ошибка при пакетной связи гиперонимов');
        }

        return finalEvent;
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
        
        const response = await fetch('/api/auth/users', {
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
        
        const response = await fetch(`/api/auth/users/${userId}`, {
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
        
        const response = await fetch(`/api/auth/users/${userId}`, {
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
