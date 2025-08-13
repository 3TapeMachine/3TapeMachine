import * as d3 from 'd3';
import './StateViz.css';

/* eslint-disable no-invalid-this */

// --- Vector Math Utilities ---

const addV = (a, b) => a.map((x, i) => x + b[i]);
const negateV = a => a.map(x => -x);
const subtractV = (a, b) => addV(a, negateV(b));
const multiplyV = (a, scalar) => a.map(x => x * scalar);
const normSqV = a => a.reduce((sum, x) => sum + x * x, 0);
const normV = a => Math.sqrt(normSqV(a));
const unitV = a => {
  const n = normV(a);
  return n === 0 ? a.map(() => 0) : a.map(x => x / n);
};

const angleV = ([x, y]) => Math.atan2(y, x);
const vectorFromLengthAngle = (l, angle) => [Math.cos(angle) * l, Math.sin(angle) * l];

// --- Edge Counting and Shape ---

const EdgeShape = Object.freeze({
  loop: Symbol('loop'),
  arc: Symbol('arc'),
  straight: Symbol('straight')
});

class EdgeCounter {
  constructor(edges) {
    this.counts = new Map();
    edges.forEach(e => {
      const key = `${e.source.index},${e.target.index}`;
      this.counts.set(key, (this.counts.get(key) || 0) + 1);
    });
  }
  numEdgesFromTo(src, target) {
    return this.counts.get(`${src},${target}`) || 0;
  }
  shapeForEdge(e) {
    if (e.target.index === e.source.index) {
      return EdgeShape.loop;
    } else if (this.numEdgesFromTo(e.target.index, e.source.index)) {
      return EdgeShape.arc;
    } else {
      return EdgeShape.straight;
    }
  }
}

// --- Edge Path Calculation ---

function edgePathFor(nodeRadius, shape, d) {
  if (shape === EdgeShape.loop) {
    const loopEndOffset = vectorFromLengthAngle(nodeRadius, -15 * Math.PI / 180);
    const loopArc = ` a 19,27 45 1,1 ${loopEndOffset[0]},${loopEndOffset[1] + nodeRadius}`;
    return function () {
      const x1 = d.source.x, y1 = d.source.y;
      return `M ${x1},${y1 - nodeRadius}${loopArc}`;
    };
  }
  if (shape === EdgeShape.arc) {
    return function () {
      const p1 = [d.source.x, d.source.y];
      const p2 = [d.target.x, d.target.y];
      const offset = subtractV(p2, p1);
      const radius = 6 / 5 * normV(offset);
      const angle = angleV(offset);
      const sep = -Math.PI / 4;
      const source = addV(p1, vectorFromLengthAngle(nodeRadius, angle + sep));
      const target = addV(p2, vectorFromLengthAngle(nodeRadius, angle + Math.PI - sep));
      return (p1[0] <= p2[0])
        ? `M ${source[0]} ${source[1]} A ${radius} ${radius} 0 0,1 ${target[0]} ${target[1]}`
        : `M ${target[0]} ${target[1]} A ${radius} ${radius} 0 0,0 ${source[0]} ${source[1]}`;
    };
  }
  // straight
  return function () {
    const p1 = [d.source.x, d.source.y];
    const p2 = [d.target.x, d.target.y];
    const offset = subtractV(p2, p1);
    if (offset[0] === 0 && offset[1] === 0) return null;
    const target = subtractV(p2, multiplyV(unitV(offset), nodeRadius));
    return `M ${p1[0]} ${p1[1]} L ${target[0]} ${target[1]}`;
  };
}

const rectCenter = svgrect => ({
  x: svgrect.x + svgrect.width / 2,
  y: svgrect.y + svgrect.height / 2
});

const identity = x => x;
const noop = () => {};

const limitRange = (min, max, value) => Math.max(min, Math.min(value, max));

const appendSVGTo = div => div.append('svg');

// --- Object Utilities ---

const pick = (obj, keys) =>
  Object.fromEntries(keys.filter(key => Object.prototype.hasOwnProperty.call(obj, key)).map(key => [key, obj[key]]));

const mapValues = (obj, fn) =>
  Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, fn(v, k)]));

const forEachObj = (obj, fn) => {
  Object.entries(obj).forEach(([k, v]) => fn(v, k));
};

// --- Main StateViz Function ---

/**
 * Create a state diagram inside an SVG.
 * Each vertex/edge (node/link) object is also annotated with @.domNode@
 * corresponding to its SVG element.
 *
 * Note: currently, element IDs (e.g. for textPath) will collide if multiple
 * diagrams are on the same document (HTML page).
 * @param  {d3.Selection}      container     Container to add the SVG to.
 * @param  {[LayoutNode] | StateMap} nodes  Parameter to D3's force.nodes.
 *   Important: passing a StateMap is recommended when using setPositionTable.
 *   Passing an array will key the state nodes by array index.
 * @param  {[LayoutEdge]}     linkArray     Parameter to D3's force.links.
 */
export default function StateViz(container, nodes, linkArray) {
  const w = 800;
  const h = 500;
  const linkDistance = 140;
  const nodeRadius = 20;

  const colors = d3.scaleOrdinal(d3.schemeCategory10);

  const svg = appendSVGTo(container, h / w);
  svg
    .attr('viewBox', `0 0 ${w} ${h}`)
    .attr('version', '1.1')
    .attr('xmlns', 'http://www.w3.org/2000/svg')
    .attr('xmlns:xlink', 'http://www.w3.org/1999/xlink');

  // Force Layout
  function dragstart(d) {
    force.alphaTarget(0.3).restart();
    svg.transition().style('box-shadow', 'inset 0 0 1px gold');
  }
  function dragend(d) {
    force.alphaTarget(0);
    svg.transition().style('box-shadow', null);
  }
  function releasenode(d) {
    d.fx = null;
    d.fy = null;
    force.alpha(1).restart();
  }
  
  const nodeArray = Array.isArray(nodes) ? nodes : Object.values(nodes);
  this.__stateMap = nodes;

  const force = d3.forceSimulation(nodeArray)
  // .force('link', d3.forceLink(linkArray).distance(linkDistance)) // <-- Disabled movement of states 
  // .force('charge', d3.forceManyBody().strength(-500))          // <-- Disabled repulsion between states
  .force('center', d3.forceCenter(w / 2, h / 2))
  .alpha(1)
  .alphaDecay(0.0228);

  // --- DRAG BEHAVIOR FOR CIRCLES ---
  const drag = d3.drag()
    .on('start', function (event, d) {
      if (!event.active) force.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
      dragstart(d);
    })
    .on('drag', function (event, d) {
      d.fx = event.x;
      d.fy = event.y;
    })
    .on('end', function (event, d) {
      if (!event.active) force.alphaTarget(0);
      d.fx = event.x;
      d.fy = event.y;
      dragend(d);
    });

  // Edges
  const edgeCounter = new EdgeCounter(linkArray);

  const edgeselection = svg.selectAll('.edgepath')
    .data(linkArray)
    .enter();

  const edgegroups = edgeselection.append('g');

  const labelAbove = (d, i) => `${-1.1 * (i + 1)}em`;
  const labelBelow = (d, i) => `${0.6 + 1.1 * (i + 1)}em`;

  edgegroups.each(function (edgeD, edgeIndex) {
    const group = d3.select(this);
    const edgepath = group
      .append('path')
      .attr('class', 'edgepath')
      .attr('id', `edgepath${edgeIndex}`)
      .each(function (d) { d.domNode = this; });
    const labels = group.selectAll('.edgelabel')
      .data(edgeD.labels).enter()
      .append('text')
      .attr('class', 'edgelabel');
    labels.append('textPath')
      .attr('xlink:href', () => `#edgepath${edgeIndex}`)
      .attr('startOffset', '50%')
      .text(identity);

    const shape = edgeCounter.shapeForEdge(edgeD);
    edgeD.getPath = edgePathFor(nodeRadius, shape, edgeD);
    switch (shape) {
      case EdgeShape.straight:
        labels.attr('dy', labelAbove);
        edgeD.refreshLabels = function () {
          labels.attr('transform', function () {
            if (edgeD.target.x < edgeD.source.x) {
              const c = rectCenter(this.getBBox());
              return `rotate(180 ${c.x} ${c.y})`;
            }
            return null;
          });
        };
        break;
      case EdgeShape.arc: {
        let isFlipped;
        edgeD.refreshLabels = function () {
          const shouldFlip = edgeD.target.x < edgeD.source.x;
          if (shouldFlip !== isFlipped) {
            edgepath.classed('reversed-arc', shouldFlip);
            labels.attr('dy', shouldFlip ? labelBelow : labelAbove);
            isFlipped = shouldFlip;
          }
        };
        break;
      }
      case EdgeShape.loop:
        labels.attr('transform', (d, i) =>
          `translate(${8 * (i + 1)} ${-8 * (i + 1)})`
        );
        edgeD.refreshLabels = noop;
        break;
      default:
        edgeD.refreshLabels = noop;
    }
  });
  const edgepaths = edgegroups.selectAll('.edgepath');

  // Nodes
  const nodeSelection = svg.selectAll('.node')
    .data(nodeArray)
    .enter();

  const nodecircles = nodeSelection
    .append('circle')
    .attr('class', 'node')
    .attr('r', nodeRadius)
    .style('fill', (d, i) => colors(i))
    .each(function (d) { d.domNode = this; })
    .on('dblclick', releasenode)
    .call(drag); // <-- Drag behavior attached to circles only

  const nodelabels = nodeSelection
    .append('text')
    .attr('class', 'nodelabel')
    .attr('dy', '0.25em')
    .text(d => d.label);

  // Arrowheads
  const svgdefs = svg.append('defs');
  svgdefs.selectAll('marker')
    .data(['arrowhead', 'active-arrowhead', 'reversed-arrowhead', 'reversed-active-arrowhead'])
    .enter().append('marker')
    .attr('id', d => d)
    .attr('viewBox', '0 -5 10 10')
    .attr('refX', d => (d.startsWith('reversed-')) ? 0 : 10)
    .attr('orient', 'auto')
    .attr('markerWidth', 10)
    .attr('markerHeight', 10)
    .append('path')
    .attr('d', 'M 0 -5 L 10 0 L 0 5 Z')
    .attr('transform', d => (d.startsWith('reversed-')) ? 'rotate(180 5 0)' : null);

  const svgCSS = `
    .edgepath {
      marker-end: url(#arrowhead);
    }
    .edgepath.active-edge {
      marker-end: url(#active-arrowhead);
    }
    .edgepath.reversed-arc {
      marker-start: url(#reversed-arrowhead);
      marker-end: none;
    }
    .edgepath.active-edge.reversed-arc {
      marker-start: url(#reversed-active-arrowhead);
      marker-end: none;
    }
  `;
  svg.append('style').each(function () {
    if (this.styleSheet) {
      this.styleSheet.cssText = svgCSS;
    } else {
      this.textContent = svgCSS;
    }
  });

  // Force Layout Update
  force.on('tick', function () {
    nodecircles
      .attr('cx', d => d.x = limitRange(nodeRadius, w - nodeRadius, d.x))
      .attr('cy', d => d.y = limitRange(nodeRadius, h - nodeRadius, d.y));

    nodelabels
      .attr('x', d => d.x)
      .attr('y', d => d.y);

    edgepaths.attr('d', d => d.getPath());

    edgegroups.each(function (d) { d.refreshLabels(); });

    if (nodeArray.every(d => d.fx !== undefined && d.fy !== undefined)) {
      force.stop();
    }
  });
  this.force = force;
}

// --- Positioning API ---

function getPositionTable(stateMap) {
  return mapValues(stateMap, node => pick(node, ['x', 'y', 'px', 'py', 'fixed']));
}

function setPositionTable(posTable, stateMap) {
  forEachObj(stateMap, (node, state) => {
    const position = posTable[state];
    if (position !== undefined) {
      Object.assign(node, position);
      // THIS IS THE KEY CHANGE: Pin the node by setting its fixed position.
      node.fx = position.x;
      node.fy = position.y;
    }
  });
}

Object.defineProperty(StateViz.prototype, 'positionTable', {
  get() { return getPositionTable(this.__stateMap); },
  set(posTable) {
    setPositionTable(posTable, this.__stateMap);
    // Now that the nodes are pinned, we can safely restart the simulation.
    this.force.alpha(1).restart();
  }
});