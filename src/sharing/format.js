import jsyaml from 'js-yaml';

const KEY_MAPPINGS = {
  internal: {
    name: 'name',
    sourceCode: 'source code',
    positionTable: 'positions',
    editorSourceCode: 'editor contents'
  },
  get yaml() {
    return Object.fromEntries(
      Object.entries(this.internal).map(([k, v]) => [v, k])
    );
  }
};

const processPositions = positions => 
  positions && Object.fromEntries(
    Object.entries(positions).map(([k, pos]) => [
      k, 
      { x: pos.x, y: pos.y, ...(pos.fixed ? {} : { fixed: false }) }
    ])
  );

export function stringifyDocument(doc) {
  const mapped = Object.fromEntries(
    Object.entries(KEY_MAPPINGS.internal)
      .map(([fromKey, toKey]) => [toKey, doc[fromKey]])
      .filter(([, v]) => v != null)
  );

  if (mapped.positions) {
    mapped.positions = processPositions(mapped.positions);
  }

  return jsyaml.dump(mapped, {
    flowLevel: 2,
    lineWidth: -1,
    noRefs: true,
    noCompatMode: true
  });
}

export function parseDocument(str) {
  const yaml = jsyaml.load(str);
  
  if (!yaml?.['source code'] || typeof yaml['source code'] !== 'string') {
    throw new InvalidDocumentError('The "source code:" value is missing or invalid');
  }

  if (yaml.positions) {
    yaml.positions = Object.fromEntries(
      Object.entries(yaml.positions).map(([k, pos]) => [
        k,
        { 
          px: pos.x, 
          py: pos.y,
          x: pos.x,
          y: pos.y,
          fixed: pos.fixed ?? true
        }
      ])
    );
  }

  return Object.fromEntries(
    Object.entries(KEY_MAPPINGS.yaml)
      .map(([yamlKey, docKey]) => [docKey, yaml[yamlKey]])
  );
}

export class InvalidDocumentError extends Error {
  constructor(message = 'Invalid document') {
    super(message);
    this.name = 'InvalidDocumentError';
  }
}

export const { YAMLException } = jsyaml;
