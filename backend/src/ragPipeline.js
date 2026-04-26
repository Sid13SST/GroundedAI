import { parsePDF, chunkPages } from './pdfProcessor.js';
import { embed, embedSingle } from './embedder.js';
import { resetIndex, addChunks, searchSimilar } from './vectorStore.js';
import { generateAnswer } from './llm.js';

/**
 * Full ingestion pipeline: parse → chunk → embed → store.
 * @param {string} filePath
 * @returns {Promise<{numPages, numChunks}>}
 */
export async function ingestPDF(filePath) {
  console.log('📄 Parsing PDF…');
  const { pages, numPages } = await parsePDF(filePath);

  console.log(`📦 Creating chunks from ${numPages} pages…`);
  const chunks = chunkPages(pages);

  console.log(`🧮 Generating embeddings for ${chunks.length} chunks…`);
  // Embed in batches of 32 to avoid memory spikes
  const BATCH = 32;
  const allEmbeddings = [];
  for (let i = 0; i < chunks.length; i += BATCH) {
    const batch = chunks.slice(i, i + BATCH).map((c) => c.text);
    const vecs = await embed(batch);
    allEmbeddings.push(...vecs);
    process.stdout.write(`\r  Embedded ${Math.min(i + BATCH, chunks.length)}/${chunks.length}`);
  }
  console.log();

  console.log('💾 Storing in vector index…');
  await resetIndex();
  await addChunks(chunks, allEmbeddings);

  return { numPages, numChunks: chunks.length };
}

/**
 * RAG query: embed → retrieve → threshold-check → LLM generate.
 * @param {string} userQuery
 * @param {Array<{role, content}>} history
 * @returns {Promise<{answer, citations, isRefusal, refusalType, debug}>}
 */
export async function query(userQuery, history = []) {
  // 1. Embed the query
  const queryEmbedding = await embedSingle(userQuery);

  // 2. Vector retrieval
  const chunks = await searchSimilar(queryEmbedding);

  // 3. Threshold guard — no relevant chunks found
  if (chunks.length === 0) {
    return {
      answer: 'This information is not available in the uploaded document.',
      citations: [],
      isRefusal: true,
      refusalType: 'not_in_document',
      debug: { retrievedChunks: [] },
    };
  }

  // 4. LLM grounded generation
  const { answer, isRefusal, refusalType } = await generateAnswer(userQuery, chunks, history);

  // 5. Deduplicate & sort page citations
  const citations = isRefusal
    ? []
    : [...new Set(chunks.map((c) => c.pageNumber))].sort((a, b) => a - b);

  return {
    answer,
    citations,
    isRefusal,
    refusalType,
    debug: {
      retrievedChunks: chunks.map((c) => ({
        text: c.text.substring(0, 250) + (c.text.length > 250 ? '…' : ''),
        pageNumber: c.pageNumber,
        score: c.score,
      })),
    },
  };
}
