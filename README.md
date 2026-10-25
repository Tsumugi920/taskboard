# taskboard 任务看板

前后端完整的看板（Kanban）应用：前端为原生 HTML/CSS/JavaScript 实现的看板界面，后端为 Node + Express 提供的 REST API，数据持久化保存在 `server/data.json` 文件中（无需数据库）。

## 功能特性

- **看板列**：内置 1 个看板、3 列（待办 / 进行中 / 已完成），列支持通过 API 新增、重命名、删除
- **卡片拖拽**：卡片可跨列拖拽移动，也可列内拖拽排序，拖拽结果实时保存到后端
- **卡片管理**：新建、编辑（标题 / 描述 / 标签）、删除，点击卡片或「编辑」按钮即可修改
- **标签筛选**：顶栏展示全部标签，点击可多选筛选（卡片命中任一选中标签即显示）
- **数据持久化**：所有变更同步写入 `server/data.json`，服务重启后数据不丢失
- **内置示例数据**：首次启动自动生成 1 个看板、3 列、10 张示例卡片

## 目录结构

```
taskboard/
├── client/              # 前端（由后端托管，访问 http://localhost:3002）
│   ├── index.html       # 页面骨架：顶栏（标题 + 标签筛选）、看板、卡片弹窗
│   ├── style.css        # 样式
│   └── app.js           # 渲染、拖拽、筛选、增删改逻辑
├── server/
│   ├── index.js         # Express 服务：REST API + 托管前端静态文件
│   └── data.json        # 数据文件（首次启动自动生成）
├── package.json         # 启动脚本 npm start
└── README.md
```

## 环境要求

- Node.js >= 16（开发时使用 Node 22 验证）

## 安装与启动

```bash
cd taskboard
npm install
npm start
```

启动后浏览器访问 **http://localhost:3002** 即可使用（后端同时托管前端页面与 REST API）。

> 服务端口默认 **3002**（避开 3000/3001），如需更换：`PORT=3003 npm start`。

## REST API

Base URL：`http://localhost:3002`

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/board` | 获取看板整体数据（board + columns + cards） |
| GET | `/api/columns` | 列出所有列 |
| POST | `/api/columns` | 新建列：`{ "name": "新列" }` |
| PUT | `/api/columns/:id` | 重命名列：`{ "name": "..." }` |
| DELETE | `/api/columns/:id` | 删除列（列内卡片一并删除） |
| GET | `/api/cards?columnId=` | 列出卡片，可按列过滤 |
| POST | `/api/cards` | 新建卡片：`{ "columnId": "col-todo", "title": "...", "description": "...", "tags": ["前端"] }` |
| PUT | `/api/cards/:id` | 编辑卡片：`{ "title"?,"description"?,"tags"? }` |
| DELETE | `/api/cards/:id` | 删除卡片 |
| POST | `/api/cards/:id/move` | 跨列移动 / 列内排序：`{ "toColumnId": "col-doing", "position": 0 }` |

`move` 接口中 `position` 为卡片在目标列中的下标（从 0 开始），缺省或越界时移到末尾。

### curl 示例

```bash
# 列出全部卡片
curl -s http://localhost:3002/api/cards

# 新增一张卡片
curl -s -X POST http://localhost:3002/api/cards \
  -H 'Content-Type: application/json' \
  -d '{"columnId":"col-todo","title":"写周报","tags":["文档"]}'

# 把某张卡片移动到「进行中」第一张
curl -s -X POST http://localhost:3002/api/cards/<卡片ID>/move \
  -H 'Content-Type: application/json' \
  -d '{"toColumnId":"col-doing","position":0}'
```

## 数据持久化

- 所有增删改都会同步写入 `server/data.json`，服务重启后数据保留。
- 想恢复内置示例数据：停止服务后删除 `server/data.json`，重新 `npm start` 即可自动重新生成。

## 常见问题

- **端口被占用**：`PORT=3003 npm start` 换端口启动。
- **页面空白 / 接口 404**：请通过 `npm start` 启动后访问 `http://localhost:3002`，不要直接用文件方式打开 `index.html`（前端需要调用后端接口）。
