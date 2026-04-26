// Uses the Gemini v1 REST API directly — bypasses the @google/generative-ai SDK
// which hardcodes the v1beta endpoint (where embedding models are unavailable).
// Node.js 18+ has fetch built-in, so no extra package is needed.

const EMBED_MODEL = 'gemini-embedding-001';
const EMBED_URL = (key) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:embedContent?key=${key}`;

function getKey() {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not set in your .env file.');
  }
  return process.env.GEMINI_API_KEY;
}

/**
 * Embed a single text via the Gemini v1 REST API.
 * @param {string} text
 * @returns {Promise<number[]>} 768-dim float vector
 */
export async function embedSingle(text) {
  const res = await fetch(EMBED_URL(getKey()), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: { parts: [{ text }] },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Embedding API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.embedding.values;
}

/**
 * Embed an array of texts sequentially (respects free-tier rate limits).
 * @param {string[]} texts
 * @returns {Promise<number[][]>} Array of 768-dim float vectors
 */
export async function embed(texts) {
  const results = [];
  for (const text of texts) {
    results.push(await embedSingle(text));
  }
  return results;
}
