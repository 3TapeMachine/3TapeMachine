import { Tape } from './Tape.js';
import * as d3 from 'd3';
import './tape.css';

const cellWidth = 50;
const cellHeight = 50;

const initTapeCells = (selection) => {
  selection.attr('class', 'tape-cell');
  selection.append('rect')
    .datum(null)
    .attr('width', cellWidth)
    .attr('height', cellHeight);
  selection.append('text')
    .text(d => d)
    .attr('x', cellWidth / 2)
    .attr('y', cellHeight / 2 + 8);
  return selection;
};

const positionCells = (selection, offset = 0) => {
  selection.attr('transform', (d, i) =>
    `translate(${(-cellWidth + 10 + cellWidth * (i + offset))})`
  );
  return selection;
};

const repositionWrapper = (wrapper) => {
  wrapper.attr('transform', 'translate(0 10)')
    .transition()
    .duration(0)
    .select('.exiting')
    .remove();
};


// Tape visualization centered around the tape head.
export default class TapeViz extends Tape {
  constructor(svg, lookaround, blank, input) {
    super(blank, input);
    Object.defineProperty(this, 'lookaround', {
      value: lookaround,
      writable: false,
      enumerable: true
    });
    Object.defineProperty(this, 'domNode', {
      value: svg,
      writable: false,
      enumerable: true
    });

    // width is before + head + after, trimming 2 off to show cut-off tape ends
    const width = cellWidth * (lookaround + 1 + lookaround - 2) + 2 * 10;
    const height = cellHeight + 2 * 10;
    svg.attr('width', '95%')
      .attr('viewBox', [0, 0, width, height].join(' '));

    this.wrapper = svg.append('g')
      .attr('class', 'wrapper')
      .call(repositionWrapper);

    svg.append('rect')
      .attr('id', 'tape-head')
      .attr('width', (1 + 1 / 5) * cellWidth)
      .attr('height', (1 + 1 / 5) * cellHeight)
      .attr('x', -cellWidth + 10 / 2 + cellWidth * lookaround)
      .attr('y', 10 / 2);

    this.wrapper.selectAll('.tape-cell')
      .data(this.readRange(-lookaround, lookaround))
      .enter()
      .append('g')
      .call(initTapeCells)
      .call(positionCells);
  }

  write(symbol) {
    // don't animate if symbol stays the same
    if (super.read() === symbol) {
      return;
    }
    super.write(symbol);

    // remove leftover .exiting in case animation was interrupted
    this.wrapper.selectAll('.exiting').remove();

    // d3 v6+ selection.node() replaces [0][0]
    d3.select(this.wrapper.node().childNodes[this.lookaround])
      .datum(symbol)
      .select('text')
      .attr('fill-opacity', '1')
      .attr('stroke-opacity', '1')
      .transition()
      .attr('fill-opacity', '0.4')
      .attr('stroke-opacity', '0.1')
      .transition()
      .text(d => d)
      .attr('fill-opacity', '1')
      .attr('stroke-opacity', '1')
      .transition()
      .duration(0)
      .attr('fill-opacity', null)
      .attr('stroke-opacity', null);
  }


  headRight() {
    super.headRight();
    this.wrapper.selectAll('.exiting').remove();
    moveHead(
      this.wrapper,
      // add to right end
      this.wrapper.append('g').datum(this.readOffset(this.lookaround)),
      // remove from left end
      this.wrapper.select('.tape-cell'),
      1, -1
    );
  }

  headLeft() {
    super.headLeft();
    this.wrapper.selectAll('.exiting').remove();
    moveHead(
      this.wrapper,
      this.wrapper.insert('g', ':first-child').datum(this.readOffset(-this.lookaround)),
      this.wrapper.select('.wrapper > .tape-cell:last-of-type'),
      -1, 0
    );
  }
}

function moveHead(wrapper, enter, exit, wOffset, cOffset) {
  // add to one end
  enter.call(initTapeCells);
  // remove from the other end
  exit.classed('exiting', true);
  // translate cells forward, and the wrapper backwards
  wrapper.selectAll('.tape-cell')
    .call(positionCells, cOffset);
  wrapper
    .attr('transform', `translate(${wOffset * cellWidth} 10)`)
    .transition()
    .call(repositionWrapper);
}