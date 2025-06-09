/**
 * Reads a Blob as text, returns a Promise that resolves with the result.
 * Supports cancellation via AbortSignal.
 * @param {Blob} blob
 * @param {string} [encoding]
 * @param {AbortSignal} [signal]
 * @returns {Promise<string>}
 */
export function readAsText(blob, encoding, signal) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.addEventListener('load', () => resolve(reader.result));
    reader.addEventListener('error', () => reject(reader.error));

    if (signal) {
      if (signal.aborted) {
        try { reader.abort(); } catch {/* */ }
        return reject(new DOMException('Aborted', 'AbortError'));
      }
      const abortHandler = () => {
        try { reader.abort(); } catch {/* */ }
        reject(new DOMException('Aborted', 'AbortError'));
      };
      signal.addEventListener('abort', abortHandler, { once: true });
      // Clean up event listener after promise settles
      const cleanup = () => signal.removeEventListener('abort', abortHandler);
      reader.addEventListener('loadend', cleanup, { once: true });
      reader.addEventListener('error', cleanup, { once: true });
    }

    reader.readAsText(blob, encoding);
  });
}
