import { KeyValueStorage } from './storage.js';
import * as examples from './examples1.js';

/**
 * Document model (storage).
 * @param {string} docID Each document ID in a key-value store should be unique.
 *                       An ID is typically a timestamp. It should not contain '.'.
 */
function TMDocument(docID) {
  const preset = examples.get(docID);
  Object.defineProperties(this, {
    id:     { value: docID },
    prefix: { value: 'doc.' + docID },
    isExample: { value: !!preset }
  });
  // fall back to reading presets for example documents
  if (preset) {
    Object.defineProperties(this, {
      sourceCode: useFallbackGet(preset, this, 'sourceCode'),
      // names are read-only
      positionTable: useFallbackGet(preset, this, 'positionTable'),
      name: {
        get() { return preset.name; },
        set() {}, // don't err when removing (set = null)
        enumerable: true
      }
    });
  }
}

function useFallbackGet(preset, obj, prop) {
  const proto = Object.getPrototypeOf(obj);
  const desc = Object.getOwnPropertyDescriptor(proto, prop);
  const get = desc.get;
  desc.get = function () {
    const val = get.call(obj);
    return val != null ? val : preset[prop];
  };
  return desc;
}

// internal method.
TMDocument.prototype.path = function (path) {
  return `${this.prefix}.${path}`;
};

(() => {
  const store = KeyValueStorage;
  const read = store.read.bind(store);
  const write = (key, val) => {
    if (val != null) {
      store.write(key, val);
    } else {
      store.remove(key);
    }
  };

  function stringProp(path) {
    return {
      get() { return read(this.path(path)); },
      set(val) { write(this.path(path), val); },
      enumerable: true
    };
  }

  const propDescriptors = {
    sourceCode: stringProp('diagram.sourceCode'),
    positionTable: {
      get() {
        const x = read(this.path('diagram.positions'));
        return x == null ? null : parsePositionTable(x);
      },
      set(val) {
        write(
          this.path('diagram.positions'),
          val == null ? null : stringifyPositionTable(val)
        );
      },
      enumerable: true
    },
    editorSourceCode: stringProp('editor.sourceCode'),
    name: stringProp('name')
  };
  Object.defineProperties(TMDocument.prototype, propDescriptors);
  TMDocument.prototype.dataKeys = Object.keys(propDescriptors);
})();

// IDEA: bypass extra parse & stringify cycle for positions
TMDocument.prototype.copyFrom = function (other) {
  this.dataKeys.forEach(function (key) {
    this[key] = other[key];
  }, this);
  return this;
};

TMDocument.prototype.delete = function () {
  this.copyFrom({});
};

// Cross-tab/window storage sync

/**
 * Checks whether a storage key is for a document's name.
 * @return {?string} The document ID if true, otherwise null.
 */
TMDocument.IDFromNameStorageKey = function (string) {
  const result = /^doc\.([^.]+)\.name$/.exec(string);
  return result && result[1];
};

/**
 * Registers a listener for document changes caused by other tabs/windows.
 * The listener receives the document ID and the property name that changed.
 * @param {Function} listener
 */
TMDocument.addOutsideChangeListener = function (listener) {
  const re = /^doc\.([^.]+)\.(.+)$/;

  KeyValueStorage.addStorageListener(function (e) {
    const matches = re.exec(e.key);
    if (matches) {
      listener(matches[1], matches[2]);
    }
  });
};

/////////////////////////
// Position table JSON //
/////////////////////////

// JSON -> Object
const parsePositionTable = JSON.parse;

// PositionTable -> JSON
const stringifyPositionTable = val =>
  JSON.stringify(
    Object.fromEntries(
      Object.entries(val).map(([k, v]) => [k, truncateCoords(2)(v)])
    )
  );

// Truncate .x .y .px .py to 2 decimal places, to save space.
function truncateCoords(decimalPlaces) {
  const multiplier = Math.pow(10, decimalPlaces);
  function truncate(value) {
    return Math.round(value * multiplier) / multiplier;
  }

  return function (val) {
    const result = {};
    ['x', 'y', 'px', 'py'].forEach(key => {
      if (val[key] !== undefined) result[key] = truncate(val[key]);
    });
    if ('fixed' in val) result.fixed = val.fixed;
    return result;
  };
}

export default TMDocument;