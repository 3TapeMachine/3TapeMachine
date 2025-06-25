import * as d3 from 'd3';

// Helper function to create a unique ID for edges
function edgeId(edge) {
  // Use a more robust ID in case of multiple edges between same nodes
  const labels = edge.labels.join('').replace(/[^a-zA-Z0-9]/g, '');
  return `edge-${edge.source.label}-${edge.target.label}-${labels}`;
}

export default class StateViz {
  constructor(container, vertexMap, edges) {
    const nodes = Object.values(vertexMap);
    const links = edges;
    this.vertexMap = vertexMap;

    const width = container.node().getBoundingClientRect().width || 600;
    const height = 500;

    container.selectAll('*').remove();
    const svg = container.append('svg')
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', [0, 0, width, height]);

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

    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id(d => d.label).distance(150))
      .force('charge', d3.forceManyBody().strength(-800))
      .force('center', d3.forceCenter(width / 2, height / 2));

    const link = svg.append('g')
      .selectAll('path')
      .data(links)
      .join('path')
        .attr('id', edgeId)
        .attr('class', 'tm-edge')
        .attr('marker-end', 'url(#arrowhead)');

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
      .attr('dy', '0.35em')
      .attr('text-anchor', 'middle');

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
    // =========== START OF CORRECTED INTERACTION LOGIC ================
    // =================================================================

    // Click handler to "pin" and "un-pin" states
    node.on('click', (event, d) => {
        // Toggle the 'fixed' status of the node
        d.fixed = !d.fixed;
        if (d.fixed) {
            d.fx = d.x;
            d.fy = d.y;
        } else {
            // Un-pinning the node
            d.fx = null;
            d.fy = null;
        }
    });

    function dragstarted(event, d) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      // Use the node's current position as the fixed point
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event, d) {
      // Update the fixed position to the mouse's current position
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(event, d) {
      if (!event.active) simulation.alphaTarget(0);
      // If the node isn't set to be fixed (via click), un-pin it after drag.
      if (!d.fixed) {
        d.fx = null;
        d.fy = null;
      }
    }

    node.call(d3.drag()
      .on('start', dragstarted)
      .on('drag', dragged)
      .on('end', dragended));

    // =================================================================
    // ============ END OF CORRECTED INTERACTION LOGIC =================
    // =================================================================


    simulation.on('tick', () => {
      link.attr('d', d => {
        const dx = d.target.x - d.source.x;
        const dy = d.target.y - d.source.y;
        const dr = d.source === d.target ? 100 : 0;
        return `M${d.source.x},${d.source.y}A${dr},${dr} 0 0,1 ${d.target.x},${d.target.y}`;
      });
      node.attr('transform', d => `translate(${d.x},${d.y})`);
    });

    this.simulation = simulation;
  }
}