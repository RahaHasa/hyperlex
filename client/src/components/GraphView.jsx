/**
 * Компонент визуализации графа
 * Интерактивное дерево гиперонимов/гипонимов на D3.js
 */

import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { treeToGraph, getNodeColor, formatWord } from '../utils/graphHelpers';
import './GraphView.css';

export default function GraphView({ 
    treeData, 
    onNodeClick,
    width = 800,
    height = 500 
}) {
    const svgRef = useRef(null);
    const containerRef = useRef(null);
    const [dimensions, setDimensions] = useState({ width, height });
    const [tooltip, setTooltip] = useState({ show: false, x: 0, y: 0, content: null });
    
    // Обновление размеров при ресайзе
    useEffect(() => {
        const updateDimensions = () => {
            if (containerRef.current) {
                const { width: w } = containerRef.current.getBoundingClientRect();
                setDimensions({ width: w, height: Math.min(w * 0.625, 600) });
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
        const margin = { top: 40, right: 40, bottom: 40, left: 40 };
        const innerWidth = w - margin.left - margin.right;
        const innerHeight = h - margin.top - margin.bottom;
        
        // Группа для трансформаций
        const g = svg.append('g')
            .attr('transform', `translate(${margin.left}, ${margin.top})`);
        
        // Zoom
        const zoom = d3.zoom()
            .scaleExtent([0.5, 2])
            .on('zoom', (event) => {
                g.attr('transform', event.transform);
            });
        
        svg.call(zoom);
        
        // Симуляция силы
        const simulation = d3.forceSimulation(nodes)
            .force('link', d3.forceLink(links).id(d => d.id).distance(80))
            .force('charge', d3.forceManyBody().strength(-300))
            .force('center', d3.forceCenter(innerWidth / 2, innerHeight / 2))
            .force('y', d3.forceY().y(d => {
                const centerY = innerHeight / 2;
                return centerY - d.level * 100;
            }).strength(0.5));
        
        // Линии связей
        const link = g.append('g')
            .attr('class', 'links')
            .selectAll('path')
            .data(links)
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
            .data(nodes)
            .join('g')
            .attr('class', d => `node node-${d.type}`)
            .style('cursor', 'pointer')
            .call(d3.drag()
                .on('start', dragstarted)
                .on('drag', dragged)
                .on('end', dragended));
        
        // Круги узлов
        node.append('circle')
            .attr('r', d => d.type === 'center' ? 28 : 22)
            .attr('fill', d => getNodeColor(d))
            .attr('stroke', 'white')
            .attr('stroke-width', 2);
        
        // Текст узлов
        node.append('text')
            .attr('dy', '0.35em')
            .attr('text-anchor', 'middle')
            .attr('fill', 'white')
            .attr('font-size', d => d.type === 'center' ? '11px' : '10px')
            .attr('font-weight', d => d.type === 'center' ? '600' : '500')
            .text(d => formatWord(d.word, 10));
        
        // События узлов
        node.on('click', (event, d) => {
            event.stopPropagation();
            if (onNodeClick) onNodeClick(d.id);
        })
        .on('mouseover', (event, d) => {
            const [x, y] = d3.pointer(event, containerRef.current);
            setTooltip({
                show: true,
                x,
                y: y - 10,
                content: d
            });
        })
        .on('mouseout', () => {
            setTooltip({ show: false, x: 0, y: 0, content: null });
        });
        
        // Обновление позиций
        simulation.on('tick', () => {
            link.attr('d', d => {
                const dx = d.target.x - d.source.x;
                const dy = d.target.y - d.source.y;
                const dr = Math.sqrt(dx * dx + dy * dy) * 2;
                return `M${d.source.x},${d.source.y}A${dr},${dr} 0 0,1 ${d.target.x},${d.target.y}`;
            });
            
            node.attr('transform', d => `translate(${d.x}, ${d.y})`);
        });
        
        // Функции перетаскивания
        function dragstarted(event, d) {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
        }
        
        function dragged(event, d) {
            d.fx = event.x;
            d.fy = event.y;
        }
        
        function dragended(event, d) {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
        }
        
        return () => simulation.stop();
        
    }, [treeData, dimensions, onNodeClick]);
    
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
            
            {/* Тултип */}
            {tooltip.show && tooltip.content && (
                <div 
                    className="graph-tooltip"
                    style={{ left: tooltip.x, top: tooltip.y }}
                >
                    <div className="tooltip-word">{tooltip.content.word}</div>
                    {tooltip.content.definition && (
                        <div className="tooltip-def">{tooltip.content.definition}</div>
                    )}
                    <div className="tooltip-id">{tooltip.content.id}</div>
                </div>
            )}
            
            {/* Подсказка */}
            <div className="graph-hint">
                Перетаскивайте узлы • Колёсико для масштаба • Клик для перехода
            </div>
        </div>
    );
}
