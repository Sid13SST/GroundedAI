/* ── Config ───────────────────────────────────────────────────────────────── */
// When deploying frontend to Vercel, change this to your Render backend URL
// Example: const BACKEND_URL = 'https://grounded-ai-backend.onrender.com';
const BACKEND_URL = 'https://groundedai-5t1s.onrender.com'; // Point to Render backend

/* ── State ──────────────────────────────────────────────────────────────── */
const state = {
  pdfLoaded: false,
  isProcessing: false,
  debugMode: false,
  history: [], // { role: 'user'|'assistant', content }
};

/* ── DOM Refs ───────────────────────────────────────────────────────────── */
const uploadZone    = document.getElementById('uploadZone');
const fileInput     = document.getElementById('fileInput');
const uploadTitle   = document.getElementById('uploadTitle');
const uploadSub     = document.getElementById('uploadSub');
const uploadIconWrap= document.getElementById('uploadIconWrap');
const uploadProgress= document.getElementById('uploadProgress');
const progressFill  = document.getElementById('progressFill');
const progressLabel = document.getElementById('progressLabel');
const docInfo       = document.getElementById('docInfo');
const docFilename   = document.getElementById('docFilename');
const statPages     = document.getElementById('statPages');
const statChunks    = document.getElementById('statChunks');
const statusDot     = document.getElementById('statusDot');
const statusText    = document.getElementById('statusText');
const messagesContainer = document.getElementById('messagesContainer');
const welcomeScreen = document.getElementById('welcomeScreen');
const queryInput    = document.getElementById('queryInput');
const sendBtn       = document.getElementById('sendBtn');
const debugToggle   = document.getElementById('debugToggle');
const newChatBtn    = document.getElementById('newChatBtn');
const toast         = document.getElementById('toast');

/* ── Toast ──────────────────────────────────────────────────────────────── */
function showToast(msg, type = '') {
  toast.textContent = msg;
  toast.className = 'toast show' + (type ? ' ' + type : '');
  setTimeout(() => { toast.className = 'toast'; }, 3000);
}

/* ── Status helpers ─────────────────────────────────────────────────────── */
function setStatus(text, state = 'idle') {
  statusText.textContent = text;
  statusDot.className = 'status-dot ' + state;
}

/* ── Drag-and-drop ──────────────────────────────────────────────────────── */
uploadZone.addEventListener('click', () => fileInput.click());

uploadZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  uploadZone.classList.add('drag-over');
});
uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag-over'));
uploadZone.addEventListener('drop', (e) => {
  e.preventDefault();
  uploadZone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) handleFile(file);
});

fileInput.addEventListener('change', () => {
  if (fileInput.files[0]) handleFile(fileInput.files[0]);
});

/* ── PDF Upload ─────────────────────────────────────────────────────────── */
async function handleFile(file) {
  if (!file.name.toLowerCase().endsWith('.pdf')) {
    showToast('Only PDF files are accepted.', 'error');
    return;
  }

  // Show progress UI
  uploadProgress.style.display = 'block';
  uploadTitle.textContent = file.name.length > 24 ? file.name.slice(0, 22) + '…' : file.name;
  uploadSub.style.display = 'none';
  uploadIconWrap.style.display = 'none';
  progressLabel.textContent = 'Parsing & embedding…';
  progressFill.style.width = '0%';
  setStatus('Processing PDF…', 'loading');

  // Animate progress (indeterminate feel)
  let prog = 0;
  const progInterval = setInterval(() => {
    prog = Math.min(prog + (Math.random() * 8), 88);
    progressFill.style.width = prog + '%';
  }, 350);

  try {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch(`${BACKEND_URL}/upload-pdf`, { method: 'POST', body: formData });
    const data = await res.json();

    clearInterval(progInterval);

    if (!res.ok) throw new Error(data.error || 'Upload failed');

    progressFill.style.width = '100%';
    progressLabel.textContent = 'Ready!';

    setTimeout(() => {
      // Show doc info card
      uploadProgress.style.display = 'none';
      uploadIconWrap.style.display = 'flex';
      uploadSub.style.display = 'block';
      uploadTitle.textContent = 'Replace PDF';
      docInfo.style.display = 'block';
      docFilename.textContent = data.filename;
      statPages.textContent  = data.numPages;
      statChunks.textContent = data.numChunks;
    }, 600);

    state.pdfLoaded = true;
    state.history = [];
    clearMessages();
    setStatus(`${data.filename} ready`, 'ready');
    enableInput(true);
    showToast(`✅ ${data.numChunks} chunks indexed from ${data.numPages} pages`, 'success');
    fileInput.value = '';
    saveState();
  } catch (err) {
    clearInterval(progInterval);
    progressFill.style.width = '0%';
    uploadProgress.style.display = 'none';
    uploadIconWrap.style.display = 'flex';
    uploadSub.style.display = 'block';
    uploadTitle.textContent = 'Drop PDF here';
    setStatus('Upload a PDF to begin', 'idle');
    showToast(err.message, 'error');
  }
}

/* ── Input enable/disable ───────────────────────────────────────────────── */
function enableInput(on) {
  queryInput.disabled = !on;
  sendBtn.disabled    = !on;
  if (on) queryInput.focus();
}

/* ── Auto-resize textarea ───────────────────────────────────────────────── */
queryInput.addEventListener('input', () => {
  queryInput.style.height = 'auto';
  queryInput.style.height = Math.min(queryInput.scrollHeight, 140) + 'px';
});

queryInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
});
sendBtn.addEventListener('click', handleSend);

/* ── Send message ───────────────────────────────────────────────────────── */
async function handleSend() {
  const text = queryInput.value.trim();
  if (!text || state.isProcessing || !state.pdfLoaded) return;

  state.isProcessing = true;
  enableInput(false);
  hideWelcome();

  // Append user bubble
  appendMessage('user', text);
  state.history.push({ role: 'user', content: text });

  queryInput.value = '';
  queryInput.style.height = 'auto';

  // Append thinking indicator
  const thinkingEl = appendThinking();
  setStatus('Thinking…', 'loading');

  try {
    const res = await fetch(`${BACKEND_URL}/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: text, history: state.history.slice(-10) }),
    });
    const data = await res.json();

    thinkingEl.remove();

    if (!res.ok) throw new Error(data.error || 'Server error');

    appendAssistantMessage(data);
    state.history.push({ role: 'assistant', content: data.answer });
    setStatus(`${docFilename.textContent} ready`, 'ready');
  } catch (err) {
    thinkingEl.remove();
    appendErrorMessage(err.message);
    setStatus('Error — try again', 'idle');
    showToast(err.message, 'error');
  }

  state.isProcessing = false;
  enableInput(true);
}

/* ── Message builders ───────────────────────────────────────────────────── */
function hideWelcome() {
  if (welcomeScreen) welcomeScreen.style.display = 'none';
}

function clearMessages() {
  // Remove all messages but keep welcome screen
  const msgs = messagesContainer.querySelectorAll('.message, .thinking-row');
  msgs.forEach(m => m.remove());
  if (welcomeScreen) welcomeScreen.style.display = 'flex';
}

function appendMessage(role, text) {
  const wrap = document.createElement('div');
  wrap.className = `message ${role}`;

  const roleEl = document.createElement('div');
  roleEl.className = 'message-role';
  roleEl.textContent = role === 'user' ? 'You' : 'GroundedAI';

  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';
  bubble.textContent = text;

  wrap.appendChild(roleEl);
  wrap.appendChild(bubble);
  messagesContainer.appendChild(wrap);
  scrollBottom();
  saveState();
  return wrap;
}

function appendAssistantMessage(data) {
  const { answer, citations = [], isRefusal, debug } = data;

  const wrap = document.createElement('div');
  wrap.className = `message assistant${isRefusal ? ' refusal' : ''}`;

  const roleEl = document.createElement('div');
  roleEl.className = 'message-role';
  roleEl.textContent = 'GroundedAI';

  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';
  bubble.textContent = answer;

  wrap.appendChild(roleEl);
  wrap.appendChild(bubble);

  // Citations
  if (!isRefusal && citations.length > 0) {
    const citeRow = document.createElement('div');
    citeRow.className = 'citations';
    citations.forEach(pg => {
      const chip = document.createElement('div');
      chip.className = 'citation-chip';
      chip.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>Page ${pg}`;
      citeRow.appendChild(chip);
    });
    wrap.appendChild(citeRow);
  }

  // Debug panel
  if (debug && debug.retrievedChunks && debug.retrievedChunks.length > 0) {
    const panel = buildDebugPanel(debug.retrievedChunks);
    if (!state.debugMode) panel.classList.add('debug-hidden');
    panel.dataset.debugPanel = 'true';
    wrap.appendChild(panel);
  }

  messagesContainer.appendChild(wrap);
  scrollBottom();
  saveState();
}

function appendErrorMessage(msg) {
  const wrap = document.createElement('div');
  wrap.className = 'message assistant refusal';
  const roleEl = document.createElement('div');
  roleEl.className = 'message-role';
  roleEl.textContent = 'GroundedAI';
  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';
  bubble.textContent = `⚠️ ${msg}`;
  wrap.appendChild(roleEl);
  wrap.appendChild(bubble);
  messagesContainer.appendChild(wrap);
  scrollBottom();
  saveState();
}

function appendThinking() {
  const row = document.createElement('div');
  row.className = 'message assistant thinking-row';
  const roleEl = document.createElement('div');
  roleEl.className = 'message-role';
  roleEl.textContent = 'GroundedAI';
  const ind = document.createElement('div');
  ind.className = 'thinking-indicator';
  ind.innerHTML = '<div class="thinking-dot"></div><div class="thinking-dot"></div><div class="thinking-dot"></div>';
  row.appendChild(roleEl);
  row.appendChild(ind);
  messagesContainer.appendChild(row);
  scrollBottom();
  return row;
}

function buildDebugPanel(chunks) {
  const panel = document.createElement('div');
  panel.className = 'debug-panel';

  const header = document.createElement('div');
  header.className = 'debug-header';
  header.innerHTML = `<span>🔍 Debug — ${chunks.length} retrieved chunk(s)</span><span id="dbgArrow">▾</span>`;

  const body = document.createElement('div');
  body.className = 'debug-body';
  let open = true;

  header.addEventListener('click', () => {
    open = !open;
    body.style.display = open ? 'flex' : 'none';
    header.querySelector('#dbgArrow').textContent = open ? '▾' : '▸';
  });

  chunks.forEach((chunk, i) => {
    const scoreClass = chunk.score >= 0.85 ? 'score-high' : 'score-med';
    const div = document.createElement('div');
    div.className = 'debug-chunk';
    div.innerHTML = `
      <div class="debug-chunk-meta">
        <span class="debug-badge">Chunk ${i + 1}</span>
        <span class="debug-badge">Page ${chunk.pageNumber}</span>
        <span class="debug-badge ${scoreClass}">Score ${chunk.score}</span>
      </div>
      <div class="debug-chunk-text">${escapeHtml(chunk.text)}</div>`;
    body.appendChild(div);
  });

  panel.appendChild(header);
  panel.appendChild(body);
  return panel;
}

/* ── Debug toggle ───────────────────────────────────────────────────────── */
debugToggle.addEventListener('change', () => {
  state.debugMode = debugToggle.checked;
  document.querySelectorAll('[data-debug-panel]').forEach(panel => {
    panel.classList.toggle('debug-hidden', !state.debugMode);
  });
});

/* ── New Chat ────────────────────────────────────────────────────────────── */
newChatBtn.addEventListener('click', () => {
  state.history = [];
  clearMessages();
  localStorage.removeItem('groundedAI_history');
  localStorage.removeItem('groundedAI_messages');
  localStorage.removeItem('groundedAI_pdfLoaded');
  localStorage.removeItem('groundedAI_docInfo');
  state.pdfLoaded = false;
  uploadProgress.style.display = 'none';
  uploadIconWrap.style.display = 'flex';
  uploadSub.style.display = 'block';
  uploadTitle.textContent = 'Drop PDF here';
  docInfo.style.display = 'none';
  setStatus('Upload a PDF to begin', 'idle');
  enableInput(false);
  showToast('Conversation cleared.', '');
});

/* ── Local Storage Helpers ────────────────────────────────────────────────── */
function saveState() {
  const messagesHTML = messagesContainer.innerHTML;
  localStorage.setItem('groundedAI_history', JSON.stringify(state.history));
  localStorage.setItem('groundedAI_messages', messagesHTML);
  localStorage.setItem('groundedAI_pdfLoaded', JSON.stringify(state.pdfLoaded));
  if (state.pdfLoaded) {
    localStorage.setItem('groundedAI_docInfo', JSON.stringify({
      filename: docFilename.textContent,
      pages: statPages.textContent,
      chunks: statChunks.textContent
    }));
  }
}

function loadState() {
  const savedHistory = localStorage.getItem('groundedAI_history');
  const savedMessages = localStorage.getItem('groundedAI_messages');
  const savedPdfLoaded = localStorage.getItem('groundedAI_pdfLoaded');
  const savedDocInfo = localStorage.getItem('groundedAI_docInfo');

  if (savedHistory && savedMessages && savedPdfLoaded === 'true') {
    state.history = JSON.parse(savedHistory);
    state.pdfLoaded = true;
    messagesContainer.innerHTML = savedMessages;
    
    // Re-attach event listeners to debug panels if any
    const debugHeaders = messagesContainer.querySelectorAll('.debug-header');
    debugHeaders.forEach(header => {
      let open = true;
      const body = header.nextElementSibling;
      header.addEventListener('click', () => {
        open = !open;
        body.style.display = open ? 'flex' : 'none';
        header.querySelector('#dbgArrow').textContent = open ? '▾' : '▸';
      });
    });

    // Restore UI state
    if (savedDocInfo) {
      const info = JSON.parse(savedDocInfo);
      uploadProgress.style.display = 'none';
      uploadIconWrap.style.display = 'flex';
      uploadSub.style.display = 'block';
      uploadTitle.textContent = 'Replace PDF';
      docInfo.style.display = 'block';
      docFilename.textContent = info.filename;
      statPages.textContent = info.pages;
      statChunks.textContent = info.chunks;
      setStatus(`${info.filename} ready`, 'ready');
    }
    enableInput(true);
    scrollBottom();
  }
}

// Load state on startup
loadState();

/* ── Helpers ─────────────────────────────────────────────────────────────── */
function scrollBottom() {
  requestAnimationFrame(() => {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  });
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
