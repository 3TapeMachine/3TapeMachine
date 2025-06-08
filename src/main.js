// main entry point for index.html.
// important: make sure to coordinate variables and elements between the HTML and JS

import TMDocumentController from './TMDocumentController.js';
import DocumentMenu from './DocumentMenu.js';
import examples from './examples1.js';
import ace from 'ace-builds/src-noconflict/ace.js';
import $ from 'jquery'; // for Bootstrap modal dialog events

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

// load up front so going offline doesn't break anything
// (for snippet placeholders, used by "New blank document")
ace.config.loadModule('ace/ext/language_tools');

function getId(id) { return document.getElementById(id); }

function addAlertPane(type, html) {
  getId('diagram-column').insertAdjacentHTML('afterbegin',
    `<div class="alert alert-${type} alert-dismissible" role="alert">
      <button type="button" class="close" data-dismiss="alert" aria-label="Close">
        <span aria-hidden="true">×</span>
      </button>
      ${html}
    </div>`);
}

//////////////////////////
// Compatibility Checks //
//////////////////////////

(() => {
  // Warn when falling back to RAM-only storage
  if (!(import('./storage.js')).canUseLocalStorage) {
    addAlertPane('info', `<p>Local storage is unavailable. 
      Your browser could be in Private Browsing mode, or it might not support 
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
  $(() => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    if (isIOS) {
      getId('misc-tips-list').insertAdjacentHTML('afterbegin',
        `<li><strong class="text-warning">Important note for iOS</strong>: 
        iOS saves browser local storage in the cache folder, which is <strong>not backed up</strong>, and is 
        <q cite="https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API/Using_the_Web_Storage_API#Browser_compatibility"><strong>subject to occasional clean up</strong>, 
        at the behest of the OS, typically if space is short.</q></li>`);
    }
  });
})();

/////////////////////
// Import & Export //
/////////////////////

function importDocument(obj) {
  // duplicate data into the menu, then open it.
  menu.duplicate(obj, { select: true, type: 'open' });
}

$(() => {
  // Enable buttons now that handlers are ready
  $('.tm-needsready').prop('disabled', false);

  // Run import from URL query (if any)
  const importArgs = {
    dialogNode: getId('importDialog'),
    importDocument
  };
  import('./sharing/import.js').then(mod => mod.runImport(importArgs));
  // Init import dialog
  const $importPanel = $('#importPanel');
  $importPanel.one('show.bs.modal', () => {
    import('./sharing/import-panel.js').then(mod => mod.init({
      dialog: $importPanel[0],
      gistIDForm: getId('gistIDForm'),
      importArgs
    }));
  });
  // Init export dialog
  const exportPanel = getId('exportPanel');
  import('./sharing/export-panel.js').then(mod => mod.init({
    dialog: exportPanel,
    getCurrentDocument: () => {
      controller.save(); // IMPORTANT: save changes, otherwise data model is out of date
      return menu.currentDocument;
    },
    getIsSynced: controller.getIsSynced.bind(controller),
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
  };

  // Refresh the "Edit" menu items depending on document vs. example.
  const refreshEditMenu = (() => {
    const renameLink = document.querySelector('[data-target="#renameDialog"]');
    const deleteLink = document.querySelector('[data-target="#deleteDialog"]');
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
          renameLink.setAttribute('data-toggle', 'modal');
          deleteLink.textContent = 'Delete…';
          deleteLink.setAttribute('data-target', '#deleteDialog');
        } else {
          renameLink.textContent = 'Rename a copy…';
          renameLink.addEventListener('click', renameExample);
          renameLink.removeAttribute('data-toggle');
          deleteLink.textContent = 'Reset this example…';
          deleteLink.setAttribute('data-target', '#resetExampleDialog');
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

  const $renameDialog = $(getId('renameDialog'));
  [
    { id: 'tm-doc-action-duplicate', callback: duplicateDocument },
    { id: 'tm-doc-action-newblank', callback: newBlankDocument }
  ].forEach(item => {
    document.getElementById(item.id).addEventListener('click', e => {
      e.preventDefault();
      item.callback(e);

      $renameDialog.modal({ keyboard: false })
        .one('hidden.bs.modal', () => {
          controller.editor.focus();
        });
    });
  });
})();

/////////////
// Dialogs //
/////////////

(() => {
  // Rename
  const $renameDialog = $(getId('renameDialog'));
  const renameBox = getId('renameDialogInput');
  $renameDialog
    .on('show.bs.modal', () => {
      renameBox.value = menu.currentOption.text;
    })
    .on('shown.bs.modal', () => {
      renameBox.select();
    })
    .on('hidden.bs.modal', () => {
      const newName = renameBox.value;
      if (menu.currentOption.text !== newName) {
        menu.rename(newName);
      }
      renameBox.value = '';
    });
  document.getElementById('renameDialogForm').addEventListener('submit', e => {
    e.preventDefault();
    $renameDialog.modal('hide');
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
$(() => {
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
    mod.addOutsideChangeListener((docID, prop) => {
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
