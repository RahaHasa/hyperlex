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
        
        // Конвертируем дерево в иерархию для D3
        const hierarchy = d3.hierarchy(tree);
        const treeLayout = d3.tree().size([width, height]);
        const nodes = treeLayout(hierarchy).descendants();
        const links = treeLayout(hierarchy).links();
        
        // SVG группа для трансформации
        const g = svg.append('g');
        
        // === ZOOM & PAN ===
        const zoom = d3.zoom()
            .on('zoom', (event) => {
                g.attr('transform', event.transform);
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
                setHoveredNode(nodeId);
                d3.select(this).select('circle')
                    .transition()
                    .duration(200)
                    .attr('r', 12)
                    .attr('stroke-width', 3);
            })
            .on('mouseleave', function(event, d) {
                const nodeId = d.data._id || d.data.id;
                if (nodeId !== selectedNode) {
                    setHoveredNode(null);
                    d3.select(this).select('circle')
                        .transition()
                        .duration(200)
                        .attr('r', nodeId === selectedNode ? 10 : 7)
                        .attr('stroke-width', nodeId === selectedNode ? 3 : 2);
                }
            })
            .on('click', function(event, d) {
                event.stopPropagation();
                const nodeId = d.data._id || d.data.id;
                setSelectedNode(nodeId);
                
                // Обновляем все узлы
                g.selectAll('.node').select('circle')
                    .attr('r', node => {
                        const id = node.data._id || node.data.id;
                        return id === nodeId ? 10 : 7;
                    })
                    .attr('stroke-width', node => {
                        const id = node.data._id || node.data.id;
                        return id === nodeId ? 3 : 2;
                    });
            });
        
        // Окружности узлов
        nodeEnter.append('circle')
            .attr('r', d => {
                const nodeId = d.data._id || d.data.id;
                const rootId = tree._id || tree.id;
                return nodeId === rootId ? 10 : 7;
            })
            .attr('class', d => {
                const nodeId = d.data._id || d.data.id;
                const rootId = tree._id || tree.id;
                if (nodeId === rootId) return 'node-circle root';
                return 'node-circle';
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
                return nodeId === rootId ? 3 : 2;
            });
        
        // Текст (слова)
        nodeEnter.append('text')
            .attr('text-anchor', 'middle')
            .attr('dy', '.35em')
            .attr('class', 'node-label')
            .text(d => d.data.word)
            .attr('fill', '#2c3e50')
            .attr('font-size', '12px')
            .attr('font-weight', d => {
                const nodeId = d.data._id || d.data.id;
                const rootId = tree._id || tree.id;
                return nodeId === rootId ? 'bold' : 'normal';
            })
            .attr('pointer-events', 'none');
        
        // Язык (значок)
        nodeEnter.append('text')
            .attr('text-anchor', 'middle')
            .attr('dy', '1.8em')
            .attr('class', 'node-lang')
            .text(d => d.data.language === 'ru' ? '🇷🇺' : '🇺🇿')
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
            
            row.append('circle')
                .attr('r', 5)
                .attr('fill', item.color)
                .attr('stroke', '#2c3e50')
                .attr('stroke-width', 1);
            
            row.append('text')
                .attr('x', 15)
                .attr('y', 4)
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
            .text('🔍+');
        
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
            .text('🔍−');
        
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
                <span>💡 Используй мышь для панорамирования и зуммирования</span>
            </div>
        </div>
    );
}
