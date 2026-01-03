/**
 * Physics Knowledge Graph Visualization
 * Uses D3.js for force-directed graph and timeline views
 */

class PhysicsKnowledgeGraph {
    constructor() {
        this.nodes = [];
        this.edges = [];
        this.filteredNodes = [];
        this.filteredEdges = [];
        this.simulation = null;
        this.svg = null;
        this.zoom = null;
        this.currentView = 'graph';
        this.selectedNode = null;

        // Node colors by type
        this.colors = {
            scientist: '#8b5cf6',
            equation: '#22c55e',
            concept: '#f59e0b',
            discovery: '#06b6d4'
        };

        // Node sizes by type
        this.sizes = {
            scientist: 28,
            equation: 22,
            concept: 24,
            discovery: 20
        };

        this.init();
    }

    async init() {
        await this.loadData();
        this.setupEventListeners();
        this.renderGraph();
    }

    async loadData() {
        try {
            const response = await fetch('/api/kg/list');
            if (!response.ok) throw new Error('Failed to load data');

            const data = await response.json();
            this.nodes = data.nodes || [];
            this.edges = data.edges || [];
            this.filteredNodes = [...this.nodes];
            this.filteredEdges = [...this.edges];

            this.updateStats(data.stats);
            document.getElementById('graphLoading').style.display = 'none';

        } catch (err) {
            console.error('Failed to load knowledge graph:', err);
            document.getElementById('graphLoading').innerHTML = `
                <i class="fas fa-exclamation-triangle" style="font-size: 3rem; opacity: 0.5;"></i>
                <span>Failed to load knowledge graph</span>
            `;
        }
    }

    updateStats(stats) {
        if (!stats) return;
        document.getElementById('statScientists').textContent = stats.nodesByType?.scientist || 0;
        document.getElementById('statEquations').textContent = stats.nodesByType?.equation || 0;
        document.getElementById('statConcepts').textContent = stats.nodesByType?.concept || 0;
        document.getElementById('statDiscoveries').textContent = stats.nodesByType?.discovery || 0;
        document.getElementById('statEdges').textContent = stats.totalEdges || 0;
    }

    setupEventListeners() {
        // View toggle
        document.querySelectorAll('.kg-view-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.kg-view-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.switchView(btn.dataset.view);
            });
        });

        // Filters
        document.getElementById('typeFilter').addEventListener('change', () => this.applyFilters());
        document.getElementById('categoryFilter').addEventListener('change', () => this.applyFilters());
        document.getElementById('searchInput').addEventListener('input', 
            this.debounce(() => this.applyFilters(), 300)
        );

        // Zoom controls
        document.getElementById('zoomIn').addEventListener('click', () => this.zoomBy(1.3));
        document.getElementById('zoomOut').addEventListener('click', () => this.zoomBy(0.7));
        document.getElementById('zoomReset').addEventListener('click', () => this.resetZoom());

        // Detail panel
        document.getElementById('closeDetail').addEventListener('click', () => this.closeDetailPanel());
    }

    switchView(view) {
        this.currentView = view;
        const graphContainer = document.getElementById('graphContainer');
        const timelineContainer = document.getElementById('timelineContainer');

        if (view === 'graph') {
            graphContainer.classList.remove('hidden');
            timelineContainer.classList.remove('active');
            this.renderGraph();
        } else {
            graphContainer.classList.add('hidden');
            timelineContainer.classList.add('active');
            this.renderTimeline();
        }
    }

    applyFilters() {
        const type = document.getElementById('typeFilter').value;
        const category = document.getElementById('categoryFilter').value;
        const search = document.getElementById('searchInput').value.toLowerCase();

        this.filteredNodes = this.nodes.filter(node => {
            if (type && node.type !== type) return false;
            if (category && node.category !== category) return false;
            if (search) {
                const searchable = [
                    node.name, node.name_zh, node.description, 
                    node.description_zh, node.formula
                ].filter(Boolean).join(' ').toLowerCase();
                if (!searchable.includes(search)) return false;
            }
            return true;
        });

        const nodeIds = new Set(this.filteredNodes.map(n => n.id));
        this.filteredEdges = this.edges.filter(e => 
            nodeIds.has(e.source_id || e.source?.id || e.source) && 
            nodeIds.has(e.target_id || e.target?.id || e.target)
        );

        if (this.currentView === 'graph') {
            this.renderGraph();
        } else {
            this.renderTimeline();
        }
    }

    renderGraph() {
        const container = document.getElementById('kg-graph');
        container.innerHTML = '';

        if (this.filteredNodes.length === 0) {
            container.innerHTML = `
                <div class="kg-empty">
                    <i class="fas fa-project-diagram"></i>
                    <h3>No nodes found</h3>
                    <p>Try adjusting your filters</p>
                </div>
            `;
            return;
        }

        const width = container.clientWidth;
        const height = container.clientHeight;

        // Create SVG
        this.svg = d3.select('#kg-graph')
            .append('svg')
            .attr('width', width)
            .attr('height', height);

        // Add zoom behavior with better trackpad support
        this.zoom = d3.zoom()
            .scaleExtent([0.1, 4])
            .filter((event) => {
                // Allow all events except wheel (we handle wheel separately)
                if (event.type === 'wheel') {
                    return event.ctrlKey || event.metaKey; // Only zoom on pinch (ctrl/cmd + wheel)
                }
                return true;
            })
            .on('zoom', (event) => {
                g.attr('transform', event.transform);
            });

        this.svg.call(this.zoom);

        // Custom wheel handler for trackpad panning
        let currentTransform = d3.zoomIdentity;
        this.svg.on('wheel.pan', (event) => {
            // If ctrl/cmd is pressed, let D3 handle it for zooming (pinch gesture)
            if (event.ctrlKey || event.metaKey) return;
            
            event.preventDefault();
            
            // Get current transform
            currentTransform = d3.zoomTransform(this.svg.node());
            
            // Apply pan with smooth damping
            const dx = -event.deltaX;
            const dy = -event.deltaY;
            
            // Create new transform with panning
            const newTransform = currentTransform.translate(dx / currentTransform.k, dy / currentTransform.k);
            
            // Apply transform smoothly
            this.svg.call(this.zoom.transform, newTransform);
        }, { passive: false });

        const g = this.svg.append('g');

        // Prepare data for D3
        const nodes = this.filteredNodes.map(n => ({
            ...n,
            id: n.id
        }));

        const nodeMap = new Map(nodes.map(n => [n.id, n]));

        const links = this.filteredEdges
            .filter(e => {
                const sourceId = e.source_id || e.source;
                const targetId = e.target_id || e.target;
                return nodeMap.has(sourceId) && nodeMap.has(targetId);
            })
            .map(e => ({
                ...e,
                source: e.source_id || e.source,
                target: e.target_id || e.target
            }));

        // Create simulation
        this.simulation = d3.forceSimulation(nodes)
            .force('link', d3.forceLink(links).id(d => d.id).distance(120))
            .force('charge', d3.forceManyBody().strength(-400))
            .force('center', d3.forceCenter(width / 2, height / 2))
            .force('collision', d3.forceCollide().radius(d => this.sizes[d.type] + 10));

        // Draw links
        const link = g.append('g')
            .selectAll('line')
            .data(links)
            .join('line')
            .attr('class', 'kg-link')
            .attr('stroke-opacity', 0.6);

        // Draw link labels
        const linkLabel = g.append('g')
            .selectAll('text')
            .data(links)
            .join('text')
            .attr('class', 'kg-link-label')
            .text(d => this.formatRelationship(d.relationship));

        // Draw nodes
        const node = g.append('g')
            .selectAll('g')
            .data(nodes)
            .join('g')
            .attr('class', 'kg-node')
            .call(this.drag(this.simulation))
            .on('click', (event, d) => this.showNodeDetail(d))
            .on('mouseover', (event, d) => this.showTooltip(event, d))
            .on('mouseout', () => this.hideTooltip());

        // Node circles
        node.append('circle')
            .attr('r', d => this.sizes[d.type])
            .attr('fill', d => this.colors[d.type])
            .style('filter', 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))');

        // Node icons
        node.append('text')
            .attr('dy', 5)
            .attr('text-anchor', 'middle')
            .attr('font-family', 'Font Awesome 6 Free')
            .attr('font-weight', 900)
            .attr('font-size', d => this.sizes[d.type] * 0.6)
            .text(d => this.getNodeIcon(d.type));

        // Node labels
        node.append('text')
            .attr('dy', d => this.sizes[d.type] + 16)
            .attr('text-anchor', 'middle')
            .attr('font-size', 11)
            .attr('fill', 'rgba(255,255,255,0.9)')
            .text(d => d.name.length > 15 ? d.name.substring(0, 15) + '...' : d.name);

        // Update positions on tick
        this.simulation.on('tick', () => {
            link
                .attr('x1', d => d.source.x)
                .attr('y1', d => d.source.y)
                .attr('x2', d => d.target.x)
                .attr('y2', d => d.target.y);

            linkLabel
                .attr('x', d => (d.source.x + d.target.x) / 2)
                .attr('y', d => (d.source.y + d.target.y) / 2);

            node.attr('transform', d => `translate(${d.x},${d.y})`);
        });

        // Initial zoom to fit
        setTimeout(() => this.fitGraph(), 500);
    }

    getNodeIcon(type) {
        const icons = {
            scientist: '\uf007', // fa-user
            equation: '\uf12b', // fa-superscript
            concept: '\uf0eb', // fa-lightbulb
            discovery: '\uf0d0'  // fa-search
        };
        return icons[type] || '\uf111';
    }

    formatRelationship(rel) {
        const labels = {
            'invented_by': 'invented',
            'leads_to': 'led to',
            'part_of': 'part of',
            'influenced': 'influenced',
            'discovered': 'discovered',
            'applied_in': 'applied in',
            'based_on': 'based on'
        };
        return labels[rel] || rel;
    }

    drag(simulation) {
        function dragstarted(event) {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            event.subject.fx = event.subject.x;
            event.subject.fy = event.subject.y;
        }

        function dragged(event) {
            event.subject.fx = event.x;
            event.subject.fy = event.y;
        }

        function dragended(event) {
            if (!event.active) simulation.alphaTarget(0);
            event.subject.fx = null;
            event.subject.fy = null;
        }

        return d3.drag()
            .on('start', dragstarted)
            .on('drag', dragged)
            .on('end', dragended);
    }

    fitGraph() {
        if (!this.svg) return;
        
        const g = this.svg.select('g');
        const bounds = g.node().getBBox();
        const container = document.getElementById('kg-graph');
        const width = container.clientWidth;
        const height = container.clientHeight;

        const dx = bounds.width;
        const dy = bounds.height;
        const x = bounds.x + dx / 2;
        const y = bounds.y + dy / 2;

        const scale = Math.min(0.9 * width / dx, 0.9 * height / dy, 1.5);
        const translate = [width / 2 - scale * x, height / 2 - scale * y];

        this.svg.transition().duration(750).call(
            this.zoom.transform,
            d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale)
        );
    }

    zoomBy(factor) {
        if (!this.svg || !this.zoom) return;
        this.svg.transition().duration(300).call(this.zoom.scaleBy, factor);
    }

    resetZoom() {
        this.fitGraph();
    }

    showTooltip(event, node) {
        const tooltip = document.getElementById('tooltip');
        let content = `<strong>${node.name}</strong>`;
        if (node.name_zh) content += `<br>${node.name_zh}`;
        if (node.formula) content += `<br><em>${node.formula}</em>`;
        if (node.year_start) {
            content += `<br>${node.year_start}`;
            if (node.year_end) content += ` - ${node.year_end}`;
        }

        tooltip.innerHTML = content;
        tooltip.style.left = (event.pageX + 10) + 'px';
        tooltip.style.top = (event.pageY - 10) + 'px';
        tooltip.classList.add('visible');
    }

    hideTooltip() {
        document.getElementById('tooltip').classList.remove('visible');
    }

    async showNodeDetail(node) {
        this.selectedNode = node;
        const panel = document.getElementById('detailPanel');
        const content = document.getElementById('detailContent');

        try {
            const response = await fetch(`/api/kg/${node.id}`);
            const data = await response.json();

            if (!response.ok) throw new Error(data.error);

            const nodeData = data.node;
            const connections = data.connections;

            let html = `
                <span class="kg-detail-type ${nodeData.type}">${nodeData.type}</span>
                <h2 class="kg-detail-name">${nodeData.name}</h2>
                ${nodeData.name_zh ? `<div class="kg-detail-name-zh">${nodeData.name_zh}</div>` : ''}
            `;

            if (nodeData.year_start) {
                html += `
                    <div class="kg-detail-years">
                        <i class="fas fa-calendar"></i>
                        <span>${nodeData.year_start}${nodeData.year_end ? ' - ' + nodeData.year_end : ''}</span>
                    </div>
                `;
            }

            if (nodeData.formula) {
                html += `<div class="kg-detail-formula">${nodeData.formula}</div>`;
            }

            html += `
                <div class="kg-detail-section">
                    <div class="kg-detail-section-title">Description</div>
                    <div class="kg-detail-description">${nodeData.description || 'No description available.'}</div>
                    ${nodeData.description_zh ? `<div class="kg-detail-description-zh">${nodeData.description_zh}</div>` : ''}
                </div>
            `;

            // Connections
            const allConnections = [...(connections.outgoing || []), ...(connections.incoming || [])];
            if (allConnections.length > 0) {
                html += `
                    <div class="kg-detail-connections">
                        <div class="kg-detail-section-title">Connections</div>
                `;

                for (const conn of allConnections) {
                    // Check if connection has target_name (outgoing) or source_name (incoming)
                    const isOutgoing = conn.target_name !== undefined;
                    const connName = isOutgoing ? conn.target_name : conn.source_name;
                    const connNameZh = isOutgoing ? conn.target_name_zh : conn.source_name_zh;
                    const connType = isOutgoing ? conn.target_type : conn.source_type;
                    const connId = isOutgoing ? conn.target_id : conn.source_id;
                    const relLabel = this.formatRelationship(conn.relationship);

                    // Skip connections with undefined names (orphaned edges)
                    if (!connName) continue;

                    html += `
                        <div class="kg-connection-item" data-id="${connId}">
                            <div class="kg-connection-icon ${connType || 'concept'}">
                                <i class="fas ${this.getIconClass(connType)}"></i>
                            </div>
                            <div class="kg-connection-info">
                                <div class="kg-connection-name">${connName}${connNameZh ? ' (' + connNameZh + ')' : ''}</div>
                                <div class="kg-connection-relation">${isOutgoing ? '→' : '←'} ${relLabel}</div>
                            </div>
                        </div>
                    `;
                }

                html += '</div>';
            }

            content.innerHTML = html;
            panel.classList.add('open');

            // Add click handlers to connections
            content.querySelectorAll('.kg-connection-item').forEach(item => {
                item.addEventListener('click', () => {
                    const connId = item.dataset.id;
                    const connNode = this.nodes.find(n => n.id === connId);
                    if (connNode) this.showNodeDetail(connNode);
                });
            });

        } catch (err) {
            console.error('Failed to load node details:', err);
            content.innerHTML = `
                <div class="kg-empty">
                    <i class="fas fa-exclamation-triangle"></i>
                    <h3>Failed to load details</h3>
                </div>
            `;
            panel.classList.add('open');
        }
    }

    getIconClass(type) {
        const icons = {
            scientist: 'fa-user',
            equation: 'fa-superscript',
            concept: 'fa-lightbulb',
            discovery: 'fa-search'
        };
        return icons[type] || 'fa-circle';
    }

    closeDetailPanel() {
        document.getElementById('detailPanel').classList.remove('open');
        this.selectedNode = null;
    }

    renderTimeline() {
        const container = document.getElementById('timeline');
        
        if (this.filteredNodes.length === 0) {
            container.innerHTML = `
                <div class="kg-empty" style="color: var(--text-secondary);">
                    <i class="fas fa-stream"></i>
                    <h3>No items found</h3>
                    <p>Try adjusting your filters</p>
                </div>
            `;
            return;
        }

        // Sort nodes by year
        const sortedNodes = [...this.filteredNodes]
            .filter(n => n.year_start)
            .sort((a, b) => a.year_start - b.year_start);

        // Group by era
        const eras = {
            'Classical Era (Before 1800)': sortedNodes.filter(n => n.year_start < 1800),
            '19th Century (1800-1899)': sortedNodes.filter(n => n.year_start >= 1800 && n.year_start < 1900),
            'Modern Physics (1900-1950)': sortedNodes.filter(n => n.year_start >= 1900 && n.year_start < 1950),
            'Contemporary (1950-Present)': sortedNodes.filter(n => n.year_start >= 1950)
        };

        let html = '';

        for (const [era, nodes] of Object.entries(eras)) {
            if (nodes.length === 0) continue;

            html += `
                <div class="kg-timeline-era">
                    <div class="kg-timeline-era-title">${era}</div>
            `;

            for (const node of nodes) {
                html += `
                    <div class="kg-timeline-item ${node.type}" data-id="${node.id}">
                        <div class="kg-timeline-card ${node.type}">
                            <span class="kg-timeline-type-badge ${node.type}">${node.type}</span>
                            <div class="kg-timeline-year">
                                ${node.year_start}${node.year_end ? ' - ' + node.year_end : ''}
                            </div>
                            <div class="kg-timeline-name">${node.name}</div>
                            ${node.name_zh ? `<div class="kg-timeline-name-zh">${node.name_zh}</div>` : ''}
                            ${node.formula ? `<div class="kg-timeline-formula">${node.formula}</div>` : ''}
                            <div class="kg-timeline-desc">${node.description || ''}</div>
                        </div>
                    </div>
                `;
            }

            html += '</div>';
        }

        // Add nodes without year
        const noYearNodes = this.filteredNodes.filter(n => !n.year_start);
        if (noYearNodes.length > 0) {
            html += `
                <div class="kg-timeline-era">
                    <div class="kg-timeline-era-title">Undated</div>
            `;
            for (const node of noYearNodes) {
                html += `
                    <div class="kg-timeline-item ${node.type}" data-id="${node.id}">
                        <div class="kg-timeline-card ${node.type}">
                            <span class="kg-timeline-type-badge ${node.type}">${node.type}</span>
                            <div class="kg-timeline-name">${node.name}</div>
                            ${node.name_zh ? `<div class="kg-timeline-name-zh">${node.name_zh}</div>` : ''}
                            ${node.formula ? `<div class="kg-timeline-formula">${node.formula}</div>` : ''}
                            <div class="kg-timeline-desc">${node.description || ''}</div>
                        </div>
                    </div>
                `;
            }
            html += '</div>';
        }

        container.innerHTML = html;

        // Add click handlers
        container.querySelectorAll('.kg-timeline-item').forEach(item => {
            item.addEventListener('click', () => {
                const nodeId = item.dataset.id;
                const node = this.filteredNodes.find(n => n.id === nodeId);
                if (node) this.showNodeDetail(node);
            });
        });
    }

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    window.knowledgeGraph = new PhysicsKnowledgeGraph();
});

