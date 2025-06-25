import * as d3 from 'd3';

// Helper function to create a unique ID for edges
function edgeId(edge) {
  return `edge-${edge.source.label}-${edge.target.label}`;
}

export default class StateViz {
  constructor(container, vertexMap, edges) {
    const nodes = Object.values(vertexMap);
    const links = edges;
    this.vertexMap = vertexMap;

    const width = container.node().getBoundingClientRect().width || 600;
    const height = 500;

    container.selectAll('*').remove(); // Clear previous visualizations
    const svg = container.append('svg')
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', [0, 0, width, height]);

    // Define arrow markers for the edges
    svg.append('defs').selectAll('marker')
      .data(['arrowhead'])
      .join('marker')
        .attr('id', String)
        .attr('viewBox', '0 -5 10 10')
        .attr('refX', 25)
        .attr('refY', 0)
        .attr('markerWidth', 6)
        .attr('markerHeight', 6)
        .attr('orient', 'auto')
      .append('path')
        .attr('d', 'M0,-5L10,0L0,5');

    // Set up the D3 force simulation
    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id(d => d.label).distance(150))
      .force('charge', d3.forceManyBody().strength(-800))
      .force('center', d3.forceCenter(width / 2, height / 2));

    // Create the visual elements for links (edges)
    const link = svg.append('g')
      .attr('class', 'links')
      .selectAll('path')
      .data(links)
      .join('path')
        .attr('id', edgeId)
        .attr('class', 'tm-edge')
        .attr('marker-end', 'url(#arrowhead)');

    // Create the visual elements for nodes (states)
    const node = svg.append('g')
      .attr('class', 'nodes')
      .selectAll('g')
      .data(nodes)
      .join('g');

    node.append('circle')
      .attr('r', 20)
      .attr('class', 'tm-state');

    node.append('text')
      .text(d => d.label)
      .attr('dy', '0.35em');

    // Add labels to the links
    const linkLabel = svg.append('g')
      .attr('class', 'link-labels')
      .selectAll('text')
      .data(links)
      .join('text')
        .attr('dy', -5)
      .append('textPath')
        .attr('xlink:href', d => `#${edgeId(d)}`)
        .attr('startOffset', '50%')
        .text(d => d.labels.join('\n'));

    // =================================================================
    // =========== START OF ADDED DRAG-AND-DROP LOGIC ==================
    // =================================================================

    // These functions define what happens when a drag event starts,
    // continues, and ends.
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
      // To "un-fix" a node's position, you might add a condition here
      // For now, we will keep it fixed after dragging.
      // To un-fix, you would set d.fx = null; and d.fy = null;
    }

    // Attach the drag behavior to the nodes
    node.call(d3.drag()
      .on('start', dragstarted)
      .on('drag', dragged)
      .on('end', dragended));
      
    // Add a double-click event to un-fix a node's position
    node.on('dblclick', (event, d) => {
        d.fx = null;
        d.fy = null;
    });

    // =================================================================
    // ============ END OF ADDED DRAG-AND-DROP LOGIC ===================
    // =================================================================


    // The 'tick' function updates the positions of all elements on each step of the simulation
    simulation.on('tick', () => {
      link.attr('d', d => {
        const dx = d.target.x - d.source.x;
        const dy = d.target.y - d.source.y;
        const dr = d.source === d.target ? 100 : 0; // For self-loops
        return `M${d.source.x},${d.source.y}A${dr},${dr} 0 0,1 ${d.target.x},${d.target.y}`;
      });
      node.attr('transform', d => `translate(${d.x},${d.y})`);
    });

    this.simulation = simulation;
  }
}