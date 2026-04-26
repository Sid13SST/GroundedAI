<div align="center">
  <img src="https://raw.githubusercontent.com/FortAwesome/Font-Awesome/master/svgs/solid/file-pdf.svg" width="80" alt="PDF Icon" style="filter: invert(53%) sepia(50%) saturate(5412%) hue-rotate(224deg) brightness(101%) contrast(97%); margin-bottom: 20px;" />
  
  # GroundedAI
  
  **A 100% Zero-Hallucination, PDF-Constrained Conversational RAG Agent**
  
  [![Node.js](https://img.shields.io/badge/Node.js-18.x-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
  [![Gemini 2.5 Flash](https://img.shields.io/badge/LLM-Gemini_2.5_Flash-8E75B2)](https://aistudio.google.com/)
  [![Hono.js](https://img.shields.io/badge/Framework-Hono-E36002)](https://hono.dev/)
  [![Vectra](https://img.shields.io/badge/Vector_DB-Vectra-007ACC)](https://github.com/microsoft/vectra)
  
  [Overview](#overview) • [Features](#key-features) • [Tech Stack](#tech-stack) • [Getting Started](#getting-started) • [Architecture](#architecture)
</div>

---

## 📖 Overview

**GroundedAI** is a cutting-edge Retrieval-Augmented Generation (RAG) agent that allows users to chat with their PDF documents. What sets GroundedAI apart is its **absolute strictness** — it guarantees zero hallucinations. If an answer isn't in the uploaded document, it will explicitly refuse to answer, and when it does answer, it provides **exact page-level citations**.

It features a stunning, glassmorphism-inspired dark mode UI that persists your chat and documents locally, paired with a blazing-fast local vector database and direct integrations with Google's latest Gemini models.

---

## ✨ Key Features

- **Strict Grounding**: System prompts explicitly enforce answering *only* from the text provided.
- **Zero Hallucination**: Returns explicit Refusal tokens for out-of-scope queries (e.g., `REFUSAL_NOT_FOUND`).
- **Page-Level Citations**: Traces answers back to their exact source pages in the PDF.
- **Local Vector Database**: Uses `vectra` to store embeddings locally on your filesystem — no Docker containers, Python environments, or cloud DB subscriptions required.
- **Generous Free-Tier RAG**: Built purely on Gemini's `gemini-embedding-001` and `gemini-2.5-flash` via direct REST APIs, ensuring lighting-fast, free-tier-friendly inferences.
- **State Persistence**: Your active document, chat history, and UI state survive page reloads using browser `localStorage`.
- **Debug Mode**: Toggle a developer view to instantly inspect vector similarity scores and the exact text chunks retrieved from the DB for any query.

---

## 🛠 Tech Stack

### Backend
- **Server**: [Hono.js](https://hono.dev/) (Extremely fast, edge-ready web framework)
- **Vector Database**: [Vectra](https://github.com/microsoft/vectra) (Local, file-backed vector DB built for Node.js)
- **PDF Parsing**: `pdf-parse` (Extracts text and page metadata natively)
- **Embeddings**: `gemini-embedding-001` (3072-dimensional vectors)
- **LLM**: `gemini-2.5-flash`

### Frontend
- **HTML / CSS / JS**: Vanilla implementation (Zero build-steps)
- **Design System**: Premium Dark Mode, Glassmorphism elements, CSS Variables, and responsive flex layouts.

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** (v18 or higher)
- A **Gemini API Key** (Get one for free at [Google AI Studio](https://aistudio.google.com/apikey))

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Sid13SST/GroundedAI.git
   cd GroundedAI/backend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up Environment Variables:**
   Copy the `.env.example` file to create your own `.env` file:
   ```bash
   cp .env.example .env
   ```
   Open `.env` and add your Gemini API Key:
   ```env
   GEMINI_API_KEY=your_api_key_here
   PORT=3000
   ```

4. **Start the server:**
   ```bash
   npm start
   ```

5. **Open the app:**
   Visit `http://localhost:3000` in your browser.

---

## 🧠 Architecture Flow

1. **Ingestion**: 
   - PDF is uploaded via a multipart form to the backend.
   - Text is extracted using `pagerender` hooks to ensure absolute page-number accuracy.
   - Text is split into overlapping chunks (~1400 chars, 200 overlap).
   - Chunks are vectorized using `gemini-embedding-001` and saved locally using `Vectra`.
2. **Retrieval**: 
   - User asks a question.
   - Question is vectorized.
   - Top-K similar chunks (Cosine Similarity > 0.3) are pulled from the local Vector Index.
3. **Generation**:
   - The LLM (`gemini-2.5-flash`) evaluates the chunks against the query using a strict bounding prompt.
   - Answer is returned with citations, or refused if out-of-bounds.

---

<div align="center">
  <i>Built with passion and a focus on beautiful, reliable AI.</i>
</div>
