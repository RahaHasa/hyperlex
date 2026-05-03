/**
 * Компонент визуализации графа
 * Интерактивное дерево гиперонимов/гипонимов на D3.js
 */

import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { treeToGraph, getNodeColor, formatWord, generateLinkPath } from '../utils/graphHelpers';
import './GraphView.css';

export default function GraphView({ 
    treeData, 
    onNodeClick,
    width = 1000,
    height = 700 
}) {
    const svgRef = useRef(null);
    const containerRef = useRef(null);
    const [dimensions, setDimensions] = useState({ width, height });
    const [tooltip, setTooltip] = useState({ show: false, x: 0, y: 0, content: null });
    const [selectedNode, setSelectedNode] = useState(null);
    
    // Обновление размеров при ресайзе
    useEffect(() => {
        const updateDimensions = () => {
            if (containerRef.current) {
                const { width: w, height: h } = containerRef.current.getBoundingClientRect();
                // На мобильке высота должна быть достаточной
                const newHeight = window.innerWidth < 640 ? 
                    Math.max(window.innerHeight * 0.5, 300) : 
                    Math.min(w * 0.625, 600);
                setDimensions({ 
                    width: Math.max(w, 300), 
                    height: newHeight 
                });
                console.log('📐 Размеры графа обновлены:', { w, h: newHeight, viewport: window.innerWidth });
            }
        };
        
        updateDimensions();
        window.addEventListener('resize', updateDimensions);
        return () => window.removeEventListener('resize', updateDimensions);
    }, []);
    
    // Отрисовка графа
    useEffect(() => {
        if (!svgRef.current || !treeData) return;
        
        const svg = d3.select(svgRef.current);
        svg.selectAll('*').remove();
        
        const { nodes, links } = treeToGraph(treeData);
        if (!nodes.length) return;
        
        const { width: w, height: h } = dimensions;
        const isMobile = window.innerWidth < 640;
        
        // Адаптивные margins для мобильки
        const margin = isMobile ? 
            { top: 20, right: 20, bottom: 20, left: 20 } :
            { top: 40, right: 40, bottom: 40, left: 40 };
        const innerWidth = w - margin.left - margin.right;
        const innerHeight = h - margin.top - margin.bottom;
        
        console.log('🎨 Отрисовка графа:', { 
            nodes: nodes.length, 
            links: links.length, 
            dimensions: { w, h },
            innerDimensions: { innerWidth, innerHeight },
            isMobile 
        });
        
        // SVG настройки
        svg.attr('width', w)
           .attr('height', h)
           .attr('viewBox', `0 0 ${w} ${h}`)
           .style('width', '100%')
           .style('height', 'auto');
        
        // Группа для трансформаций
        const g = svg.append('g')
            .attr('transform', `translate(${margin.left}, ${margin.top})`);
        
        // Zoom
        let currentZoomScale = 1;
        const zoom = d3.zoom()
            .scaleExtent([0.5, isMobile ? 2 : 3])
            .on('zoom', (event) => {
                g.attr('transform', event.transform);
                currentZoomScale = event.transform.k;
                if (currentZoomScale > 1.2) {
                    setSelectedNode(null);
                    setTooltip({ show: false, x: 0, y: 0, content: null });
                }
            });
        
        svg.call(zoom);
        
        // Радиальная раскладка: корень в центре, остальные узлы на кольцах
        const centerX = innerWidth / 2;
        const centerY = innerHeight / 2;
        const levels = new Map();

        nodes.forEach((node) => {
            const level = node.level || 0;
            if (!levels.has(level)) levels.set(level, []);
            levels.get(level).push(node);
        });

        const ringSpacing = isMobile ? 130 : 175;
        const maxRadius = Math.min(centerX, centerY) - 40;

        const positionedNodes = [];
        levels.forEach((levelNodes, level) => {
            if (level === 0) {
                positionedNodes.push({ ...levelNodes[0], x: centerX, y: centerY });
                return;
            }

            const radius = Math.min(maxRadius, Math.abs(level) * ringSpacing);
            const angleStep = (2 * Math.PI) / levelNodes.length;
            const offset = level < 0 ? -Math.PI / 2 : Math.PI / 2;

            levelNodes.forEach((node, index) => {
                const angle = offset + index * angleStep;
                positionedNodes.push({
                    ...node,
                    x: centerX + radius * Math.cos(angle),
                    y: centerY + radius * Math.sin(angle)
                });
            });
        });

        const nodePositionById = new Map(positionedNodes.map(node => [node.id, node]));
        const linkNodes = links.map((link) => ({
            ...link,
            source: nodePositionById.get(link.source),
            target: nodePositionById.get(link.target)
        }));
        
        // Линии связей
        const link = g.append('g')
            .attr('class', 'links')
            .selectAll('path')
            .data(linkNodes)
            .join('path')
            .attr('class', d => `link link-${d.type}`)
            .attr('fill', 'none')
            .attr('stroke', d => d.type === 'hypernym' ? 'var(--color-primary-light)' : 'var(--color-accent)')
            .attr('stroke-width', 2)
            .attr('stroke-opacity', 0.6);
        
        // Группы узлов
        const node = g.append('g')
            .attr('class', 'nodes')
            .selectAll('g')
            .data(positionedNodes)
            .join('g')
            .attr('class', d => `node node-${d.type}`)
            .style('cursor', 'pointer');
        
        // Вычисляем размер прямоугольника на основе длины слова
        const getRectSize = (word, isCenter = false) => {
            const multiplier = isMobile ? 0.9 : 1;
            
            // Ширина динамическая
            let width;
            if (isCenter) {
                width = Math.max(85, (word.length * 10.5 + 30) * multiplier);
            } else {
                width = Math.max(70, (word.length * 9 + 25) * multiplier);
            }
            
            // Высота ФИКСИРОВАННАЯ для всех карточек (одинакового размера)
            const height = (isCenter ? 56 : 48) * multiplier;
            
            return { width, height };
        };
        
        // Прямоугольники узлов
        node.append('rect')
            .attr('width', d => getRectSize(d.word, d.type === 'center').width)
            .attr('height', d => getRectSize(d.word, d.type === 'center').height)
            .attr('x', d => -(getRectSize(d.word, d.type === 'center').width / 2))
            .attr('y', d => -(getRectSize(d.word, d.type === 'center').height / 2))
            .attr('fill', d => getNodeColor(d))
            .attr('stroke', 'white')
            .attr('stroke-width', 2)
            .attr('rx', 6)
            .attr('ry', 6);
        
        // Текст узлов (одна строка)
        node.append('text')
            .attr('dy', '0.35em')
            .attr('text-anchor', 'middle')
            .attr('fill', 'white')
            .attr('font-size', d => {
                if (d.type === 'center') {
                    return isMobile ? '11px' : '13px';
                } else {
                    return isMobile ? '8px' : '10px';
                }
            })
            .attr('font-weight', d => d.type === 'center' ? '600' : '500')
            .attr('pointer-events', 'none')
            .text(d => d.word);
        
        // События узлов
        const handleNodeClick = (event, d) => {
            // Ignore clicks when zoomed in to avoid accidental detail popups
            if (currentZoomScale > 1.2) return;
            event.stopPropagation();
            event.preventDefault();
            setSelectedNode(d);
        };
        
        node.on('click', handleNodeClick)
        .on('mouseover', (event, d) => {
            // Подсвечиваем узел
            d3.select(event.currentTarget)
                .select('rect')
                .transition()
                .duration(200)
                .attr('stroke-width', 3);
            
            // Показываем tooltip
            const [x, y] = d3.pointer(event, svgRef.current);
            setTooltip({
                show: true,
                x: x + 10,
                y: y - 10,
                content: d
            });
        })
        .on('mouseout', (event, d) => {
            // Гасим подсветку
            d3.select(event.currentTarget)
                .select('rect')
                .transition()
                .duration(200)
                .attr('stroke-width', 2);
            
            // Скрываем tooltip
            setTooltip({ show: false, x: 0, y: 0, content: null });
        });
        
        // Обновление позиций
        link.attr('d', d => {
            return generateLinkPath(d.source, d.target);
        });

        node.attr('transform', d => `translate(${d.x}, ${d.y})`);
        
        // Функции перетаскивания
        return () => {};
        
    }, [treeData, dimensions]);
    
    if (!treeData) {
        return (
            <div className="graph-view graph-empty">
                <p>Выберите слово для отображения графа</p>
            </div>
        );
    }
    
    return (
        <div className="graph-view" ref={containerRef}>
            <svg 
                ref={svgRef} 
                width={dimensions.width} 
                height={dimensions.height}
                className="graph-svg"
            />
            
            {/* Легенда */}
            <div className="graph-legend">
                <div className="legend-item">
                    <span className="legend-dot hypernym"></span>
                    <span>Гиперонимы</span>
                </div>
                <div className="legend-item">
                    <span className="legend-dot center"></span>
                    <span>Текущее слово</span>
                </div>
                <div className="legend-item">
                    <span className="legend-dot hyponym"></span>
                    <span>Гипонимы</span>
                </div>
            </div>
            
            {/* Тултип при клике */}
            {selectedNode && (
                <div className="graph-tooltip-modal">
                    <div className="tooltip-content">
                        <button 
                            className="tooltip-close"
                            onClick={() => setSelectedNode(null)}
                        >
                            ✕
                        </button>
                        <div className="tooltip-header">
                            <span className={`tooltip-type ${selectedNode.type}`}>
                                {selectedNode.type === 'center' ? 'Текущее слово' : 
                                 selectedNode.type === 'hypernym' ? ' Гипероним' : 
                                 'Гипоним'}
                            </span>
                        </div>
                        <h3 className="tooltip-word">{selectedNode.word}</h3>
                        {selectedNode.definition && (
                            <p className="tooltip-def">{selectedNode.definition}</p>
                        )}
                        <div className="tooltip-id">ID: <code>{selectedNode.id}</code></div>
                    </div>
                    <div 
                        className="tooltip-overlay"
                        onClick={() => setSelectedNode(null)}
                    />
                </div>
            )}
            
            {/* Тултип при наведении */}
            {tooltip.show && tooltip.content && (
                <div 
                    className="graph-tooltip"
                    style={{ left: `${tooltip.x}px`, top: `${tooltip.y}px` }}
                >
                    <div className="tooltip-word">{tooltip.content.word}</div>
                    {tooltip.content.definition && (
                        <div className="tooltip-def">{tooltip.content.definition}</div>
                    )}
                </div>
            )}
            
            {/* Подсказка */}
            <div className="graph-hint">
                Перетаскивайте узлы • Колёсико для масштаба • Клик для перехода
            </div>
        </div>
    );
}
