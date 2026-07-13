#!/usr/bin/env node
'use strict';

/*
 * oakmega-scrm CLI
 *
 * 設計重點：
 * - 單一檔案、零外部相依，只用 Node 內建模組。
 * - API key 存在 ~/.config/oakmega-scrm/config.json（不在 plugin 目錄底下，
 *   因為 ${CLAUDE_PLUGIN_ROOT} 會在 plugin 更新時被整個覆蓋）。
 * - key 永遠不印全文；只在必要時印前 10 碼。
 * - 「未設定」一律以非 0 exit code 結束，方便 SKILL.md / Claude 用 exit code 分支判斷。
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const https = require('https');
const { URL } = require('url');
const { spawn } = require('child_process');

const PRODUCTION_BASE_URL = 'https://agent-api.oakmega.com';

const CONFIG_DIR = path.join(os.homedir(), '.config', 'oakmega-scrm');
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');

// ---------- 設定檔讀寫 ----------

function readConfig() {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
    const obj = JSON.parse(raw);
    return obj && typeof obj === 'object' ? obj : {};
  } catch (_err) {
    // 檔案不存在或解析失敗，一律視為「尚未設定」
    return {};
  }
}

function writeConfig(apiKey, workspaceId) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  const existing = readConfig();
  const payload = JSON.stringify({
    ...existing,
    API_KEY: apiKey,
    WORKSPACE_ID: workspaceId,
  }, null, 2) + '\n';
  fs.writeFileSync(CONFIG_PATH, payload, { mode: 0o600 });
  // writeFileSync 的 mode 只在「建立新檔」時生效；若檔案已存在，明確再 chmod 一次。
  fs.chmodSync(CONFIG_PATH, 0o600);
}

function getApiKey() {
  const cfg = readConfig();
  const key = cfg.API_KEY;
  if (typeof key === 'string' && key.trim() !== '') return key;
  return null;
}

function getWorkspaceId() {
  const cfg = readConfig();
  const id = cfg.WORKSPACE_ID;
  if (typeof id === 'number' || (typeof id === 'string' && id.trim() !== '')) return String(id);
  return null;
}

function getBaseUrl() {
  if (process.env.OAKMEGA_BASE_URL) return process.env.OAKMEGA_BASE_URL.replace(/\/$/, '');
  const cfg = readConfig();
  if (cfg.BASE_URL) return String(cfg.BASE_URL).replace(/\/$/, '');
  return PRODUCTION_BASE_URL;
}

function preview(key, n = 10) {
  return key.slice(0, n);
}

// ---------- 子指令：auth status ----------

function cmdAuthStatus() {
  const key = getApiKey();
  if (key) {
    console.log(`已登入。API_KEY: ${preview(key)}…（設定檔：${CONFIG_PATH}）`);
    process.exit(0);
  }
  console.log('尚未登入，請執行：oakmega-scrm login');
  process.exit(1);
}

// ---------- 子指令：whoami（示意操作） ----------

function cmdWhoami() {
  const key = getApiKey();
  if (!key) {
    console.log('尚未登入，請先執行：oakmega-scrm login');
    process.exit(1);
  }
  console.log(`API_KEY 前 10 碼：${preview(key)}`);
  process.exit(0);
}

// ---------- 子指令：login（本機網頁表單） ----------

function openBrowser(targetUrl) {
  let cmd;
  let args;
  if (process.platform === 'darwin') {
    cmd = 'open';
    args = [targetUrl];
  } else if (process.platform === 'win32') {
    // start 需透過 cmd，且第一個引號參數會被當成視窗標題，故補一個空標題。
    cmd = 'cmd';
    args = ['/c', 'start', '', targetUrl];
  } else {
    cmd = 'xdg-open';
    args = [targetUrl];
  }
  try {
    const child = spawn(cmd, args, { stdio: 'ignore', detached: true });
    child.on('error', () => {/* 開不起來就算了，使用者可手動貼網址 */});
    child.unref();
  } catch (_err) {
    /* 同上，忽略 */
  }
}

function htmlEscape(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formPage(nonce) {
  return `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>OakMega SCRM 設定</title>
<style>
  body { font-family: -apple-system, "Segoe UI", system-ui, sans-serif;
         background: #f5f6f8; margin: 0; display: flex; min-height: 100vh;
         align-items: center; justify-content: center; }
  .card { background: #fff; padding: 32px 36px; border-radius: 12px;
          box-shadow: 0 4px 24px rgba(0,0,0,.08); width: 360px; }
  h1 { font-size: 18px; margin: 0 0 4px; color: #1a1a1a; }
  p { font-size: 13px; color: #666; margin: 0 0 20px; line-height: 1.5; }
  label { font-size: 13px; color: #333; display: block; margin-bottom: 6px; }
  input[type=password],
  input[type=number] { width: 100%; box-sizing: border-box; padding: 10px 12px;
          font-size: 14px; border: 1px solid #d0d3d8; border-radius: 8px; }
  .field { margin-bottom: 16px; }
  button { margin-top: 4px; width: 100%; padding: 11px; font-size: 14px;
          color: #fff; background: #2563eb; border: 0; border-radius: 8px;
          cursor: pointer; }
  button:hover { background: #1d4ed8; }
</style>
</head>
<body>
  <div class="card">
    <h1>OakMega SCRM 設定</h1>
    <p>請貼上你的 API key 並填入 Workspace ID。送出後會儲存在本機，不會經過任何對話。</p>
    <form method="POST" action="/submit?nonce=${encodeURIComponent(nonce)}">
      <div class="field">
        <label for="key">API key</label>
        <input id="key" name="api_key" type="password" autocomplete="off"
               autofocus placeholder="貼上 API key">
      </div>
      <div class="field">
        <label for="workspace_id">Workspace ID</label>
        <input id="workspace_id" name="workspace_id" type="number" min="1"
               placeholder="例如：42">
      </div>
      <input type="hidden" name="nonce" value="${htmlEscape(nonce)}">
      <button type="submit">儲存設定</button>
    </form>
  </div>
</body>
</html>`;
}

function successPage() {
  return `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<title>設定完成</title>
<style>
  body { font-family: -apple-system, "Segoe UI", system-ui, sans-serif;
         background: #f5f6f8; margin: 0; display: flex; min-height: 100vh;
         align-items: center; justify-content: center; }
  .card { background: #fff; padding: 32px 36px; border-radius: 12px;
          box-shadow: 0 4px 24px rgba(0,0,0,.08); width: 360px; text-align: center; }
  h1 { font-size: 18px; margin: 0 0 8px; color: #16a34a; }
  p { font-size: 13px; color: #666; margin: 0; line-height: 1.5; }
</style>
</head>
<body>
  <div class="card">
    <h1>✓ 設定完成</h1>
    <p>API key 已儲存，可以關掉這個分頁回到終端機了。</p>
  </div>
</body>
</html>`;
}

function parseUrlEncoded(body) {
  const params = new URLSearchParams(body);
  const out = {};
  for (const [k, v] of params.entries()) out[k] = v;
  return out;
}

function randomNonce() {
  // 用內建 crypto 取隨機值，避免本機其他網頁亂打我們的 server。
  return require('crypto').randomBytes(16).toString('hex');
}

function cmdLogin() {
  const nonce = randomNonce();
  let settled = false;

  const server = http.createServer((req, res) => {
    let reqUrl;
    try {
      reqUrl = new URL(req.url, 'http://127.0.0.1');
    } catch (_err) {
      res.writeHead(400).end('bad request');
      return;
    }

    // GET / → 表單頁
    if (req.method === 'GET' && reqUrl.pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(formPage(nonce));
      return;
    }

    // POST /submit → 收 key
    if (req.method === 'POST' && reqUrl.pathname === '/submit') {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
        if (body.length > 1e6) req.destroy(); // 防爆量
      });
      req.on('end', () => {
        const fields = parseUrlEncoded(body);
        // nonce 驗證（query 或隱藏欄位任一相符即可）
        const gotNonce = reqUrl.searchParams.get('nonce') || fields.nonce;
        if (gotNonce !== nonce) {
          res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('forbidden: nonce mismatch');
          return;
        }
        const key = (fields.api_key || '').trim();
        const workspaceId = (fields.workspace_id || '').trim();
        if (!key) {
          res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end('<p>API key 不可為空，請回上一頁重試。</p>');
          return;
        }
        if (!workspaceId || !/^\d+$/.test(workspaceId)) {
          res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end('<p>Workspace ID 不可為空且必須為數字，請回上一頁重試。</p>');
          return;
        }
        try {
          writeConfig(key, workspaceId);
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('寫入設定檔失敗：' + err.message);
          return;
        }
        // Connection: close 讓瀏覽器不要保持 keep-alive 連線，
        // 否則 server.close() 會一直等不到連線排空。
        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Connection': 'close',
        });
        res.end(successPage());
        settled = true;
        console.log(`\n設定完成，已寫入：${CONFIG_PATH}`);
        // 停止接受新連線，並在回應送達後「直接」結束 process。
        // 不依賴 server.close() 的 callback——瀏覽器的 keep-alive 連線會讓該
        // callback 遲遲不觸發，導致 process 永遠掛著（先前的 bug）。
        server.close();
        setTimeout(() => process.exit(0), 300).unref();
      });
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('not found');
  });

  server.on('error', (err) => {
    console.error('啟動本機 server 失敗：' + err.message);
    process.exit(1);
  });

  // 綁 127.0.0.1 + 隨機 port（port=0 讓 OS 配一個可用 port）。
  server.listen(0, '127.0.0.1', () => {
    const port = server.address().port;
    const url = `http://127.0.0.1:${port}/?nonce=${nonce}`;
    console.log('OakMega SCRM 登入');
    console.log('請在打開的瀏覽器視窗貼上你的 API key 完成設定。');
    console.log('若瀏覽器沒有自動打開，請手動貼上以下網址：');
    console.log('  ' + url);
    openBrowser(url);
  });

  // 安全網：10 分鐘沒完成就放棄。
  setTimeout(() => {
    if (!settled) {
      console.error('\n逾時未完成設定，已結束。請重新執行：oakmega-scrm login');
      server.close(() => process.exit(1));
    }
  }, 10 * 60 * 1000).unref();
}

// ---------- HTTP 工具 ----------

function apiRequest(urlStr, apiKey) {
  return new Promise((resolve, reject) => {
    let parsed;
    try { parsed = new URL(urlStr); } catch (e) { return reject(e); }
    const lib = parsed.protocol === 'https:' ? https : http;
    const options = {
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: 'GET',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Accept': 'application/json' },
    };
    const req = lib.request(options, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    req.end();
  });
}

// ---------- HTTP 工具（POST） ----------

function apiPostRequest(urlStr, apiKey, bodyObj) {
  return new Promise((resolve, reject) => {
    let parsed;
    try { parsed = new URL(urlStr); } catch (e) { return reject(e); }
    const lib = parsed.protocol === 'https:' ? https : http;
    const bodyStr = JSON.stringify(bodyObj);
    const options = {
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr),
      },
    };
    const req = lib.request(options, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

// ---------- 子指令：tag list-member-tags ----------

async function cmdTagListMemberTags(argv) {
  const key = getApiKey();
  if (!key) {
    console.error('尚未登入，請先執行：oakmega-scrm login');
    process.exit(1);
  }

  // parse flags
  let workspaceId = null;
  let memberId = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--workspace-id' && argv[i + 1]) workspaceId = argv[++i];
    else if (argv[i] === '--member-id' && argv[i + 1]) memberId = argv[++i];
  }

  // fallback to config
  if (!workspaceId) workspaceId = getWorkspaceId();

  if (!workspaceId) {
    console.error('缺少 workspace ID。請用 --workspace-id <id> 指定，或重新執行 login 設定預設值。');
    process.exit(1);
  }
  if (!memberId) {
    console.error('缺少 --member-id <workspace_member_id>');
    process.exit(1);
  }

  const baseUrl = getBaseUrl();
  const url = `${baseUrl}/agent-tools/v3/${workspaceId}/tag/list-member-tags/${memberId}/`;

  let result;
  try {
    result = await apiRequest(url, key);
  } catch (err) {
    console.error('請求失敗：' + err.message);
    process.exit(1);
  }

  if (result.status !== 200) {
    console.error(`API 回傳 HTTP ${result.status}：${result.body}`);
    process.exit(1);
  }

  console.log(result.body);
  process.exit(0);
}

// ---------- 子指令：member search ----------

async function cmdMemberSearch(argv) {
  const key = getApiKey();
  if (!key) {
    console.error('尚未登入，請先執行：oakmega-scrm login');
    process.exit(1);
  }

  let query = null;
  let searchBy = null;
  let workspaceId = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--query' && argv[i + 1]) query = argv[++i];
    else if (argv[i] === '--search-by' && argv[i + 1]) searchBy = argv[++i];
    else if (argv[i] === '--workspace-id' && argv[i + 1]) workspaceId = argv[++i];
  }

  if (!workspaceId) workspaceId = getWorkspaceId();

  if (!workspaceId) {
    console.error('缺少 workspace ID。請用 --workspace-id <id> 指定，或重新執行 login 設定預設值。');
    process.exit(1);
  }
  if (!query) {
    console.error('缺少 --query <搜尋內容>');
    process.exit(1);
  }
  const VALID_SEARCH_BY = ['name', 'workspace_member_id', 'uuid'];
  if (!searchBy || !VALID_SEARCH_BY.includes(searchBy)) {
    console.error(`缺少或無效的 --search-by，必須是：${VALID_SEARCH_BY.join(' | ')}`);
    process.exit(1);
  }

  const baseUrl = getBaseUrl();
  const qs = new URLSearchParams({ query, search_by: searchBy }).toString();
  const url = `${baseUrl}/agent-tools/v3/${workspaceId}/member/search-members/?${qs}`;

  let result;
  try {
    result = await apiRequest(url, key);
  } catch (err) {
    console.error('請求失敗：' + err.message);
    process.exit(1);
  }

  if (result.status !== 200) {
    console.error(`API 回傳 HTTP ${result.status}：${result.body}`);
    process.exit(1);
  }

  console.log(result.body);
  process.exit(0);
}

// ---------- 子指令：broadcast search ----------

async function cmdBroadcastSearch(argv) {
  const key = getApiKey();
  if (!key) {
    console.error('尚未登入，請先執行：oakmega-scrm login');
    process.exit(1);
  }

  let workspaceId = null;
  let broadcastName = null;
  let startDt = null;
  let endDt = null;
  let limit = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--workspace-id' && argv[i + 1]) workspaceId = argv[++i];
    else if (argv[i] === '--name' && argv[i + 1]) broadcastName = argv[++i];
    else if (argv[i] === '--start-dt' && argv[i + 1]) startDt = argv[++i];
    else if (argv[i] === '--end-dt' && argv[i + 1]) endDt = argv[++i];
    else if (argv[i] === '--limit' && argv[i + 1]) limit = argv[++i];
  }

  if (!workspaceId) workspaceId = getWorkspaceId();
  if (!workspaceId) {
    console.error('缺少 workspace ID。請用 --workspace-id <id> 指定，或重新執行 login 設定預設值。');
    process.exit(1);
  }
  if (!startDt) {
    console.error('缺少 --start-dt <YYYY-MM-DD>');
    process.exit(1);
  }
  if (!endDt) {
    console.error('缺少 --end-dt <YYYY-MM-DD>');
    process.exit(1);
  }

  const params = { broadcast_start_dt: startDt, broadcast_end_dt: endDt };
  if (broadcastName) params.broadcast_name = broadcastName;
  if (limit) params.limit = limit;

  const baseUrl = getBaseUrl();
  const qs = new URLSearchParams(params).toString();
  const url = `${baseUrl}/agent-tools/v3/${workspaceId}/broadcast/search-broadcasts/?${qs}`;

  let result;
  try {
    result = await apiRequest(url, key);
  } catch (err) {
    console.error('請求失敗：' + err.message);
    process.exit(1);
  }

  if (result.status !== 200) {
    console.error(`API 回傳 HTTP ${result.status}：${result.body}`);
    process.exit(1);
  }

  console.log(result.body);
  process.exit(0);
}

// ---------- 子指令：broadcast get-statistics ----------

async function cmdBroadcastGetStatistics(argv) {
  const key = getApiKey();
  if (!key) {
    console.error('尚未登入，請先執行：oakmega-scrm login');
    process.exit(1);
  }

  let workspaceId = null;
  let broadcastId = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--workspace-id' && argv[i + 1]) workspaceId = argv[++i];
    else if (argv[i] === '--broadcast-id' && argv[i + 1]) broadcastId = argv[++i];
  }

  if (!workspaceId) workspaceId = getWorkspaceId();
  if (!workspaceId) {
    console.error('缺少 workspace ID。請用 --workspace-id <id> 指定，或重新執行 login 設定預設值。');
    process.exit(1);
  }
  if (!broadcastId) {
    console.error('缺少 --broadcast-id <id>');
    process.exit(1);
  }

  const baseUrl = getBaseUrl();
  const url = `${baseUrl}/agent-tools/v3/${workspaceId}/broadcast/get-broadcast-statistics/${broadcastId}/`;

  let result;
  try {
    result = await apiRequest(url, key);
  } catch (err) {
    console.error('請求失敗：' + err.message);
    process.exit(1);
  }

  if (result.status !== 200) {
    console.error(`API 回傳 HTTP ${result.status}：${result.body}`);
    process.exit(1);
  }

  console.log(result.body);
  process.exit(0);
}

// ---------- 子指令：member get-basic-info ----------

async function cmdMemberGetBasicInfo(argv) {
  const key = getApiKey();
  if (!key) { console.error('尚未登入，請先執行：oakmega-scrm login'); process.exit(1); }

  let workspaceId = null;
  let memberId = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--workspace-id' && argv[i + 1]) workspaceId = argv[++i];
    else if (argv[i] === '--member-id' && argv[i + 1]) memberId = argv[++i];
  }
  if (!workspaceId) workspaceId = getWorkspaceId();
  if (!workspaceId) { console.error('缺少 workspace ID。'); process.exit(1); }
  if (!memberId) { console.error('缺少 --member-id <workspace_member_id>'); process.exit(1); }

  const url = `${getBaseUrl()}/agent-tools/v3/${workspaceId}/member/get-member-basic-info/${memberId}/`;
  let result;
  try { result = await apiRequest(url, key); } catch (err) { console.error('請求失敗：' + err.message); process.exit(1); }
  if (result.status !== 200) { console.error(`API 回傳 HTTP ${result.status}：${result.body}`); process.exit(1); }
  console.log(result.body);
  process.exit(0);
}

// ---------- 子指令：member get-channel-line ----------

async function cmdMemberGetChannelLine(argv) {
  const key = getApiKey();
  if (!key) { console.error('尚未登入，請先執行：oakmega-scrm login'); process.exit(1); }

  let workspaceId = null;
  let memberId = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--workspace-id' && argv[i + 1]) workspaceId = argv[++i];
    else if (argv[i] === '--member-id' && argv[i + 1]) memberId = argv[++i];
  }
  if (!workspaceId) workspaceId = getWorkspaceId();
  if (!workspaceId) { console.error('缺少 workspace ID。'); process.exit(1); }
  if (!memberId) { console.error('缺少 --member-id <workspace_member_id>'); process.exit(1); }

  const url = `${getBaseUrl()}/agent-tools/v3/${workspaceId}/member/get-member-line/${memberId}/`;
  let result;
  try { result = await apiRequest(url, key); } catch (err) { console.error('請求失敗：' + err.message); process.exit(1); }
  if (result.status !== 200) { console.error(`API 回傳 HTTP ${result.status}：${result.body}`); process.exit(1); }
  console.log(result.body);
  process.exit(0);
}

// ---------- 子指令：member get-channel-fb ----------

async function cmdMemberGetChannelFb(argv) {
  const key = getApiKey();
  if (!key) { console.error('尚未登入，請先執行：oakmega-scrm login'); process.exit(1); }

  let workspaceId = null;
  let memberId = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--workspace-id' && argv[i + 1]) workspaceId = argv[++i];
    else if (argv[i] === '--member-id' && argv[i + 1]) memberId = argv[++i];
  }
  if (!workspaceId) workspaceId = getWorkspaceId();
  if (!workspaceId) { console.error('缺少 workspace ID。'); process.exit(1); }
  if (!memberId) { console.error('缺少 --member-id <workspace_member_id>'); process.exit(1); }

  const url = `${getBaseUrl()}/agent-tools/v3/${workspaceId}/member/get-member-fb/${memberId}/`;
  let result;
  try { result = await apiRequest(url, key); } catch (err) { console.error('請求失敗：' + err.message); process.exit(1); }
  if (result.status !== 200) { console.error(`API 回傳 HTTP ${result.status}：${result.body}`); process.exit(1); }
  console.log(result.body);
  process.exit(0);
}

// ---------- 子指令：member get-channel-ig ----------

async function cmdMemberGetChannelIg(argv) {
  const key = getApiKey();
  if (!key) { console.error('尚未登入，請先執行：oakmega-scrm login'); process.exit(1); }

  let workspaceId = null;
  let memberId = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--workspace-id' && argv[i + 1]) workspaceId = argv[++i];
    else if (argv[i] === '--member-id' && argv[i + 1]) memberId = argv[++i];
  }
  if (!workspaceId) workspaceId = getWorkspaceId();
  if (!workspaceId) { console.error('缺少 workspace ID。'); process.exit(1); }
  if (!memberId) { console.error('缺少 --member-id <workspace_member_id>'); process.exit(1); }

  const url = `${getBaseUrl()}/agent-tools/v3/${workspaceId}/member/get-member-ig/${memberId}/`;
  let result;
  try { result = await apiRequest(url, key); } catch (err) { console.error('請求失敗：' + err.message); process.exit(1); }
  if (result.status !== 200) { console.error(`API 回傳 HTTP ${result.status}：${result.body}`); process.exit(1); }
  console.log(result.body);
  process.exit(0);
}

// ---------- 子指令：member get-channel-whatsapp ----------

async function cmdMemberGetChannelWhatsapp(argv) {
  const key = getApiKey();
  if (!key) { console.error('尚未登入，請先執行：oakmega-scrm login'); process.exit(1); }

  let workspaceId = null;
  let memberId = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--workspace-id' && argv[i + 1]) workspaceId = argv[++i];
    else if (argv[i] === '--member-id' && argv[i + 1]) memberId = argv[++i];
  }
  if (!workspaceId) workspaceId = getWorkspaceId();
  if (!workspaceId) { console.error('缺少 workspace ID。'); process.exit(1); }
  if (!memberId) { console.error('缺少 --member-id <workspace_member_id>'); process.exit(1); }

  const url = `${getBaseUrl()}/agent-tools/v3/${workspaceId}/member/get-member-whatsapp/${memberId}/`;
  let result;
  try { result = await apiRequest(url, key); } catch (err) { console.error('請求失敗：' + err.message); process.exit(1); }
  if (result.status !== 200) { console.error(`API 回傳 HTTP ${result.status}：${result.body}`); process.exit(1); }
  console.log(result.body);
  process.exit(0);
}

// ---------- 子指令：member list-recent-messaged ----------

async function cmdMemberListRecentMessaged(argv) {
  const key = getApiKey();
  if (!key) { console.error('尚未登入，請先執行：oakmega-scrm login'); process.exit(1); }

  let workspaceId = null;
  let days = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--workspace-id' && argv[i + 1]) workspaceId = argv[++i];
    else if (argv[i] === '--days' && argv[i + 1]) days = argv[++i];
  }
  if (!workspaceId) workspaceId = getWorkspaceId();
  if (!workspaceId) { console.error('缺少 workspace ID。'); process.exit(1); }

  const params = days ? '?' + new URLSearchParams({ days }).toString() : '';
  const url = `${getBaseUrl()}/agent-tools/v3/${workspaceId}/member/list-recent-messaged-members/${params}`;
  let result;
  try { result = await apiRequest(url, key); } catch (err) { console.error('請求失敗：' + err.message); process.exit(1); }
  if (result.status !== 200) { console.error(`API 回傳 HTTP ${result.status}：${result.body}`); process.exit(1); }
  console.log(result.body);
  process.exit(0);
}

// ---------- 子指令：member list-recent-chatbot-triggered ----------

async function cmdMemberListRecentChatbotTriggered(argv) {
  const key = getApiKey();
  if (!key) { console.error('尚未登入，請先執行：oakmega-scrm login'); process.exit(1); }

  let workspaceId = null;
  let days = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--workspace-id' && argv[i + 1]) workspaceId = argv[++i];
    else if (argv[i] === '--days' && argv[i + 1]) days = argv[++i];
  }
  if (!workspaceId) workspaceId = getWorkspaceId();
  if (!workspaceId) { console.error('缺少 workspace ID。'); process.exit(1); }

  const params = days ? '?' + new URLSearchParams({ days }).toString() : '';
  const url = `${getBaseUrl()}/agent-tools/v3/${workspaceId}/member/list-recent-chatbot-triggered-members/${params}`;
  let result;
  try { result = await apiRequest(url, key); } catch (err) { console.error('請求失敗：' + err.message); process.exit(1); }
  if (result.status !== 200) { console.error(`API 回傳 HTTP ${result.status}：${result.body}`); process.exit(1); }
  console.log(result.body);
  process.exit(0);
}

// ---------- 子指令：member list-recent-deeplink-clicked ----------

async function cmdMemberListRecentDeeplinkClicked(argv) {
  const key = getApiKey();
  if (!key) { console.error('尚未登入，請先執行：oakmega-scrm login'); process.exit(1); }

  let workspaceId = null;
  let days = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--workspace-id' && argv[i + 1]) workspaceId = argv[++i];
    else if (argv[i] === '--days' && argv[i + 1]) days = argv[++i];
  }
  if (!workspaceId) workspaceId = getWorkspaceId();
  if (!workspaceId) { console.error('缺少 workspace ID。'); process.exit(1); }

  const params = days ? '?' + new URLSearchParams({ days }).toString() : '';
  const url = `${getBaseUrl()}/agent-tools/v3/${workspaceId}/member/list-recent-deeplink-clicked-members/${params}`;
  let result;
  try { result = await apiRequest(url, key); } catch (err) { console.error('請求失敗：' + err.message); process.exit(1); }
  if (result.status !== 200) { console.error(`API 回傳 HTTP ${result.status}：${result.body}`); process.exit(1); }
  console.log(result.body);
  process.exit(0);
}

// ---------- 子指令：tag list-members-batch ----------

async function cmdTagListMembersBatch(argv) {
  const key = getApiKey();
  if (!key) { console.error('尚未登入，請先執行：oakmega-scrm login'); process.exit(1); }

  let workspaceId = null;
  let memberIdsStr = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--workspace-id' && argv[i + 1]) workspaceId = argv[++i];
    else if (argv[i] === '--member-ids' && argv[i + 1]) memberIdsStr = argv[++i];
  }
  if (!workspaceId) workspaceId = getWorkspaceId();
  if (!workspaceId) { console.error('缺少 workspace ID。'); process.exit(1); }
  if (!memberIdsStr) { console.error('缺少 --member-ids <id1,id2,...>'); process.exit(1); }

  const memberIds = memberIdsStr.split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n));
  if (memberIds.length === 0) { console.error('--member-ids 必須包含至少一個有效數字 ID'); process.exit(1); }
  if (memberIds.length > 20) { console.error('--member-ids 最多 20 人'); process.exit(1); }

  const url = `${getBaseUrl()}/agent-tools/v3/${workspaceId}/tag/list-members-tags-batch/`;
  let result;
  try { result = await apiPostRequest(url, key, { workspace_member_ids: memberIds }); } catch (err) { console.error('請求失敗：' + err.message); process.exit(1); }
  if (result.status !== 200) { console.error(`API 回傳 HTTP ${result.status}：${result.body}`); process.exit(1); }
  console.log(result.body);
  process.exit(0);
}

// ---------- 子指令：activity-log list-tag-changes ----------

async function cmdActivityLogListTagChanges(argv) {
  const key = getApiKey();
  if (!key) { console.error('尚未登入，請先執行：oakmega-scrm login'); process.exit(1); }

  let workspaceId = null;
  let memberId = null;
  let memberIdsStr = null;
  let days = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--workspace-id' && argv[i + 1]) workspaceId = argv[++i];
    else if (argv[i] === '--member-id' && argv[i + 1]) memberId = argv[++i];
    else if (argv[i] === '--member-ids' && argv[i + 1]) memberIdsStr = argv[++i];
    else if (argv[i] === '--days' && argv[i + 1]) days = argv[++i];
  }
  if (!workspaceId) workspaceId = getWorkspaceId();
  if (!workspaceId) { console.error('缺少 workspace ID。'); process.exit(1); }
  if (!memberId && !memberIdsStr) { console.error('缺少 --member-id <id> 或 --member-ids <id1,id2,...>'); process.exit(1); }

  const baseUrl = getBaseUrl();
  const params = days ? '?' + new URLSearchParams({ days }).toString() : '';

  if (memberIdsStr) {
    const ids = memberIdsStr.split(',').map((s) => s.trim()).filter(Boolean);
    const results = [];
    for (const id of ids) {
      const url = `${baseUrl}/agent-tools/v3/${workspaceId}/activity-log/list-member-tag-changes/${id}/${params}`;
      let res;
      try { res = await apiRequest(url, key); } catch (err) { results.push({ workspace_member_id: Number(id), error: err.message }); continue; }
      if (res.status === 404) { results.push({ workspace_member_id: Number(id), error: 'not_in_workspace' }); continue; }
      if (res.status !== 200) { results.push({ workspace_member_id: Number(id), error: `http_${res.status}` }); continue; }
      try {
        const parsed = JSON.parse(res.body);
        results.push({ workspace_member_id: Number(id), result: parsed.result });
      } catch (_) { results.push({ workspace_member_id: Number(id), error: 'parse_error' }); }
    }
    console.log(JSON.stringify({ results }));
    process.exit(0);
  }

  const url = `${baseUrl}/agent-tools/v3/${workspaceId}/activity-log/list-member-tag-changes/${memberId}/${params}`;
  let result;
  try { result = await apiRequest(url, key); } catch (err) { console.error('請求失敗：' + err.message); process.exit(1); }
  if (result.status !== 200) { console.error(`API 回傳 HTTP ${result.status}：${result.body}`); process.exit(1); }
  console.log(result.body);
  process.exit(0);
}

// ---------- 子指令：activity-log list-chatbot-triggers ----------

async function cmdActivityLogListChatbotTriggers(argv) {
  const key = getApiKey();
  if (!key) { console.error('尚未登入，請先執行：oakmega-scrm login'); process.exit(1); }

  let workspaceId = null;
  let memberId = null;
  let memberIdsStr = null;
  let days = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--workspace-id' && argv[i + 1]) workspaceId = argv[++i];
    else if (argv[i] === '--member-id' && argv[i + 1]) memberId = argv[++i];
    else if (argv[i] === '--member-ids' && argv[i + 1]) memberIdsStr = argv[++i];
    else if (argv[i] === '--days' && argv[i + 1]) days = argv[++i];
  }
  if (!workspaceId) workspaceId = getWorkspaceId();
  if (!workspaceId) { console.error('缺少 workspace ID。'); process.exit(1); }
  if (!memberId && !memberIdsStr) { console.error('缺少 --member-id <id> 或 --member-ids <id1,id2,...>'); process.exit(1); }

  const baseUrl = getBaseUrl();
  const params = days ? '?' + new URLSearchParams({ days }).toString() : '';

  if (memberIdsStr) {
    const ids = memberIdsStr.split(',').map((s) => s.trim()).filter(Boolean);
    const results = [];
    for (const id of ids) {
      const url = `${baseUrl}/agent-tools/v3/${workspaceId}/activity-log/list-member-chatbot-triggers/${id}/${params}`;
      let res;
      try { res = await apiRequest(url, key); } catch (err) { results.push({ workspace_member_id: Number(id), error: err.message }); continue; }
      if (res.status === 404) { results.push({ workspace_member_id: Number(id), error: 'not_in_workspace' }); continue; }
      if (res.status !== 200) { results.push({ workspace_member_id: Number(id), error: `http_${res.status}` }); continue; }
      try {
        const parsed = JSON.parse(res.body);
        results.push({ workspace_member_id: Number(id), result: parsed.result });
      } catch (_) { results.push({ workspace_member_id: Number(id), error: 'parse_error' }); }
    }
    console.log(JSON.stringify({ results }));
    process.exit(0);
  }

  const url = `${baseUrl}/agent-tools/v3/${workspaceId}/activity-log/list-member-chatbot-triggers/${memberId}/${params}`;
  let result;
  try { result = await apiRequest(url, key); } catch (err) { console.error('請求失敗：' + err.message); process.exit(1); }
  if (result.status !== 200) { console.error(`API 回傳 HTTP ${result.status}：${result.body}`); process.exit(1); }
  console.log(result.body);
  process.exit(0);
}

// ---------- 子指令：activity-log list-deeplink-clicks ----------

async function cmdActivityLogListDeeplinkClicks(argv) {
  const key = getApiKey();
  if (!key) { console.error('尚未登入，請先執行：oakmega-scrm login'); process.exit(1); }

  let workspaceId = null;
  let memberId = null;
  let memberIdsStr = null;
  let days = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--workspace-id' && argv[i + 1]) workspaceId = argv[++i];
    else if (argv[i] === '--member-id' && argv[i + 1]) memberId = argv[++i];
    else if (argv[i] === '--member-ids' && argv[i + 1]) memberIdsStr = argv[++i];
    else if (argv[i] === '--days' && argv[i + 1]) days = argv[++i];
  }
  if (!workspaceId) workspaceId = getWorkspaceId();
  if (!workspaceId) { console.error('缺少 workspace ID。'); process.exit(1); }
  if (!memberId && !memberIdsStr) { console.error('缺少 --member-id <id> 或 --member-ids <id1,id2,...>'); process.exit(1); }

  const baseUrl = getBaseUrl();
  const params = days ? '?' + new URLSearchParams({ days }).toString() : '';

  if (memberIdsStr) {
    const ids = memberIdsStr.split(',').map((s) => s.trim()).filter(Boolean);
    const results = [];
    for (const id of ids) {
      const url = `${baseUrl}/agent-tools/v3/${workspaceId}/activity-log/list-member-deeplink-clicks/${id}/${params}`;
      let res;
      try { res = await apiRequest(url, key); } catch (err) { results.push({ workspace_member_id: Number(id), error: err.message }); continue; }
      if (res.status === 404) { results.push({ workspace_member_id: Number(id), error: 'not_in_workspace' }); continue; }
      if (res.status !== 200) { results.push({ workspace_member_id: Number(id), error: `http_${res.status}` }); continue; }
      try {
        const parsed = JSON.parse(res.body);
        results.push({ workspace_member_id: Number(id), result: parsed.result });
      } catch (_) { results.push({ workspace_member_id: Number(id), error: 'parse_error' }); }
    }
    console.log(JSON.stringify({ results }));
    process.exit(0);
  }

  const url = `${baseUrl}/agent-tools/v3/${workspaceId}/activity-log/list-member-deeplink-clicks/${memberId}/${params}`;
  let result;
  try { result = await apiRequest(url, key); } catch (err) { console.error('請求失敗：' + err.message); process.exit(1); }
  if (result.status !== 200) { console.error(`API 回傳 HTTP ${result.status}：${result.body}`); process.exit(1); }
  console.log(result.body);
  process.exit(0);
}

// ---------- 子指令：chatbot list-recent-triggered ----------

async function cmdChatbotListRecentTriggered(argv) {
  const key = getApiKey();
  if (!key) { console.error('尚未登入，請先執行：oakmega-scrm login'); process.exit(1); }

  let workspaceId = null;
  let days = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--workspace-id' && argv[i + 1]) workspaceId = argv[++i];
    else if (argv[i] === '--days' && argv[i + 1]) days = argv[++i];
  }
  if (!workspaceId) workspaceId = getWorkspaceId();
  if (!workspaceId) { console.error('缺少 workspace ID。'); process.exit(1); }

  const params = days ? '?' + new URLSearchParams({ days }).toString() : '';
  const url = `${getBaseUrl()}/agent-tools/v3/${workspaceId}/chatbot/list-recent-triggered-chatbots/${params}`;
  let result;
  try { result = await apiRequest(url, key); } catch (err) { console.error('請求失敗：' + err.message); process.exit(1); }
  if (result.status !== 200) { console.error(`API 回傳 HTTP ${result.status}：${result.body}`); process.exit(1); }
  console.log(result.body);
  process.exit(0);
}

// ---------- 子指令：chatbot list-member-triggered ----------

async function cmdChatbotListMemberTriggered(argv) {
  const key = getApiKey();
  if (!key) { console.error('尚未登入，請先執行：oakmega-scrm login'); process.exit(1); }

  let workspaceId = null;
  let memberId = null;
  let days = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--workspace-id' && argv[i + 1]) workspaceId = argv[++i];
    else if (argv[i] === '--member-id' && argv[i + 1]) memberId = argv[++i];
    else if (argv[i] === '--days' && argv[i + 1]) days = argv[++i];
  }
  if (!workspaceId) workspaceId = getWorkspaceId();
  if (!workspaceId) { console.error('缺少 workspace ID。'); process.exit(1); }
  if (!memberId) { console.error('缺少 --member-id <workspace_member_id>'); process.exit(1); }

  const params = days ? '?' + new URLSearchParams({ days }).toString() : '';
  const url = `${getBaseUrl()}/agent-tools/v3/${workspaceId}/chatbot/list-member-recent-triggered-chatbots/${memberId}/${params}`;
  let result;
  try { result = await apiRequest(url, key); } catch (err) { console.error('請求失敗：' + err.message); process.exit(1); }
  if (result.status !== 200) { console.error(`API 回傳 HTTP ${result.status}：${result.body}`); process.exit(1); }
  console.log(result.body);
  process.exit(0);
}

// ---------- 子指令：chatbot list-members-triggered-batch ----------

async function cmdChatbotListMembersTriggeredBatch(argv) {
  const key = getApiKey();
  if (!key) { console.error('尚未登入，請先執行：oakmega-scrm login'); process.exit(1); }

  let workspaceId = null;
  let memberIdsStr = null;
  let days = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--workspace-id' && argv[i + 1]) workspaceId = argv[++i];
    else if (argv[i] === '--member-ids' && argv[i + 1]) memberIdsStr = argv[++i];
    else if (argv[i] === '--days' && argv[i + 1]) days = argv[++i];
  }
  if (!workspaceId) workspaceId = getWorkspaceId();
  if (!workspaceId) { console.error('缺少 workspace ID。'); process.exit(1); }
  if (!memberIdsStr) { console.error('缺少 --member-ids <id1,id2,...>'); process.exit(1); }

  const memberIds = memberIdsStr.split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n));
  if (memberIds.length === 0) { console.error('--member-ids 必須包含至少一個有效數字 ID'); process.exit(1); }
  if (memberIds.length > 20) { console.error('--member-ids 最多 20 人'); process.exit(1); }

  const bodyObj = { workspace_member_ids: memberIds };
  if (days !== null) bodyObj.days = parseInt(days, 10);

  const url = `${getBaseUrl()}/agent-tools/v3/${workspaceId}/chatbot/list-members-recent-triggered-chatbots-batch/`;
  let result;
  try { result = await apiPostRequest(url, key, bodyObj); } catch (err) { console.error('請求失敗：' + err.message); process.exit(1); }
  if (result.status !== 200) { console.error(`API 回傳 HTTP ${result.status}：${result.body}`); process.exit(1); }
  console.log(result.body);
  process.exit(0);
}

// ---------- 子指令：deeplink list-recent-clicked ----------

async function cmdDeeplinkListRecentClicked(argv) {
  const key = getApiKey();
  if (!key) { console.error('尚未登入，請先執行：oakmega-scrm login'); process.exit(1); }

  let workspaceId = null;
  let days = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--workspace-id' && argv[i + 1]) workspaceId = argv[++i];
    else if (argv[i] === '--days' && argv[i + 1]) days = argv[++i];
  }
  if (!workspaceId) workspaceId = getWorkspaceId();
  if (!workspaceId) { console.error('缺少 workspace ID。'); process.exit(1); }

  const params = days ? '?' + new URLSearchParams({ days }).toString() : '';
  const url = `${getBaseUrl()}/agent-tools/v3/${workspaceId}/deeplink/list-recent-clicked-deeplinks/${params}`;
  let result;
  try { result = await apiRequest(url, key); } catch (err) { console.error('請求失敗：' + err.message); process.exit(1); }
  if (result.status !== 200) { console.error(`API 回傳 HTTP ${result.status}：${result.body}`); process.exit(1); }
  console.log(result.body);
  process.exit(0);
}

// ---------- 子指令：deeplink list-member-clicked ----------

async function cmdDeeplinkListMemberClicked(argv) {
  const key = getApiKey();
  if (!key) { console.error('尚未登入，請先執行：oakmega-scrm login'); process.exit(1); }

  let workspaceId = null;
  let memberId = null;
  let days = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--workspace-id' && argv[i + 1]) workspaceId = argv[++i];
    else if (argv[i] === '--member-id' && argv[i + 1]) memberId = argv[++i];
    else if (argv[i] === '--days' && argv[i + 1]) days = argv[++i];
  }
  if (!workspaceId) workspaceId = getWorkspaceId();
  if (!workspaceId) { console.error('缺少 workspace ID。'); process.exit(1); }
  if (!memberId) { console.error('缺少 --member-id <workspace_member_id>'); process.exit(1); }

  const params = days ? '?' + new URLSearchParams({ days }).toString() : '';
  const url = `${getBaseUrl()}/agent-tools/v3/${workspaceId}/deeplink/list-member-recent-clicked-deeplinks/${memberId}/${params}`;
  let result;
  try { result = await apiRequest(url, key); } catch (err) { console.error('請求失敗：' + err.message); process.exit(1); }
  if (result.status !== 200) { console.error(`API 回傳 HTTP ${result.status}：${result.body}`); process.exit(1); }
  console.log(result.body);
  process.exit(0);
}

// ---------- 子指令：deeplink list-members-clicked-batch ----------

async function cmdDeeplinkListMembersClickedBatch(argv) {
  const key = getApiKey();
  if (!key) { console.error('尚未登入，請先執行：oakmega-scrm login'); process.exit(1); }

  let workspaceId = null;
  let memberIdsStr = null;
  let days = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--workspace-id' && argv[i + 1]) workspaceId = argv[++i];
    else if (argv[i] === '--member-ids' && argv[i + 1]) memberIdsStr = argv[++i];
    else if (argv[i] === '--days' && argv[i + 1]) days = argv[++i];
  }
  if (!workspaceId) workspaceId = getWorkspaceId();
  if (!workspaceId) { console.error('缺少 workspace ID。'); process.exit(1); }
  if (!memberIdsStr) { console.error('缺少 --member-ids <id1,id2,...>'); process.exit(1); }

  const memberIds = memberIdsStr.split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n));
  if (memberIds.length === 0) { console.error('--member-ids 必須包含至少一個有效數字 ID'); process.exit(1); }
  if (memberIds.length > 20) { console.error('--member-ids 最多 20 人'); process.exit(1); }

  const bodyObj = { workspace_member_ids: memberIds };
  if (days !== null) bodyObj.days = parseInt(days, 10);

  const url = `${getBaseUrl()}/agent-tools/v3/${workspaceId}/deeplink/list-members-recent-clicked-deeplinks-batch/`;
  let result;
  try { result = await apiPostRequest(url, key, bodyObj); } catch (err) { console.error('請求失敗：' + err.message); process.exit(1); }
  if (result.status !== 200) { console.error(`API 回傳 HTTP ${result.status}：${result.body}`); process.exit(1); }
  console.log(result.body);
  process.exit(0);
}

// ---------- 子指令：service-center list-member-messages ----------

async function cmdServiceCenterListMemberMessages(argv) {
  const key = getApiKey();
  if (!key) { console.error('尚未登入，請先執行：oakmega-scrm login'); process.exit(1); }

  let workspaceId = null;
  let socialMediaMemberId = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--workspace-id' && argv[i + 1]) workspaceId = argv[++i];
    else if (argv[i] === '--social-media-member-id' && argv[i + 1]) socialMediaMemberId = argv[++i];
  }
  if (!workspaceId) workspaceId = getWorkspaceId();
  if (!workspaceId) { console.error('缺少 workspace ID。'); process.exit(1); }
  if (!socialMediaMemberId) { console.error('缺少 --social-media-member-id <social_media_member_id>'); process.exit(1); }

  const url = `${getBaseUrl()}/agent-tools/v3/${workspaceId}/service-center/list-member-messages/${socialMediaMemberId}/`;
  let result;
  try { result = await apiRequest(url, key); } catch (err) { console.error('請求失敗：' + err.message); process.exit(1); }
  if (result.status !== 200) { console.error(`API 回傳 HTTP ${result.status}：${result.body}`); process.exit(1); }
  console.log(result.body);
  process.exit(0);
}

// ---------- 子指令：service-center list-members-messages-batch ----------

async function cmdServiceCenterListMembersMessagesBatch(argv) {
  const key = getApiKey();
  if (!key) { console.error('尚未登入，請先執行：oakmega-scrm login'); process.exit(1); }

  let workspaceId = null;
  let socialMediaMemberIdsStr = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--workspace-id' && argv[i + 1]) workspaceId = argv[++i];
    else if (argv[i] === '--social-media-member-ids' && argv[i + 1]) socialMediaMemberIdsStr = argv[++i];
  }
  if (!workspaceId) workspaceId = getWorkspaceId();
  if (!workspaceId) { console.error('缺少 workspace ID。'); process.exit(1); }
  if (!socialMediaMemberIdsStr) { console.error('缺少 --social-media-member-ids <id1,id2,...>'); process.exit(1); }

  const socialMediaMemberIds = socialMediaMemberIdsStr.split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n));
  if (socialMediaMemberIds.length === 0) { console.error('--social-media-member-ids 必須包含至少一個有效數字 ID'); process.exit(1); }
  if (socialMediaMemberIds.length > 20) { console.error('--social-media-member-ids 最多 20 人'); process.exit(1); }

  const url = `${getBaseUrl()}/agent-tools/v3/${workspaceId}/service-center/list-members-messages-batch/`;
  let result;
  try { result = await apiPostRequest(url, key, { social_media_member_ids: socialMediaMemberIds }); } catch (err) { console.error('請求失敗：' + err.message); process.exit(1); }
  if (result.status !== 200) { console.error(`API 回傳 HTTP ${result.status}：${result.body}`); process.exit(1); }
  console.log(result.body);
  process.exit(0);
}

// ---------- usage ----------

function printUsage() {
  console.log(`oakmega-scrm — OakMega SCRM CLI

用法：
  oakmega-scrm auth status                              檢查是否已登入（已登入 exit 0；未登入 exit 1）
  oakmega-scrm login                                    開啟本機網頁表單，設定 API key 與 Workspace ID
  oakmega-scrm whoami                                   印出 API_KEY 前 10 碼

  ── Member ──
  oakmega-scrm member search --query <q> --search-by <field>  搜尋會員
                        [--workspace-id <id>]                  search-by: name | workspace_member_id | uuid
  oakmega-scrm member get-basic-info --member-id <id>         取得會員主表欄位與自訂欄位
                        [--workspace-id <id>]
  oakmega-scrm member get-channel-line --member-id <id>       取得會員的 LINE 渠道資訊（未綁定回 404）
  oakmega-scrm member get-channel-fb --member-id <id>         取得會員的 Facebook 渠道資訊
  oakmega-scrm member get-channel-ig --member-id <id>         取得會員的 Instagram 渠道資訊
  oakmega-scrm member get-channel-whatsapp --member-id <id>   取得會員的 WhatsApp 渠道資訊
  oakmega-scrm member list-recent-messaged [--days <1-7>]     最近 N 日有訊息往來的會員（預設 1 日）
  oakmega-scrm member list-recent-chatbot-triggered [--days <1-7>]  最近 N 日觸發過聊天機器人的會員（預設 7 日）
  oakmega-scrm member list-recent-deeplink-clicked [--days <1-7>]   最近 N 日點擊過追蹤連結的會員（預設 7 日）

  ── Tag ──
  oakmega-scrm tag list-member-tags --member-id <id>          取得 member 身上所有有效標籤
                        [--workspace-id <id>]
  oakmega-scrm tag list-members-batch --member-ids <id1,id2,...>  批次取得多個 member 的標籤（最多 20 人）
                        [--workspace-id <id>]

  ── Broadcast ──
  oakmega-scrm broadcast search --start-dt <YYYY-MM-DD> --end-dt <YYYY-MM-DD>  搜尋發文
                        [--name <關鍵字>] [--limit <n>] [--workspace-id <id>]
  oakmega-scrm broadcast get-statistics --broadcast-id <id>                   取得單一發文統計（6 小時互動 / 影片播放）
                        [--workspace-id <id>]

  ── Chatbot ──
  oakmega-scrm chatbot list-recent-triggered [--days <1-7>]                          workspace 最近 N 日 chatbot 排行（預設 7 日）
                        [--workspace-id <id>]
  oakmega-scrm chatbot list-member-triggered --member-id <id> [--days <1-60>]        某 member 的 chatbot 觸發排行（預設 60 日）
                        [--workspace-id <id>]
  oakmega-scrm chatbot list-members-triggered-batch --member-ids <id1,id2,...>        批次，最多 20 人，每人最多 20 筆
                        [--days <int,1-60>] [--workspace-id <id>]

  ── Deeplink ──
  oakmega-scrm deeplink list-recent-clicked [--days <1-7>]                           workspace 最近 N 日 deeplink 排行（預設 7 日）
                        [--workspace-id <id>]
  oakmega-scrm deeplink list-member-clicked --member-id <id> [--days <1-60>]         某 member 的 deeplink 點擊排行（預設 60 日）
                        [--workspace-id <id>]
  oakmega-scrm deeplink list-members-clicked-batch --member-ids <id1,id2,...>         批次，最多 20 人，每人最多 20 筆
                        [--days <int,1-60>] [--workspace-id <id>]

  ── Service Center ──
  oakmega-scrm service-center list-member-messages --social-media-member-id <id>      取得單一渠道成員的對話紀錄（最多 500 筆）
                        [--workspace-id <id>]
  oakmega-scrm service-center list-members-messages-batch --social-media-member-ids <id1,id2,...>  批次，最多 20 人，每人最多 20 筆
                        [--workspace-id <id>]

  ── Activity Log ──
  oakmega-scrm activity-log list-tag-changes --member-id <id> [--days <1-60>]            標籤異動紀錄（預設 60 日）
                        --member-ids <id1,id2,...>                                        批次查詢，輸出 {"results":[...]}
  oakmega-scrm activity-log list-chatbot-triggers --member-id <id> [--days <1-60>]       Chatbot 觸發紀錄（預設 60 日）
                        --member-ids <id1,id2,...>                                        批次查詢
  oakmega-scrm activity-log list-deeplink-clicks --member-id <id> [--days <1-60>]        Deeplink 點擊紀錄（預設 60 日）
                        --member-ids <id1,id2,...>                                        批次查詢

  所有指令均可加 [--workspace-id <id>] 覆蓋 config 中的預設 workspace ID。

環境變數：
  OAKMEGA_BASE_URL   覆蓋 API base URL（不設則連 production：${PRODUCTION_BASE_URL}）

設定檔位置：${CONFIG_PATH}
API key 僅儲存在本機，永遠不會經過對話。`);
}

// ---------- 進入點 ----------

function main() {
  const argv = process.argv.slice(2);
  const [a, b] = argv;

  if (!a || a === '--help' || a === '-h' || a === 'help') {
    printUsage();
    process.exit(0);
  }

  if (a === 'auth' && b === 'status') return cmdAuthStatus();
  if (a === 'auth') {
    console.log('未知的 auth 子指令。可用：oakmega-scrm auth status');
    process.exit(1);
  }
  if (a === 'login') return cmdLogin();
  if (a === 'whoami') return cmdWhoami();
  if (a === 'tag' && b === 'list-member-tags') return cmdTagListMemberTags(argv.slice(2));
  if (a === 'tag' && b === 'list-members-batch') return cmdTagListMembersBatch(argv.slice(2));
  if (a === 'member' && b === 'search') return cmdMemberSearch(argv.slice(2));
  if (a === 'member' && b === 'get-basic-info') return cmdMemberGetBasicInfo(argv.slice(2));
  if (a === 'member' && b === 'get-channel-line') return cmdMemberGetChannelLine(argv.slice(2));
  if (a === 'member' && b === 'get-channel-fb') return cmdMemberGetChannelFb(argv.slice(2));
  if (a === 'member' && b === 'get-channel-ig') return cmdMemberGetChannelIg(argv.slice(2));
  if (a === 'member' && b === 'get-channel-whatsapp') return cmdMemberGetChannelWhatsapp(argv.slice(2));
  if (a === 'member' && b === 'list-recent-messaged') return cmdMemberListRecentMessaged(argv.slice(2));
  if (a === 'member' && b === 'list-recent-chatbot-triggered') return cmdMemberListRecentChatbotTriggered(argv.slice(2));
  if (a === 'member' && b === 'list-recent-deeplink-clicked') return cmdMemberListRecentDeeplinkClicked(argv.slice(2));
  if (a === 'broadcast' && b === 'search') return cmdBroadcastSearch(argv.slice(2));
  if (a === 'broadcast' && b === 'get-statistics') return cmdBroadcastGetStatistics(argv.slice(2));
  if (a === 'chatbot' && b === 'list-recent-triggered') return cmdChatbotListRecentTriggered(argv.slice(2));
  if (a === 'chatbot' && b === 'list-member-triggered') return cmdChatbotListMemberTriggered(argv.slice(2));
  if (a === 'chatbot' && b === 'list-members-triggered-batch') return cmdChatbotListMembersTriggeredBatch(argv.slice(2));
  if (a === 'deeplink' && b === 'list-recent-clicked') return cmdDeeplinkListRecentClicked(argv.slice(2));
  if (a === 'deeplink' && b === 'list-member-clicked') return cmdDeeplinkListMemberClicked(argv.slice(2));
  if (a === 'deeplink' && b === 'list-members-clicked-batch') return cmdDeeplinkListMembersClickedBatch(argv.slice(2));
  if (a === 'service-center' && b === 'list-member-messages') return cmdServiceCenterListMemberMessages(argv.slice(2));
  if (a === 'service-center' && b === 'list-members-messages-batch') return cmdServiceCenterListMembersMessagesBatch(argv.slice(2));
  if (a === 'activity-log' && b === 'list-tag-changes') return cmdActivityLogListTagChanges(argv.slice(2));
  if (a === 'activity-log' && b === 'list-chatbot-triggers') return cmdActivityLogListChatbotTriggers(argv.slice(2));
  if (a === 'activity-log' && b === 'list-deeplink-clicks') return cmdActivityLogListDeeplinkClicks(argv.slice(2));

  console.log(`未知指令：${a}`);
  printUsage();
  process.exit(1);
}

main();
