// Direct REST call to v1beta — same pattern as embedder.js.
// Avoids @google/generative-ai SDK locking us to stale model names.

const LLM_MODEL = 'gemini-2.5-flash';
const LLM_URL = (key) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${LLM_MODEL}:generateContent?key=${key}`;

function getKey() {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not set in your .env file.');
  }
  return process.env.GEMINI_API_KEY;
}

const SYSTEM_PROMPT = `You are GroundedAI, a document-grounded assistant. Follow these rules STRICTLY:

1. Answer ONLY using information explicitly present in the provided Document Context.
2. If the answer is NOT found in the context, respond with EXACTLY this token: REFUSAL_NOT_FOUND
3. If the question is clearly unrelated to the document topic, respond with EXACTLY this token: REFUSAL_OUT_OF_SCOPE
4. Always cite the page number(s) using the inline format [Page X] directly after the relevant statement.
5. Never use external knowledge, assumptions, or inference beyond the document.
6. Be concise, accurate, and professional. Use plain text only.`;

/**
 * Generate a grounded answer via the Gemini v1beta REST API.
 * @param {string} query
 * @param {Array<{text, pageNumber, score}>} chunks
 * @param {Array<{role, content}>} history
 * @returns {Promise<{answer, isRefusal, refusalType}>}
 */
export async function generateAnswer(query, chunks, history = []) {
  const contextText = chunks
    .map((c) => `[Page ${c.pageNumber}]:\n${c.text}`)
    .join('\n\n---\n\n');

  const historyText =
    history.length > 0
      ? '\nConversation History:\n' +
        history
          .map((h) => `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.content}`)
          .join('\n')
      : '';

  const userMessage = `${SYSTEM_PROMPT}

Document Context:
${contextText}
${historyText}

User Question: ${query}

Answer:`;

  const res = await fetch(LLM_URL(getKey()), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: userMessage }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 1024 },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`LLM API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';

  if (raw.includes('REFUSAL_NOT_FOUND')) {
    return {
      answer: 'This information is not available in the uploaded document.',
      isRefusal: true,
      refusalType: 'not_in_document',
    };
  }
  if (raw.includes('REFUSAL_OUT_OF_SCOPE')) {
    return {
      answer: 'This query is outside the scope of the uploaded document.',
      isRefusal: true,
      refusalType: 'out_of_scope',
    };
  }

  return { answer: raw, isRefusal: false, refusalType: null };
}

