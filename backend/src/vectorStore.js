import { LocalIndex } from 'vectra';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INDEX_PATH = path.join(__dirname, '..', 'data', 'vector-index');

const SIMILARITY_THRESHOLD = 0.3;
const TOP_K = 5;

// Singleton index
let index = null;

function getIndex() {
  if (!index) {
    index = new LocalIndex(INDEX_PATH);
  }
  return index;
}

/**
 * Wipe and recreate the vector index (called on every new PDF upload).
 */
export async function resetIndex() {
  // Remove existing index directory
  if (fs.existsSync(INDEX_PATH)) {
    fs.rmSync(INDEX_PATH, { recursive: true, force: true });
  }
  index = new LocalIndex(INDEX_PATH);
  await index.createIndex();
  console.log('✅ Vector index reset.');
}

/**
 * Bulk-insert chunks + their embeddings into the index.
 * @param {Array<{id, text, pageNumber, chunkIndex}>} chunks
 * @param {number[][]} embeddings  - parallel array of vectors
 */
export async function addChunks(chunks, embeddings) {
  const idx = getIndex();
  if (!(await idx.isIndexCreated())) {
    await idx.createIndex();
  }

  await idx.beginUpdate();
  for (let i = 0; i < chunks.length; i++) {
    await idx.insertItem({
      vector: embeddings[i],
      metadata: {
        text: chunks[i].text,
        pageNumber: chunks[i].pageNumber,
        chunkIndex: chunks[i].chunkIndex,
        id: chunks[i].id,
      },
    });
  }
  await idx.endUpdate();
  console.log(`✅ Stored ${chunks.length} chunks in vector index.`);
}

/**
 * Retrieve top-k similar chunks above the similarity threshold.
 * @param {number[]} queryEmbedding
 * @returns {Promise<Array<{text, pageNumber, score}>>}
 */
export async function searchSimilar(queryEmbedding) {
  const idx = getIndex();
  if (!(await idx.isIndexCreated())) return [];

  const results = await idx.queryItems(queryEmbedding, TOP_K);

  // Log raw scores so threshold can be tuned if needed
  console.log(
    '🔍 Raw similarity scores:',
    results.map((r) => r.score.toFixed(4)).join(', ')
  );

  const filtered = results.filter((r) => r.score >= SIMILARITY_THRESHOLD);
  console.log(`   Passed threshold (>=${SIMILARITY_THRESHOLD}): ${filtered.length}/${results.length} chunks`);

  return filtered.map((r) => ({
    text: r.item.metadata.text,
    pageNumber: r.item.metadata.pageNumber,
    chunkIndex: r.item.metadata.chunkIndex,
    score: Math.round(r.score * 1000) / 1000,
  }));
}
