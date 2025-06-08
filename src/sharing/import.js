import CheckboxTable from './CheckboxTable.js';
import * as FileReaderPromise from './FileReaderPromise.js';
import * as format from './format.js';
import { getGist } from './gist.js';
import * as d3 from 'd3';

// Utility: decode URL component, treating '+' as space
function decodeFormURLComponent(str) {
  return decodeURIComponent(str.replace(/\+/g, ' '));
}

// Parse query string into an object
function queryParams(queryString) {
  const result = {};
  queryString.split('&').forEach(str => {
    const [key, value] = str.split('=');
    result[decodeFormURLComponent(key)] = decodeFormURLComponent(value || '');
  });
  return result;
}

// Join nodes or strings into a DocumentFragment
function joinNodes(nodes) {
  const frag = document.createDocumentFragment();
  nodes.forEach(node => {
    frag.appendChild(typeof node === 'string' ? document.createTextNode(node) : node);
  });
  return frag;
}

// Create an external link element
function externalLink({ href, textContent }) {
  const link = document.createElement('a');
  link.href = href;
  link.target = '_blank';
  link.textContent = textContent || href;
  return link;
}

// Wrap a node in a tag
function wrapTag(tagName, node) {
  const tag = document.createElement(tagName);
  tag.appendChild(node);
  return tag;
}

// Create a gist description link or fallback to gist ID
function gistDescriptionLink({ gistID, description }) {
  const link = externalLink({
    href: 'https://gist.github.com/' + gistID,
    textContent: description || ('gist ' + gistID)
  });
  return description ? wrapTag('q', link) : link;
}

// Error string utility
function errorString(reason) {
  return reason instanceof Error
    ? String(reason)
    : reason?.message || reason?.name || String(reason);
}

// Create an HTML element with innerHTML
function createElementHTML(tagName, innerHTML) {
  const element = document.createElement(tagName);
  element.innerHTML = innerHTML;
  return element;
}

// Message for error display
function messageForError(reason) {
  const xhr = reason.xhr;
  if (xhr) {
    // Connection/fetch error
    let msg;
    switch (reason.status) {
      case 'abort':
        msg = '';
        break;
      case 'timeout':
        msg = [
          '<strong>The request timed out.</strong>',
          'You can check your connection and try again.'
        ].join('<br>');
        break;
      default:
        if (xhr.status === 404) {
          msg = [
            '<strong>No GitHub gist exists with that ID.</strong>',
            'It’s possible the ID is incorrect, or the gist was deleted.'
          ].join('<br>');
        } else if (xhr.status === 0) {
          msg = 'GitHub could not be reached. Your Internet connection may be offline.';
        } else {
          msg = [
            'The import failed because of a <strong>connection error</strong>.',
            'HTTP status code: ' + xhr.status + ' ' + xhr.statusText
          ].join('<br>');
        }
    }
    return createElementHTML('p', msg);
  } else {
    // Other error
    const pre = document.createElement('pre');
    pre.textContent = errorString(reason);
    return joinNodes([
      createElementHTML('p', 'An unexpected error occurred:'),
      pre
    ]);
  }
}

// Show size in KB
function showSizeKB(n) {
  return (Math.ceil(10 * n / 1024) / 10).toFixed(1) + ' KB';
}

// Check if all arrays in an object are empty
function isEmptyNonDocs(nondocs) {
  return Object.values(nondocs).every(arr => !arr.length);
}

// List non-document files in the dialog
function listNondocuments(dialogBody, nondocs, disclosureTitle) {
  if (isEmptyNonDocs(nondocs)) return;
  const collapseId = 'nondocument-files';
  dialogBody.append('a')
    .attr('href', '#' + collapseId)
    .attr('class', 'disclosure-triangle collapsed')
    .attr('role', 'button')
    .attr('data-toggle', 'collapse')
    .text(disclosureTitle || 'Show other files');
  const container = dialogBody.append('div')
    .attr('id', collapseId)
    .attr('class', 'collapse');

  // Errors by type
  appendTablePanel(container, {
    title: 'Unexpected error',
    headers: ['Filename', 'Error'],
    data: nondocs.otherError.map(d => [d.filename, errorString(d.error)])
  }).classed('panel-danger', true);

  appendTablePanel(container, {
    title: 'Not suitable for import',
    headers: ['Filename', 'Reason'],
    data: nondocs.badDoc.map(d => [d.filename, d.error.message])
  });

  appendTablePanel(container, {
    title: 'Not valid as YAML',
    headers: ['Filename', 'Syntax error'],
    data: nondocs.badYAML.map(d => [
      d.filename,
      td => td.append('pre').text(d.error.message)
    ])
  });

  appendListPanel(container, {
    title: 'File is too large',
    data: nondocs.tooLarge
  });

  appendListPanel(container, {
    title: 'Different file extension (not <code>.yaml</code>/<code>.yml</code>)',
    data: nondocs.wrongType
  });
}

// Append a list panel
function appendListPanel(container, data) {
  if (!data.data || !data.data.length) return d3.select(document.createDocumentFragment());
  const panel = appendPanel(container, data.title);
  panel.append('div')
    .attr('class', 'panel-body')
    .append('ul')
    .attr('class', 'list-inline')
    .selectAll('li')
    .data(data.data)
    .enter().append('li')
    .text(String);
  return panel;
}

// Append a table panel
function appendTablePanel(container, data) {
  if (!data.data || !data.data.length) return d3.select(document.createDocumentFragment());
  const panel = appendPanel(container, data.title);
  panel.append('table')
    .attr('class', 'table')
    .call(table => {
      // headers
      table.append('thead')
        .append('tr').selectAll('th').data(data.headers)
        .enter().append('th').text(String);
      // contents
      table.append('tbody').selectAll('tr')
        .data(data.data)
        .enter().append('tr').selectAll('td')
        .data(d => d)
        .enter().append('td').each(function (d) {
          const td = d3.select(self);
          if (typeof d === 'function') {
            d(td);
          } else {
            td.text(d);
          }
        });
    });
  return panel;
}

// Append a panel with a title
function appendPanel(div, titleHTML) {
  const panel = div.append('div')
    .attr('class', 'panel panel-default');
  panel.append('div')
    .attr('class', 'panel-heading')
    .append('h5')
    .attr('class', 'panel-title')
    .html(titleHTML);
  return panel;
}


// Parse files into document files and non-document files
async function parseFiles(sizelimit, files) {
  const docfiles = [];
  const nondocs = { wrongType: [], tooLarge: [], badYAML: [], badDoc: [], otherError: [] };

  for (const file of files) {
    const filename = file.filename || file.name;
    if (!/\.ya?ml$/i.test(filename)) {
      nondocs.wrongType.push(filename);
    } else if (file.truncated || file.size > sizelimit) {
      nondocs.tooLarge.push(filename);
    } else {
      try {
        const content = file.content != null ? file.content : await FileReaderPromise.readAsText(file);
        docfiles.push({
          filename,
          size: file.size,
          document: format.parseDocument(content)
        });
      } catch (e) {
        const tuple = { filename, error: e };
        if (e instanceof format.YAMLException) {
          nondocs.badYAML.push(tuple);
        } else if (e instanceof format.InvalidDocumentError) {
          nondocs.badDoc.push(tuple);
        } else {
          nondocs.otherError.push(tuple);
        }
      }
    }
  }
  return { documentFiles: docfiles, nonDocumentFiles: nondocs };
}

// Pick multiple documents to import
function pickMultiple({ documentFiles, nonDocumentFiles, citeNode, dialog, importDocuments }) {
  const dialogBody = d3.select(dialog.bodyNode).text('');
  dialogBody.append('p').call(p => {
    p.append('strong').text('Select documents to import');
    if (citeNode) {
      p.node().appendChild(document.createTextNode(' from '));
      p.node().appendChild(citeNode);
    }
  });
  const ctable = new CheckboxTable({
    table: dialogBody.append('table').attr('class', 'table table-hover checkbox-table'),
    headers: ['Filename', 'Size'],
    data: documentFiles.map(doc => [doc.filename, showSizeKB(doc.size)])
  });
  listNondocuments(dialogBody, nonDocumentFiles);

  // Dialog footer
  const importButton = d3.select(dialog.footerNode).append('button')
    .attr('type', 'button')
    .attr('class', 'btn btn-primary')
    .attr('data-dismiss', 'modal')
    .property('disabled', true)
    .text('Import')
    .on('click', function () {
      d3.select(self).on('click', null); // prevent double import
      const names = new Set(ctable.getCheckedValues());
      importDocuments(documentFiles
        .filter(file => names.has(file.filename))
        .map(doc => doc.document)
      );
    })
    .node();

  ctable.onChange = function () {
    importButton.disabled = ctable.isCheckedEmpty();
  };
}

// Pick none (no valid documents)
function pickNone({ nonDocumentFiles, dialog, citeLink }) {
  const body = d3.select(dialog.bodyNode).text('');
  body.append('p').append('strong').text(!isEmptyNonDocs(nonDocumentFiles)
    ? 'None of the files are suitable for import.'
    : 'No files were selected.');
  if (citeLink) {
    body.append('p').text('Requested URL: ').node().appendChild(citeLink);
  }
  listNondocuments(body, nonDocumentFiles, 'Show details');
  dialog.cancelButtonNode.textContent = 'Close';
}

// Import dialog logic
async function importCommon(args) {
  const { gistID, dialogNode, importDocument, files } = args;
  const dialog = new ImportDialog(dialogNode);
  let citeLink, citeNode;
  const MAX_FILESIZE = 400 * 1024;

  // Start fetch, show dialog
  let filesList;
  if (gistID != null) {
    dialog.titleNode.textContent = 'Import from GitHub gist';
    citeLink = externalLink({ href: 'https://gist.github.com/' + gistID });
    dialog.setBodyChildNodes(['Retrieving ', citeLink, '…']);
    try {
      const data = await getGist(gistID);
      citeNode = gistDescriptionLink({
        gistID,
        description: data.description
      });
      dialog.setBodyChildNodes(['Processing ', citeLink, '…']);
      filesList = Object.values(data.files);
    } catch (reason) {
      dialog.setBodyChildNodes([messageForError(reason)]
        .concat(citeLink ? ['Requested URL: ', citeLink] : []));
      dialog.cancelButtonNode.textContent = 'Close';
      return;
    }
  } else {
    dialog.titleNode.textContent = 'Import from files';
    dialog.setBodyChildNodes(['Processing files…']);
    filesList = Array.from(files);
  }
  dialog.show();

  // Parse, pick, import
  try {
    const parsed = await parseFiles(MAX_FILESIZE, filesList);
    const docfiles = parsed.documentFiles;
    switch (docfiles.length) {
      case 0:
        pickNone({
          nonDocumentFiles: parsed.nonDocumentFiles,
          dialog,
          citeLink
        });
        return;
      case 1:
        importDocument(docfiles[0].document);
        dialog.close();
        return;
      default:
        pickMultiple({
          documentFiles: docfiles,
          nonDocumentFiles: parsed.nonDocumentFiles,
          dialog,
          citeNode,
          importDocuments: docs => docs.concat().reverse().forEach(importDocument)
        });
    }
  } catch (reason) {
    dialog.setBodyChildNodes([messageForError(reason)]
      .concat(citeLink ? ['Requested URL: ', citeLink] : []));
    dialog.cancelButtonNode.textContent = 'Close';
  }
}

// Import a gist via ?import-gist=gistID and remove the query string from the URL.
export function runImport({ dialogNode, importDocument }) {
  function removeQuery() {
    try {
      history.replaceState(null, null, location.pathname);
    } catch {
      // ignore
    }
  }
  const params = queryParams(location.search.substring(1));
  const gistID = params['import-gist'];
  if (gistID) {
    importGist({ gistID, dialogNode, importDocument }).finally(removeQuery);
  }
}

// ImportDialog class (modernized)
class ImportDialog {
  constructor(dialogNode) {
    this.node = dialogNode;
    this.titleNode = dialogNode.querySelector('.modal-header .modal-title');
    this.bodyNode = dialogNode.querySelector('.modal-body');
    this.footerNode = dialogNode.querySelector('.modal-footer');
    this.cancelButtonNode = d3.select(this.footerNode).text('')
      .append('button')
      .attr('type', 'button')
      .attr('class', 'btn btn-default')
      .attr('data-dismiss', 'modal')
      .text('Cancel')
      .node();
    this.node.addEventListener('hide.bs.modal', this.__onClose.bind(this), { once: true });
  }

  __onClose() {
    this.onClose();
    this.bodyNode.textContent = '';
    this.footerNode.textContent = '';
  }

  onClose() {}

  show() {
    this.node.classList.add('show');
    this.node.setAttribute('aria-hidden', 'false');
    this.node.style.display = '';
  }

  close() {
    this.node.classList.remove('show');
    this.node.setAttribute('aria-hidden', 'true');
    this.node.style.display = 'none';
    this.__onClose();
  }

  setBodyChildNodes(nodes) {
    this.bodyNode.textContent = '';
    this.bodyNode.appendChild(joinNodes(nodes));
  }
}

// Exported functions
export const importGist = importCommon;
export const importLocalFiles = importCommon;