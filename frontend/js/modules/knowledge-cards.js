import { api } from '../api.js';
import { formatDate, escapeHtml, showModal, showToast, nl2br } from '../utils.js';

let cardsCache = [];
let pageSubjects = [];

export async function renderKnowledgeCards(container) {
  container.innerHTML = '<div class="page-loading"><div class="loading-spinner"></div></div>';

  const [subjects, cards] = await Promise.all([api.getSubjects(), api.getKnowledgeCards()]);
  pageSubjects = subjects;
  cardsCache = cards;

  container.innerHTML = `
    <div class="section-header">
      <h2 class="section-title">\u77e5\u8bc6\u5361\u7247</h2>
    </div>
    <div class="filter-bar">
      <select class="form-select" id="filterSubject">
        <option value="">\u5168\u90e8\u79d1\u76ee</option>
        ${subjects.map((s) => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('')}
      </select>
      <span id="cardsCountHint" style="color:var(--text-muted);font-size:0.85rem;font-family:var(--font-mono);">\u5171 ${cards.length} \u5f20\u5361\u7247 \u00b7 \u70b9\u51fb\u67e5\u770b\u8be6\u60c5</span>
    </div>
    <div id="cardsContainer">
      ${renderCardsGrid(cards, subjects)}
    </div>
  `;

  document.getElementById('filterSubject').addEventListener('change', async (e) => {
    const filtered = await api.getKnowledgeCards(e.target.value || undefined);
    cardsCache = filtered;
    document.getElementById('cardsContainer').innerHTML = renderCardsGrid(filtered, subjects);
    updateCountHint(filtered.length);
    bindCardEvents(document.getElementById('cardsContainer'), subjects);
  });

  bindCardEvents(document.getElementById('cardsContainer'), subjects);
}

function updateCountHint(count) {
  document.getElementById('cardsCountHint').textContent =
    `\u5171 ${count} \u5f20\u5361\u7247 \u00b7 \u70b9\u51fb\u67e5\u770b\u8be6\u60c5`;
}

function refreshGrid() {
  const filterEl = document.getElementById('filterSubject');
  const subjectId = filterEl?.value || '';
  document.getElementById('cardsContainer').innerHTML = renderCardsGrid(cardsCache, pageSubjects);
  updateCountHint(cardsCache.length);
  bindCardEvents(document.getElementById('cardsContainer'), pageSubjects);
  if (filterEl && subjectId) filterEl.value = subjectId;
}

function renderCardsGrid(cards, subjects) {
  if (!cards.length) {
    return `<div class="empty-state">
      <div class="empty-icon">&#9733;</div>
      <h3 class="empty-title">\u6682\u65e0\u77e5\u8bc6\u5361\u7247</h3>
      <p class="empty-desc">\u8bf7\u5148\u5728\u79d1\u76ee\u7ba1\u7406\u4e2d\u4e0a\u4f20\u8d44\u6599\uff0c\u7531 AI \u6839\u636e\u539f\u6587\u62bd\u53d6\u672f\u8bed\u5e76\u751f\u6210\u4e00\u53e5\u8bdd\u89e3\u91ca\u4e0e\u8be6\u7ec6\u8bf4\u660e</p>
      <button class="btn btn-primary" id="gotoSubjects">\u524d\u5f80\u79d1\u76ee\u7ba1\u7406</button>
    </div>`;
  }

  return `<div class="card-grid">${cards
    .map((c) => `<div class="knowledge-card" data-id="${c.id}">
        <button class="card-delete-btn" data-id="${c.id}" title="\u5220\u9664\u5361\u7247" aria-label="\u5220\u9664\u5361\u7247">&times;</button>
        <div class="concept-title">${escapeHtml(c.concept)}</div>
        <div class="concept-preview">${escapeHtml(c.summary)}</div>
        <div class="card-hint">\u70b9\u51fb\u67e5\u770b\u8be6\u7ec6\u89e3\u91ca \u2192</div>
      </div>`)
    .join('')}</div>`;
}

function bindCardEvents(container, subjects) {
  container.querySelector('#gotoSubjects')?.addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('navigate', { detail: 'subjects' }));
  });

  container.querySelectorAll('.card-delete-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleDeleteCard(btn.dataset.id);
    });
  });

  container.querySelectorAll('.knowledge-card').forEach((el) => {
    el.addEventListener('click', () => {
      const card = cardsCache.find((c) => c.id === el.dataset.id);
      if (card) openCardDetail(card, subjects);
    });
  });
}

async function handleDeleteCard(cardId) {
  const card = cardsCache.find((c) => c.id === cardId);
  if (!card) return;
  if (!confirm(`\u786e\u5b9a\u5220\u9664\u77e5\u8bc6\u5361\u7247\u300c${card.concept}\u300d\u5417\uff1f`)) return;

  try {
    await api.deleteKnowledgeCard(cardId);
    cardsCache = cardsCache.filter((c) => c.id !== cardId);
    refreshGrid();
    showToast('\u5df2\u5220\u9664\u77e5\u8bc6\u5361\u7247', 'success');
  } catch (err) {
    showToast(err.message || '\u5220\u9664\u5931\u8d25', 'error');
  }
}

function openCardDetail(card, subjects) {
  const sub = subjects.find((s) => s.id === card.subjectId);

  const modal = document.getElementById('modal');
  modal.classList.add('modal-lg');

  const { close } = showModal({
    title: card.concept,
    body: `
      <div class="card-detail-modal">
        <div class="card-detail-section">
          <label class="form-label">\u6240\u5c5e\u79d1\u76ee</label>
          <p>${escapeHtml(sub?.name || '\u672a\u77e5')}</p>
        </div>
        <div class="card-detail-section">
          <label class="form-label">\u7b80\u4ecb</label>
          <p class="card-detail-hint">AI \u6839\u636e\u4e0a\u4f20\u8d44\u6599\u751f\u6210\uff0c\u4e00\u53e5\u8bdd\u4e0d\u8d85\u8fc720\u5b57</p>
          <p class="card-detail-text">${nl2br(card.summary)}</p>
        </div>
        <div class="card-detail-section">
          <label class="form-label">\u8be6\u7ec6\u8bf4\u660e</label>
          <p class="card-detail-hint">AI \u6839\u636e\u4e0a\u4f20\u5185\u5bb9\u751f\u6210\uff0c\u4e0d\u8d85\u8fc75\u53e5\u8bdd</p>
          <div class="card-detail-full">${nl2br(card.detail || '\u6682\u65e0\u8be6\u7ec6\u8bf4\u660e')}</div>
        </div>
        <div class="card-detail-footer">
          <span>\u521b\u5efa\u65f6\u95f4\uff1a${formatDate(card.createdAt)}</span>
        </div>
      </div>
    `,
    footer: `
      <button class="btn btn-danger" id="modalDeleteBtn">\u5220\u9664\u5361\u7247</button>
      <button class="btn btn-secondary" id="modalCloseBtn">\u5173\u95ed</button>
    `,
    onClose: () => modal.classList.remove('modal-lg'),
  });

  document.getElementById('modalCloseBtn')?.addEventListener('click', close);
  document.getElementById('modalDeleteBtn')?.addEventListener('click', async () => {
    close();
    await handleDeleteCard(card.id);
  });
}
