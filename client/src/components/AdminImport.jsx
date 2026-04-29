import React, { useRef, useState } from 'react';
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
    }).filter(row => row.word_ru || row.word_uz || row.word_1 || row.word_2);
}

function parseTSV(content) {
    const lines = content.split(/\r?\n/).filter(line => line.trim());
    if (lines.length < 1) {
        throw new Error('TSV файл должен содержать хотя бы одну строку');
    }

    // Проверяем, есть ли заголовок (содержит ли строка допустимые названия столбцов)
    const firstLine = lines[0].split('\t');
    const headerKeywords = ['word', 'link', 'uz', 'ru', 'definition', 'column', 'name', 'lemma'];
    const hasHeader = firstLine.some(col => 
        headerKeywords.some(keyword => col.toLowerCase().includes(keyword))
    );

    const startIdx = hasHeader ? 1 : 0;
    const headers = hasHeader 
        ? lines[0].split('\t').map(h => h.toLowerCase().trim())
        : ['word_1', 'word_2'];

    return lines.slice(startIdx).map(line => {
        const values = line.split('\t').map(v => v.trim());
        if (hasHeader && headers.length > 0) {
            const row = {};
            headers.forEach((header, index) => {
                row[header] = values[index] || '';
            });
            return row;
        } else {
            // Без заголовка - простая пара слов
            return {
                word_1: values[0] || '',
                word_2: values[1] || ''
            };
        }
    }).filter(row => Object.values(row).some(v => v.trim() !== ''));
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

    throw new Error('XML не содержит поддерживаемых данных');
}

// ===== КОНВЕРТЕР ОТ JSON/XML/TSV/TXT В CSV =====
function Converter() {
    const [sourceFile, setSourceFile] = useState(null);
    const [sourceFormat, setSourceFormat] = useState('');
    const [convertedData, setConvertedData] = useState([]);
    const [convertError, setConvertError] = useState('');
    const [convertSuccess, setConvertSuccess] = useState('');
    const [aiFilling, setAiFilling] = useState(false);
    const [enrichMethod, setEnrichMethod] = useState('openai');
    const inputRef = useRef(null);

    function handleSourceFileChange(event) {
        const selected = event.target.files?.[0];
        setConvertError('');
        setConvertSuccess('');
        setConvertedData([]);

        if (!selected) {
            setSourceFile(null);
            return;
        }

        const isJson = selected.name.toLowerCase().endsWith('.json');
        const isXml = selected.name.toLowerCase().endsWith('.xml');
        const isTxt = selected.name.toLowerCase().endsWith('.txt');
        const isTsv = selected.name.toLowerCase().endsWith('.tsv');
        const isBz2 = selected.name.toLowerCase().endsWith('.bz2');
        const isBz = selected.name.toLowerCase().endsWith('.bz');

        const formats = {
            json: isJson,
            xml: isXml,
            txt: isTxt,
            tsv: isTsv,
            bz2: isBz2,
            bz: isBz
        };

        const detectedFormat = Object.keys(formats).find(f => formats[f]);
        if (!detectedFormat) {
            setConvertError('Поддерживаются JSON, XML, TSV, TXT, BZ и BZ2 файлы');
            return;
        }

        if (detectedFormat === 'bz' || detectedFormat === 'bz2') {
            setConvertError('BZ/BZ2 конвертацию нужно делать на сервере. Используйте прямую загрузку в импортер.');
            return;
        }

        setSourceFormat(detectedFormat);
        setSourceFile(selected);

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const text = String(e.target.result || '');
                let data = [];

                if (detectedFormat === 'json') {
                    const parsed = JSON.parse(text);
                    data = Array.isArray(parsed) ? parsed : [parsed];
                } else if (detectedFormat === 'xml') {
                    data = parseXMLPreview(text);
                } else if (detectedFormat === 'tsv') {
                    data = parseTSV(text);
                } else if (detectedFormat === 'txt') {
                    data = parseTextPreview(text);
                }

                setConvertedData(data);
                setConvertSuccess(`Разобрано ${data.length} записей`);
            } catch (err) {
                setConvertError(`Ошибка разбора: ${err.message}`);
            }
        };

        reader.readAsText(selected);
    }

    function downloadAsCSV() {
        if (convertedData.length === 0) {
            setConvertError('Данные для скачивания не загружены');
            return;
        }

        const headers = ['word_ru', 'definition_ru', 'word_uz', 'definition_uz'];
        const csvLines = [headers.join(',')];

        convertedData.forEach(row => {
            const values = headers.map(header => {
                const val = row[header] || '';
                return `"${val.replace(/"/g, '""')}"`;
            });
            csvLines.push(values.join(','));
        });

        const csv = csvLines.join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.setAttribute('href', URL.createObjectURL(blob));
        link.setAttribute('download', `converted_${Date.now()}.csv`);
        link.click();

        setConvertSuccess('CSV скачан успешно');
    }

    async function fillMissingWithAI() {
        if (convertedData.length === 0) {
            setConvertError('Нет данных для AI-дозаполнения');
            return;
        }

        setAiFilling(true);
        setConvertError('');
        setConvertSuccess('');

        try {
            const CHUNK_SIZE = 100;
            const nextRows = [...convertedData];
            let totalEnriched = 0;

            for (let i = 0; i < nextRows.length; i += CHUNK_SIZE) {
                const chunk = nextRows.slice(i, i + CHUNK_SIZE);
                const result = await adminAPI.enrichImportRows(chunk, enrichMethod);
                const enrichedRows = Array.isArray(result.rows) ? result.rows : chunk;

                for (let j = 0; j < enrichedRows.length; j++) {
                    nextRows[i + j] = enrichedRows[j];
                }

                totalEnriched += Number(result.enrichedCount || 0);
                setConvertSuccess(`AI обработка (${enrichMethod}): ${Math.min(i + CHUNK_SIZE, nextRows.length)}/${nextRows.length}`);
            }

            setConvertedData(nextRows);
            setConvertSuccess(`Дозаполнение (${enrichMethod}) завершено. Изменено полей: ${totalEnriched}`);
        } catch (err) {
            setConvertError(err.message || 'Ошибка AI-дозаполнения');
        } finally {
            setAiFilling(false);
        }
    }

    return (
        <div className="admin-import__tab">
            <h3>Конвертер форматов в CSV</h3>
            <p className="admin-import__subtitle">
                Загрузите JSON, XML, TSV или TXT и сконвертируйте в CSV для последующей загрузки
            </p>

            <div className="admin-import__box">
                <label className="admin-import__file">
                    <input
                        ref={inputRef}
                        type="file"
                        accept=".json,.xml,.txt,.tsv"
                        onChange={handleSourceFileChange}
                    />
                    <span>Выбрать файл для конвертации</span>
                </label>
                {sourceFile && <div className="admin-import__selected">Файл: {sourceFile.name}</div>}
            </div>

            <div className="admin-import__box">
                <label className="admin-import__selected" style={{ marginTop: 0 }}>
                    Метод дозаполнения:
                </label>
                <select
                    value={enrichMethod}
                    onChange={(e) => setEnrichMethod(e.target.value)}
                    disabled={aiFilling}
                >
                    <option value="openai">OpenAI (батчи, ~5-10 мин)</option>
                    <option value="google">Google Translate (~2-5 мин)</option>
                </select>
            </div>

            {convertedData.length > 0 && (
                <div className="admin-import__preview">
                    <h4>Превью ({convertedData.slice(0, PREVIEW_LIMIT).length} из {convertedData.length})</h4>
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
                            {convertedData.slice(0, PREVIEW_LIMIT).map((row, index) => (
                                <tr key={index}>
                                    <td>{row.word_ru}</td>
                                    <td>{row.definition_ru}</td>
                                    <td>{row.word_uz}</td>
                                    <td>{row.definition_uz}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {convertError && <div className="admin-import__error">{convertError}</div>}
            {convertSuccess && <div className="admin-import__success">{convertSuccess}</div>}

            <div className="admin-import__actions">
                <button
                    type="button"
                    onClick={fillMissingWithAI}
                    disabled={convertedData.length === 0 || aiFilling}
                >
                    {aiFilling ? 'Заполняем...' : 'Заполнить UZ и описания RU/UZ'}
                </button>
                <button 
                    type="button" 
                    onClick={downloadAsCSV} 
                    disabled={convertedData.length === 0 || aiFilling}
                >
                    Скачать CSV
                </button>
            </div>
        </div>
    );
}

// ===== ЗАГРУЗЧИК CSV =====
function CSVUploader({ onSuccess, onCancel }) {
    const [csvFile, setCsvFile] = useState(null);
    const [csvPreview, setCsvPreview] = useState([]);
    const [csvTotalRows, setCsvTotalRows] = useState(0);
    const [csvError, setCsvError] = useState('');
    const [csvSuccess, setCsvSuccess] = useState('');
    const [loading, setLoading] = useState(false);
    const csvInputRef = useRef(null);

    function handleCSVFileChange(event) {
        const selected = event.target.files?.[0];
        setCsvError('');
        setCsvSuccess('');

        if (!selected) {
            setCsvFile(null);
            setCsvPreview([]);
            setCsvTotalRows(0);
            return;
        }

        if (!selected.name.toLowerCase().endsWith('.csv')) {
            setCsvError('Требуется CSV файл');
            return;
        }

        setCsvFile(selected);

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const text = String(e.target.result || '');
                const data = parseCSV(text);

                setCsvTotalRows(data.length);
                setCsvPreview(data.slice(0, PREVIEW_LIMIT));
            } catch (err) {
                setCsvError(`Ошибка разбора CSV: ${err.message}`);
                setCsvFile(null);
                setCsvPreview([]);
                setCsvTotalRows(0);
            }
        };

        reader.readAsText(selected);
    }

    async function handleCSVImport() {
        if (!csvFile) {
            setCsvError('Выберите CSV файл');
            return;
        }

        setLoading(true);
        setCsvError('');
        setCsvSuccess('');

        try {
            const formData = new FormData();
            formData.append('file', csvFile);
            formData.append('format', 'csv');

            const result = await adminAPI.importData(formData);

            setCsvSuccess(
                `Импорт завершен. Добавлено: ${result.created || 0}, обновлено: ${result.updated || 0}`
            );
            setCsvFile(null);
            setCsvPreview([]);
            setCsvTotalRows(0);
            if (csvInputRef.current) {
                csvInputRef.current.value = '';
            }

            if (onSuccess) {
                onSuccess();
            }
        } catch (err) {
            setCsvError(err.message || 'Не удалось импортировать CSV');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="admin-import__tab">
            <h3>Загрузить CSV в БД</h3>
            <p className="admin-import__subtitle">
                Используйте колонки: word_ru, definition_ru, word_uz, definition_uz или word_1, word_2
            </p>

            <div className="admin-import__box">
                <label className="admin-import__file">
                    <input
                        ref={csvInputRef}
                        type="file"
                        accept=".csv"
                        onChange={handleCSVFileChange}
                    />
                    <span>Выбрать CSV файл</span>
                </label>
                {csvFile && <div className="admin-import__selected">Файл: {csvFile.name}</div>}
            </div>

            {csvPreview.length > 0 && (
                <div className="admin-import__preview">
                    <h4>
                        Превью первых {csvPreview.length} строк
                        {csvTotalRows > csvPreview.length ? ` (из ${csvTotalRows})` : ''}
                    </h4>
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
                            {csvPreview.map((row, index) => (
                                <tr key={index}>
                                    <td>{row.word_ru || row.word_1}</td>
                                    <td>{row.definition_ru}</td>
                                    <td>{row.word_uz || row.word_2}</td>
                                    <td>{row.definition_uz}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <p className="admin-import__count">Всего слов в файле: <strong>{csvTotalRows}</strong></p>
                </div>
            )}

            {csvError && <div className="admin-import__error">{csvError}</div>}
            {csvSuccess && <div className="admin-import__success">{csvSuccess}</div>}

            <div className="admin-import__actions">
                <button 
                    type="button" 
                    onClick={handleCSVImport} 
                    disabled={loading || !csvFile}
                >
                    {loading ? 'Загружаем...' : 'Импортировать'}
                </button>
                <button type="button" onClick={onCancel} disabled={loading}>
                    Отмена
                </button>
            </div>
        </div>
    );
}

// ===== ГЛАВНЫЙ КОМПОНЕНТ =====
export default function AdminImport({ onSuccess, onCancel }) {
    const [activeTab] = useState('uploader');

    return (
        <div className="admin-import">
            <div className="admin-import__header">
                <h2>Импорт данных</h2>
                <p>Загрузка данных только из CSV-файла в БД.</p>
            </div>

            <div className="admin-import__content">
                {/* Конвертер временно скрыт: оставляем только CSV-загрузчик */}
                {/* {activeTab === 'converter' && <Converter />} */}
                <CSVUploader onSuccess={onSuccess} onCancel={onCancel} />
            </div>
        </div>
    );
}