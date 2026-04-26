import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

// ~350 tokens * 4 chars/token
const CHUNK_SIZE = 1400;
// ~50 tokens overlap * 4 chars/token
const OVERLAP = 200;

export async function parsePDF(filePath) {
  const buffer = fs.readFileSync(filePath);

  const pages = [];

  function render_page(pageData) {
    return pageData.getTextContent().then(function (textContent) {
      let text = '';
      let lastY;
      for (let item of textContent.items) {
        if (lastY == item.transform[5] || !lastY) {
          text += item.str;
        } else {
          text += '\n' + item.str;
        }
        lastY = item.transform[5];
      }
      
      pages.push({
        pageNumber: pageData.pageIndex + 1, // pageIndex is 0-based
        text: text.replace(/\s+/g, ' ').trim(),
      });
      
      return text;
    });
  }

  const options = { pagerender: render_page };
  const data = await pdfParse(buffer, options);

  // Filter out empty pages and ensure they are sorted correctly
  const validPages = pages
    .filter((p) => p.text.length > 10)
    .sort((a, b) => a.pageNumber - b.pageNumber);

  return { pages: validPages, numPages: data.numpages };
}

/**
 * Chunk pages into overlapping windows with page-number metadata.
 * @param {Array<{pageNumber, text}>} pages
 * @returns {Array<{id, text, pageNumber, chunkIndex}>}
 */
export function chunkPages(pages) {
  const chunks = [];

  for (const { pageNumber, text } of pages) {
    if (text.length <= CHUNK_SIZE) {
      chunks.push({
        id: uuidv4(),
        text,
        pageNumber,
        chunkIndex: chunks.length,
      });
    } else {
      let start = 0;
      while (start < text.length) {
        const end = Math.min(start + CHUNK_SIZE, text.length);
        chunks.push({
          id: uuidv4(),
          text: text.slice(start, end),
          pageNumber,
          chunkIndex: chunks.length,
        });
        if (end === text.length) break;
        start += CHUNK_SIZE - OVERLAP;
      }
    }
  }

  return chunks;
}
