import { checkApiHealth, isMockMode } from './api.js';
import { renderChat } from './modules/chat.js';
import { renderDashboard } from './modules/dashboard.js';
import { renderSubjects } from './modules/subjects.js';
import { renderKnowledgeCards } from './modules/knowledge-cards.js';
import { renderPractice } from './modules/practice.js';
import { renderWrongBook } from './modules/wrong-book.js';
import { renderHistory } from './modules/history.js';

const PAGE_TITLES = {
  dashboard: '\u4eea\u8868\u76d8',
  subjects: '\u79d1\u76ee\u7ba1\u7406',
  'knowledge-cards': '\u77e5\u8bc6\u5361\u7247',
  chat: '\u667a\u80fd\u95ee\u7b54',
  practice: '\u7ec3\u4e60\u62bd\u67e5',
  'wrong-book': '\u9519\u9898\u672c',
  history: '\u7ec3\u4e60\u5386\u53f2',
};

const pages = {
  dashboard: renderDashboard,
  subjects: renderSubjects,
  'knowledge-cards': renderKnowledgeCards,
  chat: renderChat,
  practice: renderPractice,
  'wrong-book': renderWrongBook,
  history: renderHistory,
};

async function navigate(page) {
  if (!pages[page]) return;

  document.querySelectorAll('.nav-item').forEach((item) => {
    item.classList.toggle('active', item.dataset.page === page);
  });

  document.getElementById('pageTitle').textContent = PAGE_TITLES[page];

  const container = document.getElementById('pageContent');
  await pages[page](container);

  document.getElementById('sidebar').classList.remove('open');
}

function initNavigation() {
  document.querySelectorAll('.nav-item').forEach((item) => {
    item.addEventListener('click', () => navigate(item.dataset.page));
  });

  window.addEventListener('navigate', (e) => navigate(e.detail));

  document.getElementById('menuToggle').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
  });
}

async function init() {
  initNavigation();

  const online = await checkApiHealth();
  const statusEl = document.getElementById('apiStatus');
  statusEl.textContent = online ? 'API \u5df2\u8fde\u63a5' : '\u672c\u5730\u6a21\u5f0f';
  statusEl.parentElement.style.borderColor = online
    ? 'rgba(16, 185, 129, 0.3)'
    : 'rgba(245, 158, 11, 0.3)';
  statusEl.parentElement.style.color = online ? 'var(--success)' : 'var(--warning)';

  await navigate('dashboard');
}

init();

export { navigate, isMockMode };
