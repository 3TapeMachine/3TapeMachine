// /**
//  * Modern GitHub Gist API helper using fetch and native Promises.
//  */

/**
 * Helper to make a cancellable fetch request.
 * @param {RequestInfo} url
 * @param {RequestInit} [options]
 * @param {AbortSignal} [signal]
 * @returns {Promise<any>}
 */
function fetchJson(url, options = {}, signal) {
  return fetch(url, { ...options, signal })
    .then(async response => {
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw {
          xhr: response,
          status: response.status,
          error: error.message || response.statusText
        };
      }
      return response.json();
    });
}

/**
 * Get a gist by ID.
 * @param {string} gistID
 * @param {AbortSignal} [signal]
 * @returns {Promise<any>}
 */
export function getGist(gistID, signal) {
  return fetchJson(
    `https://api.github.com/gists/${gistID}`,
    {
      method: 'GET',
      headers: {
        Accept: 'application/vnd.github.v3+json'
      }
    },
    signal
  );
}

/* Unauthenticated gist support doesn't seem to be working */

/**
 * Create a new gist.
 * @param {Object} payload
 * @param {AbortSignal} [signal]
 * @returns {Promise<any>}
 */
export function createGist(payload, signal) {
  return fetchJson(
    'https://api.github.com/gists',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/vnd.github.v3+json'
      },
      body: JSON.stringify(payload)
    },
    signal
  );
}
