/**
 * Компонент визуализации графа.
 * Показывает путь по уровням и фокус на текущем уровне.
 */

import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { treeToGraph, calculateFocusedLayout, getNodeColor, generateLinkPath } from '../utils/graphHelpers';
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

    useEffect(() => {
        const updateDimensions = () => {
            if (!containerRef.current) return;

            const { width: containerWidth } = containerRef.current.getBoundingClientRect();
            const isMobile = window.innerWidth < 640;
            const nextHeight = isMobile
                ? Math.max(window.innerHeight * 0.58, 420)
                : Math.min(containerWidth * 0.72, 760);

            setDimensions({
                width: Math.max(containerWidth, 320),
                height: nextHeight
            });
        };

        updateDimensions();
        window.addEventListener('resize', updateDimensions);

        return () => window.removeEventListener('resize', updateDimensions);
    }, []);

    useEffect(() => {
        if (!svgRef.current || !treeData) return;

        const svg = d3.select(svgRef.current);
        svg.selectAll('*').remove();

        const { nodes, links, rows } = treeToGraph(treeData);
        if (!nodes.length) return;

        const { width: w, height: h } = dimensions;
        const isMobile = window.innerWidth < 640;
        const margin = isMobile
            ? { top: 20, right: 16, bottom: 28, left: 46 }
            : { top: 28, right: 30, bottom: 32, left: 64 };
        const innerWidth = w - margin.left - margin.right;
        const innerHeight = h - margin.top - margin.bottom;

        svg.attr('width', w)
            .attr('height', h)
            .attr('viewBox', `0 0 ${w} ${h}`)
            .style('width', '100%')
            .style('height', 'auto');

        const content = svg.append('g')
            .attr('transform', `translate(${margin.left}, ${margin.top})`);

        const zoomLayer = content.append('g');

        const zoom = d3.zoom()
            .scaleExtent([0.8, isMobile ? 1.8 : 2.2])
            .on('zoom', (event) => {
                zoomLayer.attr('transform', event.transform);
            });

        svg.call(zoom);

        const positionedNodes = calculateFocusedLayout(rows, innerWidth, innerHeight, isMobile);
        const nodePositionById = new Map(positionedNodes.map((node) => [node.id, node]));
        const positionedLinks = links
            .map((link) => ({
                ...link,
                source: nodePositionById.get(link.source),
                target: nodePositionById.get(link.target)
            }))
            .filter((link) => link.source && link.target);

        const rowLabels = rows.map((row, index) => {
            const firstNode = row[0];
            const label = row.length === 1
                ? `Level ${firstNode?.level || index + 1}: ${firstNode?.word || ''}`
                : `Level ${firstNode?.level || index + 1}: ${row.length} words`;

            return {
                label,
                y: positionedNodes.find((node) => node.rowIndex === index)?.y || 0,
                isActive: index === rows.length - 1
            };
        });

        zoomLayer.append('g')
            .attr('class', 'graph-level-labels')
            .selectAll('text')
            .data(rowLabels)
            .join('text')
            .attr('x', 8)
            .attr('y', (d) => d.y + 4)
            .attr('text-anchor', 'start')
            .attr('class', (d) => `graph-level-label${d.isActive ? ' active' : ''}`)
            .text((d) => d.label);

        zoomLayer.append('g')
            .attr('class', 'links')
            .selectAll('path')
            .data(positionedLinks)
            .join('path')
            .attr('class', (d) => `link link-${d.type}`)
            .attr('fill', 'none')
            .attr('stroke', (d) => (d.type === 'focus' ? 'var(--color-primary)' : 'var(--color-primary-light)'))
            .attr('stroke-width', (d) => (d.type === 'focus' ? 2.5 : 2))
            .attr('stroke-opacity', (d) => (d.type === 'sibling' ? 0.45 : 0.75))
            .attr('d', (d) => generateLinkPath(d.source, d.target));

        const nodeGroup = zoomLayer.append('g')
            .attr('class', 'nodes')
            .selectAll('g')
            .data(positionedNodes)
            .join('g')
            .attr('class', (d) => `node node-${d.type}`)
            .attr('transform', (d) => `translate(${d.x}, ${d.y})`)
            .style('cursor', 'pointer');

        const getRectSize = (word, isCurrent = false) => {
            const multiplier = isMobile ? 0.9 : 1;
            const boxWidth = Math.max(isCurrent ? 112 : 98, Math.min((word.length * (isCurrent ? 10.2 : 9.4) + 34) * multiplier, isMobile ? 156 : 196));
            const boxHeight = (isCurrent ? 58 : 50) * multiplier;
            return { width: boxWidth, height: boxHeight };
        };

        nodeGroup.append('rect')
            .attr('width', (d) => getRectSize(d.word, d.type === 'center').width)
            .attr('height', (d) => getRectSize(d.word, d.type === 'center').height)
            .attr('x', (d) => -(getRectSize(d.word, d.type === 'center').width / 2))
            .attr('y', (d) => -(getRectSize(d.word, d.type === 'center').height / 2))
            .attr('fill', (d) => getNodeColor(d))
            .attr('stroke', (d) => (d.type === 'center' ? '#f3e4b8' : 'rgba(255,255,255,0.95)'))
            .attr('stroke-width', (d) => (d.type === 'center' ? 3 : 2))
            .attr('rx', 12)
            .attr('ry', 12);

        nodeGroup.append('text')
            .attr('dy', '-0.1em')
            .attr('text-anchor', 'middle')
            .attr('fill', 'white')
            .attr('font-size', (d) => (d.type === 'center' ? (isMobile ? '11px' : '13px') : (isMobile ? '9px' : '11px')))
            .attr('font-weight', (d) => (d.type === 'center' ? '700' : '600'))
            .attr('pointer-events', 'none')
            .text((d) => d.word);

        nodeGroup.append('text')
            .attr('dy', '1.35em')
            .attr('text-anchor', 'middle')
            .attr('fill', 'rgba(255,255,255,0.85)')
            .attr('font-size', isMobile ? '8px' : '9px')
            .attr('font-weight', '500')
            .attr('pointer-events', 'none')
            .text((d) => `Level ${d.level}`);

        nodeGroup
            .on('click', (event, d) => {
                event.stopPropagation();
                if (typeof onNodeClick === 'function') {
                    onNodeClick(d.id);
                }
            })
            .on('mouseover', (event, d) => {
                d3.select(event.currentTarget)
                    .select('rect')
                    .transition()
                    .duration(160)
                    .attr('stroke-width', d.type === 'center' ? 4 : 3);

                const [x, y] = d3.pointer(event, svgRef.current);
                setTooltip({
                    show: true,
                    x: x + 12,
                    y: y - 12,
                    content: d
                });
            })
            .on('mouseout', (event, d) => {
                d3.select(event.currentTarget)
                    .select('rect')
                    .transition()
                    .duration(160)
                    .attr('stroke-width', d.type === 'center' ? 3 : 2);

                setTooltip({ show: false, x: 0, y: 0, content: null });
            });
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

            <div className="graph-legend">
                <div className="legend-item">
                    <span className="legend-dot hypernym"></span>
                    <span>Путь к родителю</span>
                </div>
                <div className="legend-item">
                    <span className="legend-dot center"></span>
                    <span>Выбранное слово</span>
                </div>
                <div className="legend-item">
                    <span className="legend-dot hyponym"></span>
                    <span>Слова уровня</span>
                </div>
            </div>

            {tooltip.show && tooltip.content && (
                <div
                    className="graph-tooltip"
                    style={{ left: `${tooltip.x}px`, top: `${tooltip.y}px` }}
                >
                    <div className="tooltip-word">{tooltip.content.word}</div>
                    <div className="tooltip-level">Level {tooltip.content.level}</div>
                    {tooltip.content.definition && (
                        <div className="tooltip-def">{tooltip.content.definition}</div>
                    )}
                </div>
            )}

            <div className="graph-hint">
                На уровнях выше показывается путь к слову. На текущем уровне видно до 5 слов, клик переводит фокус на выбранное.
            </div>
        </div>
    );
}
