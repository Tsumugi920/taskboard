/* taskboard 任务看板 - 前端逻辑 */
const API = '/api';

const state = {
  board: null,
  columns: [],
  cards: [],
  activeTags: new Set(), // 选中的筛选标签（多选，命中任一即显示）
};

let dragCardId = null; // 正在拖拽的卡片 id
let dropHandled = false; // 本次拖拽是否已被 drop 处理
let modalContext = { mode: 'create', columnId: null, cardId: null };
let toastTimer;

const boardEl = document.getElementById('board');
const filterChipsEl = document.getElementById('filter-chips');
const modalEl = document.getElementById('card-modal');
const formEl = document.getElementById('card-form');
const toastEl = document.getElementById('toast');

/* ---------- 请求封装 ---------- */

async function fetchJSON(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `请求失败（HTTP ${res.status}）`);
  return data;
}

async function loadBoard() {
  const data = await fetchJSON(`${API}/board`);
  state.board = data.board;
  state.columns = data.columns;
  state.cards = data.cards;
  document.getElementById('board-name').textContent = state.board.name;
  render();
}

/* ---------- 渲染 ---------- */

function allTags() {
  const tags = new Set();
  state.cards.forEach((card) => card.tags.forEach((tag) => tags.add(tag)));
  return [...tags].sort((a, b) => a.localeCompare(b, 'zh-CN'));
}

function cardVisible(card) {
  if (state.activeTags.size === 0) return true;
  return card.tags.some((tag) => state.activeTags.has(tag));
}

function tagColor(tag) {
  let hash = 0;
  for (let i = 0; i < tag.length; i += 1) hash = (hash * 31 + tag.charCodeAt(i)) >>> 0;
  const hue = hash % 360;
  return {
    bg: `hsl(${hue}, 75%, 89%)`,
    fg: `hsl(${hue}, 55%, 32%)`,
    border: `hsl(${hue}, 60%, 78%)`,
  };
}

function render() {
  renderFilter();
  renderBoard();
}

function renderFilter() {
  filterChipsEl.innerHTML = '';
  const tags = allTags();
  if (tags.length === 0) {
    const empty = document.createElement('span');
    empty.className = 'filter-empty';
    empty.textContent = '暂无标签';
    filterChipsEl.appendChild(empty);
    return;
  }
  tags.forEach((tag) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = `filter-chip${state.activeTags.has(tag) ? ' active' : ''}`;
    chip.textContent = tag;
    if (state.activeTags.has(tag)) {
      const color = tagColor(tag);
      chip.style.background = color.bg;
      chip.style.color = color.fg;
      chip.style.borderColor = color.border;
    }
    chip.addEventListener('click', () => {
      if (state.activeTags.has(tag)) state.activeTags.delete(tag);
      else state.activeTags.add(tag);
      render();
    });
    filterChipsEl.appendChild(chip);
  });
  if (state.activeTags.size > 0) {
    const clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.className = 'filter-chip filter-clear';
    clearBtn.textContent = '✕ 清除筛选';
    clearBtn.addEventListener('click', () => {
      state.activeTags.clear();
      render();
    });
    filterChipsEl.appendChild(clearBtn);
  }
}

function renderBoard() {
  boardEl.innerHTML = '';
  state.columns.forEach((column) => {
    const columnEl = document.createElement('section');
    columnEl.className = 'column';
    columnEl.dataset.columnId = column.id;

    const cards = state.cards
      .filter((card) => card.columnId === column.id)
      .sort((a, b) => a.position - b.position);

    const header = document.createElement('header');
    header.className = 'column-header';
    const nameEl = document.createElement('h2');
    nameEl.className = 'column-name';
    nameEl.textContent = column.name;
    const countEl = document.createElement('span');
    countEl.className = 'column-count';
    countEl.textContent = String(cards.length);
    header.append(nameEl, countEl);

    const listEl = document.createElement('div');
    listEl.className = 'card-list';
    cards.filter(cardVisible).forEach((card) => listEl.appendChild(buildCardEl(card)));

    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'add-card-btn';
    addBtn.textContent = '＋ 新建卡片';
    addBtn.addEventListener('click', () => openModal('create', { columnId: column.id }));

    columnEl.append(header, listEl, addBtn);
    bindColumnDnD(columnEl, listEl);
    boardEl.appendChild(columnEl);
  });
}

function buildCardEl(card) {
  const el = document.createElement('article');
  el.className = 'card';
  el.dataset.cardId = card.id;
  el.draggable = true;

  const title = document.createElement('h3');
  title.className = 'card-title';
  title.textContent = card.title;
  el.appendChild(title);

  if (card.description) {
    const desc = document.createElement('p');
    desc.className = 'card-description';
    desc.textContent = card.description;
    el.appendChild(desc);
  }

  if (card.tags.length > 0) {
    const tagsEl = document.createElement('div');
    tagsEl.className = 'card-tags';
    card.tags.forEach((tag) => {
      const chip = document.createElement('span');
      chip.className = 'tag';
      chip.textContent = tag;
      const color = tagColor(tag);
      chip.style.background = color.bg;
      chip.style.color = color.fg;
      chip.style.border = `1px solid ${color.border}`;
      tagsEl.appendChild(chip);
    });
    el.appendChild(tagsEl);
  }

  const actions = document.createElement('div');
  actions.className = 'card-actions';
  const editBtn = document.createElement('button');
  editBtn.type = 'button';
  editBtn.className = 'btn btn-mini';
  editBtn.textContent = '编辑';
  editBtn.addEventListener('click', () => openModal('edit', { card }));
  const delBtn = document.createElement('button');
  delBtn.type = 'button';
  delBtn.className = 'btn btn-mini btn-danger';
  delBtn.textContent = '删除';
  delBtn.addEventListener('click', () => deleteCard(card));
  actions.append(editBtn, delBtn);
  el.appendChild(actions);

  el.addEventListener('click', (e) => {
    if (e.target.closest('button')) return;
    openModal('edit', { card });
  });

  el.addEventListener('dragstart', (e) => {
    dragCardId = card.id;
    dropHandled = false;
    e.dataTransfer.setData('text/plain', card.id);
    e.dataTransfer.effectAllowed = 'move';
    el.classList.add('dragging');
  });
  el.addEventListener('dragend', () => {
    el.classList.remove('dragging');
    if (!dropHandled) render(); // 未落到任何列时恢复原状
    dragCardId = null;
  });

  return el;
}

/* ---------- 拖拽 ---------- */

// 找到鼠标位置之后的那张卡片，作为插入点参考
function getCardAfter(listEl, y) {
  const cards = [...listEl.querySelectorAll('.card:not(.dragging)')];
  let closest = { offset: Number.NEGATIVE_INFINITY, element: null };
  cards.forEach((cardEl) => {
    const box = cardEl.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) closest = { offset, element: cardEl };
  });
  return closest.element;
}

function bindColumnDnD(columnEl, listEl) {
  columnEl.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const dragging = boardEl.querySelector('.card.dragging');
    if (!dragging) return;
    const after = getCardAfter(listEl, e.clientY);
    if (after) listEl.insertBefore(dragging, after);
    else listEl.appendChild(dragging);
  });

  columnEl.addEventListener('drop', async (e) => {
    e.preventDefault();
    dropHandled = true;
    const cardId = dragCardId || e.dataTransfer.getData('text/plain');
    const card = state.cards.find((c) => c.id === cardId);
    if (!card) return;
    const toColumnId = columnEl.dataset.columnId;

    const dragging = boardEl.querySelector('.card.dragging');
    const siblings = [...listEl.querySelectorAll('.card')];
    let position = dragging ? siblings.indexOf(dragging) : -1;
    if (position < 0) {
      position = state.cards.filter((c) => c.columnId === toColumnId && c.id !== card.id).length;
    }

    if (card.columnId === toColumnId && position === card.position) {
      render();
      return;
    }
    try {
      await fetchJSON(`${API}/cards/${card.id}/move`, {
        method: 'POST',
        body: JSON.stringify({ toColumnId, position }),
      });
      await loadBoard();
    } catch (err) {
      toast(err.message);
      render();
    }
  });
}

/* ---------- 新建 / 编辑 / 删除 ---------- */

function openModal(mode, { columnId = null, card = null } = {}) {
  modalContext = { mode, columnId, cardId: card ? card.id : null };
  document.getElementById('modal-title').textContent = mode === 'create' ? '新建卡片' : '编辑卡片';
  document.getElementById('field-title').value = card ? card.title : '';
  document.getElementById('field-description').value = card ? card.description || '' : '';
  document.getElementById('field-tags').value = card ? card.tags.join(', ') : '';
  modalEl.hidden = false;
  document.getElementById('field-title').focus();
}

function closeModal() {
  modalEl.hidden = true;
}

formEl.addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = document.getElementById('field-title').value.trim();
  if (!title) {
    toast('标题不能为空');
    return;
  }
  const description = document.getElementById('field-description').value.trim();
  const tags = document.getElementById('field-tags').value
    .split(/[,，]/)
    .map((tag) => tag.trim())
    .filter(Boolean);

  try {
    if (modalContext.mode === 'create') {
      await fetchJSON(`${API}/cards`, {
        method: 'POST',
        body: JSON.stringify({ columnId: modalContext.columnId, title, description, tags }),
      });
      toast('卡片已创建');
    } else {
      await fetchJSON(`${API}/cards/${modalContext.cardId}`, {
        method: 'PUT',
        body: JSON.stringify({ title, description, tags }),
      });
      toast('卡片已保存');
    }
    closeModal();
    await loadBoard();
  } catch (err) {
    toast(err.message);
  }
});

async function deleteCard(card) {
  if (!window.confirm(`确定删除卡片「${card.title}」吗？`)) return;
  try {
    await fetchJSON(`${API}/cards/${card.id}`, { method: 'DELETE' });
    toast('卡片已删除');
    await loadBoard();
  } catch (err) {
    toast(err.message);
  }
}

/* ---------- 提示条 ---------- */

function toast(message) {
  toastEl.textContent = message;
  toastEl.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastEl.hidden = true; }, 2200);
}

/* ---------- 事件绑定与启动 ---------- */

document.getElementById('btn-cancel').addEventListener('click', closeModal);
modalEl.addEventListener('click', (e) => {
  if (e.target === modalEl) closeModal();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !modalEl.hidden) closeModal();
});

loadBoard().catch((err) => toast('加载看板失败：' + err.message));
