import TMSimulator from './TMSimulator.js';
import * as parser from './parser.js';
import ace from 'ace-builds/src-min-noconflict/ace.js';
// These two are for WebPack to include the ace modes.
import 'ace-builds/src-min-noconflict/mode-yaml.js';
//import 'ace-builds/src-min-noconflict/undomanager.js';
import * as d3 from 'd3';

const { TMSpecError, YAMLException } = parser;
const UndoManager = ace.require('ace/undomanager').UndoManager;

/**
 * For editing and displaying a TMDocument.
 * The controller coordinates the interactions between
 *   1. simulator
 *   2. code editor
 *   3. storage
 *
 * All container and button params are required.
 * @param {Object} containers
 *   Empty containers to use (contents will likely be replaced).
 * @param {HTMLDivElement} containers.simulator
 * @param {HTMLDivElement} containers.editorAlerts
 * @param {HTMLDivElement} containers.editor
 * @param {Object} buttons Buttons to use.
 * @param {HTMLButtonElement} buttons.simulator.run
 * @param {HTMLButtonElement} buttons.simulator.step
 * @param {HTMLButtonElement} buttons.simulator.reset
 * @param {HTMLButtonElement} buttons.editor.load For loading the editor source
 * @param {HTMLButtonElement} buttons.editor.revert For reverting the editor source
 * @param {TMDocument} document The document to load from and save to.
 */
export default class TMDocumentController {
  constructor(containers, buttons, doc) {
    this.simulator = new TMSimulator(containers.simulator, buttons.simulator);

    // Set up ace editor
    const editor = ace.edit(containers.editor);
    editor.session.setOptions({
      mode: 'ace/mode/yaml',
      tabSize: 2,
      useSoftTabs: true
    });
    editor.setOptions({
      minLines: 15,
      maxLines: 50
    });
    // suppress warning about
    // "Automatically scrolling cursor into view after selection change"
    editor.$blockScrolling = Infinity;

    this.editor = editor;
    this.buttons = buttons;
    this.containers = containers;

    // Button event handlers
    buttons.editor.load.addEventListener('click', () => {
      this.loadEditorSource();
      this.save();
      this.editor.focus();
    });
    buttons.editor.revert.addEventListener('click', () => {
      this.revertEditorSource();
      this.editor.focus();
    });

    // Dummy document that gets replaced
    this.__document = { editor: {} };

    this.openDocument(doc);
  }

  getDocument() {
    return this.__document;
  }

  // set the backing document, without saving/loading or affecting the views.
  setBackingDocument(doc) {
    this.__document = doc;
  }

  // save the current document, then open another one.
  // does nothing if the document ID is the same.
  openDocument(doc) {
    if (this.getDocument().id === doc.id) return; // same document
    this.save();
    return this.forceLoadDocument(doc);
  }

  // (low-level) load the document. current data is discarded without saving.
  // this can be used to switch from a deleted document or reload a document.
  forceLoadDocument(doc, keepUndoHistory) {
    this.setBackingDocument(doc);
    const diagramSource = doc.sourceCode;
    const editorSource = doc.editorSourceCode;
    // init
    this.simulator.clear();
    this.setEditorValue(editorSource == null ? diagramSource : editorSource);
    // prevent undo-ing to the previous document. note: .reset() doesn't work
    if (!keepUndoHistory) {
      this.editor.session.setUndoManager(new UndoManager());
    }

    if (editorSource == null) {
      // case: synced: load straight from editor.
      this.loadEditorSource();
    } else {
      // case: not synced: editor has separate contents.
      this.isSynced = false;
      try {
        this.simulator.sourceCode = diagramSource;
        this.simulator.positionTable = doc.positionTable;
      } catch {
        this.showCorruptDiagramAlert(true);
      }
    }
  }

  save() {
    const doc = this.getDocument();
    if (this.hasValidDiagram) {
      // sidenote: deleting first can allow saving when space would otherwise be full
      doc.editorSourceCode = this.isSynced ? undefined : this.editor.getValue();
      doc.sourceCode = this.simulator.sourceCode;
      doc.positionTable = this.simulator.positionTable;
    } else {
      if (doc.editorSourceCode == null) {
        // case 1: editor was synced with the diagram.
        //  only edit doc.sourceCode until it's fixed;
        //  don't worsen the problem to case 2.
        doc.sourceCode = this.editor.getValue();
      } else {
        // case 2: editor has separate contents.
        //  this is more confusing, as there are two "source code" values to contend with.
        doc.editorSourceCode = this.editor.getValue();
      }
    }
  }

  /**
   * Set the editor contents.
   * • Converts null to '', since editor.setValue(null) crashes.
   * • Clears the editor alerts.
   * @param {?string} str
   */
  setEditorValue(str) {
    this.editor.setValue(str ? str : '', -1 /* put cursor at start */);
    this.setAlertErrors([]);
  }

  /////////////////////////
  // Error/Alert Display //
  /////////////////////////

  setAlertErrors(errors) {
    const alerts = d3.select(this.containers.editorAlerts).selectAll('.alert')
      .data(errors, e => String(e)); // key by error description

    alerts.exit().remove();

    alerts.enter()
      .append('div')
      .attr('class', 'alert alert-danger')
      .attr('role', 'alert')
      .each(function (e) {
        const div = d3.select(this);
        if (e instanceof YAMLException) {
          const annot = aceAnnotationFromYAMLException(e);
          const lineNum = annot.row + 1; // annotation lines start at 0; editor starts at 1
          const column = annot.column;
          div.append('strong')
            .text('Syntax error on ')
            .append('a')
            .text('line ' + lineNum)
            .on('click', function (evt) {
              self.editor.gotoLine(lineNum, column, true);
              self.editor.focus();
              evt.preventDefault();
            })
            .attr('href', '#' + self.containers.editor.id);
          div.append('br');
          div.append('span').text('Possible reason: ' + e.reason);
        } else if (e instanceof TMSpecError) {
          div.html(e.message);
        } else {
          div.html('<strong>Unexpected error</strong>: ' + e);
        }
      });

    this.editor.session.setAnnotations(
      errors
        .map(e => (e instanceof YAMLException) ? aceAnnotationFromYAMLException(e) : null)
        .filter(x => x)
    );
  }

  //////////////////////////////
  // Syncing diagram & editor //
  //////////////////////////////

  // This method can be overridden as necessary.
  // The default implementation toggles Bootstrap 3 classes.
  setLoadButtonSuccess(didSucceed) {
    d3.select(this.buttons.editor.load)
      .classed('btn-success', didSucceed)
      .classed('btn-primary', !didSucceed);
  }

  // Load & Revert

  /**
   * Show/hide the notice that the diagram's source code is invalid;
   * use this when the editor has contents of its own (so it can't display the diagram's source).
   *
   * This happens for imported documents that were corrupted.
   * It can also happen if the value in storage is tampered with.
   * @param  {boolean} show true to display immediately, false to hide.
   */
  showCorruptDiagramAlert(show) {
    function enquote(s) { return '<q>' + s + '</q>'; }
    const div = d3.select(this.simulator.container);
    if (show) {
      const revertName = this.buttons.editor.revert.textContent.trim();
      div.html('')
        .append('div')
        .attr('class', 'alert alert-danger')
        .html('<h4>This imported document has an error</h4>' +
          [
            'The diagram was not valid and could not be displayed.',
            'You can either load a new diagram from the editor, or attempt to recover this one',
            'using ' + enquote(revertName) + ' (which will replace the current editor contents).'
          ].join('<br>')
        );
    } else {
      div.selectAll('.alert').remove();
    }
  }

  // Sync from editor to diagram
  loadEditorSource() {
    // load to diagram, and report any errors
    const errors = (() => {
      try {
        const isNewDiagram = !this.hasValidDiagram;
        this.simulator.sourceCode = this.editor.getValue();
        if (isNewDiagram) {
          // loaded new, or recovery succeeded => close error notice, restore positions
          this.showCorruptDiagramAlert(false);
          this.simulator.positionTable = this.getDocument().positionTable;
        }
        return [];
      } catch (e) {
        return [e];
      }
    })();
    this.isSynced = (errors.length === 0);
    this.setAlertErrors(errors);
  }

  // Sync from diagram to editor
  revertEditorSource() {
    this.setEditorValue(this.hasValidDiagram
      ? this.simulator.sourceCode
      : this.getDocument().sourceCode);

    if (this.hasValidDiagram) {
      this.isSynced = true;
    } else {
      // show errors when reverting to a corrupted diagram
      this.loadEditorSource();
    }
    // if (this.__loadedEditorSelection) {
    //   this.editor.session.selection.fromJSON(this.__loadedEditorSelection);
    // }
  }

  // public API for isSynced
  getIsSynced() {
    return Boolean(this.isSynced);
  }

  // internal. used to detect when an imported document is corrupted.
  get hasValidDiagram() {
    return Boolean(this.simulator.sourceCode);
  }

  // internal. whether the editor and diagram source code are in sync, and the diagram is valid.
  // Updates "Load machine" button display.
  // for future reference: .isSynced cannot be moved to TMDocument because it requires knowledge from the simulator.
  set isSynced(isSynced) {
    isSynced = Boolean(isSynced);
    if (this.__isSynced !== isSynced) {
      this.__isSynced = isSynced;
      this.setLoadButtonSuccess(isSynced);
      if (isSynced) {
        // changes cause desync
        const onChange = () => {
          this.isSynced = false;
          this.editor.removeListener('change', onChange);
        };
        this.editor.on('change', onChange);
      }
    }
  }
  get isSynced() {
    return this.__isSynced;
  }
}

// Helper for ace annotation from YAMLException
function aceAnnotationFromYAMLException(e) {
  return {
    row: e.mark.line,
    column: e.mark.column,
    text: 'Not valid YAML (possibly caused by a typo):\n' + e.message,
    type: 'error'
  };
}
