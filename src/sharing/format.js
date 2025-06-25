import { TMSpecError, YAMLException, parseSpec } from '../parser.js';
import { stringify } from './stringify.js';
import jsyaml from 'js-yaml'; // FIX: Use the correct ES6 import syntax

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

/**
 * Convert an error to a user-friendly HTML string.
 */
export function formatError(e) {
  if (e instanceof TMSpecError || e instanceof YAMLException) {
    return e.message;
  }
  console.error(e); // Log unexpected errors for debugging
  return '<strong>Unexpected error:</strong> ' + e;
}

/**
 * Parse a YAML document containing a machine specification.
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
 */
export function stringifyDocument(doc) {
  const spec = {};
  const topLevelKeys = new Set(['name', 'source code', 'id', 'doc_id', 'title']);
  for (const key in doc) {
    if (Object.prototype.hasOwnProperty.call(doc, key) && !topLevelKeys.has(key)) {
      spec[key] = doc[key];
    }
  }
  const newDoc = {
    name: doc.name,
    'source code': stringify(spec)
  };
  return jsyaml.dump(newDoc, { skipInvalid: true });
}

export { YAMLException };