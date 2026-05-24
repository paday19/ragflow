import { generateId, getStore, saveStore, shuffleArray } from './utils.js';

const API_BASE = window.API_BASE_URL || 'http://localhost:8000/api';
let useMock = true;

export async function checkApiHealth() {
  try {
    const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(2000) });
    if (res.ok) {
      useMock = false;
      return true;
    }
  } catch {
  }
  useMock = true;
  return false;
}

export function isMockMode() {
  return useMock;
}

async function request(path, options = {}) {
  if (useMock) {
    return mockRequest(path, options);
  }
  let url = `${API_BASE}${path}`;
  if (options.query) {
    url += options.query.startsWith('?') ? options.query : `?${options.query}`;
  }
  const headers = { ...options.headers };
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  const fetchOptions = { ...options, headers };
  delete fetchOptions.query;
  delete fetchOptions.timeoutMs;
  if (options.timeoutMs) {
    fetchOptions.signal = AbortSignal.timeout(options.timeoutMs);
  }
  const res = await fetch(url, fetchOptions);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || err.message || `请求失败 (${res.status})`);
  }
  if (res.status === 204) return null;
  return res.json();
}

async function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function extractConceptsWithProgress(subjectId, onProgress) {
  if (useMock) {
    const steps = [
      [8, '\u8bfb\u53d6\u8d44\u6599\u6587\u4ef6\u2026'],
      [25, '\u89e3\u6790\u6587\u6863\u5185\u5bb9\u2026'],
      [55, 'AI \u5206\u6790\u5e76\u62bd\u53d6\u4e13\u4e1a\u672f\u8bed\u2026'],
      [80, '\u6574\u7406\u77e5\u8bc6\u5361\u7247\u2026'],
      [92, '\u4fdd\u5b58\u77e5\u8bc6\u5361\u7247\u2026'],
    ];
    for (const [p, m] of steps) {
      onProgress?.(p, m);
      await delay(450);
    }
    const cards = await mockRequest(`/subjects/${subjectId}/extract`, { method: 'POST' });
    onProgress?.(100, `\u5b8c\u6210\uff0c\u5171\u62bd\u53d6 ${cards.length} \u4e2a\u672f\u8bed`);
    return cards;
  }

  const res = await fetch(`${API_BASE}/subjects/${subjectId}/extract/stream`, {
    method: 'POST',
    headers: { Accept: 'text/event-stream' },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || err.message || `\u62bd\u53d6\u5931\u8d25 (${res.status})`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let result = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (!line.startsWith('data:')) continue;
      const raw = line.slice(5).trim();
      if (!raw) continue;
      let payload;
      try {
        payload = JSON.parse(raw);
      } catch {
        continue;
      }
      if (payload.type === 'progress') {
        onProgress?.(payload.progress, payload.message);
      } else if (payload.type === 'done') {
        onProgress?.(payload.progress, payload.message);
        result = payload.cards;
      } else if (payload.type === 'error') {
        throw new Error(payload.message || '\u62bd\u53d6\u5931\u8d25');
      }
    }
  }

  if (!result) throw new Error('\u62bd\u53d6\u672a\u5b8c\u6210\uff0c\u8bf7\u91cd\u8bd5');
  return result;
}

async function mockRequest(path, options = {}) {
  await delay(300);
  const store = getStore();
  const method = (options.method || 'GET').toUpperCase();

  if (path === '/subjects' && method === 'GET') {
    return store.subjects.map(enrichSubject);
  }
  if (path === '/subjects' && method === 'POST') {
    const body = JSON.parse(options.body);
    const subject = {
      id: generateId(),
      name: body.name,
      description: body.description || '',
      createdAt: new Date().toISOString(),
    };
    store.subjects.push(subject);
    saveStore(store);
    return enrichSubject(subject);
  }
  if (path.match(/^\/subjects\/[^/]+$/) && method === 'DELETE') {
    const id = path.split('/')[2];
    store.subjects = store.subjects.filter((s) => s.id !== id);
    store.materials = store.materials.filter((m) => m.subjectId !== id);
    store.knowledgeCards = store.knowledgeCards.filter((c) => c.subjectId !== id);
    saveStore(store);
    return null;
  }
  if (path.match(/^\/subjects\/[^/]+\/materials$/) && method === 'GET') {
    const subjectId = path.split('/')[2];
    return store.materials.filter((m) => m.subjectId === subjectId);
  }
  if (path.match(/^\/subjects\/[^/]+\/materials$/) && method === 'POST') {
    const subjectId = path.split('/')[2];
    const formData = options.body;
    const files = formData.getAll('files');
    const added = files.map((file) => ({
      id: generateId(),
      subjectId,
      name: file.name,
      size: file.size,
      status: 'uploaded',
      uploadedAt: new Date().toISOString(),
    }));
    store.materials.push(...added);
    saveStore(store);
    return added;
  }
  if (path.match(/^\/subjects\/[^/]+\/extract$/) && method === 'POST') {
    const subjectId = path.split('/')[2];
    const cards = mockExtractConcepts(subjectId, store);
    store.knowledgeCards.push(...cards);
    saveStore(store);
    return cards;
  }
  if (path === '/knowledge-cards' && method === 'GET') {
    const url = new URL(`http://x${path}${options.query || ''}`);
    const subjectId = url.searchParams.get('subject_id');
    let cards = store.knowledgeCards;
    if (subjectId) cards = cards.filter((c) => c.subjectId === subjectId);
    return cards;
  }
  if (path.match(/^\/knowledge-cards\/[^/]+$/) && method === 'DELETE') {
    const id = path.split('/')[2];
    store.knowledgeCards = store.knowledgeCards.filter((c) => c.id !== id);
    saveStore(store);
    return null;
  }
  if (path === '/practice/generate' && method === 'POST') {
    const body = JSON.parse(options.body);
    return generateQuestions(body.subject_id, body.count || 5, store);
  }
  if (path === '/practice/submit' && method === 'POST') {
    const body = JSON.parse(options.body);
    return submitPractice(body, store);
  }
  if (path === '/wrong-book' && method === 'GET') {
    const url = new URL(`http://x${path}${options.query || ''}`);
    const subjectId = url.searchParams.get('subject_id');
    let items = store.wrongAnswers;
    if (subjectId) items = items.filter((w) => w.subjectId === subjectId);
    return items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }
  if (path.match(/^\/wrong-book\/[^/]+$/) && method === 'DELETE') {
    const id = path.split('/')[2];
    store.wrongAnswers = store.wrongAnswers.filter((w) => w.id !== id);
    saveStore(store);
    return null;
  }
  if (path === '/history' && method === 'GET') {
    return store.practiceSessions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }
  if (path === '/chat' && method === 'POST') {
    const body = JSON.parse(options.body);
    const msg = body.message;
    const sid = body.subjectId || body.subject_id;
    let prefix = sid ? '（基于科目知识背景）' : '（通用模式）';
    return {
      reply: `${prefix} 关于「${msg}」：这是一个很好的问题。在本地模式下无法调用 RAGFlow 模型，请确保后端已配置 RAGFLOW_API_URL 并连接 API。`,
    };
  }
  if (path === '/stats' && method === 'GET') {
    return {
      subjectCount: store.subjects.length,
      cardCount: store.knowledgeCards.length,
      wrongCount: store.wrongAnswers.length,
      sessionCount: store.practiceSessions.length,
    };
  }

  throw new Error(`Mock API: 未实�?${method} ${path}`);
}

function enrichSubject(subject) {
  const store = getStore();
  return {
    ...subject,
    materialCount: store.materials.filter((m) => m.subjectId === subject.id).length,
    cardCount: store.knowledgeCards.filter((c) => c.subjectId === subject.id).length,
  };
}

function mockExtractConcepts(subjectId, store) {
  const materials = store.materials.filter((m) => m.subjectId === subjectId);
  const subject = store.subjects.find((s) => s.id === subjectId);
  const templates = [
    { concept: '\u6838\u5fc3\u5b9a\u4e49', summary: '\u8be5\u6982\u5ff5\u7684\u57fa\u672c\u5b9a\u4e49\u4e0e\u5185\u6db5', detail: '\u5173\u952e\u6982\u5ff5\u662f\u5bf9\u5b66\u79d1\u77e5\u8bc6\u4f53\u7cfb\u7684\u62bd\u8c61\u6982\u62ec\uff0c\u7406\u89e3\u5b9a\u4e49\u662f\u638c\u63e1\u77e5\u8bc6\u7684\u7b2c\u4e00\u6b65\u3002' },
    { concept: '\u57fa\u672c\u539f\u7406', summary: '\u652f\u6491\u8be5\u9886\u57df\u7684\u5e95\u5c42\u903b\u8f91', detail: '\u57fa\u672c\u539f\u7406\u63ed\u793a\u4e86\u73b0\u8c61\u80cc\u540e\u7684\u56e0\u679c\u5173\u7cfb\u548c\u8fd0\u884c\u89c4\u5f8b\u3002' },
    { concept: '\u5178\u578b\u5e94\u7528', summary: '\u6982\u5ff5\u5728\u5b9e\u9645\u573a\u666f\u4e2d\u7684\u8fd0\u7528', detail: '\u901a\u8fc7\u5177\u4f53\u6848\u4f8b\u7406\u89e3\u62bd\u8c61\u6982\u5ff5\uff0c\u80fd\u591f\u52a0\u6df1\u8bb0\u5fc6\u5e76\u63d0\u5347\u8fc1\u79fb\u80fd\u529b\u3002' },
    { concept: '\u5e38\u89c1\u8bef\u533a', summary: '\u5b66\u4e60\u8fc7\u7a0b\u4e2d\u5bb9\u6613\u6df7\u6dc6\u7684\u70b9', detail: '\u8bc6\u522b\u5e38\u89c1\u8bef\u533a\u6709\u52a9\u4e8e\u907f\u514d\u9519\u8bef\u7406\u89e3\uff0c\u5efa\u7acb\u66f4\u51c6\u786e\u7684\u77e5\u8bc6\u7ed3\u6784\u3002' },
    { concept: '\u5173\u8054\u77e5\u8bc6', summary: '\u4e0e\u5176\u4ed6\u6982\u5ff5\u7684\u5185\u5728\u8054\u7cfb', detail: '\u77e5\u8bc6\u4e4b\u95f4\u5f80\u5f80\u76f8\u4e92\u5173\u8054\uff0c\u5efa\u7acb\u77e5\u8bc6\u7f51\u7edc\u6bd4\u5b64\u7acb\u8bb0\u5fc6\u66f4\u6709\u6548\u3002' },
  ];

  const base = subject?.name || '\u8d44\u6599';
  const source = materials.length ? materials[0].name : '\u9ed8\u8ba4\u8d44\u6599';

  return templates.map((t) => ({
    id: generateId(),
    subjectId,
    concept: base + ' \u00b7 ' + t.concept,
    summary: t.summary,
    detail: t.detail + '\n\n\uff08\u4ece\u300c' + source + '\u300d\u4e2d\u62bd\u53d6\uff0c\u6a21\u62df RAGFlow \u77e5\u8bc6\u62bd\u53d6\u7ed3\u679c\uff09',
    tags: [],
    createdAt: new Date().toISOString(),
  }));
}

function generateQuestions(subjectId, count, store) {
  let cards = store.knowledgeCards.filter((c) => c.subjectId === subjectId);
  if (!cards.length) {
    cards = store.knowledgeCards;
  }
  if (!cards.length) return [];

  const selected = shuffleArray(cards).slice(0, Math.min(count, cards.length));
  return selected.map((card) => {
    const wrongPool = store.knowledgeCards.filter((c) => c.id !== card.id);
    const distractors = shuffleArray(wrongPool).slice(0, 3).map((c) => c.summary);
    while (distractors.length < 3) {
      distractors.push('以上都不正确');
    }
    const options = shuffleArray([card.summary, ...distractors.slice(0, 3)]);
    return {
      id: generateId(),
      cardId: card.id,
      subjectId: card.subjectId,
      question: '\u5173\u4e8e\u300c' + card.concept + '\u300d\uff0c\u4ee5\u4e0b\u54ea\u9879\u63cf\u8ff0\u6700\u51c6\u786e\uff1f',
      options,
      correctIndex: options.indexOf(card.summary),
      explanation: card.detail,
    };
  });
}

function submitPractice(body, store) {
  const { subject_id, answers, duration } = body;
  let correct = 0;
  const wrongItems = [];

  answers.forEach((a) => {
    if (a.isCorrect) {
      correct++;
    } else {
      wrongItems.push({
        id: generateId(),
        subjectId: subject_id,
        question: a.question,
        userAnswer: a.userAnswer,
        correctAnswer: a.correctAnswer,
        conceptId: a.cardId,
        createdAt: new Date().toISOString(),
      });
    }
  });

  store.wrongAnswers.push(...wrongItems);

  const session = {
    id: generateId(),
    subjectId: subject_id,
    score: correct,
    total: answers.length,
    duration: duration || 0,
    createdAt: new Date().toISOString(),
  };
  store.practiceSessions.push(session);
  saveStore(store);

  return { session, wrongCount: wrongItems.length };
}

export const api = {
  getStats: () => request('/stats'),
  getSubjects: () => request('/subjects'),
  createSubject: (data) => request('/subjects', { method: 'POST', body: JSON.stringify(data) }),
  deleteSubject: (id) => request(`/subjects/${id}`, { method: 'DELETE' }),
  getMaterials: (subjectId) => request(`/subjects/${subjectId}/materials`),
  uploadMaterials: (subjectId, files) => {
    const formData = new FormData();
    files.forEach((f) => formData.append('files', f));
    if (useMock) {
      return mockRequest(`/subjects/${subjectId}/materials`, { method: 'POST', body: formData });
    }
    return fetch(`${API_BASE}/subjects/${subjectId}/materials`, { method: 'POST', body: formData }).then(async (r) => {
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.detail || err.message || `上传失败 (${r.status})`);
      }
      return r.json();
    });
  },
  extractConcepts: (subjectId, onProgress) => extractConceptsWithProgress(subjectId, onProgress),
  getKnowledgeCards: (subjectId) => {
    const q = subjectId ? `?subject_id=${subjectId}` : '';
    return request(`/knowledge-cards`, { query: q });
  },
  deleteKnowledgeCard: (id) => request(`/knowledge-cards/${id}`, { method: 'DELETE' }),
  generateQuiz: (subjectId, count) =>
    request('/practice/generate', { method: 'POST', body: JSON.stringify({ subject_id: subjectId, count }) }),
  submitPractice: (data) => request('/practice/submit', { method: 'POST', body: JSON.stringify(data) }),
  getWrongBook: (subjectId) => {
    const q = subjectId ? `?subject_id=${subjectId}` : '';
    return request('/wrong-book', { query: q });
  },
  deleteWrongItem: (id) => request(`/wrong-book/${id}`, { method: 'DELETE' }),
  getHistory: () => request('/history'),
  sendChat: (data) => request('/chat', { method: 'POST', body: JSON.stringify(data) }),
};
