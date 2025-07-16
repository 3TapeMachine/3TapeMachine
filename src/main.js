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
  // This is sometimes required when using Bootstrap as a JS module.
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

    // Show/hide the binary conversion button depending on the loaded example.
    const binaryConversionBtn = document.getElementById('binary-conversion-btn');
    if (binaryConversionBtn) {
        // Safely get the title, defaulting to an empty string if it's undefined.
        const docTitle = doc.title || ''; 

        // Check for the 3-tape example by ID or title.
        const is3TapeExample = (doc.id === 'add-binary-3-tape') || (docTitle.toLowerCase() === 'add binary (3 tape)');

        if (doc.isExample && !is3TapeExample) {
            // Show button if it IS an example and IS NOT the 3-tape machine.
            binaryConversionBtn.style.display = 'inline-block';
        } else {
            // Hide button in all other cases.
            binaryConversionBtn.style.display = 'none';
        }
    }
  };

  // Refresh the "Edit" menu items depending on document vs. example.
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
    // load up starter template
    if (controller.editor.insertSnippet) { // async loaded
      controller.editor.insertSnippet(examples.blankTemplate);
      controller.loadEditorSource();
    }
  }

  // ***FIX***: Removed incorrect logic that showed the "Rename" dialog
  // for "Duplicate" and "New" actions.
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

// =========================================================================
// ▼▼▼ BINARY CONVERSION FUNCTION ADDED HERE ▼▼▼
// =========================================================================
function handleBinaryConversion() {
  // 1. Define the binary dictionary
  const binaryMap = {
    states: { 'right': '111', 'carry': '1111', 'done': '1' },
    symbols: { ' ': '1', '0': '11', '1': '111' },
    directions: { 'L': '11', 'R': '1' }
  };

  // 2. Get the rules from the currently loaded machine
  const machineRules = controller.simulator.machine.rules;

  if (!machineRules) {
    alert("Could not find machine rules to convert.");
    return;
  }

  // 3. Convert each rule into its binary string format
  const encodedRules = [];
  for (const fromState in machineRules) {
    for (const readSymbol in machineRules[fromState]) {
      const rule = machineRules[fromState][readSymbol];

      const currentStateCode = binaryMap.states[fromState];
      const readSymbolCode = binaryMap.symbols[readSymbol];
      const newStateCode = binaryMap.states[rule.state];
      const writeSymbolCode = binaryMap.symbols[rule.write];
      const moveDirectionCode = binaryMap.directions[rule.move];

      // Check if all parts were found in the map before joining
      if (currentStateCode && readSymbolCode && newStateCode && writeSymbolCode && moveDirectionCode) {
        encodedRules.push([currentStateCode, readSymbolCode, newStateCode, writeSymbolCode, moveDirectionCode].join('0'));
      }
    }
  }

  // 4. Join all the encoded rules together with '00'
  const finalBinaryString = encodedRules.join('00');

  // 5. Copy the final string to the clipboard
  navigator.clipboard.writeText(finalBinaryString).then(() => {
    alert("Binary code copied to clipboard!");
  }).catch(err => {
    console.error('Failed to copy text: ', err);
    alert("Failed to copy binary code.");
  });
}
// =========================================================================
// ▲▲▲ END OF NEW FUNCTION ▲▲▲
// =========================================================================

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

// =========================================================================
// ▼▼▼ EVENT LISTENER FOR BINARY BUTTON ADDED HERE ▼▼▼
// =========================================================================
document.addEventListener('DOMContentLoaded', () => {
    const binaryConversionBtn = document.getElementById('binary-conversion-btn');
    if (binaryConversionBtn) {
        binaryConversionBtn.addEventListener('click', handleBinaryConversion);
    }
});
// =========================================================================

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

// For interaction/debugging
export { controller };