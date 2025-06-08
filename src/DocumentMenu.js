import { KeyValueStorage } from './storage.js';
import TMDocument from './TMDocument.js';
import * as d3 from 'd3';

/**
 * Shallow merges two objects, with properties from the second argument taking precedence.
 * @param {Object} obj1
 * @param {Object} obj2
 * @returns {Object}
 */
function defaults(obj1, obj2) {
  return { ...obj1, ...obj2 };
}

/**
 * Document menu controller.
 *
 * The view is fully determined by a 3-tuple: ([ID], ID -> Name, currentID).
 * @constructor
 * @param {Object}  args                  argument object
 * @param {HTMLSelectElement}
 *                  args.menu
 * @param {?Node}  [args.group=args.menu] Node to add documents to.
 * @param {string}  args.storagePrefix
 * @param {?(TMDocument -> HTMLOptionElement)}
 *                  args.makeOption       Customize rendering for each document entry.
 * @param {?string} args.firsttimeDocID   Document to open on the first visit.
 */
class DocumentMenu {
  constructor(args) {
    const menu = args.menu;
    const group = args.group || menu;
    const storagePrefix = args.storagePrefix;
    const firsttimeDocID = args.firsttimeDocID;

    if (!menu) {
      throw new TypeError('DocumentMenu: missing parameter: menu element');
    } else if (!storagePrefix) {
      throw new TypeError('DocumentMenu: missing parameter: storage prefix');
    }
    if (args.makeOption) {
      this.optionFromDocument = args.makeOption;
    }
    this.menu = menu;
    this.group = group;
    this.group.innerHTML = '';
    this.__storagePrefix = storagePrefix;

    // Load document entries (non-examples)
    this.doclist = new DocumentList(storagePrefix + '.list');
    this.render();
    // Re-open last-opened document
    this.selectDocID(this.getSavedCurrentDocID() || firsttimeDocID);

    // Listen for selection changes
    this.menu.addEventListener('change', () => {
      this.onChange(this.currentDocument, { type: 'open' });
    });

    // Listen for storage changes in other tabs/windows
    KeyValueStorage.addStorageListener((e) => {
      let docID;
      let option, newOption;

      if (e.key === this.doclist.storageKey) {
        // case: [ID] list changed
        this.doclist.readList();
        this.render();
      } else if ((docID = TMDocument.IDFromNameStorageKey(e.key))) {
        // case: single document renamed: (ID -> Name) changed
        option = this.findOptionByDocID(docID);
        if (option) {
          // replace the whole <option>, to be consistent with .optionFromDocument
          option.parentNode.replaceChild(
            newOption = this.optionFromDocument(new TMDocument(docID)),
            option
          );
          newOption.selected = option.selected;
          d3.select(newOption).datum(d3.select(option).datum());
        }
      }
    });
  }

  get currentOption() {
    return this.menu.options[this.menu.selectedIndex];
  }

  get currentDocument() {
    const opt = this.currentOption;
    return opt ? new TMDocument(opt.value) : null;
  }

  render() {
    const currentDocID = this.currentOption ? this.currentOption.value : null;

    const option = d3.select(this.group).selectAll('option')
      .data(this.doclist.list, entry => entry.id);

    option.exit().remove();

    option.enter().insert(entry => 
      this.optionFromDocument(new TMDocument(entry.id))
    );

    // If current document was deleted, switch to another document
    if (this.currentOption.value !== currentDocID) {
      // fallback 1: saved current docID
      if (!this.selectDocID(this.getSavedCurrentDocID(), { type: 'delete' })) {
        // fallback 2: whatever is now selected
        this.onChange(this.currentDocument, { type: 'delete' });
      }
    }
  }

  // Returns the <option> whose 'value' attribute is docID.
  findOptionByDocID(docID) {
    return this.menu.querySelector(`option[value="${docID.replace(/"/g, '\\"')}"]`);
  }

  // Selects (switches the active item to) the given docID. Returns true on success.
  selectDocID(docID, opts) {
    try {
      this.findOptionByDocID(docID).selected = true;
    } catch  {
      return false;
    }
    this.onChange(this.currentDocument, opts);
    return true;
  }

  // Saves the current (selected) docID to storage.
  saveCurrentDocID() {
    const docID = this.currentOption && this.currentOption.value;
    if (docID) {
      KeyValueStorage.write(this.__storagePrefix + '.currentDocID', docID);
    }
  }

  // Returns the saved current docID, otherwise null.
  getSavedCurrentDocID() {
    return KeyValueStorage.read(this.__storagePrefix + '.currentDocID');
  }

  // Configurable methods

  optionFromDocument(doc) {
    const option = document.createElement('option');
    option.value = doc.id;
    option.text = doc.name || 'untitled';
    return option;
  }

  // Called when the current document ID changes
  // through user action (<select>) or this class's API.
  // The callback receives the new value of .currentDocument,
  // along with the options object (whose .type
  // is 'duplicate', 'delete', or 'open').
  onChange() {}

  // Internal Helpers

  // prepend then select
  __prepend(doc, opts) {
    const option = this.optionFromDocument(doc);
    this.group.insertBefore(option, this.group.firstChild);
    if (opts && opts.select) {
      this.menu.selectedIndex = option.index;
      this.onChange(doc, opts);
    }
    return doc;
  }

  // Methods not about Current Document

  newDocument(opts) {
    return this.__prepend(this.doclist.newDocument(), defaults({ type: 'open' }, opts));
  }

  // Methods about Current Document

  duplicate(doc, opts) {
    return this.__prepend(this.doclist.duplicate(doc), defaults({ type: 'duplicate' }, opts));
  }

  rename(newName) {
    this.currentDocument.name = newName;
    this.currentOption.text = newName;
  }

  // required invariant: one option is always selected.
  // returns true if the current entry was removed from the list.
  delete(opts) {
    this.currentDocument.delete();
    const index = this.menu.selectedIndex;
    const didDeleteEntry = this.doclist.deleteIndex(index);
    if (didDeleteEntry) {
      this.currentOption.remove();
      this.menu.selectedIndex = index;
      this.onChange(this.currentDocument, defaults({ type: 'delete' }, opts));
    }
    return didDeleteEntry;
  }
}

/////////////////////
// Document List   //
// (model/storage) //
/////////////////////

class DocumentList {
  constructor(storageKey) {
    this.storageKey = storageKey;
    this.readList();
  }

  static newID() {
    return String(Date.now());
  }

  add(docID) {
    this.__list.unshift({ id: docID });
    this.writeList();
  }

  readList() {
    this.__list = JSON.parse(KeyValueStorage.read(this.storageKey)) || [];
  }

  writeList() {
    KeyValueStorage.write(this.storageKey, JSON.stringify(this.__list));
  }

  newDocument() {
    const newID = DocumentList.newID();
    this.add(newID);
    return new TMDocument(newID);
  }

  duplicate(doc) {
    return this.newDocument().copyFrom(doc);
  }

  /**
   * Behaves like list.splice(index, 1).
   * @param  {number} index index of the element to delete
   * @return {boolean} true if an element was removed, false otherwise (index out of bounds)
   */
  deleteIndex(index) {
    const deleted = this.__list.splice(index, 1);
    this.writeList();
    return (deleted.length > 0);
  }

  get list() {
    return this.__list;
  }
}

export default DocumentMenu;