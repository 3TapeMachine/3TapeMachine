import jsyaml from 'js-yaml';

// Document Serialization

const docToYaml = {
  name: 'name',
  sourceCode: 'source code',
  positionTable: 'positions',
  editorSourceCode: 'editor contents'
};
const yamlToDoc = Object.fromEntries(Object.entries(docToYaml).map(([k, v]) => [v, k]));

// like _.mapKeys, but only using the keys specified in a mapping object.
function mapKeys(mapping) {
  return function (input) {
    const output = {};
    if (input != null) {
      Object.keys(mapping).forEach(fromKey => {
        const toKey = mapping[fromKey];
        output[toKey] = input[fromKey];
      });
    }
    return output;
  };
}

// Omit keys with null or undefined values
function omitByNull(obj) {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v != null)
  );
}

// Like lodash's mapValues
function mapValues(obj, fn) {
  if (!obj) return obj;
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k, fn(v, k)])
  );
}

// Like lodash's update
function update(obj, key, fn) {
  if (!obj || !(key in obj)) return obj;
  return { ...obj, [key]: fn(obj[key]) };
}

// Like lodash's defaults (but 2nd arg takes precedence)
function defaults(defaultsObj, obj) {
  return { ...defaultsObj, ...obj };
}

/**
 * Serialize a document.
 * For each state node position, only .x, .y, and .fixed are saved.
 * .fixed is omitted if true (its default value).
 * @param  {TMDocument} doc document to serialize
 * @return {string}
 */
export function stringifyDocument(doc) {
  let out = mapKeys(docToYaml)(doc);
  out = omitByNull(out);
  out = update(out, 'positions', positions =>
    mapValues(positions, pos =>
      pos.fixed
        ? { x: pos.x, y: pos.y }
        : { x: pos.x, y: pos.y, fixed: false }
    )
  );
  return jsyaml.dump(out, {
    flowLevel: 2,       // positions: one state per line
    lineWidth: -1,      // don't wrap lines
    noRefs: true,       // no aliases/references are used
    noCompatMode: true  // use y: instead of 'y':
  });
}

/**
 * Deserialize a document.
 * State positions' .px and .py are optional and default to .x and .y.
 * .fixed defaults to true.
 * @param  {string} str    serialized document
 * @return {Object}        data usable in TMDocument.copyFrom()
 * @throws {YAMLException} on YAML syntax error
 * @throws {TypeError}     when missing "source code" string property
 */
export function parseDocument(str) {
  let obj = jsyaml.load(str);
  obj = update(obj, 'positions', positions =>
    mapValues(positions, pos =>
      defaults({ px: pos.x, py: pos.y, fixed: true }, pos)
    )
  );
  obj = mapKeys(yamlToDoc)(obj);
  return checkData(obj);
}

// throw if "source code" attribute is missing or not a string
function checkData(obj) {
  if (obj == null || obj.sourceCode == null) {
    throw new InvalidDocumentError('The “source code:” value is missing');
  } else if (typeof obj.sourceCode !== 'string') {
    throw new InvalidDocumentError('The “source code:” value needs to be of type string');
  }
  return obj;
}

// for valid YAML that is not valid as a document
export class InvalidDocumentError extends Error {
  constructor(message = 'Invalid document') {
    super(message);
    this.name = 'InvalidDocumentError';
  }
}

// Re-exports
export const YAMLException = jsyaml.YAMLException;
