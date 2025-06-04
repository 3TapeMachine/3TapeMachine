'use strict';

var TM       = require('./TuringMachine'),
    d3       = require('d3-selection'),
    jsyaml   = require('js-yaml'),
    _        = require('lodash');
    
/**
 * TMViz: Visualization + simulation of a Turing Machine.
 * Updated for three-tape support: 
 *   - Replaced single `this.tape` + `this.headPos` with `this.tapes = [[],[],[]]` + `this.heads = [0,0,0]`.
 *   - Transition map built as nested [sym0][sym1][sym2] → { write: [w0,w1,w2], move: [d0,d1,d2], nextState }.
 *   - step() reads/writes/moves all three tapes.
 *   - render() draws three horizontal tape rows.
 */
function TMViz(container, spec, positionTable) {
  this.container = container;
  this.spec      = spec;              // holds blank, startState, input, table
  this.state     = spec.startState;
  this.isHalted  = false;
  this.isRunning = false;

  // *** CHANGED: Initialize three-tape data structures ***
  this.blank = spec.blank;            // e.g. '_'
  this.tapes = [ [], [], [] ];        // three tape arrays
  this.heads = [ 0, 0, 0 ];           // three head positions

  // Populate tape 0 from spec.input; if input is empty, initialize a single blank
  for (let i = 0; i < spec.input.length; i++) {
    this.tapes[0][i] = spec.input.charAt(i);
  }
  if (this.tapes[0].length === 0) {
    this.tapes[0] = [ this.blank ];
  }
  // Ensure tape 1 and tape 2 each have at least one blank cell
  if (this.tapes[1].length === 0) { this.tapes[1] = [ this.blank ]; }
  if (this.tapes[2].length === 0) { this.tapes[2] = [ this.blank ]; }

  // *** CHANGED: Build three-tape transitions map ***
  // spec.table is nested { state: { sym0: { sym1: { sym2: actionObj } } } }
  this.transitions = {};
  Object.keys(spec.table).forEach(state => {
    const level0 = spec.table[state];
    if (level0 == null) {
      this.transitions[state] = null;  // halting state
    } else {
      this.transitions[state] = {};
      Object.keys(level0).forEach(sym0 => {
        const level1 = level0[sym0];
        if (!level1 || typeof level1 !== 'object') {
          throw new Error(`Invalid three-tape table entry at state=${state}, sym0=${sym0}`);
        }
        this.transitions[state][sym0] = {};

        Object.keys(level1).forEach(sym1 => {
          const level2 = level1[sym1];
          if (!level2 || typeof level2 !== 'object') {
            throw new Error(`Invalid three-tape table entry at state=${state}, sym1=${sym1}`);
          }
          this.transitions[state][sym0][sym1] = {};

          Object.keys(level2).forEach(sym2 => {
            const action = level2[sym2];
            // action.write is an array [w0,w1,w2]
            // action.move  is an array [d0,d1,d2] of TM.MoveHead.left/right
            // action.next  is the next state string
            this.transitions[state][sym0][sym1][sym2] = {
              write:     action.write,
              move:      action.move,
              nextState: action.next
            };
          });
        });
      });
    }
  });

  // Set up SVG/groups for rendering
  this.setupSVG();

  // Kick off the first render
  this.render();
}

/**
 * setupSVG:
 *   Creates an SVG element inside this.container for drawing tapes + heads.
 *   Adjusts as needed for three rows.
 */
TMViz.prototype.setupSVG = function() {
  // Clear container
  this.container.innerHTML = '';

  // Create an SVG element that fills the container
  this.svg = d3.select(this.container)
    .append('svg')
      .attr('width',  '100%')
      .attr('height', '100%');

  // Create a group for tape cells
  this.cellsGroup = this.svg.append('g')
    .attr('class', 'cells-group');

  // Create a group for head arrows
  this.headGroup = this.svg.append('g')
    .attr('class', 'head-group');
};

/**
 * step: Execute one transition on all three tapes.
 * *** CHANGED: Reads triple-symbol, writes triple-symbol, moves triple heads. ***
 */
TMViz.prototype.step = function() {
  if (this.isHalted) return;

  // (1) Read three symbols under the three heads (or blank if undefined)
  const sym0 = this.tapes[0][ this.heads[0] ] || this.blank;
  const sym1 = this.tapes[1][ this.heads[1] ] || this.blank;
  const sym2 = this.tapes[2][ this.heads[2] ] || this.blank;

  // (2) Lookup triple-symbol rule
  const stateObj = this.transitions[this.state];
  const rule = stateObj
               && stateObj[sym0]
               && stateObj[sym0][sym1]
               && stateObj[sym0][sym1][sym2];
  if (!rule) {
    this.isHalted = true;
    return;
  }

  // (3) Write new symbols on each tape
  this.tapes[0][ this.heads[0] ] = rule.write[0];
  this.tapes[1][ this.heads[1] ] = rule.write[1];
  this.tapes[2][ this.heads[2] ] = rule.write[2];

  // (4) Move each head left/right according to rule.move array
  this.heads[0] += (rule.move[0] === TM.MoveHead.right ? +1 : -1);
  this.heads[1] += (rule.move[1] === TM.MoveHead.right ? +1 : -1);
  this.heads[2] += (rule.move[2] === TM.MoveHead.right ? +1 : -1);

  // (5) Extend any tape if a head moved off the left/right end
  [0, 1, 2].forEach(i => {
    if (this.heads[i] < 0) {
      // Prepend a blank cell
      this.tapes[i].unshift(this.blank);
      this.heads[i] = 0;
    }
    if (this.heads[i] >= this.tapes[i].length) {
      // Append a blank cell
      this.tapes[i].push(this.blank);
    }
  });

  // (6) Update state
  this.state = rule.nextState;

  // Re-render after the step
  this.render();
};

/**
 * reset: Restore initial configuration from spec.
 * *** CHANGED: Reinitialize three tapes/heads. ***
 */
TMViz.prototype.reset = function() {
  this.state    = this.spec.startState;
  this.isHalted = false;

  // Reinitialize tape-0 from input
  this.tapes = [ [], [], [] ];
  for (let i = 0; i < this.spec.input.length; i++) {
    this.tapes[0][i] = this.spec.input.charAt(i);
  }
  if (this.tapes[0].length === 0) {
    this.tapes[0] = [ this.blank ];
  }
  // Tape-1 and tape-2 get one blank cell each
  this.tapes[1] = [ this.blank ];
  this.tapes[2] = [ this.blank ];

  this.heads = [ 0, 0, 0 ];

  // Redraw
  this.render();
};

/**
 * render: Draw three tape rows and head arrows.
 * *** CHANGED: Loops over this.tapes (tIdx = 0,1,2) instead of single tape. ***
 */
TMViz.prototype.render = function() {
  const CELL_W = 30, CELL_H = 30;
  const HEAD_Y = 10;        // vertical offset for arrow above a tape
  const GAP_Y  = 60;        // vertical gap between each tape row
  const windowRadius = 10;  // show ±10 cells around each head

  // Clear previous cells and heads
  this.cellsGroup.selectAll('*').remove();
  this.headGroup.selectAll('*').remove();

  // For each tape (tIdx: 0,1,2), render cells and head
  this.tapes.forEach((tapeArr, tIdx) => {
    const headPos = this.heads[tIdx];
    const startIdx = Math.max(0, headPos - windowRadius);
    const endIdx   = Math.min(tapeArr.length - 1, headPos + windowRadius);

    // Build array of visible cells for this tape
    const visibleCells = [];
    for (let i = startIdx; i <= endIdx; i++) {
      visibleCells.push({
        index:  i,
        symbol: tapeArr[i] || this.blank
      });
    }

    // Bind data to a <g> for each cell
    const cellSel = this.cellsGroup
      .selectAll(`.tape${tIdx}-cell`)
      .data(visibleCells, d => d.index);

    // ENTER: append new cell <g>
    const enterSel = cellSel.enter()
      .append('g')
        .attr('class', `tape${tIdx}-cell`);

    // Append rect for each entered cell
    enterSel.append('rect')
      .attr('width',  CELL_W)
      .attr('height', CELL_H)
      .attr('x', d => (d.index - startIdx) * CELL_W)
      .attr('y', tIdx * GAP_Y + 50)
      .attr('fill', '#eee')
      .attr('stroke', '#000');

    // Append text for each entered cell
    enterSel.append('text')
      .attr('x', d => (d.index - startIdx) * CELL_W + CELL_W / 2)
      .attr('y', tIdx * GAP_Y + 50 + CELL_H / 2 + 5)
      .attr('text-anchor', 'middle')
      .text(d => d.symbol)
      .attr('font-size', '14px')
      .attr('fill', '#000');

    // UPDATE: shift existing cells and update symbol
    cellSel.select('rect')
      .attr('x', d => (d.index - startIdx) * CELL_W)
      .attr('y', tIdx * GAP_Y + 50);
    cellSel.select('text')
      .attr('x', d => (d.index - startIdx) * CELL_W + CELL_W / 2)
      .attr('y', tIdx * GAP_Y + 50 + CELL_H / 2 + 5)
      .text(d => d.symbol);

    // EXIT: remove cells that scrolled out of view
    cellSel.exit().remove();

    // Draw head arrow for this tape
    const headX = (headPos - startIdx) * CELL_W;
    const headSel = this.headGroup
      .selectAll(`.tape${tIdx}-head`)
      .data([true]);

    // ENTER: create one arrow
    headSel.enter()
      .append('path')
        .attr('class', `tape${tIdx}-head`)
        .attr('d', 'M0,10 L10,0 L20,10 Z')  // simple triangle arrow
        .attr('fill', 'red')
        .attr('transform', `translate(${headX}, ${tIdx * GAP_Y + 50 - HEAD_Y})`);

    // UPDATE: reposition the existing arrow
    headSel
      .attr('transform', `translate(${headX}, ${tIdx * GAP_Y + 50 - HEAD_Y})`);

    // EXIT: unlikely to happen (always one head), but keep for completeness
    headSel.exit().remove();
  });
};


// Export the class
module.exports = TMViz;
