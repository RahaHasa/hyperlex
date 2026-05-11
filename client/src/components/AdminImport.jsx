import React, { useRef, useState } from 'react';
import adminAPI from '../services/adminAPI';
import './AdminImport.css';

/**
 * Admin Import JSON - импорт иерархических данных в JSON формате
 */
export default function AdminImport() {
    const [file, setFile] = useState(null);
    const [data, setData] = useState([]);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);
    const [importing, setImporting] = useState(false);
    const [importProgress, setImportProgress] = useState(null);
    const inputRef = useRef(null);

    const normalizeEntries = (parsed) => {
        if (Array.isArray(parsed)) {
            return parsed.map((item, index) => ({
                ...item,
                semantic_key: item.semantic_key || item.id || item.key || `item_${index}`
            }));
        }

        if (parsed && typeof parsed === 'object') {
            return Object.entries(parsed)
                .filter(([, item]) => item && typeof item === 'object' && !Array.isArray(item))
                .map(([semantic_key, item]) => ({
                    semantic_key,
                    ...item
                }));
        }

        return [];
    };

    // Обработка выбора файла
    const handleFileChange = (event) => {
        const selected = event.target.files?.[0];
        setError('');
        setSuccess('');
        setData([]);
        setImportProgress(null);

        if (!selected) {
            setFile(null);
            return;
        }

        // Проверяем расширение
        if (!selected.name.toLowerCase().endsWith('.json')) {
            setError('❌ Поддерживаются только JSON файлы (.json)');
            setFile(null);
            return;
        }

        setFile(selected);
        setLoading(true);

        // Читаем и парсим JSON
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const text = String(e.target.result || '');
                const parsed = JSON.parse(text);

                const normalized = normalizeEntries(parsed);

                if (normalized.length === 0) {
                    throw new Error('JSON должен быть массивом или объектом с данными');
                }

                const firstItem = normalized[0];
                if (!firstItem.ru || !firstItem.uz) {
                    throw new Error('Каждый элемент должен иметь поля "ru" и "uz"');
                }

                setData(normalized);
                setSuccess(`✅ Загружено ${normalized.length} элементов`);
                setLoading(false);
            } catch (err) {
                setError(`❌ Ошибка: ${err.message}`);
                setLoading(false);
                setFile(null);
            }
        };

        reader.onerror = () => {
            setError('❌ Ошибка чтения файла');
            setLoading(false);
        };

        reader.readAsText(selected);
    };

    // Импорт данных
    const handleImport = async () => {
        if (data.length === 0) {
            setError('❌ Нет данных для импорта');
            return;
        }

        setImporting(true);
        setError('');
        setSuccess('');
        setImportProgress({ status: 'running', message: 'Импорт в процессе...' });

        try {
            const result = await adminAPI.importHierarchy(data);

            setImportProgress({
                status: 'done',
                message: `✅ Импорт завершён!`
            });

            setSuccess(`
✅ УСПЕШНО!

📊 Статистика:
• Всего концептов: ${result.statistics?.totalConcepts || 0}
• Root концептов: ${result.statistics?.rootConcepts || 0}
• Категории: ${(result.statistics?.categories || []).join(', ') || 'нет'}

Сервер автоматически:
✓ Нормализовал слова
✓ Удалил склонения
✓ Создал semantic key
✓ Построил иерархию
✓ Создал семантический граф
✓ Сохранил структуру
            `.trim());

            // Очищаем форму
            setFile(null);
            setData([]);
            if (inputRef.current) inputRef.current.value = '';
        } catch (err) {
            const errorMsg = err.message || 'Неизвестная ошибка';
            
            // Проверяем если это ошибка авторизации
            if (errorMsg.includes('авторизация') || errorMsg.includes('Token')) {
                setError(`❌ ${errorMsg}\n\n⚠️ Пожалуйста, откройте главную страницу и залогиньтесь снова!`);
            } else {
                const errorData = err.response?.data;
                let errorMessage = `❌ Ошибка импорта: ${errorData?.message || errorMsg}`;
                
                // Если есть детальные ошибки валидации
                if (errorData?.errors && Array.isArray(errorData.errors)) {
                    errorMessage += '\n\n🔍 Проблемы:\n' + errorData.errors.map(e => `• ${e}`).join('\n');
                }
                
                setError(errorMessage);
            }
            setImportProgress({ status: 'error', message: 'Ошибка при импорте' });
        } finally {
            setImporting(false);
        }
    };

    return (
        <div className="admin-import-container">
            <div className="admin-import-section">
                <h2>📥 Импорт данных</h2>
                <p className="admin-import-subtitle">
                    Загрузите JSON файл с иерархией слов. Поддерживаются массив объектов и формат словаря по ключам, как в animalia.json.
                </p>

                {/* Выбор файла */}
                <div className="admin-import-file-section">
                    <label className="admin-import-file-label">
                        <input
                            ref={inputRef}
                            type="file"
                            accept=".json"
                            onChange={handleFileChange}
                            disabled={importing}
                            className="admin-import-file-input"
                        />
                        <span className="admin-import-file-button">
                            <span className="admin-import-file-icon">📂</span>
                            Выбрать JSON файл
                        </span>
                    </label>

                    {file && (
                        <div className="admin-import-file-info">
                            <div className="admin-import-file-name">
                                📄 {file.name}
                            </div>
                            <div className="admin-import-file-size">
                                {(file.size / 1024).toFixed(2)} KB
                            </div>
                        </div>
                    )}
                </div>

                {/* Сообщения */}
                {error && (
                    <div className="admin-import-message admin-import-error">
                        <span className="message-icon">❌</span>
                        {error}
                    </div>
                )}

                {success && (
                    <div className="admin-import-message admin-import-success">
                        <span className="message-icon">✅</span>
                        {success.split('\n').map((line, i) => (
                            <div key={i}>{line}</div>
                        ))}
                    </div>
                )}

                {loading && (
                    <div className="admin-import-message admin-import-loading">
                        <span className="message-spinner">⏳</span>
                        Загрузка файла...
                    </div>
                )}

                {/* Превью загруженных данных */}
                {data.length > 0 && !loading && (
                    <div className="admin-import-preview-section">
                        <div className="admin-import-preview-header">
                            <h3>✅ Ваши данные ({data.length})</h3>
                            <div className="admin-import-stats">
                                <span className="stat">
                                    <strong>{data.length}</strong> элементов
                                </span>
                                <span className="stat">
                                    <strong>{data.filter(d => d.category).length}</strong> с категориями
                                </span>
                                <span className="stat">
                                    <strong>{data.filter(d => d.parent || d.parent_ru || d.parent_semantic_key).length}</strong> с родителями
                                </span>
                            </div>
                        </div>

                        <div className="admin-import-preview">
                            <table className="admin-import-data-table">
                                <thead>
                                    <tr>
                                        <th>Русский</th>
                                        <th>Узбекский</th>
                                        <th>Родитель</th>
                                        <th>Категория</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.slice(0, 8).map((item, idx) => (
                                        <tr key={idx}>
                                            <td className="cell-ru">{item.ru}</td>
                                            <td className="cell-uz">{item.uz}</td>
                                            <td className="cell-parent">
                                                {item.parent || item.parent_ru || item.parent_semantic_key || '—'}
                                            </td>
                                            <td className="cell-category">
                                                {item.category || 'general'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {data.length > 8 && (
                                <div className="admin-import-preview-more">
                                    ... и ещё {data.length - 8} элементов
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Прогресс импорта */}
                {importProgress && (
                    <div className={`admin-import-progress admin-import-progress-${importProgress.status}`}>
                        <div className="progress-header">
                            {importProgress.status === 'running' && <span className="spinner">⏳</span>}
                            {importProgress.status === 'done' && <span className="checkmark">✅</span>}
                            {importProgress.status === 'error' && <span className="error-icon">❌</span>}
                            <span>{importProgress.message}</span>
                        </div>
                    </div>
                )}

                {/* Кнопки действий */}
                <div className="admin-import-actions">
                    <button
                        className="admin-import-btn admin-import-btn-import"
                        onClick={handleImport}
                        disabled={data.length === 0 || importing || loading}
                    >
                        {importing ? '⏳ Импорт...' : '📥 Импортировать'}
                    </button>
                    <button
                        className="admin-import-btn admin-import-btn-cancel"
                        onClick={() => {
                            setFile(null);
                            setData([]);
                            setError('');
                            setSuccess('');
                            if (inputRef.current) inputRef.current.value = '';
                        }}
                        disabled={importing}
                    >
                        ❌ Отмена
                    </button>
                </div>
            </div>
        </div>
    );
}
