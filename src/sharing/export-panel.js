import * as format from './format.js';
import { createGist } from './gist.js';

// https://github.com/Modernizr/Modernizr/blob/master/feature-detects/a/download.js
const canUseDownloadAttribute = 'download' in document.createElement('a');

// can copy to clipboard programmatically?
const canUseClipboardAPI = !!(navigator.clipboard && navigator.clipboard.writeText);


// Add event handlers to select an HTMLInputElement's text on focus.
function addSelectOnFocus(element) {
  element.addEventListener('focus', e => e.target.select());
  // Safari workaround
  element.addEventListener('mouseup', e => e.preventDefault());
}

// Show a one-time tooltip using a custom span
function showTransientTooltip(element, message) {
  const tooltip = document.createElement('span');
  tooltip.className = 'custom-tooltip';
  tooltip.textContent = message;
  tooltip.style.position = 'absolute';
  tooltip.style.background = '#333';
  tooltip.style.color = '#fff';
  tooltip.style.padding = '2px 8px';
  tooltip.style.borderRadius = '4px';
  tooltip.style.fontSize = '0.9em';
  tooltip.style.zIndex = 1000;

  // Position below the element
  const rect = element.getBoundingClientRect();
  tooltip.style.left = `${rect.left + window.scrollX}px`;
  tooltip.style.top = `${rect.bottom + window.scrollY + 4}px`;

  document.body.appendChild(tooltip);

  setTimeout(() => {
    tooltip.remove();
  }, 1200);
}

function showCopiedTooltip(element) {
  showTransientTooltip(element, 'Copied!');
}

///////////////////////
// Share with GitHub //
///////////////////////

/**
 * Generate a new gist and display a shareable link.
 * @param  {HTMLElement} container  Container to use for displaying the link.
 * @param  {HTMLButtonElement} button
 * @param  {string} filename
 * @param  {string} contents  The file contents.
 * @return {Promise}          Cancellable promise to create the gist.
 */
function generateGist(container, button, filename, contents) {
  const oldButtonText = button.textContent;
  button.textContent = 'Loading…';
  button.disabled = true;

  const payload = {
    files: { [filename]: { content: contents } },
    description: '3 machine turing machine visualizer',
    public: true
  };

  return createGist(payload).then(response => {
    // Show link on success
    const id = response.id;
    showGeneratedGist(container, `http://localhost:8080/?import-gist=${id}`);
  }).catch(reason => {
    // Alert error on failure
    const xhr = reason.xhr;
    let message;
    try {
      message = `Response from GitHub: “${xhr.responseJSON.message}”`;
    } catch {
      if (xhr && xhr.status > 0) {
        message = `HTTP status code: ${xhr.status} ${xhr.statusText}`;
      } else {
        message = 'GitHub could not be reached.\nYour Internet connection may be offline.';
      }
    }
    alert(`Could not create new gist.\n\n${message}`);

    button.disabled = false;
    button.textContent = oldButtonText;
  });
}

function showGeneratedGist(container, url) {
  container.innerHTML =
    `<input id="sharedPermalink" type="url" class="form-control" readonly>
     <button type="button" class="btn btn-default" id="copyPermalinkBtn">
       <span class="glyphicon glyphicon-copy" aria-hidden="true"></span>
     </button>`;
  const urlInput = container.querySelector('input');
  urlInput.value = url;
  urlInput.size = url.length + 2;
  addSelectOnFocus(urlInput);
  urlInput.focus();

  // Copy to clipboard using Clipboard API
  const copyBtn = container.querySelector('#copyPermalinkBtn');
  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(urlInput.value);
      showCopiedTooltip(copyBtn);
    } catch {
      alert('Copy failed. Please copy manually.');
    }
  });
}

function createGenerateGistButton(container) {
  container.innerHTML =
    `<button type="button" class="btn btn-default">Create permalink</button>
     <p class="help-block">This will create and link to a new
       <a href="https://help.github.com/articles/creating-gists/#creating-an-anonymous-gist"
          target="_blank">read-only</a> GitHub gist.
     </p>`;
  return container.querySelector('button');
}

///////////////////
// Download file //
///////////////////

// Create a link button if canUseDownloadAttribute, otherwise a link with instructions.
function createDownloadLink(filename, contents) {
  const link = document.createElement('a');
  link.href = 'data:text/x-yaml;charset=utf-8,' + encodeURIComponent(contents);
  link.target = '_blank';
  link.download = filename;

  if (canUseDownloadAttribute) {
    link.textContent = 'Download document';
    link.className = 'btn btn-primary';
    return link;
  } else {
    link.textContent = 'Right-click here and choose “Save target as…” or “Download Linked File As…”';
    const p = document.createElement('p');
    p.innerHTML = ', <br>then name the file to end with <code>.yaml</code>';
    p.insertBefore(link, p.firstChild);
    return p;
  }
}

////////////
// Common //
////////////

export function init(args) {
  const {
    dialog, // HTMLElement (was $dialog)
    getCurrentDocument,
    getIsSynced,
    gistContainer,
    downloadContainer,
    textarea
  } = args;

  if (canUseDownloadAttribute) {
    dialog.classList.add('download-attr');
  }
  if (!canUseClipboardAPI) {
    dialog.classList.add('no-copycommand');
  }
  gistContainer.className = 'form-group form-inline';
  addSelectOnFocus(textarea);

  function setupDialog() {
    const doc = getCurrentDocument();
    const filename = doc.name + '.yaml';
    const contents = format.stringifyDocument(doc);
    let gistPromise;

    // warn about unsynced changes
    let alertDiv;
    if (!getIsSynced()) {
      alertDiv = document.createElement('div');
      alertDiv.className = 'alert alert-warning';
      alertDiv.setAttribute('role', 'alert');
      alertDiv.innerHTML =
        'The code editor has <strong>unsynced changes</strong> and might not correspond with the diagram.<br>' +
        'Click <q>Load machine</q> to try to sync them. Otherwise, two sets of code will be exported.';
      const modalBody = dialog.querySelector('.modal-body');
      if (modalBody) modalBody.prepend(alertDiv);
    }

    createGenerateGistButton(gistContainer).addEventListener('click', e => {
      gistPromise = generateGist(gistContainer, e.target, filename, contents);
    });

    // Clear previous download links
    downloadContainer.textContent = '';
    // "Download document" button link
    downloadContainer.appendChild(createDownloadLink(filename, contents));
    // <textarea> for document contents
    textarea.value = contents;

    // return cleanup function
    return function cleanup() {
      if (gistPromise && typeof gistPromise.cancel === 'function') {
        try { gistPromise.cancel(); } catch  {/* */}
      }
      if (alertDiv) { alertDiv.remove(); }
      gistContainer.textContent = '';
      downloadContainer.textContent = '';
      textarea.value = '';
    };
  }

  // Modal show/hide events (Bootstrap 4+ uses native events, not jQuery)
  dialog.addEventListener('show.bs.modal', () => {
    const cleanup = setupDialog();
    dialog.addEventListener('hidden.bs.modal', cleanup, { once: true });
  });

  dialog.addEventListener('shown.bs.modal', () => {
    // workaround "Copy to clipboard" .focus() scrolling down to <textarea>
    // note: doesn't work when <textarea> is completely out of view
    textarea.setSelectionRange(0, 0);
  });
}
