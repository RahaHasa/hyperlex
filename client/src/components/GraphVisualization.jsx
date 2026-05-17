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
        let root = d3.hierarchy(tree);
        
        // По умолчанию сворачиваем все уровни глубже 2 (depth > 0)
        root.descendants().forEach(d => {
            if (d.depth > 0 && d.children) {
                d._children = d.children;
                d.children = null;
            }
        });

        const g = svg.append('g');
        let currentZoomScale = 1; // track zoom scale to disable clicks when zoomed
        
        // === ZOOM & PAN ===
        const zoom = d3.zoom()
            .on('zoom', (event) => {
                g.attr('transform', event.transform);
                currentZoomScale = event.transform.k;
                if (currentZoomScale > 1.2) {
                    setSelectedNode(null);
                }
            });
        
        svg.call(zoom);

        const updateLayout = (source) => {
            // Кастомный layout: корень в центре, прямые дети — по окружности,
            // более глубокие уровни — на концентрических кольцах.
            const customLayout = (node, depth = 0, parentAngle = 0) => {
                // Если корень 0, то cx, cy это 0, 0, т.к. потом g центруется? 
                // Нет, раньше они брали width/2 
                const cx = width / 2;
                const cy = height / 2;

                if (depth === 0) {
                    node.x = cx;
                    node.y = cy;
                }

                if (node.children && node.children.length > 0) {
                    const baseRadius = 180;
                    const radius = baseRadius * (depth === 0 ? 1 : (depth + 1.2));

                    if (depth === 0) {
                        const angleStep = (2 * Math.PI) / Math.min(node.children.length, 5);
                        // Ограничиваем до 5 узлов для текущего уровня
                        const visibleChildren = node.children.slice(0, 5);
                        visibleChildren.forEach((child, i) => {
                            const angle = i * angleStep;
                            child.x = cx + radius * Math.cos(angle);
                            child.y = cy + radius * Math.sin(angle);
                            customLayout(child, depth + 1, angle);
                        });
                        // Скрываем остальных детей (чтобы не загромождать, если их больше 5)
                        for(let i = 5; i < node.children.length; i++) {
                             node.children[i].x = cx;
                             node.children[i].y = cy;
                        }
                    } else {
                        const maxSector = Math.PI * 0.8;
                        const visibleChildren = node.children.slice(0, 5);
                        const sectorWidth = Math.min(Math.PI / 4, maxSector / visibleChildren.length);
                        const start = parentAngle - (sectorWidth * (visibleChildren.length - 1)) / 2;
                        visibleChildren.forEach((child, i) => {
                            const angle = start + i * sectorWidth;
                            child.x = cx + radius * Math.cos(angle);
                            child.y = cy + radius * Math.sin(angle);
                            customLayout(child, depth + 1, angle);
                        });
                    }
                }
                return node;
            };
            
            customLayout(root);
            const nodes = root.descendants();
            const links = root.links();
            
            // Очищаем старые элементы перед перерисовкой
            g.selectAll('*').remove();

            // === СВЯЗИ (рёбра) ===
            const linkGroup = g.append('g')
                .selectAll('path')
                .data(links, d => (d.source.data._id || d.source.data.id) + "-" + (d.target.data._id || d.target.data.id))
                .enter()
                .append('path')
                .attr('class', d => d.target.data.isHypernym ? 'link hypernym' : 'link hyponym')
                .attr('d', d3.linkVertical().x(d => d.x).y(d => d.y))
                .attr('stroke-width', 2)
                .attr('fill', 'none')
                .attr('marker-end', d => `url(#arrowhead-${d.target.data.isHypernym ? 'hyper' : 'hypo'})`)
                .style('opacity', 0.6)
                .on('mouseenter', function() { d3.select(this).style('opacity', 1).attr('stroke-width', 3); })
                .on('mouseleave', function() { d3.select(this).style('opacity', 0.6).attr('stroke-width', 2); });

            // === УЗЛЫ ===
            const nodeEnter = g.append('g')
                .selectAll('g.node')
                .data(nodes, d => d.data._id || d.data.id)
                .enter()
                .append('g')
                .attr('class', 'node')
                .attr('transform', d => `translate(${d.x},${d.y})`)
                .on('click', function(event, d) {
                    event.stopPropagation();
                    const nodeId = d.data._id || d.data.id;
                    setSelectedNode(nodeId);
                    
                    // Переключаем children и перерисовываем дерево
                    if (d.children) {
                        d._children = d.children;
                        d.children = null;
                    } else if (d._children) {
                        d.children = d._children;
                        d._children = null;
                    }
                    updateLayout(root);
                });

            // Прямоугольники узлов (зеленый ободок если есть свернутые дети)
            nodeEnter.append('rect')
                .attr('width', d => getRectDimensions(d.data.word, d.depth === 0).width)
                .attr('height', d => getRectDimensions(d.data.word, d.depth === 0).height)
                .attr('x', d => -(getRectDimensions(d.data.word, d.depth === 0).width / 2))
                .attr('y', d => -(getRectDimensions(d.data.word, d.depth === 0).height / 2))
                .attr('class', d => d.depth === 0 ? 'node-rect root' : 'node-rect')
                .attr('fill', d => d.depth === 0 ? '#e74c3c' : (d.data.isHypernym ? '#27ae60' : '#3498db'))
                // Если есть свернутые дети, выделяем обводку
                .attr('stroke', d => d._children ? '#f1c40f' : '#2c3e50')
                .attr('stroke-width', d => d.depth === 0 ? 3 : (d._children ? 4 : 2))
                .attr('rx', 8)
                .attr('ry', 8);

            nodeEnter.append('text')
                .attr('text-anchor', 'middle')
                .attr('class', 'node-label')
                .attr('fill', '#fff')
                .attr('font-size', d => getFontSize(d.depth === 0))
                .attr('font-weight', d => d.depth === 0 ? 'bold' : 'normal')
                .attr('pointer-events', 'none')
                .attr('dominant-baseline', 'middle')
                .text(d => d.data.word);

            nodeEnter.append('text')
                .attr('text-anchor', 'middle')
                .attr('dy', '1.8em')
                .attr('class', 'node-lang')
                .text(d => d.data.language === 'ru' ? 'RU' : 'UZ')
                .attr('font-size', '10px')
                .attr('pointer-events', 'none');
        };

        // Запуск первой отрисовки
        updateLayout(root);
        
        // === СТРЕЛКИ (маркеры) выносим в дефы ===
        
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
