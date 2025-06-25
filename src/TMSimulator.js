import TMViz from './TMViz.js';
import { formatError } from './sharing/format.js';

export default class TMSimulator {
  constructor(container) {
    this.container = container;
    this.viz = null;
    this.error = null;
    this.onError = null;
  }

  get sourceCode() {
    return this.viz ? this.viz.sourceCode : null;
  }

  set sourceCode(spec) { // Changed 'str' to 'spec' for clarity
    if (this.viz && this.viz.__spec === spec) { return; }

    if (this.viz) {
      this.viz.stop();
    }
    
    this.container.style.display = 'none';
    this.error = null;

    if (spec != null) {
      try {
        // We now pass the full spec object directly
        this.viz = new TMViz(this.container, spec);
        this.container.style.display = null;
      } catch (e) {
        this.viz = null;
        this.error = formatError(e);
      }
    }
    if (this.onError) { this.onError(this.error); }
  }

  clear() {
    this.sourceCode = null;
  }

  get positionTable() {
    return this.viz ? this.viz.positionTable : null;
  }

  set positionTable(val) {
    if (this.viz) {
      this.viz.positionTable = val;
    }
  }
}