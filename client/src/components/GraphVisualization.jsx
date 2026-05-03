import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import './GraphVisualization.css';

/**
 * Компонент для визуализации дерева гиперонимо-гипонимических связей
 * Использует D3.js для отрисовки интерактивного графа
 */
export default function GraphVisualization({ data, width = 1000, height = 600 }) {
    const svgRef = useRef();
    const [hoveredNode, setHoveredNode] = useState(null);
    const [selectedNode, setSelectedNode] = useState(null);
    
    useEffect(() => {
        if (!data || !svgRef.current) return;
        
        drawGraph(data);
    }, [data, width, height]);
    
    const drawGraph = (tree) => {
        if (!tree) return;
        
        const svg = d3.select(svgRef.current);
        svg.selectAll("*").remove();
        
        // Вычисляем размер прямоугольника на основе длины слова
        const getRectDimensions = (word, isRoot = false) => {
            // Ширина динамическая, но высота ФИКСИРОВАННАЯ
            let width;
            if (isRoot) {
                width = Math.max(130, word.length * 10.5 + 25);
            } else {
                width = Math.max(115, word.length * 9.5 + 20);
            }
            
            // Высота ФИКСИРОВАННАЯ для всех карточек (одинакового размера)
            const height = isRoot ? 62 : 55;
            
            return { width, height };
        };
        
        // Фиксированный размер шрифта для читаемости (одна строка)
        const getFontSize = (isRoot = false) => {
            return isRoot ? '13px' : '11px';
        };
        
        // Конвертируем дерево в иерархию для D3
        const hierarchy = d3.hierarchy(tree);
        
        // Кастомный layout: корень в центре, прямые дети — по окружности,
        // более глубокие уровни — на концентрических кольцах.
        const customLayout = (node, depth = 0, parentAngle = 0) => {
            const cx = width / 2;
            const cy = height / 2;

            if (depth === 0) {
                // Корень в центре
                node.x = cx;
                node.y = cy;
            }

            if (node.children && node.children.length > 0) {
                const baseRadius = 220;
                const radius = baseRadius * (depth === 0 ? 1 : (depth + 0.9));

                if (depth === 0) {
                    // Распределяем прямых детей равномерно по всей окружности
                    const angleStep = (2 * Math.PI) / node.children.length;
                    node.children.forEach((child, i) => {
                        const angle = i * angleStep;
                        child.x = cx + radius * Math.cos(angle);
                        child.y = cy + radius * Math.sin(angle);
                        // передаём угол родителя дальше
                        customLayout(child, depth + 1, angle);
                    });
                } else {
                    // Для глубинных детей ставим их в небольшой сектор вокруг parentAngle
                    const sector = Math.min(Math.PI / 2, (Math.PI * 0.8) / node.children.length);
                    const start = parentAngle - sector * (node.children.length - 1) / 2;
                    node.children.forEach((child, i) => {
                        const angle = start + i * sector;
                        child.x = cx + radius * Math.cos(angle);
                        child.y = cy + radius * Math.sin(angle);
                        customLayout(child, depth + 1, angle);
                    });
                }
            }

            return node;
        };
        
        customLayout(hierarchy);
        const nodes = hierarchy.descendants();
        const links = hierarchy.links();
        
        // SVG группа для трансформации
        const g = svg.append('g');
        let currentZoomScale = 1; // track zoom scale to disable clicks when zoomed
        
        // === ZOOM & PAN ===
        const zoom = d3.zoom()
            .on('zoom', (event) => {
                g.attr('transform', event.transform);
                currentZoomScale = event.transform.k;
                // when user zooms in, hide selected details to avoid accidental clicks
                if (currentZoomScale > 1.2) {
                    setSelectedNode(null);
                }
            });
        
        svg.call(zoom);
        
        // === СВЯЗИ (рёбра) ===
        const linkGroup = g.append('g')
            .selectAll('path')
            .data(links)
            .enter()
            .append('path')
            .attr('class', d => {
                // Гиперонимы (вверх) - зелёные
                // Гипонимы (вниз) - синие
                return d.target.data.isHypernym ? 'link hypernym' : 'link hyponym';
            })
            .attr('d', d3.linkVertical()
                .x(d => d.x)
                .y(d => d.y)
            )
            .attr('stroke-width', 2)
            .attr('fill', 'none')
            .attr('marker-end', d => `url(#arrowhead-${d.target.data.isHypernym ? 'hyper' : 'hypo'})`)
            .style('opacity', 0.6)
            .on('mouseenter', function() {
                d3.select(this).style('opacity', 1).attr('stroke-width', 3);
            })
            .on('mouseleave', function() {
                d3.select(this).style('opacity', 0.6).attr('stroke-width', 2);
            });
        
        // === СТРЕЛКИ (маркеры) ===
        svg.append('defs').selectAll('marker')
            .data(['hypernym', 'hyponym'])
            .enter()
            .append('marker')
            .attr('id', d => `arrowhead-${d}`)
            .attr('markerWidth', 10)
            .attr('markerHeight', 10)
            .attr('refX', 9)
            .attr('refY', 3)
            .attr('orient', 'auto')
            .append('polygon')
            .attr('points', '0 0, 10 3, 0 6')
            .attr('fill', d => d === 'hypernym' ? '#27ae60' : '#3498db');
        
        // === УЗЛЫ ===
        const nodeEnter = g.append('g')
            .selectAll('g')
            .data(nodes)
            .enter()
            .append('g')
            .attr('class', 'node')
            .attr('transform', d => `translate(${d.x},${d.y})`)
            .on('mouseenter', function(event, d) {
                const nodeId = d.data._id || d.data.id;
                const rootId = tree._id || tree.id;
                const isRoot = nodeId === rootId;
                setHoveredNode(nodeId);
                d3.select(this).select('rect')
                    .transition()
                    .duration(200)
                    .attr('stroke-width', 4);
            })
            .on('mouseleave', function(event, d) {
                const nodeId = d.data._id || d.data.id;
                const rootId = tree._id || tree.id;
                const isRoot = nodeId === rootId;
                const isSelected = nodeId === selectedNode;
                if (!isSelected) {
                    setHoveredNode(null);
                    d3.select(this).select('rect')
                        .transition()
                        .duration(200)
                        .attr('stroke-width', isRoot ? 3 : 2);
                }
            })
            .on('click', function(event, d) {
                // ignore clicks when zoomed in past threshold
                if (currentZoomScale > 1.2) return;
                event.stopPropagation();
                const nodeId = d.data._id || d.data.id;
                const rootId = tree._id || tree.id;
                setSelectedNode(nodeId);
                
                // Обновляем все узлы
                g.selectAll('.node').select('rect')
                    .attr('stroke-width', node => {
                        const id = node.data._id || node.data.id;
                        const isRoot = id === rootId;
                        return (id === nodeId || isRoot) ? 4 : 2;
                    });
            });
        
        // Прямоугольники узлов
        nodeEnter.append('rect')
            .attr('width', d => {
                const nodeId = d.data._id || d.data.id;
                const rootId = tree._id || tree.id;
                const isRoot = nodeId === rootId;
                return getRectDimensions(d.data.word, isRoot).width;
            })
            .attr('height', d => {
                const nodeId = d.data._id || d.data.id;
                const rootId = tree._id || tree.id;
                const isRoot = nodeId === rootId;
                return getRectDimensions(d.data.word, isRoot).height;
            })
            .attr('x', d => {
                const nodeId = d.data._id || d.data.id;
                const rootId = tree._id || tree.id;
                const isRoot = nodeId === rootId;
                const w = getRectDimensions(d.data.word, isRoot).width;
                return -(w / 2);
            })
            .attr('y', d => {
                const nodeId = d.data._id || d.data.id;
                const rootId = tree._id || tree.id;
                const isRoot = nodeId === rootId;
                const h = getRectDimensions(d.data.word, isRoot).height;
                return -(h / 2);
            })
            .attr('class', d => {
                const nodeId = d.data._id || d.data.id;
                const rootId = tree._id || tree.id;
                if (nodeId === rootId) return 'node-rect root';
                return 'node-rect';
            })
            .attr('fill', d => {
                const nodeId = d.data._id || d.data.id;
                const rootId = tree._id || tree.id;
                if (nodeId === rootId) return '#e74c3c'; // Красный - корень
                if (d.data.isHypernym) return '#27ae60'; // Зелёный - гипероним
                return '#3498db'; // Синий - гипоним
            })
            .attr('stroke', '#2c3e50')
            .attr('stroke-width', d => {
                const nodeId = d.data._id || d.data.id;
                const rootId = tree._id || tree.id;
                const isRoot = nodeId === rootId;
                return isRoot ? 3 : 2;
            })
            .attr('rx', 8)
            .attr('ry', 8);
        
        // Текст (слова) — одна строка, ширина карточки увеличивается под длину
        nodeEnter.append('text')
            .attr('text-anchor', 'middle')
            .attr('class', 'node-label')
            .attr('fill', '#fff')
            .attr('font-size', d => {
                const nodeId = d.data._id || d.data.id;
                const rootId = tree._id || tree.id;
                const isRoot = nodeId === rootId;
                return getFontSize(isRoot);
            })
            .attr('font-weight', d => {
                const nodeId = d.data._id || d.data.id;
                const rootId = tree._id || tree.id;
                return nodeId === rootId ? 'bold' : 'normal';
            })
            .attr('pointer-events', 'none')
            .attr('dominant-baseline', 'middle')
            .text(d => d.data.word);
        
        // Язык (значок)
        nodeEnter.append('text')
            .attr('text-anchor', 'middle')
            .attr('dy', '1.8em')
            .attr('class', 'node-lang')
            .text(d => d.data.language === 'ru' ? 'RU' : 'UZ')
            .attr('font-size', '10px')
            .attr('pointer-events', 'none');
        
        // === ЛЕГЕНДА ===
        const legend = svg.append('g')
            .attr('class', 'legend')
            .attr('transform', 'translate(10, 10)');
        
        const legendData = [
            { color: '#e74c3c', label: 'Поисковое слово', type: 'circle' },
            { color: '#27ae60', label: 'Гиперонимы (родители)', type: 'circle' },
            { color: '#3498db', label: 'Гипонимы (дети)', type: 'circle' }
        ];
        
        legendData.forEach((item, i) => {
            const row = legend.append('g')
                .attr('transform', `translate(0, ${i * 25})`);
            
            row.append('rect')
                .attr('width', 10)
                .attr('height', 10)
                .attr('fill', item.color)
                .attr('stroke', '#2c3e50')
                .attr('stroke-width', 1)
                .attr('rx', 2);
            
            row.append('text')
                .attr('x', 15)
                .attr('y', 9)
                .attr('font-size', '12px')
                .attr('fill', '#2c3e50')
                .text(item.label);
        });
        
        // === ИНСТРУМЕНТЫ ===
        const toolbar = svg.append('g')
            .attr('class', 'toolbar')
            .attr('transform', `translate(${width - 120}, 10)`);
        
        // Кнопка Zoom In
        toolbar.append('rect')
            .attr('width', 40)
            .attr('height', 35)
            .attr('fill', 'white')
            .attr('stroke', '#bdc3c7')
            .attr('stroke-width', 1)
            .attr('rx', 4)
            .style('cursor', 'pointer')
            .on('click', () => {
                svg.transition()
                    .duration(750)
                    .call(zoom.scaleBy, 1.3);
            });
        
        toolbar.append('text')
            .attr('x', 20)
            .attr('y', 24)
            .attr('text-anchor', 'middle')
            .attr('font-size', '20px')
            .style('pointer-events', 'none')
            .text('Zoom +');
        
        // Кнопка Zoom Out
        toolbar.append('rect')
            .attr('width', 40)
            .attr('height', 35)
            .attr('y', 40)
            .attr('fill', 'white')
            .attr('stroke', '#bdc3c7')
            .attr('stroke-width', 1)
            .attr('rx', 4)
            .style('cursor', 'pointer')
            .on('click', () => {
                svg.transition()
                    .duration(750)
                    .call(zoom.scaleBy, 0.77);
            });
        
        toolbar.append('text')
            .attr('x', 20)
            .attr('y', 64)
            .attr('text-anchor', 'middle')
            .attr('font-size', '20px')
            .style('pointer-events', 'none')
            .text('Zoom -');
        
        // Кнопка Reset
        toolbar.append('rect')
            .attr('width', 40)
            .attr('height', 35)
            .attr('y', 80)
            .attr('fill', 'white')
            .attr('stroke', '#bdc3c7')
            .attr('stroke-width', 1)
            .attr('rx', 4)
            .style('cursor', 'pointer')
            .on('click', () => {
                svg.transition()
                    .duration(750)
                    .call(zoom.transform, d3.zoomIdentity);
            });
        
        toolbar.append('text')
            .attr('x', 20)
            .attr('y', 104)
            .attr('text-anchor', 'middle')
            .attr('font-size', '18px')
            .style('pointer-events', 'none')
            .text('↻');
    };
    
    return (
        <div className="graph-visualization">
            <div className="graph-container">
                <svg
                    ref={svgRef}
                    width={width}
                    height={height}
                    className="graph-svg"
                />
            </div>
            
            {selectedNode && (
                <div className="node-info">
                    <p>Выбран узел: <strong>{selectedNode}</strong></p>
                    <button onClick={() => setSelectedNode(null)}>✕ Очистить</button>
                </div>
            )}
            
            <div className="graph-hint">
                <span>Используй мышь для панорамирования и зуммирования</span>
            </div>
        </div>
    );
}
