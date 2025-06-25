import { TMSpecError, YAMLException, parseSpec } from '../parser.js';
import { stringify } from './stringify.js';

// The parser can throw these two errors.
export { TMSpecError, YAMLException };

/**
 * Thrown by parseDocument when a string can't be parsed.
 */
export class InvalidDocumentError extends Error {
  constructor(message, cause) {
    super();
    this.name = 'InvalidDocumentError';
    this.message = message;
    this.cause = cause;
  }
}

// =================================================================
// =========== START OF ADDED FUNCTION TO FIX ERROR ================
// =================================================================

/**
 * Convert an error to a user-friendly HTML string.
 * @param {Error} e
 * @returns {string}
 */
export function formatError(e) {
  if (e instanceof TMSpecError || e instanceof YAMLException) {
    return e.message;
  }
  // For any other unexpected errors, log the full error to the console for debugging
  console.error(e);
  return '<strong>Unexpected error:</strong> ' + e;
}

// =================================================================
// ============ END OF ADDED FUNCTION ==============================
// =================================================================

/**
 * Parse a YAML document containing a machine specification.
 * The YAML is expected to have a `source code:` key containing the spec.
 * @param {string} str - The YAML document string.
 * @returns {object} The parsed document object.
 */
export function parseDocument(str) {
  const doc = jsyaml.load(str);
  if (doc == null || typeof doc !== 'object') {
    throw new InvalidDocumentError('The document is empty or invalid.');
  }
  if (!('source code' in doc)) {
    throw new InvalidDocumentError('The "source code:" value is missing or invalid');
  }
  try {
    const spec = parseSpec(doc['source code']);
    // Combine top-level properties with parsed spec properties
    return { ...doc, ...spec };
  } catch (e) {
    if (e instanceof TMSpecError || e instanceof YAMLException) {
      throw new InvalidDocumentError(e.message, e);
    }
    throw e;
  }
}

/**
 * Convert a document object back into a YAML string.
 * @param {object} doc - The document object.
 * @returns {string} The YAML string representation.
 */
export function stringifyDocument(doc) {
  const spec = {};
  for (const key in doc) {
    if (Object.prototype.hasOwnProperty.call(doc, key) && key !== 'name' && key !== 'source code' && key !== 'id') {
      spec[key] = doc[key];
    }
  }
  const newDoc = {
    name: doc.name,
    'source code': stringify(spec)
  };
  return jsyaml.dump(newDoc, { skipInvalid: true });
}

// Re-exporting js-yaml for convenience if needed elsewhere
export const jsyaml = require('js-yaml');