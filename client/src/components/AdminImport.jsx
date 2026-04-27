import React, { useMemo, useRef, useState } from 'react';
import adminAPI from '../services/adminAPI';
import './AdminImport.css';

const PREVIEW_LIMIT = 20;

function parseCSVLine(line) {
    const values = [];
    let current = '';
    let insideQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
            if (insideQuotes && line[i + 1] === '"') {
                current += '"';
                i++;
            } else {
                insideQuotes = !insideQuotes;
            }
        } else if (char === ',' && !insideQuotes) {
            values.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }

    values.push(current.trim());
    return values;
}

function parseCSV(content) {
    const lines = content.split(/\r?\n/).filter(line => line.trim());
    if (lines.length < 2) {
        throw new Error('CSV должен содержать заголовок и хотя бы одну строку данных');
    }

    const headers = parseCSVLine(lines[0]).map(header => header.toLowerCase());
    return lines.slice(1).map(line => {
        const values = parseCSVLine(line);
        const row = {};
        headers.forEach((header, index) => {
            row[header] = values[index] || '';
        });
        return row;
    }).filter(row => row.word_ru || row.word_uz);
}

function parseTextPreview(content) {
    return String(content || '')
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean)
        .filter(line => !line.startsWith('#'))
        .map(line => {
            const parts = line.split(/[;,\t]/);
            return {
                word_ru: (parts[0] || '').trim(),
                definition_ru: (parts.slice(1).join(' ') || '').trim(),
                word_uz: '',
                definition_uz: ''
            };
        })
        .filter(row => row.word_ru);
}

function parseXMLPreview(content) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, 'application/xml');
    const parserError = doc.querySelector('parsererror');
    if (parserError) {
        throw new Error('Некорректный XML');
    }

    const result = [];

    // Формат с item/word_ru/word_uz
    const items = doc.querySelectorAll('item');
    if (items.length > 0) {
        items.forEach((item) => {
            const pick = (tag) => item.querySelector(tag)?.textContent?.trim() || '';
            const row = {
                word_ru: pick('word_ru'),
                definition_ru: pick('definition_ru'),
                word_uz: pick('word_uz'),
                definition_uz: pick('definition_uz')
            };
            if (row.word_ru || row.word_uz) result.push(row);
        });
        return result;
    }

    // RuWordNet synsets
    const synsets = doc.querySelectorAll('synset');
    if (synsets.length > 0) {
        synsets.forEach((synset) => {
            const definition = synset.getAttribute('definition') || '';
            const senses = synset.querySelectorAll('sense');
            if (senses.length > 0) {
                senses.forEach((sense) => {
                    const word = sense.textContent?.trim() || '';
                    if (word) {
                        result.push({ word_ru: word, definition_ru: definition, word_uz: '', definition_uz: '' });
                    }
                });
            } else {
                const fallbackWord = synset.getAttribute('ruthes_name') || '';
                if (fallbackWord) {
                    result.push({ word_ru: fallbackWord, definition_ru: definition, word_uz: '', definition_uz: '' });
                }
            }
        });
        return result;
    }

    // RuWordNet senses
    const senses = doc.querySelectorAll('senses > sense');
    if (senses.length > 0) {
        senses.forEach((sense) => {
            const word = sense.getAttribute('lemma') || sense.getAttribute('name') || '';
            if (word) {
                result.push({ word_ru: word.trim(), definition_ru: '', word_uz: '', definition_uz: '' });
            }
        });
        return result;
    }

    throw new Error('XML не содержит поддерживаемых данных для превью');
}

export default function AdminImport({ onSuccess, onCancel }) {
    const [file, setFile] = useState(null);
    const [format, setFormat] = useState('csv');
    const [preview, setPreview] = useState([]);
    const [totalRows, setTotalRows] = useState(0);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);
    const inputRef = useRef(null);

    const previewTitle = useMemo(() => {
        if (format === 'json') return 'JSON';
        if (format === 'xml') return 'XML';
        if (format === 'txt') return 'TXT';
        return 'CSV';
    }, [format]);

    function handleFileChange(event) {
        const selected = event.target.files?.[0];
        setError('');
        setSuccess('');

        if (!selected) {
            setFile(null);
            setPreview([]);
            setTotalRows(0);
            return;
        }

        const isJson = selected.name.toLowerCase().endsWith('.json');
        const isCsv = selected.name.toLowerCase().endsWith('.csv');
        const isXml = selected.name.toLowerCase().endsWith('.xml');
        const isTxt = selected.name.toLowerCase().endsWith('.txt');

        if (!isJson && !isCsv && !isXml && !isTxt) {
            setError('Поддерживаются CSV, JSON, XML и TXT файлы');
            setFile(null);
            setPreview([]);
            setTotalRows(0);
            return;
        }

        setFormat(isJson ? 'json' : isXml ? 'xml' : isTxt ? 'txt' : 'csv');
        setFile(selected);

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const text = String(e.target.result || '');
                let data = [];

                if (isJson) {
                    const parsed = JSON.parse(text);
                    data = Array.isArray(parsed) ? parsed : [parsed];
                } else if (isXml) {
                    data = parseXMLPreview(text);
                } else if (isTxt) {
                    data = parseTextPreview(text);
                } else {
                    data = parseCSV(text);
                }

                setTotalRows(data.length);
                setPreview(data.slice(0, PREVIEW_LIMIT));
            } catch (err) {
                setError(`Ошибка разбора файла: ${err.message}`);
                setFile(null);
                setPreview([]);
                setTotalRows(0);
            }
        };
        reader.readAsText(selected);
    }

    async function handleImport() {
        if (!file) {
            setError('Выберите файл для импорта');
            return;
        }

        setLoading(true);
        setError('');
        setSuccess('');

        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('format', format);

            const result = await adminAPI.importData(formData);

            setSuccess(
                `Импорт завершен. Добавлено: ${result.created || 0}, обновлено: ${result.updated || 0}. ` +
                `Следующие ID: ${result.nextRuId || '-'} / ${result.nextUzId || '-'}`
            );
            setFile(null);
            setPreview([]);
            setTotalRows(0);
            if (inputRef.current) {
                inputRef.current.value = '';
            }

            if (onSuccess) {
                onSuccess();
            }
        } catch (err) {
            setError(err.message || 'Не удалось импортировать файл');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="admin-import">
            <div className="admin-import__header">
                <h2>Массовый импорт</h2>
                <p>Загрузите CSV, JSON или XML. Для парного импорта используйте поля word_ru, definition_ru, word_uz, definition_uz.</p>
            </div>

            <div className="admin-import__box">
                <label className="admin-import__file">
                    <input
                        ref={inputRef}
                        type="file"
                        accept=".csv,.json,.xml,.txt"
                        onChange={handleFileChange}
                    />
                    <span>Выбрать {previewTitle} файл</span>
                </label>
                {file && <div className="admin-import__selected">Файл: {file.name}</div>}
            </div>

            {preview.length > 0 && (
                <div className="admin-import__preview">
                    <h3>
                        Превью первых {preview.length} строк
                        {totalRows > preview.length ? ` (из ${totalRows})` : ''}
                    </h3>
                    <table>
                        <thead>
                            <tr>
                                <th>Русский</th>
                                <th>Описание RU</th>
                                <th>Узбекский</th>
                                <th>Описание UZ</th>
                            </tr>
                        </thead>
                        <tbody>
                            {preview.map((row, index) => (
                                <tr key={index}>
                                    <td>{row.word_ru}</td>
                                    <td>{row.definition_ru}</td>
                                    <td>{row.word_uz}</td>
                                    <td>{row.definition_uz}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <p className="admin-import__count">Всего слов в файле: <strong>{totalRows}</strong></p>
                </div>
            )}

            {error && <div className="admin-import__error">{error}</div>}
            {success && <div className="admin-import__success">{success}</div>}

            <div className="admin-import__actions">
                <button type="button" onClick={handleImport} disabled={loading || !file}>
                    {loading ? 'Импортируем...' : 'Импортировать'}
                </button>
                <button type="button" onClick={onCancel} disabled={loading}>
                    Отмена
                </button>
            </div>
        </div>
    );
}