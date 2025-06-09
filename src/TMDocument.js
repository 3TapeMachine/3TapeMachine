import { KeyValueStorage } from './storage.js';
import * as examples from './examples1.js';

const parsePositionTable = JSON.parse;
const stringifyPositionTable = val =>
  JSON.stringify(
    Object.fromEntries(
      Object.entries(val).map(([k, v]) => [k, truncateCoords(2)(v)])
    )
  );

function truncateCoords(decimalPlaces) {
  const multiplier = Math.pow(10, decimalPlaces);
  const truncate = value => Math.round(value * multiplier) / multiplier;
  return val => {
    const result = {};
    ['x', 'y', 'px', 'py'].forEach(key => {
      if (val[key] !== undefined) result[key] = truncate(val[key]);
    });
    if ('fixed' in val) result.fixed = val.fixed;
    return result;
  };
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

const stringProp = path => ({
  get() { return KeyValueStorage.read(this.path(path)); },
  set(val) {
    if (val != null) {
      KeyValueStorage.write(this.path(path), val);
    } else {
      KeyValueStorage.remove(this.path(path));
    }
  },
  enumerable: true
});

const propDescriptors = {
  sourceCode: stringProp('diagram.sourceCode'),
  positionTable: {
    get() {
      const x = KeyValueStorage.read(this.path('diagram.positions'));
      return x == null ? null : parsePositionTable(x);
    },
    set(val) {
      KeyValueStorage.write(
        this.path('diagram.positions'),
        val == null ? null : stringifyPositionTable(val)
      );
    },
    enumerable: true
  },
  editorSourceCode: stringProp('editor.sourceCode'),
  name: stringProp('name')
};

export class TMDocument {
  constructor(docID) {
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
        positionTable: useFallbackGet(preset, this, 'positionTable'),
        name: {
          get() { return preset.name; },
          set() {}, // don't err when removing (set = null)
          enumerable: true
        }
      });
    }
  }

  path(path) {
    return `${this.prefix}.${path}`;
  }

  copyFrom(other) {
    this.dataKeys.forEach(key => {
      this[key] = other[key];
    });
    return this;
  }

  delete() {
    this.copyFrom({});
  }

  static IDFromNameStorageKey(string) {
    const result = /^doc\.([^.]+)\.name$/.exec(string);
    return result && result[1];
  }

  static addOutsideChangeListener(listener) {
    const re = /^doc\.([^.]+)\.(.+)$/;
    KeyValueStorage.addStorageListener(e => {
      const matches = re.exec(e.key);
      if (matches) {
        listener(matches[1], matches[2]);
      }
    });
  }
}

// Attach property descriptors and dataKeys to the prototype
Object.defineProperties(TMDocument.prototype, propDescriptors);
TMDocument.prototype.dataKeys = Object.keys(propDescriptors);

// Export the class as default for compatibility
export default TMDocument;
