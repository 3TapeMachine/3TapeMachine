const INDENT = '  '; // 2 spaces

function isPlainObject(x) {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

function needsQuotes(str) {
  if (typeof str !== 'string') return false;
  return /[:{}\[\]#&*!|>'"]/.test(str)
    || /^[ \t\n\r]/.test(str)
    || /[ \t\n\r]$/.test(str)
    || ['true', 'false', 'null'].includes(str.toLowerCase());
}

function quote(str) {
  if (needsQuotes(str)) {
    return JSON.stringify(str);
  }
  return str;
}

function stringify(obj, depth = 0) {
  const indent = INDENT.repeat(depth);
  const lines = [];

  if (!obj) return '';

  for (const [key, value] of Object.entries(obj)) {
    let line = indent + quote(key) + ':';
    if (isPlainObject(value)) {
      const nested = stringify(value, depth + 1);
      if (nested) {
        lines.push(line);
        lines.push(nested);
      } else {
        lines.push(line + ' {}'); // Handle empty objects
      }
    } else {
      line += ' ' + String(value);
      lines.push(line);
    }
  }
  return lines.join('\n');
}

export { stringify };