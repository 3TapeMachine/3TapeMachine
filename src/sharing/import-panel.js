import * as docimport from './import.js';
import * as format from './format.js';
import * as d3 from 'd3';

// Init the import panel and attach event handlers
// {dialog: HTMLElement, gistIDForm: HTMLFormElement, importArgs: Object} -> void
export function init(args) {
  const dialog = args.dialog;
  const gistIDForm = args.gistIDForm;
  const importArgs = args.importArgs;

  function hideDialog() {
    // Hide modal (Bootstrap 4+)
    dialog.classList.remove('show');
    dialog.setAttribute('aria-hidden', 'true');
    dialog.style.display = 'none';

    // Workaround for opening another modal before a modal is done hiding.
    const nextDialog = importArgs.dialogNode;
    dialog.addEventListener('transitionend', function handler() {
      dialog.removeEventListener('transitionend', handler);
      if (nextDialog && nextDialog.classList.contains('show')) {
        document.body.classList.add('modal-open');
      }
    });
  }

  // Panel: From GitHub gist
  gistIDForm.addEventListener('submit', e => {
    e.preventDefault();
    hideDialog();

    const gistID = gistIDForm.querySelector('input[type="text"]').value;
    docimport.importGist({ ...importArgs, gistID });
  });

  // Panel: From files
  (() => {
    // TODO: factor out element IDs and containers into interface
    const panelBody = document.querySelector('#importFilesPanel > .panel-body');
    // <input type="file">
    const fileInput = panelBody.querySelector('input[type="file"]');
    const importFilesButton = document.getElementById('importFilesButton');
    importFilesButton.addEventListener('click', () => {
      hideDialog();
      docimport.importLocalFiles({ ...importArgs, files: fileInput.files });
    });
    // <textarea>
    const textarea = panelBody.querySelector('textarea');
    const importContentsButton = document.getElementById('importContentsButton');
    importContentsButton.parentNode.style.position = 'relative';
    importContentsButton.addEventListener('click', e => {
      if (importDocumentContents(
        { containers: { status: e.target.parentNode, details: panelBody }, importDocument: importArgs.importDocument },
        textarea.value
      )) {
        textarea.select();
      }
    });
  })();
}

///////////////////////////////
// Import from pasted string //
///////////////////////////////

// () -> HTMLButtonElement
function createCloseIcon() {
  const button = document.createElement('button');
  button.className = 'close';
  button.setAttribute('aria-label', 'Close');
  button.innerHTML = '<span aria-hidden="true">&times;</span>';
  return button;
}

// Show import outcome (success/failure) and error (if any)
// ({status: HTMLElement, details: HTMLElement}, ?Error) -> void
function showImportContentOutcome(containers, error) {
  const statusContainer = d3.select(containers.status);
  const detailsContainer = d3.select(containers.details);
  statusContainer.selectAll('[role="alert"]').remove();
  detailsContainer.selectAll('.alert').remove();

  const newstatus = statusContainer.append('span')
    .attr('role', 'alert')
    .style('position', 'absolute')
    .style('left', 0)
    .style('width', '40%')
    .style('top', '50%')
    .style('transform', 'translateY(-60%)');

  function showErrorDetails() {
    const details = detailsContainer.append('div')
      .attr('role', 'alert')
      .attr('class', 'alert alert-danger')
      .style('margin-top', '1em');
    const closeBtn = createCloseIcon();
    details.node().appendChild(closeBtn);
    closeBtn.setAttribute('data-dismiss', 'alert');
    closeBtn.addEventListener('click', () => {
      newstatus.remove(); // dismiss details => also dismiss status
      details.remove();
    });
    if (error instanceof format.YAMLException) {
      details.append('h4').text('Not valid YAML');
      details.append('pre').text(error.message);
    } else if (error instanceof format.InvalidDocumentError) {
      details.append('span').text(error.message.replace(/\.?$/, '.'));
    } else {
      details.append('h4').text('Unexpected error');
      details.append('pre').text(String(error));
      return 'Import failed';
    }
    return 'Not a valid document';
  }

  if (error) {
    const statusSummary = showErrorDetails();
    newstatus.attr('class', 'text-danger')
      .html('<span class="glyphicon glyphicon-exclamation-sign" aria-hidden="true"></span> ' + statusSummary);
  } else {
    newstatus.attr('class', 'text-success')
      .html('<span class="glyphicon glyphicon-ok" aria-hidden="true"></span> Import succeeded')
      .transition()
      .delay(2500)
      .duration(2000)
      .style('opacity', 0)
      .remove();
  }
}

// returns true if import succeeded
function importDocumentContents(opts, content) {
  const { containers, importDocument } = opts;
  let error = null;
  try {
    importDocument(format.parseDocument(content));
  } catch (e) {
    error = e;
  }
  showImportContentOutcome(containers, error);
  return error == null;
}