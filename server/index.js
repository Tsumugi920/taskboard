/**
 * taskboard 任务看板 - 后端服务
 * Node + Express，REST API，数据持久化到 server/data.json
 * 默认端口 3002（避免使用 3000/3001），可用环境变量 PORT 覆盖
 */
const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3002;
const DATA_FILE = path.join(__dirname, 'data.json');

const app = express();
app.use(express.json());

/* ---------- 数据读写 ---------- */

let db;

// 首次启动（或 data.json 损坏/缺失）时生成示例数据：1 个看板、3 列、10 张卡片
function seedData() {
  const now = nowIso();
  const card = (id, columnId, title, description, tags, position) => ({
    id, columnId, title, description, tags, position, createdAt: now, updatedAt: now,
  });
  return {
    board: { id: 'board-1', name: 'taskboard 任务看板' },
    columns: [
      { id: 'col-todo', name: '待办', position: 0 },
      { id: 'col-doing', name: '进行中', position: 1 },
      { id: 'col-done', name: '已完成', position: 2 },
    ],
    cards: [
      card('card-1', 'col-todo', '设计登录页面视觉稿', '输出登录、注册两页的高保真视觉稿，包含空状态与错误提示态。', ['设计'], 0),
      card('card-2', 'col-todo', '编写用户注册接口', 'POST /api/auth/register：参数校验、密码加密存储、重复邮箱检测。', ['后端'], 1),
      card('card-3', 'col-todo', '补充接口自动化测试', '为核心 API 补充集成测试，覆盖成功与失败分支。', ['测试'], 2),
      card('card-4', 'col-todo', '调研拖拽方案选型', '对比原生 HTML5 拖拽与成熟拖拽库的实现成本与浏览器兼容性。', ['前端'], 3),
      card('card-5', 'col-doing', '实现看板拖拽交互', '支持卡片跨列拖拽与列内排序，拖拽结果实时持久化。', ['前端'], 0),
      card('card-6', 'col-doing', '开发卡片增删改查 API', '卡片新建、编辑、删除、跨列移动接口联调中。', ['后端'], 1),
      card('card-7', 'col-doing', '撰写产品需求文档', '整理看板模块的需求背景、功能清单与验收标准。', ['文档'], 2),
      card('card-8', 'col-done', '初始化项目仓库', '建立前后端目录结构，配置启动脚本与说明文档。', ['文档'], 0),
      card('card-9', 'col-done', '确定技术栈选型', '前端使用原生 HTML/CSS/JS，后端使用 Node + Express + 文件持久化。', ['文档'], 1),
      card('card-10', 'col-done', '搭建前端页面骨架', '完成看板三列布局与基础样式，接入示例数据。', ['前端'], 2),
    ],
  };
}

function loadDb() {
  if (fs.existsSync(DATA_FILE)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      if (parsed && parsed.board && Array.isArray(parsed.columns) && Array.isArray(parsed.cards)) {
        db = parsed;
        return;
      }
      console.error('[taskboard] data.json 结构不完整，重新生成示例数据。');
    } catch (err) {
      console.error('[taskboard] data.json 解析失败，重新生成示例数据：', err.message);
    }
  }
  db = seedData();
  saveDb();
  console.log('[taskboard] 已生成示例数据：1 个看板、3 列、10 张卡片。');
}

function saveDb() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), 'utf8');
}

/* ---------- 工具函数 ---------- */

const nowIso = () => new Date().toISOString();

function newId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;
}

function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

function requireText(value, field) {
  if (typeof value !== 'string' || !value.trim()) throw httpError(400, `${field}不能为空`);
  return value.trim();
}

function normalizeTags(value) {
  if (value == null) return [];
  if (!Array.isArray(value)) throw httpError(400, 'tags 必须是字符串数组');
  const tags = value.map((tag) => String(tag).trim()).filter(Boolean);
  return [...new Set(tags)];
}

function sortedColumns() {
  return [...db.columns].sort((a, b) => a.position - b.position);
}

function cardsOf(columnId) {
  return db.cards
    .filter((card) => card.columnId === columnId)
    .sort((a, b) => a.position - b.position);
}

function boardState() {
  return {
    board: db.board,
    columns: sortedColumns(),
    cards: [...db.cards].sort((a, b) => a.position - b.position),
  };
}

function findColumn(id) {
  const column = db.columns.find((col) => col.id === id);
  if (!column) throw httpError(404, `列不存在：${id}`);
  return column;
}

function findCard(id) {
  const card = db.cards.find((c) => c.id === id);
  if (!card) throw httpError(404, `卡片不存在：${id}`);
  return card;
}

function reindexColumn(columnId) {
  cardsOf(columnId).forEach((card, index) => { card.position = index; });
}

/* ---------- 看板 ---------- */

app.get('/api/board', (req, res) => {
  res.json(boardState());
});

/* ---------- 列的增删改查 ---------- */

app.get('/api/columns', (req, res) => {
  res.json(sortedColumns());
});

app.post('/api/columns', (req, res) => {
  const name = requireText((req.body || {}).name, '列名');
  const position = db.columns.reduce((max, col) => Math.max(max, col.position + 1), 0);
  const column = { id: newId('col'), name, position };
  db.columns.push(column);
  saveDb();
  res.status(201).json(column);
});

app.put('/api/columns/:id', (req, res) => {
  const column = findColumn(req.params.id);
  column.name = requireText((req.body || {}).name, '列名');
  saveDb();
  res.json(column);
});

app.delete('/api/columns/:id', (req, res) => {
  const column = findColumn(req.params.id);
  db.columns = db.columns.filter((col) => col.id !== column.id);
  db.cards = db.cards.filter((card) => card.columnId !== column.id);
  saveDb();
  res.json({ ok: true, deletedColumnId: column.id });
});

/* ---------- 卡片的增删改查 ---------- */

app.get('/api/cards', (req, res) => {
  let cards = [...db.cards].sort((a, b) => a.position - b.position);
  if (req.query.columnId) cards = cards.filter((card) => card.columnId === req.query.columnId);
  res.json(cards);
});

// 新建卡片：{ columnId, title, description?, tags? }，默认落到目标列末尾
app.post('/api/cards', (req, res) => {
  const body = req.body || {};
  const column = findColumn(body.columnId);
  const now = nowIso();
  const card = {
    id: newId('card'),
    columnId: column.id,
    title: requireText(body.title, '标题'),
    description: typeof body.description === 'string' ? body.description.trim() : '',
    tags: normalizeTags(body.tags),
    position: cardsOf(column.id).length,
    createdAt: now,
    updatedAt: now,
  };
  db.cards.push(card);
  saveDb();
  res.status(201).json(card);
});

// 编辑卡片内容：{ title?, description?, tags? }
app.put('/api/cards/:id', (req, res) => {
  const card = findCard(req.params.id);
  const body = req.body || {};
  if (body.title !== undefined) card.title = requireText(body.title, '标题');
  if (body.description !== undefined) card.description = String(body.description).trim();
  if (body.tags !== undefined) card.tags = normalizeTags(body.tags);
  card.updatedAt = nowIso();
  saveDb();
  res.json(card);
});

app.delete('/api/cards/:id', (req, res) => {
  const card = findCard(req.params.id);
  db.cards = db.cards.filter((c) => c.id !== card.id);
  reindexColumn(card.columnId);
  saveDb();
  res.json({ ok: true, deletedCardId: card.id });
});

/* ---------- 卡片跨列移动 / 列内排序 ----------
 * body: { toColumnId, position? }
 * position 为卡片在目标列中的下标（从 0 开始），缺省或越界时移到末尾
 */
app.post('/api/cards/:id/move', (req, res) => {
  const card = findCard(req.params.id);
  const body = req.body || {};
  const targetColumn = findColumn(body.toColumnId);
  const fromColumnId = card.columnId;

  const others = cardsOf(targetColumn.id).filter((c) => c.id !== card.id);
  let index = Number(body.position);
  if (!Number.isInteger(index)) index = others.length;
  index = Math.max(0, Math.min(index, others.length));

  card.columnId = targetColumn.id;
  const ordered = [...others.slice(0, index), card, ...others.slice(index)];
  ordered.forEach((c, i) => { c.position = i; });
  if (fromColumnId !== targetColumn.id) reindexColumn(fromColumnId);
  card.updatedAt = nowIso();
  saveDb();
  res.json({ card, board: boardState() });
});

/* ---------- 静态页面与兜底 ---------- */

app.use('/api', (req, res) => {
  res.status(404).json({ error: '接口不存在' });
});

app.use(express.static(path.join(__dirname, '..', 'client')));

// 统一错误处理（含请求体 JSON 解析错误）
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  const status = err.status || (err.type === 'entity.parse.failed' ? 400 : 500);
  if (status >= 500) console.error(err);
  res.status(status).json({ error: err.message || '服务器内部错误' });
});

loadDb();
app.listen(PORT, () => {
  console.log(`[taskboard] 服务已启动: http://localhost:${PORT}`);
  console.log(`[taskboard] 数据文件: ${DATA_FILE}`);
});
