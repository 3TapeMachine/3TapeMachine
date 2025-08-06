// main entry point for index.html.

import TMDocumentController from './TMDocumentController.js';
import DocumentMenu from './DocumentMenu.js';
import examples from './examples1.js';
import { canUseLocalStorage } from './storage.js';
import 'bootstrap/dist/css/bootstrap.min.css';
import * as bootstrap from 'bootstrap';

import ace from 'ace-builds/src-min-noconflict/ace.js';
// Make sure WebPack sees the optional Ace files
import 'ace-builds/src-min-noconflict/theme-chrome.js';
import 'ace-builds/src-min-noconflict/mode-yaml.js';
import 'ace-builds/src-min-noconflict/ext-language_tools.js';
import 'ace-builds/src-min-noconflict/worker-yaml.js';
ace.config.set('basePath', '/build/');
ace.config.set('workerPath', '/build/');

import yaml from 'js-yaml'; // Added for YAML parsing

/**
 * Concat an array of DOM Nodes into a DocumentFragment.
 * @param  {[Node]} array
 * @return {DocumentFragment}
 */
function toDocFragment(array) {
  const result = document.createDocumentFragment();
  array.forEach(node => result.appendChild(node));
  return result;
}

function getId(id) { return document.getElementById(id); }

function addAlertPane(type, html) {
  getId('diagram-column').insertAdjacentHTML('afterbegin',
    `<div class="alert alert-${type} alert-dismissible fade show" role="alert">
      ${html}
      <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    </div>`);
}

//////////////////////////
// Compatibility Checks //
//////////////////////////

document.addEventListener('DOMContentLoaded', () => {
  // ***FIX***: Manually initialize all Bootstrap dropdowns.
  const dropdownElementList = document.querySelectorAll('[data-bs-toggle="dropdown"]');
  [...dropdownElementList].map(dropdownToggleEl => new bootstrap.Dropdown(dropdownToggleEl));

  // Warn when falling back to RAM-only storage
  if (!canUseLocalStorage) {
    addAlertPane('info', `<p>Local storage is unavailable. 
      Your browser could be in Private Browse mode, or it might not support 
      <a href="http://caniuse.com/#feat=namevalue-storage" target="_blank">local storage</a>.</p>
      <strong>Any changes will be lost after leaving the webpage.</strong>`);
  }

  // Detect IE 10 and under
  const isIEUnder11 = new Function('/*@cc_on return @_jscript_version; @*/')() < 11;
  if (isIEUnder11) {
    addAlertPane('warning',
      `<p><strong>Your <a href="http://whatbrowser.org" target="_blank">web browser</a> is out of date</strong> and does not support some features used by this program.<br>
      <em>The page may not work correctly, and data may be lost.</em></p>
      Please update your browser, or use another browser such as <a href="http://www.google.com/chrome/browser/" target="_blank">Chrome</a> or <a href="http://getfirefox.com" target="_blank">Firefox</a>.`);
  }

  // Warn about iOS local storage volatility
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  if (isIOS) {
    getId('misc-tips-list').insertAdjacentHTML('afterbegin',
      `<li><strong class="text-warning">Important note for iOS</strong>: 
      iOS saves browser local storage in the cache folder, which is <strong>not backed up</strong>, and is 
      <q cite="https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API/Using_the_Web_Storage_API#Browser_compatibility"><strong>subject to occasional clean up</strong>, 
      at the behest of the OS, typically if space is short.</q></li>`);
  }
});

/////////////////////
// Import & Export //
/////////////////////

function importDocument(obj) {
  // duplicate data into the menu, then open it.
  menu.duplicate(obj, { select: true, type: 'open' });
}

document.addEventListener('DOMContentLoaded', () => {
  // Enable buttons now that handlers are ready
  document.querySelectorAll('.tm-needsready').forEach(btn => btn.disabled = false);

  // Run import from URL query (if any)
  const importArgs = {
    dialogNode: getId('importDialog'),
    importDocument
  };
  import('./sharing/import.js').then(mod => mod.runImport(importArgs));

  // Init import dialog
  const importPanel = getId('importPanel');
  importPanel.addEventListener('show.bs.modal', () => {
    import('./sharing/import-panel.js').then(mod => mod.init({
      dialog: importPanel,
      gistIDForm: getId('gistIDForm'),
      importArgs
    }));
  });
});

document.addEventListener('DOMContentLoaded', () => {
  const exportPanel = getId('exportPanel');
  import('./sharing/export-panel.js').then(mod => mod.init({
    dialog: exportPanel,
    getCurrentDocument: () => {
      controller.save(); // IMPORTANT: save changes, otherwise data model is out of date
      return menu.currentDocument;
    },
    getIsSynced: () => controller.getIsSynced(),
    gistContainer: getId('shareGistContainer'),
    downloadContainer: getId('exportDownloadContainer'),
    textarea: exportPanel.querySelector('textarea')
  }));
});

///////////////////
// Document List //
///////////////////

const menu = (() => {
  const select = document.getElementById('tm-doc-menu');
  // Group: Documents
  const docGroup = document.createElement('optgroup');
  docGroup.label = 'Documents';
  select.appendChild(docGroup);
  // Group: Examples
  const exampleGroup = document.createElement('optgroup');
  exampleGroup.label = 'Examples';
  exampleGroup.appendChild(toDocFragment(examples.list.map(
    DocumentMenu.prototype.optionFromDocument)));
  select.appendChild(exampleGroup);

  return new DocumentMenu({
    menu: select,
    group: docGroup,
    storagePrefix: 'tm.docs',
    firsttimeDocID: examples.firsttimeDocID
  });
})();

/////////////////
// "Edit" Menu //
/////////////////

function updateBinaryButtonVisibility() {
  const newBtn = document.getElementById('my-new-btn'); // <-- CORRECTED ID
  if (!newBtn) return;
  
  if (!menu.currentDocument.isExample) {
    newBtn.style.display = 'none';
    return;
  }

  let src = controller.editor.getValue();
  let doc;
  try {
    doc = yaml.load(src);
  } catch {
    newBtn.style.display = 'none';
    return;
  }
  const docType = (doc && doc.type || '').toString().trim().toLowerCase();
  if (docType === '3tape') {
    newBtn.style.display = 'none';
  } else {
    newBtn.style.display = 'inline-block';
  }
}

(() => {
  menu.onChange = (doc, opts) => {
    switch (opts && opts.type) {
      case 'duplicate':
        controller.setBackingDocument(doc);
        break;
      case 'delete':
        controller.forceLoadDocument(doc);
        break;
      default:
        controller.openDocument(doc);
    }
    refreshEditMenu();
    updateBinaryButtonVisibility();
  };

  const refreshEditMenu = (() => {
    const renameLink = document.querySelector('[data-bs-target="#renameDialog"]');
    const deleteLink = document.querySelector('[data-bs-target="#deleteDialog"]');
    let wasExample;
    function renameExample() {
      duplicateDocument();
    }

    return function () {
      const isExample = menu.currentDocument.isExample;
      if (wasExample !== isExample) {
        if (!isExample) {
          renameLink.textContent = 'Rename…';
          renameLink.removeEventListener('click', renameExample);
          renameLink.setAttribute('data-bs-toggle', 'modal');
          deleteLink.textContent = 'Delete…';
          deleteLink.setAttribute('data-bs-target', '#deleteDialog');
        } else {
          renameLink.textContent = 'Rename a copy…';
          renameLink.addEventListener('click', renameExample);
          renameLink.removeAttribute('data-bs-toggle');
          deleteLink.textContent = 'Reset this example…';
          deleteLink.setAttribute('data-bs-target', '#resetExampleDialog');
        }
        wasExample = isExample;
      }
    };
  })();
  refreshEditMenu();

  function duplicateDocument() {
    controller.save();
    menu.duplicate(menu.currentDocument, { select: true });
  }

  function newBlankDocument() {
    menu.newDocument({ select: true });
    if (controller.editor.insertSnippet) {
      controller.editor.insertSnippet(examples.blankTemplate);
      controller.loadEditorSource();
    }
  }
  
  [
    { id: 'tm-doc-action-duplicate', callback: duplicateDocument },
    { id: 'tm-doc-action-newblank', callback: newBlankDocument }
  ].forEach(item => {
    const element = document.getElementById(item.id);
    if (element) {
      element.addEventListener('click', e => {
        e.preventDefault();
        item.callback(e);
      });
    }
  });
})();

/////////////
// Dialogs //
/////////////

(() => {
  // Rename
  const renameDialog = document.getElementById('renameDialog');
  const renameBox = getId('renameDialogInput');
  renameDialog.addEventListener('show.bs.modal', () => {
    renameBox.value = menu.currentOption.text;
  });
  renameDialog.addEventListener('shown.bs.modal', () => {
    renameBox.select();
  });
  renameDialog.addEventListener('hidden.bs.modal', () => {
    const newName = renameBox.value;
    if (menu.currentOption.text !== newName) {
      menu.rename(newName);
    }
    renameBox.value = '';
  });
  document.getElementById('renameDialogForm').addEventListener('submit', e => {
    e.preventDefault();
    const modal = bootstrap.Modal.getInstance(renameDialog);
    if (modal) modal.hide();
  });

  // Delete
  document.getElementById('tm-doc-action-delete').addEventListener('click', () => {
    menu.delete();
  });

  // Reset Example
  function discardReset() {
    menu.delete();
    controller.forceLoadDocument(menu.currentDocument);
  }
  function saveReset() {
    menu.duplicate(menu.currentDocument, { select: false });
    discardReset();
  }
  document.getElementById('tm-doc-action-resetdiscard').addEventListener('click', discardReset);
  document.getElementById('tm-doc-action-resetsave').addEventListener('click', saveReset);
})();

////////////////
// Controller //
////////////////

const controller = (() => {
  function getButton(container, type) {
    return container.querySelector('button.tm-' + type);
  }
  const editor = document.getElementById('editor-container');
  const sim = document.getElementById('controls-container');
  const ed = editor.parentNode;

  return new TMDocumentController({
    simulator: document.getElementById('machine-container'),
    editorAlerts: document.getElementById('editor-alerts-container'),
    editor
  }, {
    simulator: {
      run: getButton(sim, 'run'),
      step: getButton(sim, 'step'),
      reset: getButton(sim, 'reset')
    },
    editor: {
      load: getButton(ed, 'editor-load'),
      revert: getButton(ed, 'editor-revert')
    }
  }, menu.currentDocument);
})();

controller.editor.setTheme('ace/theme/chrome');
controller.editor.commands.addCommand({
  name: 'save',
  bindKey: { mac: 'Cmd-S', win: 'Ctrl-S' },
  exec: () => {
    controller.loadEditorSource();
  }
});
controller.editor.session.setUseWrapMode(true);

document.addEventListener('DOMContentLoaded', () => {
  try {
    import('./kbdshortcuts.js').then(mod => mod.main(controller.editor.commands, getId('kbdShortcutTable')));
  } catch {
    /* ignore */
  }
});

window.addEventListener('beforeunload', ev => {
  try {
    controller.save();
    menu.saveCurrentDocID();
  } catch  {
    addAlertPane('warning',
      `<h4>The current document could not be saved.</h4>
      <p>It’s likely that the <a href="https://en.wikipedia.org/wiki/Web_storage#Storage_size" target="_blank">local storage quota</a> was exceeded. 
      Try downloading a copy of this document, then deleting other documents to make space.</p>`);
    return (ev || window.event).returnValue =
      'There is not enough space left to save the current document.';
  }
});

// Keep the current document in sync across tabs/windows
window.addEventListener('blur', () => {
  controller.save();
});
(() => {
  // ...and the other tab loads it.
  let isReloading = false;
  import('./TMDocument.js').then(mod => {
    mod.TMDocument.addOutsideChangeListener((docID, prop) => {
      if (docID === controller.getDocument().id && prop !== 'name' && !isReloading) {
        isReloading = true;
        setTimeout(() => {
          isReloading = false;
          controller.forceLoadDocument(controller.getDocument(), true);
        }, 100);
      }
    });
  });
})();

// --- Binary Conversion Logic ---

const dirDict = {
  'R': '1',
  'L': '11',
  'S': '111'
};

function generateDictionaries(table) {
  const stateDict = { 'accept': '1', 'halt': '1', 'reject': '11' };
  const symbolDict = {};
  const states = new Set();
  const symbols = new Set();
  const reservedKeys = ['input', 'blank', 'start state', 'table'];

  for (const [state, transitions] of Object.entries(table)) {
    if (reservedKeys.includes(state)) continue;

    if (typeof state === 'string' && !stateDict[state]) states.add(state);
    if (transitions && typeof transitions === 'object') {
      for (const [readSymbol, instr] of Object.entries(transitions)) {
        if (typeof readSymbol === 'string') symbols.add(readSymbol);
        if (typeof instr === 'object') {
          if ('write' in instr && typeof instr.write === 'string') symbols.add(instr.write);
          if ('L' in instr && typeof instr.L === 'string' && !stateDict[instr.L]) states.add(instr.L);
          if ('R' in instr && typeof instr.R === 'string' && !stateDict[instr.R]) states.add(instr.R);
          if ('S' in instr && typeof instr.S === 'string' && !stateDict[instr.S]) states.add(instr.S);
          if ('state' in instr && typeof instr.state === 'string' && !stateDict[instr.state]) states.add(instr.state);
        }
      }
    }
  }

  let code = 3;
  for (const s of states) {
    stateDict[s] = '1'.repeat(code);
    code++;
  }

  let symCode = 2;
  for (const sym of symbols) {
    if (typeof sym !== 'string') continue;
    if (sym.trim() === '') {
      symbolDict[sym] = '1';
      continue;
    }
    symbolDict[sym] = '1'.repeat(symCode);
    symCode++;
  }
  return { stateDict, symbolDict };
}

function encode(dict, key, fallback) {
  if (typeof key !== 'string') return fallback;
  const k = key.trim();
  return dict[k] || dict[k.toLowerCase()] || fallback;
}

function convertInputToBinary(input, symbolDict) {
  let result = [];
  for (const ch of input) {
    result.push(symbolDict[ch] || '1');
  }
  return result.join('0');
}

// const binaryConversionButton = 
// Replace the existing function in your main.js file with this one
function convertCurrentTMToBinary() {
  let src = controller.editor.getValue();
  let doc;
  try { doc = yaml.load(src); } 
  catch (e) { addAlertPane('danger', 'Could not parse YAML: ' + e.message); return; }

  const table = doc.table || doc;
  if (!table || typeof table !== 'object') {
    addAlertPane('danger', 'No transition table found.');
    return;
  }

  const { stateDict, symbolDict } = generateDictionaries(table);
  const reservedKeys = ['input', 'blank', 'start state', 'table'];

  let rules = [];
  for (const [state, transitions] of Object.entries(table)) {
    if (reservedKeys.includes(state)) continue;
    if (!transitions || typeof transitions !== 'object') continue;
    
    for (const [readSymbol, instr] of Object.entries(transitions)) {
      let newState = state;
      let writeSymbol = readSymbol;
      let direction = null;

      if (typeof instr === 'string') {
        direction = instr;
      } else if (typeof instr === 'object') {
        // ▼▼▼ THIS IS THE CORRECTED LINE ▼▼▼
        if ('write' in instr && (typeof instr.write === 'string' || typeof instr.write === 'number')) writeSymbol = instr.write.toString();
        // ▲▲▲ END OF CORRECTION ▲▲▲
        
        if ('L' in instr && typeof instr.L === 'string') { direction = 'L'; newState = instr.L; }
        else if ('R' in instr && typeof instr.R === 'string') { direction = 'R'; newState = instr.R; }
        else if ('S' in instr && typeof instr.S === 'string') { direction = 'S'; newState = instr.S; }
        else if ('direction' in instr && typeof instr.direction === 'string') direction = instr.direction;
        if ('state' in instr && typeof instr.state === 'string') newState = instr.state;
      }

      const encState = encode(stateDict, state, '1');
      const encRead = encode(symbolDict, readSymbol, '1');
      const encNewState = encode(stateDict, newState, encState);
      const encWrite = encode(symbolDict, writeSymbol, encRead);
      const encDir = encode(dirDict, direction, '1');
      rules.push([encState, encRead, encNewState, encWrite, encDir].join('0'));
    }
  }

  let input = doc.input || '';
  let binaryInput = '';
  if (input) {
    binaryInput = convertInputToBinary(input, symbolDict);
  }

  let result = rules.join('00');
  result += '000'; 
  if (binaryInput) {
    result += binaryInput;
  }

  navigator.clipboard.writeText(result).then(() => {
    addAlertPane('success', 'Binary conversion copied to clipboard!');
  }, () => {
    addAlertPane('danger', 'Failed to copy to clipboard.');
  });
}

// --- Attach binary conversion to button after DOM is ready ---
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('my-new-btn'); // <-- CORRECTED ID
  if (btn) {
    btn.addEventListener('click', convertCurrentTMToBinary);
  }
});

// For interaction/debugging
export { controller };

// --- THE VISIBILITY CHECK ON PAGE LOAD ---
// Binary_Conversion_Visibility
document.addEventListener('DOMContentLoaded', () => {
    // --- Fix for initial button visibility ---
    // A small delay ensures the menu and controller are fully initialized
    setTimeout(() => {
        if (menu.currentDocument) {
            updateBinaryButtonVisibility();
        }
    }, 100);

    // --- Debugging probe for 'Load machine' button ---
    const loadBtn = document.querySelector('.tm-editor-load');
    if (loadBtn) {
        loadBtn.addEventListener('click', () => {
            console.log("--- 'Load machine' was clicked ---");
            // Wait a moment for any async actions to potentially complete
            setTimeout(() => {
                console.log("Controller state AFTER loading:", controller);
                console.log("Rules table AFTER loading:", controller.simulator.__spec ? controller.simulator.__spec.table : "Not found");
            }, 200); // 200ms delay
        });
    }
});