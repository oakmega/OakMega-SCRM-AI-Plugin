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

// const PRODUCTION_BASE_URL = 'https://agent-api.oakmega.com';
const PRODUCTION_BASE_URL = 'https://oakmega-scrm-be-beta-yidc23zsiq-de.a.run.app';

const CONFIG_DIR = path.join(os.homedir(), '.config', 'oakmega-scrm');
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');

// ---------- 設定檔讀寫 ----------
//
// 一組 API key 只綁定一個 workspace（後端規則），本機因此以「profile」
// （workspace_id ↔ API key ↔ 別名 alias）為單位保存多組登入狀態：
//   { profiles: { "<workspace_id>": { API_KEY, alias } }, activeProfile: "<workspace_id>" }
// 舊版單一 API_KEY/WORKSPACE_ID 格式會在讀取時自動遷移成上述格式。

function writeRawConfig(obj) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  const payload = JSON.stringify(obj, null, 2) + '\n';
  fs.writeFileSync(CONFIG_PATH, payload, { mode: 0o600 });
  // writeFileSync 的 mode 只在「建立新檔」時生效；若檔案已存在，明確再 chmod 一次。
  fs.chmodSync(CONFIG_PATH, 0o600);
}

function readConfig() {
  let obj;
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
    obj = JSON.parse(raw);
    if (!obj || typeof obj !== 'object') obj = {};
  } catch (_err) {
    // 檔案不存在或解析失敗，一律視為「尚未設定」
    obj = {};
  }

  if (obj.profiles) return obj;

  // 舊格式遷移：{ API_KEY, WORKSPACE_ID, ... } → { profiles: {...}, activeProfile }
  if (typeof obj.API_KEY === 'string' && obj.API_KEY.trim() !== '' &&
      (typeof obj.WORKSPACE_ID === 'string' || typeof obj.WORKSPACE_ID === 'number')) {
    const workspaceId = String(obj.WORKSPACE_ID);
    const migrated = { ...obj };
    delete migrated.API_KEY;
    delete migrated.WORKSPACE_ID;
    migrated.profiles = { [workspaceId]: { API_KEY: obj.API_KEY, alias: '' } };
    migrated.activeProfile = workspaceId;
    writeRawConfig(migrated);
    return migrated;
  }

  obj.profiles = {};
  obj.activeProfile = null;
  return obj;
}

function writeProfile(workspaceId, apiKey, alias) {
  const cfg = readConfig();
  cfg.profiles[workspaceId] = { API_KEY: apiKey, alias: alias || '' };
  cfg.activeProfile = workspaceId;
  writeRawConfig(cfg);
}

function setActiveProfile(workspaceId) {
  const cfg = readConfig();
  cfg.activeProfile = workspaceId;
  writeRawConfig(cfg);
}

function getProfiles() {
  return readConfig().profiles || {};
}

function getActiveProfileId() {
  const id = readConfig().activeProfile;
  return (typeof id === 'string' && id.trim() !== '') ? id : null;
}

function getApiKeyForProfile(workspaceId) {
  const profile = getProfiles()[workspaceId];
  if (profile && typeof profile.API_KEY === 'string' && profile.API_KEY.trim() !== '') return profile.API_KEY;
  return null;
}

function resolveWorkspaceId(explicitProfile) {
  const workspaceId = explicitProfile || getActiveProfileId();
  if (!workspaceId || !getProfiles()[workspaceId]) {
    console.error('缺少或找不到 profile。請用 --profile <workspace_id> 指定，或執行 login / use-profile 設定。');
    process.exit(1);
  }
  return workspaceId;
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
  const activeId = getActiveProfileId();
  const key = activeId ? getApiKeyForProfile(activeId) : null;
  if (key) {
    console.log(`已登入。目前使用 workspace ${activeId}，API_KEY: ${preview(key)}…（設定檔：${CONFIG_PATH}）`);
    process.exit(0);
  }
  console.log('尚未登入，請執行：oakmega-scrm login');
  process.exit(1);
}

// ---------- 子指令：whoami（示意操作） ----------

function cmdWhoami() {
  const activeId = getActiveProfileId();
  const key = activeId ? getApiKeyForProfile(activeId) : null;
  if (!key) {
    console.log('尚未登入，請先執行：oakmega-scrm login');
    process.exit(1);
  }
  console.log(`目前 workspace：${activeId}，API_KEY 前 10 碼：${preview(key)}`);
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
  input[type=number],
  input[type=text] { width: 100%; box-sizing: border-box; padding: 10px 12px;
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
    <p>請貼上你的 API key 並填入 Workspace ID。送出後會儲存在本機，不會經過任何對話。可同時新增多組不同 workspace 的設定，並在 CLI 之間切換。</p>
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
      <div class="field">
        <label for="alias">別名（選填，方便日後用客戶名稱切換）</label>
        <input id="alias" name="alias" type="text" placeholder="例如：魚蹦興業">
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
        const alias = (fields.alias || '').trim();
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
          writeProfile(workspaceId, key, alias);
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

// ---------- 子指令：list-profiles ----------

function cmdListProfiles() {
  const profiles = getProfiles();
  const activeId = getActiveProfileId();
  const out = Object.keys(profiles).map((workspaceId) => ({
    workspace_id: workspaceId,
    alias: profiles[workspaceId].alias || workspaceId,
    active: workspaceId === activeId,
  }));
  console.log(JSON.stringify(out));
  process.exit(0);
}

// ---------- 子指令：use-profile ----------

function cmdUseProfile(argv) {
  const workspaceId = argv[0];
  const profiles = getProfiles();
  if (!workspaceId || !profiles[workspaceId]) {
    console.error(`找不到 workspace ${workspaceId || '(未提供)'}。目前可用的 profile：`);
    console.error(JSON.stringify(Object.keys(profiles)));
    process.exit(1);
  }
  setActiveProfile(workspaceId);
  const alias = profiles[workspaceId].alias || workspaceId;
  console.log(`已切換預設 workspace 為：${alias}（${workspaceId}）`);
  process.exit(0);
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
  // parse flags
  let workspaceId = null;
  let memberId = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--profile' && argv[i + 1]) workspaceId = argv[++i];
    else if (argv[i] === '--member-id' && argv[i + 1]) memberId = argv[++i];
  }

  // fallback to config
  workspaceId = resolveWorkspaceId(workspaceId);
  const key = getApiKeyForProfile(workspaceId);
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
  let query = null;
  let searchBy = null;
  let workspaceId = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--query' && argv[i + 1]) query = argv[++i];
    else if (argv[i] === '--search-by' && argv[i + 1]) searchBy = argv[++i];
    else if (argv[i] === '--profile' && argv[i + 1]) workspaceId = argv[++i];
  }

  workspaceId = resolveWorkspaceId(workspaceId);
  const key = getApiKeyForProfile(workspaceId);
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
  let workspaceId = null;
  let broadcastName = null;
  let startDt = null;
  let endDt = null;
  let limit = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--profile' && argv[i + 1]) workspaceId = argv[++i];
    else if (argv[i] === '--name' && argv[i + 1]) broadcastName = argv[++i];
    else if (argv[i] === '--start-dt' && argv[i + 1]) startDt = argv[++i];
    else if (argv[i] === '--end-dt' && argv[i + 1]) endDt = argv[++i];
    else if (argv[i] === '--limit' && argv[i + 1]) limit = argv[++i];
  }

  workspaceId = resolveWorkspaceId(workspaceId);
  const key = getApiKeyForProfile(workspaceId);
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

// ---------- 子指令：statistics get-workspace-member-overview ----------

async function cmdStatisticsGetWorkspaceMemberOverview(argv) {
  let workspaceId = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--profile' && argv[i + 1]) workspaceId = argv[++i];
  }

  workspaceId = resolveWorkspaceId(workspaceId);
  const key = getApiKeyForProfile(workspaceId);

  const baseUrl = getBaseUrl();
  const url = `${baseUrl}/agent-tools/v3/${workspaceId}/statistics/get-workspace-member-overview/`;

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

// ---------- 子指令：statistics get-line-friend-count-series ----------

async function cmdStatisticsGetLineFriendCountSeries(argv) {
  let workspaceId = null;
  let startDt = null;
  let endDt = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--profile' && argv[i + 1]) workspaceId = argv[++i];
    else if (argv[i] === '--start-dt' && argv[i + 1]) startDt = argv[++i];
    else if (argv[i] === '--end-dt' && argv[i + 1]) endDt = argv[++i];
  }

  workspaceId = resolveWorkspaceId(workspaceId);
  const key = getApiKeyForProfile(workspaceId);
  if ((startDt && !endDt) || (!startDt && endDt)) {
    console.error('--start-dt 與 --end-dt 需同時提供');
    process.exit(1);
  }

  const params = {};
  if (startDt && endDt) {
    params.start_dt = startDt;
    params.end_dt = endDt;
  }

  const baseUrl = getBaseUrl();
  const qs = new URLSearchParams(params).toString();
  const url = `${baseUrl}/agent-tools/v3/${workspaceId}/statistics/get-line-friend-count-series/${qs ? `?${qs}` : ''}`;

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

// ---------- 子指令：statistics get-line-friend-count-total ----------

async function cmdStatisticsGetLineFriendCountTotal(argv) {
  let workspaceId = null;
  let startDt = null;
  let endDt = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--profile' && argv[i + 1]) workspaceId = argv[++i];
    else if (argv[i] === '--start-dt' && argv[i + 1]) startDt = argv[++i];
    else if (argv[i] === '--end-dt' && argv[i + 1]) endDt = argv[++i];
  }

  workspaceId = resolveWorkspaceId(workspaceId);
  const key = getApiKeyForProfile(workspaceId);
  if ((startDt && !endDt) || (!startDt && endDt)) {
    console.error('--start-dt 與 --end-dt 需同時提供');
    process.exit(1);
  }

  const params = {};
  if (startDt && endDt) {
    params.start_dt = startDt;
    params.end_dt = endDt;
  }

  const baseUrl = getBaseUrl();
  const qs = new URLSearchParams(params).toString();
  const url = `${baseUrl}/agent-tools/v3/${workspaceId}/statistics/get-line-friend-count-total/${qs ? `?${qs}` : ''}`;

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

// ---------- 子指令：statistics get-active-member-count-series ----------

async function cmdStatisticsGetActiveMemberCountSeries(argv) {
  let workspaceId = null;
  let startDt = null;
  let endDt = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--profile' && argv[i + 1]) workspaceId = argv[++i];
    else if (argv[i] === '--start-dt' && argv[i + 1]) startDt = argv[++i];
    else if (argv[i] === '--end-dt' && argv[i + 1]) endDt = argv[++i];
  }

  workspaceId = resolveWorkspaceId(workspaceId);
  const key = getApiKeyForProfile(workspaceId);
  if ((startDt && !endDt) || (!startDt && endDt)) {
    console.error('--start-dt 與 --end-dt 需同時提供');
    process.exit(1);
  }

  const params = {};
  if (startDt && endDt) {
    params.start_dt = startDt;
    params.end_dt = endDt;
  }

  const baseUrl = getBaseUrl();
  const qs = new URLSearchParams(params).toString();
  const url = `${baseUrl}/agent-tools/v3/${workspaceId}/statistics/get-active-member-count-series/${qs ? `?${qs}` : ''}`;

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

// ---------- 子指令：statistics get-member-interaction-count-series ----------

async function cmdStatisticsGetMemberInteractionCountSeries(argv) {
  let workspaceId = null;
  let startDt = null;
  let endDt = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--profile' && argv[i + 1]) workspaceId = argv[++i];
    else if (argv[i] === '--start-dt' && argv[i + 1]) startDt = argv[++i];
    else if (argv[i] === '--end-dt' && argv[i + 1]) endDt = argv[++i];
  }

  workspaceId = resolveWorkspaceId(workspaceId);
  const key = getApiKeyForProfile(workspaceId);
  if ((startDt && !endDt) || (!startDt && endDt)) {
    console.error('--start-dt 與 --end-dt 需同時提供');
    process.exit(1);
  }

  const params = {};
  if (startDt && endDt) {
    params.start_dt = startDt;
    params.end_dt = endDt;
  }

  const baseUrl = getBaseUrl();
  const qs = new URLSearchParams(params).toString();
  const url = `${baseUrl}/agent-tools/v3/${workspaceId}/statistics/get-member-interaction-count-series/${qs ? `?${qs}` : ''}`;

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

// ---------- 子指令：statistics get-member-interaction-count-total ----------

async function cmdStatisticsGetMemberInteractionCountTotal(argv) {
  let workspaceId = null;
  let startDt = null;
  let endDt = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--profile' && argv[i + 1]) workspaceId = argv[++i];
    else if (argv[i] === '--start-dt' && argv[i + 1]) startDt = argv[++i];
    else if (argv[i] === '--end-dt' && argv[i + 1]) endDt = argv[++i];
  }

  workspaceId = resolveWorkspaceId(workspaceId);
  const key = getApiKeyForProfile(workspaceId);
  if ((startDt && !endDt) || (!startDt && endDt)) {
    console.error('--start-dt 與 --end-dt 需同時提供');
    process.exit(1);
  }

  const params = {};
  if (startDt && endDt) {
    params.start_dt = startDt;
    params.end_dt = endDt;
  }

  const baseUrl = getBaseUrl();
  const qs = new URLSearchParams(params).toString();
  const url = `${baseUrl}/agent-tools/v3/${workspaceId}/statistics/get-member-interaction-count-total/${qs ? `?${qs}` : ''}`;

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

// ---------- 子指令：statistics get-tag-member-count ----------

async function cmdStatisticsGetTagMemberCount(argv) {
  let workspaceId = null;
  let tagId = null;
  let dt = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--profile' && argv[i + 1]) workspaceId = argv[++i];
    else if (argv[i] === '--tag-id' && argv[i + 1]) tagId = argv[++i];
    else if (argv[i] === '--dt' && argv[i + 1]) dt = argv[++i];
  }

  workspaceId = resolveWorkspaceId(workspaceId);
  const key = getApiKeyForProfile(workspaceId);
  if (!tagId) { console.error('缺少 --tag-id <tag_id>'); process.exit(1); }

  const params = {};
  if (dt) params.dt = dt;

  const baseUrl = getBaseUrl();
  const qs = new URLSearchParams(params).toString();
  const url = `${baseUrl}/agent-tools/v3/${workspaceId}/statistics/get-tag-member-count/${tagId}/${qs ? `?${qs}` : ''}`;

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

// ---------- 子指令：statistics get-tag-member-count-series ----------

async function cmdStatisticsGetTagMemberCountSeries(argv) {
  let workspaceId = null;
  let tagId = null;
  let startDt = null;
  let endDt = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--profile' && argv[i + 1]) workspaceId = argv[++i];
    else if (argv[i] === '--tag-id' && argv[i + 1]) tagId = argv[++i];
    else if (argv[i] === '--start-dt' && argv[i + 1]) startDt = argv[++i];
    else if (argv[i] === '--end-dt' && argv[i + 1]) endDt = argv[++i];
  }

  workspaceId = resolveWorkspaceId(workspaceId);
  const key = getApiKeyForProfile(workspaceId);
  if (!tagId) { console.error('缺少 --tag-id <tag_id>'); process.exit(1); }
  if ((startDt && !endDt) || (!startDt && endDt)) {
    console.error('--start-dt 與 --end-dt 需同時提供');
    process.exit(1);
  }

  const params = {};
  if (startDt && endDt) {
    params.start_dt = startDt;
    params.end_dt = endDt;
  }

  const baseUrl = getBaseUrl();
  const qs = new URLSearchParams(params).toString();
  const url = `${baseUrl}/agent-tools/v3/${workspaceId}/statistics/get-tag-member-count-series/${tagId}/${qs ? `?${qs}` : ''}`;

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

// ---------- 子指令：statistics get-tag-member-count-total ----------

async function cmdStatisticsGetTagMemberCountTotal(argv) {
  let workspaceId = null;
  let tagId = null;
  let startDt = null;
  let endDt = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--profile' && argv[i + 1]) workspaceId = argv[++i];
    else if (argv[i] === '--tag-id' && argv[i + 1]) tagId = argv[++i];
    else if (argv[i] === '--start-dt' && argv[i + 1]) startDt = argv[++i];
    else if (argv[i] === '--end-dt' && argv[i + 1]) endDt = argv[++i];
  }

  workspaceId = resolveWorkspaceId(workspaceId);
  const key = getApiKeyForProfile(workspaceId);
  if (!tagId) { console.error('缺少 --tag-id <tag_id>'); process.exit(1); }
  if ((startDt && !endDt) || (!startDt && endDt)) {
    console.error('--start-dt 與 --end-dt 需同時提供');
    process.exit(1);
  }

  const params = {};
  if (startDt && endDt) {
    params.start_dt = startDt;
    params.end_dt = endDt;
  }

  const baseUrl = getBaseUrl();
  const qs = new URLSearchParams(params).toString();
  const url = `${baseUrl}/agent-tools/v3/${workspaceId}/statistics/get-tag-member-count-total/${tagId}/${qs ? `?${qs}` : ''}`;

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
  let workspaceId = null;
  let memberId = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--profile' && argv[i + 1]) workspaceId = argv[++i];
    else if (argv[i] === '--member-id' && argv[i + 1]) memberId = argv[++i];
  }
  workspaceId = resolveWorkspaceId(workspaceId);
  const key = getApiKeyForProfile(workspaceId);
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
  let workspaceId = null;
  let memberId = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--profile' && argv[i + 1]) workspaceId = argv[++i];
    else if (argv[i] === '--member-id' && argv[i + 1]) memberId = argv[++i];
  }
  workspaceId = resolveWorkspaceId(workspaceId);
  const key = getApiKeyForProfile(workspaceId);
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
  let workspaceId = null;
  let memberId = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--profile' && argv[i + 1]) workspaceId = argv[++i];
    else if (argv[i] === '--member-id' && argv[i + 1]) memberId = argv[++i];
  }
  workspaceId = resolveWorkspaceId(workspaceId);
  const key = getApiKeyForProfile(workspaceId);
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
  let workspaceId = null;
  let memberId = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--profile' && argv[i + 1]) workspaceId = argv[++i];
    else if (argv[i] === '--member-id' && argv[i + 1]) memberId = argv[++i];
  }
  workspaceId = resolveWorkspaceId(workspaceId);
  const key = getApiKeyForProfile(workspaceId);
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
  let workspaceId = null;
  let memberId = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--profile' && argv[i + 1]) workspaceId = argv[++i];
    else if (argv[i] === '--member-id' && argv[i + 1]) memberId = argv[++i];
  }
  workspaceId = resolveWorkspaceId(workspaceId);
  const key = getApiKeyForProfile(workspaceId);
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
  let workspaceId = null;
  let days = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--profile' && argv[i + 1]) workspaceId = argv[++i];
    else if (argv[i] === '--days' && argv[i + 1]) days = argv[++i];
  }
  workspaceId = resolveWorkspaceId(workspaceId);
  const key = getApiKeyForProfile(workspaceId);

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
  let workspaceId = null;
  let days = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--profile' && argv[i + 1]) workspaceId = argv[++i];
    else if (argv[i] === '--days' && argv[i + 1]) days = argv[++i];
  }
  workspaceId = resolveWorkspaceId(workspaceId);
  const key = getApiKeyForProfile(workspaceId);

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
  let workspaceId = null;
  let days = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--profile' && argv[i + 1]) workspaceId = argv[++i];
    else if (argv[i] === '--days' && argv[i + 1]) days = argv[++i];
  }
  workspaceId = resolveWorkspaceId(workspaceId);
  const key = getApiKeyForProfile(workspaceId);

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
  let workspaceId = null;
  let memberIdsStr = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--profile' && argv[i + 1]) workspaceId = argv[++i];
    else if (argv[i] === '--member-ids' && argv[i + 1]) memberIdsStr = argv[++i];
  }
  workspaceId = resolveWorkspaceId(workspaceId);
  const key = getApiKeyForProfile(workspaceId);
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

// ---------- 子指令：tag search-dirs ----------

async function cmdTagSearchDirs(argv) {
  let workspaceId = null;
  let query = null;
  let limit = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--profile' && argv[i + 1]) workspaceId = argv[++i];
    else if (argv[i] === '--query' && argv[i + 1]) query = argv[++i];
    else if (argv[i] === '--limit' && argv[i + 1]) limit = argv[++i];
  }
  workspaceId = resolveWorkspaceId(workspaceId);
  const key = getApiKeyForProfile(workspaceId);

  const params = {};
  if (query) params.query = query;
  if (limit) params.limit = limit;
  const qs = new URLSearchParams(params).toString();
  const url = `${getBaseUrl()}/agent-tools/v3/${workspaceId}/tag/search-tag-dirs/${qs ? `?${qs}` : ''}`;

  let result;
  try { result = await apiRequest(url, key); } catch (err) { console.error('請求失敗：' + err.message); process.exit(1); }
  if (result.status !== 200) { console.error(`API 回傳 HTTP ${result.status}：${result.body}`); process.exit(1); }
  console.log(result.body);
  process.exit(0);
}

// ---------- 子指令：tag search ----------

async function cmdTagSearch(argv) {
  let workspaceId = null;
  let searchBy = null;
  let query = null;
  let limit = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--profile' && argv[i + 1]) workspaceId = argv[++i];
    else if (argv[i] === '--search-by' && argv[i + 1]) searchBy = argv[++i];
    else if (argv[i] === '--query' && argv[i + 1]) query = argv[++i];
    else if (argv[i] === '--limit' && argv[i + 1]) limit = argv[++i];
  }
  workspaceId = resolveWorkspaceId(workspaceId);
  const key = getApiKeyForProfile(workspaceId);

  const VALID_SEARCH_BY = ['tag_dir_id', 'name'];
  if (!searchBy || !VALID_SEARCH_BY.includes(searchBy)) {
    console.error(`缺少或無效的 --search-by，必須是：${VALID_SEARCH_BY.join(' | ')}`);
    process.exit(1);
  }
  if (!query) {
    console.error('缺少 --query <值>');
    process.exit(1);
  }

  const body = { search_by: searchBy };
  if (searchBy === 'tag_dir_id') {
    const tagDirId = parseInt(query, 10);
    if (isNaN(tagDirId)) { console.error('--search-by=tag_dir_id 時，--query 必須是數字'); process.exit(1); }
    body.query = tagDirId;
    if (limit) body.limit = parseInt(limit, 10);
  } else {
    const tagNames = query.split(',').map((s) => s.trim()).filter((s) => s.length > 0);
    if (tagNames.length === 0) { console.error('--search-by=name 時，--query 必須包含至少一個名稱'); process.exit(1); }
    if (tagNames.length > 20) { console.error('--search-by=name 時，--query 最多 20 個名稱'); process.exit(1); }
    body.query = tagNames;
  }

  const url = `${getBaseUrl()}/agent-tools/v3/${workspaceId}/tag/search-tags/`;
  let result;
  try { result = await apiPostRequest(url, key, body); } catch (err) { console.error('請求失敗：' + err.message); process.exit(1); }
  if (result.status !== 200) { console.error(`API 回傳 HTTP ${result.status}：${result.body}`); process.exit(1); }
  console.log(result.body);
  process.exit(0);
}

// ---------- 子指令：advanced-filter search ----------

async function cmdAdvancedFilterSearch(argv) {
  let workspaceId = null;
  let query = null;
  let limit = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--profile' && argv[i + 1]) workspaceId = argv[++i];
    else if (argv[i] === '--query' && argv[i + 1]) query = argv[++i];
    else if (argv[i] === '--limit' && argv[i + 1]) limit = argv[++i];
  }
  workspaceId = resolveWorkspaceId(workspaceId);
  const key = getApiKeyForProfile(workspaceId);

  const params = {};
  if (query) params.query = query;
  if (limit) params.limit = limit;
  const qs = new URLSearchParams(params).toString();
  const url = `${getBaseUrl()}/agent-tools/v3/${workspaceId}/advanced-filter/search-advanced-filters/${qs ? `?${qs}` : ''}`;

  let result;
  try { result = await apiRequest(url, key); } catch (err) { console.error('請求失敗：' + err.message); process.exit(1); }
  if (result.status !== 200) { console.error(`API 回傳 HTTP ${result.status}：${result.body}`); process.exit(1); }
  console.log(result.body);
  process.exit(0);
}

// ---------- 子指令：analytics analyze-member-tag-distribution ----------

async function cmdAnalyticsAnalyzeMemberTagDistribution(argv) {
  let workspaceId = null;
  let advancedFilterId = null;
  let tagIdsStr = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--profile' && argv[i + 1]) workspaceId = argv[++i];
    else if (argv[i] === '--advanced-filter-id' && argv[i + 1]) advancedFilterId = argv[++i];
    else if (argv[i] === '--tag-ids' && argv[i + 1]) tagIdsStr = argv[++i];
  }
  workspaceId = resolveWorkspaceId(workspaceId);
  const key = getApiKeyForProfile(workspaceId);

  if (!advancedFilterId) { console.error('缺少 --advanced-filter-id <id>'); process.exit(1); }
  const advancedFilterIdInt = parseInt(advancedFilterId, 10);
  if (isNaN(advancedFilterIdInt)) { console.error('--advanced-filter-id 必須是數字'); process.exit(1); }

  const body = { advanced_filter_id: advancedFilterIdInt };
  if (tagIdsStr) {
    const tagIds = tagIdsStr.split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n));
    if (tagIds.length === 0) { console.error('--tag-ids 必須包含至少一個有效數字 ID'); process.exit(1); }
    body.tag_ids = tagIds;
  }

  const url = `${getBaseUrl()}/agent-tools/v3/${workspaceId}/analytics/analyze-member-tag-distribution/`;
  let result;
  try { result = await apiPostRequest(url, key, body); } catch (err) { console.error('請求失敗：' + err.message); process.exit(1); }
  if (result.status !== 200) { console.error(`API 回傳 HTTP ${result.status}：${result.body}`); process.exit(1); }
  console.log(result.body);
  process.exit(0);
}

// ---------- 子指令：analytics analyze-member-field-distribution ----------

async function cmdAnalyticsAnalyzeMemberFieldDistribution(argv) {
  let workspaceId = null;
  let advancedFilterId = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--profile' && argv[i + 1]) workspaceId = argv[++i];
    else if (argv[i] === '--advanced-filter-id' && argv[i + 1]) advancedFilterId = argv[++i];
  }
  workspaceId = resolveWorkspaceId(workspaceId);
  const key = getApiKeyForProfile(workspaceId);

  if (!advancedFilterId) { console.error('缺少 --advanced-filter-id <id>'); process.exit(1); }
  const advancedFilterIdInt = parseInt(advancedFilterId, 10);
  if (isNaN(advancedFilterIdInt)) { console.error('--advanced-filter-id 必須是數字'); process.exit(1); }

  const url = `${getBaseUrl()}/agent-tools/v3/${workspaceId}/analytics/analyze-member-field-distribution/`;
  let result;
  try {
    result = await apiPostRequest(url, key, { advanced_filter_id: advancedFilterIdInt });
  } catch (err) { console.error('請求失敗：' + err.message); process.exit(1); }
  if (result.status !== 200) { console.error(`API 回傳 HTTP ${result.status}：${result.body}`); process.exit(1); }
  console.log(result.body);
  process.exit(0);
}

// ---------- 子指令：statistics get-line-follow-insight ----------

async function cmdStatisticsGetLineFollowInsight(argv) {
  let workspaceId = null;
  let date = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--profile' && argv[i + 1]) workspaceId = argv[++i];
    else if (argv[i] === '--date' && argv[i + 1]) date = argv[++i];
  }

  workspaceId = resolveWorkspaceId(workspaceId);
  const key = getApiKeyForProfile(workspaceId);
  if (!date) {
    console.error('缺少 --date <YYYY-MM-DD>');
    process.exit(1);
  }

  const baseUrl = getBaseUrl();
  const qs = new URLSearchParams({ date }).toString();
  const url = `${baseUrl}/agent-tools/v3/${workspaceId}/statistics/get-line-follow-insight/?${qs}`;

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

// ---------- 子指令：statistics list-broadcast-six-hour-interaction-batch ----------

async function cmdStatisticsListBroadcastSixHourInteractionBatch(argv) {
  let workspaceId = null;
  let broadcastIdsStr = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--profile' && argv[i + 1]) workspaceId = argv[++i];
    else if (argv[i] === '--broadcast-ids' && argv[i + 1]) broadcastIdsStr = argv[++i];
  }
  workspaceId = resolveWorkspaceId(workspaceId);
  const key = getApiKeyForProfile(workspaceId);
  if (!broadcastIdsStr) { console.error('缺少 --broadcast-ids <id1,id2,...>'); process.exit(1); }

  const broadcastIds = broadcastIdsStr.split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n));
  if (broadcastIds.length === 0) { console.error('--broadcast-ids 必須包含至少一個有效數字 ID'); process.exit(1); }
  if (broadcastIds.length > 20) { console.error('--broadcast-ids 最多 20 筆'); process.exit(1); }

  const url = `${getBaseUrl()}/agent-tools/v3/${workspaceId}/statistics/list-broadcast-six-hour-interaction-batch/`;
  let result;
  try { result = await apiPostRequest(url, key, { broadcast_ids: broadcastIds }); } catch (err) { console.error('請求失敗：' + err.message); process.exit(1); }
  if (result.status !== 200) { console.error(`API 回傳 HTTP ${result.status}：${result.body}`); process.exit(1); }
  console.log(result.body);
  process.exit(0);
}

// ---------- 子指令：statistics search-broadcast-six-hour-interaction ----------

async function cmdStatisticsSearchBroadcastSixHourInteraction(argv) {
  let workspaceId = null;
  let startDt = null;
  let endDt = null;
  let limit = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--profile' && argv[i + 1]) workspaceId = argv[++i];
    else if (argv[i] === '--start-dt' && argv[i + 1]) startDt = argv[++i];
    else if (argv[i] === '--end-dt' && argv[i + 1]) endDt = argv[++i];
    else if (argv[i] === '--limit' && argv[i + 1]) limit = argv[++i];
  }

  workspaceId = resolveWorkspaceId(workspaceId);
  const key = getApiKeyForProfile(workspaceId);
  if ((startDt && !endDt) || (!startDt && endDt)) {
    console.error('--start-dt 與 --end-dt 需同時提供');
    process.exit(1);
  }

  const params = {};
  if (startDt && endDt) {
    params.broadcast_start_dt = startDt;
    params.broadcast_end_dt = endDt;
  }
  if (limit) params.limit = limit;

  const baseUrl = getBaseUrl();
  const qs = new URLSearchParams(params).toString();
  const url = `${baseUrl}/agent-tools/v3/${workspaceId}/statistics/search-broadcast-six-hour-interaction/${qs ? `?${qs}` : ''}`;

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

// ---------- 子指令：statistics get-active-member-count-total ----------

async function cmdStatisticsGetActiveMemberCountTotal(argv) {
  let workspaceId = null;
  let startDt = null;
  let endDt = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--profile' && argv[i + 1]) workspaceId = argv[++i];
    else if (argv[i] === '--start-dt' && argv[i + 1]) startDt = argv[++i];
    else if (argv[i] === '--end-dt' && argv[i + 1]) endDt = argv[++i];
  }

  workspaceId = resolveWorkspaceId(workspaceId);
  const key = getApiKeyForProfile(workspaceId);
  if ((startDt && !endDt) || (!startDt && endDt)) {
    console.error('--start-dt 與 --end-dt 需同時提供');
    process.exit(1);
  }

  const params = {};
  if (startDt && endDt) {
    params.start_dt = startDt;
    params.end_dt = endDt;
  }

  const baseUrl = getBaseUrl();
  const qs = new URLSearchParams(params).toString();
  const url = `${baseUrl}/agent-tools/v3/${workspaceId}/statistics/get-active-member-count-total/${qs ? `?${qs}` : ''}`;

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

// ---------- 子指令：activity-log list-tag-changes ----------

async function cmdActivityLogListTagChanges(argv) {
  let workspaceId = null;
  let memberId = null;
  let days = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--profile' && argv[i + 1]) workspaceId = argv[++i];
    else if (argv[i] === '--member-id' && argv[i + 1]) memberId = argv[++i];
    else if (argv[i] === '--days' && argv[i + 1]) days = argv[++i];
  }
  workspaceId = resolveWorkspaceId(workspaceId);
  const key = getApiKeyForProfile(workspaceId);
  if (!memberId) { console.error('缺少 --member-id <id>'); process.exit(1); }

  const baseUrl = getBaseUrl();
  const params = days ? '?' + new URLSearchParams({ days }).toString() : '';

  const url = `${baseUrl}/agent-tools/v3/${workspaceId}/activity-log/list-member-tag-changes/${memberId}/${params}`;
  let result;
  try { result = await apiRequest(url, key); } catch (err) { console.error('請求失敗：' + err.message); process.exit(1); }
  if (result.status !== 200) { console.error(`API 回傳 HTTP ${result.status}：${result.body}`); process.exit(1); }
  console.log(result.body);
  process.exit(0);
}

// ---------- 子指令：activity-log list-chatbot-triggers ----------

async function cmdActivityLogListChatbotTriggers(argv) {
  let workspaceId = null;
  let memberId = null;
  let days = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--profile' && argv[i + 1]) workspaceId = argv[++i];
    else if (argv[i] === '--member-id' && argv[i + 1]) memberId = argv[++i];
    else if (argv[i] === '--days' && argv[i + 1]) days = argv[++i];
  }
  workspaceId = resolveWorkspaceId(workspaceId);
  const key = getApiKeyForProfile(workspaceId);
  if (!memberId) { console.error('缺少 --member-id <id>'); process.exit(1); }

  const baseUrl = getBaseUrl();
  const params = days ? '?' + new URLSearchParams({ days }).toString() : '';

  const url = `${baseUrl}/agent-tools/v3/${workspaceId}/activity-log/list-member-chatbot-triggers/${memberId}/${params}`;
  let result;
  try { result = await apiRequest(url, key); } catch (err) { console.error('請求失敗：' + err.message); process.exit(1); }
  if (result.status !== 200) { console.error(`API 回傳 HTTP ${result.status}：${result.body}`); process.exit(1); }
  console.log(result.body);
  process.exit(0);
}

// ---------- 子指令：activity-log list-deeplink-clicks ----------

async function cmdActivityLogListDeeplinkClicks(argv) {
  let workspaceId = null;
  let memberId = null;
  let days = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--profile' && argv[i + 1]) workspaceId = argv[++i];
    else if (argv[i] === '--member-id' && argv[i + 1]) memberId = argv[++i];
    else if (argv[i] === '--days' && argv[i + 1]) days = argv[++i];
  }
  workspaceId = resolveWorkspaceId(workspaceId);
  const key = getApiKeyForProfile(workspaceId);
  if (!memberId) { console.error('缺少 --member-id <id>'); process.exit(1); }

  const baseUrl = getBaseUrl();
  const params = days ? '?' + new URLSearchParams({ days }).toString() : '';

  const url = `${baseUrl}/agent-tools/v3/${workspaceId}/activity-log/list-member-deeplink-clicks/${memberId}/${params}`;
  let result;
  try { result = await apiRequest(url, key); } catch (err) { console.error('請求失敗：' + err.message); process.exit(1); }
  if (result.status !== 200) { console.error(`API 回傳 HTTP ${result.status}：${result.body}`); process.exit(1); }
  console.log(result.body);
  process.exit(0);
}

// ---------- 子指令：chatbot list-recent-triggered ----------

async function cmdChatbotListRecentTriggered(argv) {
  let workspaceId = null;
  let days = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--profile' && argv[i + 1]) workspaceId = argv[++i];
    else if (argv[i] === '--days' && argv[i + 1]) days = argv[++i];
  }
  workspaceId = resolveWorkspaceId(workspaceId);
  const key = getApiKeyForProfile(workspaceId);

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
  let workspaceId = null;
  let memberId = null;
  let days = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--profile' && argv[i + 1]) workspaceId = argv[++i];
    else if (argv[i] === '--member-id' && argv[i + 1]) memberId = argv[++i];
    else if (argv[i] === '--days' && argv[i + 1]) days = argv[++i];
  }
  workspaceId = resolveWorkspaceId(workspaceId);
  const key = getApiKeyForProfile(workspaceId);
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
  let workspaceId = null;
  let memberIdsStr = null;
  let days = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--profile' && argv[i + 1]) workspaceId = argv[++i];
    else if (argv[i] === '--member-ids' && argv[i + 1]) memberIdsStr = argv[++i];
    else if (argv[i] === '--days' && argv[i + 1]) days = argv[++i];
  }
  workspaceId = resolveWorkspaceId(workspaceId);
  const key = getApiKeyForProfile(workspaceId);
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
  let workspaceId = null;
  let days = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--profile' && argv[i + 1]) workspaceId = argv[++i];
    else if (argv[i] === '--days' && argv[i + 1]) days = argv[++i];
  }
  workspaceId = resolveWorkspaceId(workspaceId);
  const key = getApiKeyForProfile(workspaceId);

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
  let workspaceId = null;
  let memberId = null;
  let days = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--profile' && argv[i + 1]) workspaceId = argv[++i];
    else if (argv[i] === '--member-id' && argv[i + 1]) memberId = argv[++i];
    else if (argv[i] === '--days' && argv[i + 1]) days = argv[++i];
  }
  workspaceId = resolveWorkspaceId(workspaceId);
  const key = getApiKeyForProfile(workspaceId);
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
  let workspaceId = null;
  let memberIdsStr = null;
  let days = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--profile' && argv[i + 1]) workspaceId = argv[++i];
    else if (argv[i] === '--member-ids' && argv[i + 1]) memberIdsStr = argv[++i];
    else if (argv[i] === '--days' && argv[i + 1]) days = argv[++i];
  }
  workspaceId = resolveWorkspaceId(workspaceId);
  const key = getApiKeyForProfile(workspaceId);
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
  let workspaceId = null;
  let socialMediaMemberId = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--profile' && argv[i + 1]) workspaceId = argv[++i];
    else if (argv[i] === '--social-media-member-id' && argv[i + 1]) socialMediaMemberId = argv[++i];
  }
  workspaceId = resolveWorkspaceId(workspaceId);
  const key = getApiKeyForProfile(workspaceId);
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
  let workspaceId = null;
  let socialMediaMemberIdsStr = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--profile' && argv[i + 1]) workspaceId = argv[++i];
    else if (argv[i] === '--social-media-member-ids' && argv[i + 1]) socialMediaMemberIdsStr = argv[++i];
  }
  workspaceId = resolveWorkspaceId(workspaceId);
  const key = getApiKeyForProfile(workspaceId);
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
  oakmega-scrm login                                    開啟本機網頁表單，新增/更新一組 (API key, Workspace ID, 別名)
  oakmega-scrm list-profiles                            列出所有已設定的 profile（JSON），標示目前啟用中的那組
  oakmega-scrm use-profile <workspace_id>                切換「目前啟用」的預設 profile
  oakmega-scrm whoami                                   印出目前啟用 profile 的 workspace 與 API_KEY 前 10 碼

  ── Member ──
  oakmega-scrm member search --query <q> --search-by <field>  搜尋會員
                        [--profile <workspace_id>]                  search-by: name | workspace_member_id | uuid
  oakmega-scrm member get-basic-info --member-id <id>         取得會員主表欄位與自訂欄位
                        [--profile <workspace_id>]
  oakmega-scrm member get-channel-line --member-id <id>       取得會員的 LINE 渠道資訊（未綁定回 404）
  oakmega-scrm member get-channel-fb --member-id <id>         取得會員的 Facebook 渠道資訊
  oakmega-scrm member get-channel-ig --member-id <id>         取得會員的 Instagram 渠道資訊
  oakmega-scrm member get-channel-whatsapp --member-id <id>   取得會員的 WhatsApp 渠道資訊
  oakmega-scrm member list-recent-messaged [--days <1-7>]     最近 N 日有訊息往來的會員（預設 1 日）
  oakmega-scrm member list-recent-chatbot-triggered [--days <1-7>]  最近 N 日觸發過聊天機器人的會員（預設 7 日）
  oakmega-scrm member list-recent-deeplink-clicked [--days <1-7>]   最近 N 日點擊過追蹤連結的會員（預設 7 日）

  ── Tag ──
  oakmega-scrm tag list-member-tags --member-id <id>          取得 member 身上所有有效標籤
                        [--profile <workspace_id>]
  oakmega-scrm tag list-members-batch --member-ids <id1,id2,...>  批次取得多個 member 的標籤（最多 20 人）
                        [--profile <workspace_id>]
  oakmega-scrm tag search-dirs [--query <關鍵字>] [--limit <n>]  依名稱模糊搜尋標籤資料夾
                        [--profile <workspace_id>]
  oakmega-scrm tag search --search-by <tag_dir_id|name> --query <值>  搜尋標籤
                        [--limit <n>] [--profile <workspace_id>]      tag_dir_id：query 為單一資料夾 id；name：query 為逗號分隔的名稱清單（完全相符，最多 20 個）

  ── Advanced Filter ──
  oakmega-scrm advanced-filter search [--query <關鍵字>] [--limit <n>]  依名稱模糊搜尋進階篩選
                        [--profile <workspace_id>]

  ── Broadcast ──
  oakmega-scrm broadcast search --start-dt <YYYY-MM-DD> --end-dt <YYYY-MM-DD>  搜尋發文（含開封/點擊/影片播放數據）
                        [--name <關鍵字>] [--limit <n>] [--profile <workspace_id>]

  ── Chatbot ──
  oakmega-scrm chatbot list-recent-triggered [--days <1-7>]                          workspace 最近 N 日 chatbot 排行（預設 7 日）
                        [--profile <workspace_id>]
  oakmega-scrm chatbot list-member-triggered --member-id <id> [--days <1-60>]        某 member 的 chatbot 觸發排行（預設 60 日）
                        [--profile <workspace_id>]
  oakmega-scrm chatbot list-members-triggered-batch --member-ids <id1,id2,...>        批次，最多 20 人，每人最多 20 筆
                        [--days <int,1-60>] [--profile <workspace_id>]

  ── Deeplink ──
  oakmega-scrm deeplink list-recent-clicked [--days <1-7>]                           workspace 最近 N 日 deeplink 排行（預設 7 日）
                        [--profile <workspace_id>]
  oakmega-scrm deeplink list-member-clicked --member-id <id> [--days <1-60>]         某 member 的 deeplink 點擊排行（預設 60 日）
                        [--profile <workspace_id>]
  oakmega-scrm deeplink list-members-clicked-batch --member-ids <id1,id2,...>         批次，最多 20 人，每人最多 20 筆
                        [--days <int,1-60>] [--profile <workspace_id>]

  ── Service Center ──
  oakmega-scrm service-center list-member-messages --social-media-member-id <id>      取得單一渠道成員的對話紀錄（最多 500 筆）
                        [--profile <workspace_id>]
  oakmega-scrm service-center list-members-messages-batch --social-media-member-ids <id1,id2,...>  批次，最多 20 人，每人最多 20 筆
                        [--profile <workspace_id>]

  ── Activity Log ──
  oakmega-scrm activity-log list-tag-changes --member-id <id> [--days <1-60>]            標籤異動紀錄（預設 60 日）
  oakmega-scrm activity-log list-chatbot-triggers --member-id <id> [--days <1-60>]       Chatbot 觸發紀錄（預設 60 日）
  oakmega-scrm activity-log list-deeplink-clicks --member-id <id> [--days <1-60>]        Deeplink 點擊紀錄（預設 60 日）

  ── Statistics ──
  oakmega-scrm statistics get-workspace-member-overview                              workspace 會員/好友概況
                        [--profile <workspace_id>]
  oakmega-scrm statistics get-line-friend-count-series [--start-dt <YYYY-MM-DD>] [--end-dt <YYYY-MM-DD>]   LINE 好友加入/封鎖逐日時序（預設近 30 天，最長 100 天）
                        [--profile <workspace_id>]
  oakmega-scrm statistics get-line-friend-count-total [--start-dt <YYYY-MM-DD>] [--end-dt <YYYY-MM-DD>]  LINE 好友加入/封鎖總數（區間加總單一數字，預設近 30 天，最長 100 天）
                        [--profile <workspace_id>]
  oakmega-scrm statistics get-active-member-count-series [--start-dt <YYYY-MM-DD>] [--end-dt <YYYY-MM-DD>]  活躍會員數逐日時序（預設近 30 天，最長 100 天）
                        [--profile <workspace_id>]
  oakmega-scrm statistics get-active-member-count-total [--start-dt <YYYY-MM-DD>] [--end-dt <YYYY-MM-DD>]  活躍會員總數（區間去重單一數字，預設近 30 天，最長 100 天）
                        [--profile <workspace_id>]
  oakmega-scrm statistics get-member-interaction-count-series [--start-dt <YYYY-MM-DD>] [--end-dt <YYYY-MM-DD>]  會員互動數逐日時序（預設近 30 天，最長 100 天）
                        [--profile <workspace_id>]
  oakmega-scrm statistics get-member-interaction-count-total [--start-dt <YYYY-MM-DD>] [--end-dt <YYYY-MM-DD>]  會員互動總數（區間加總單一數字，預設近 30 天，最長 100 天）
                        [--profile <workspace_id>]
  oakmega-scrm statistics get-line-follow-insight --date <YYYY-MM-DD>                LINE 官方帳號指定日期的追蹤者洞察（followers/targetedReaches/blocks）
                        [--profile <workspace_id>]
  oakmega-scrm statistics list-broadcast-six-hour-interaction-batch --broadcast-ids <id1,id2,...>  批次取得多筆發文的 6 小時互動數據，最多 20 筆
                        [--profile <workspace_id>]
  oakmega-scrm statistics search-broadcast-six-hour-interaction [--start-dt <YYYY-MM-DD>] [--end-dt <YYYY-MM-DD>] [--limit <n>]  依日期區間取得多筆發文的 6 小時互動數據（預設近 30 天，最長 100 天）
                        [--profile <workspace_id>]
  oakmega-scrm statistics get-tag-member-count --tag-id <tag_id> [--dt <YYYY-MM-DD>]  指定標籤在某一天的累積貼標人數（預設今天）
                        [--profile <workspace_id>]
  oakmega-scrm statistics get-tag-member-count-series --tag-id <tag_id> [--start-dt <YYYY-MM-DD>] [--end-dt <YYYY-MM-DD>]  指定標籤逐日累積貼標人數與當日新增人數（預設近 30 天，最長 100 天）
                        [--profile <workspace_id>]
  oakmega-scrm statistics get-tag-member-count-total --tag-id <tag_id> [--start-dt <YYYY-MM-DD>] [--end-dt <YYYY-MM-DD>]  指定標籤區間起訖累積人數與淨新增總量（預設近 30 天，最長 100 天）
                        [--profile <workspace_id>]

  ── Analytics ──
  oakmega-scrm analytics analyze-member-tag-distribution --advanced-filter-id <id>  用進階篩選篩出會員後，分析這批會員的標籤分布
                        [--tag-ids <id1,id2,...>] [--profile <workspace_id>]     不帶 --tag-ids 則回佔比最高前 20 個標籤（每個 workspace 限流每分鐘 1 次）
  oakmega-scrm analytics analyze-member-field-distribution --advanced-filter-id <id>  用進階篩選篩出會員後，分析這批會員的欄位分布
                        [--profile <workspace_id>]     封鎖/真實名稱/信箱/生日/電話/地址/性別（每個 workspace 限流每分鐘 1 次）

  所有指令均可加 [--profile <workspace_id>] 指定要用哪一組 profile（單次覆蓋，不影響預設）；不帶則使用目前啟用中的 profile。

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
  if (a === 'list-profiles') return cmdListProfiles();
  if (a === 'use-profile') return cmdUseProfile(argv.slice(1));
  if (a === 'tag' && b === 'list-member-tags') return cmdTagListMemberTags(argv.slice(2));
  if (a === 'tag' && b === 'list-members-batch') return cmdTagListMembersBatch(argv.slice(2));
  if (a === 'tag' && b === 'search-dirs') return cmdTagSearchDirs(argv.slice(2));
  if (a === 'tag' && b === 'search') return cmdTagSearch(argv.slice(2));
  if (a === 'advanced-filter' && b === 'search') return cmdAdvancedFilterSearch(argv.slice(2));
  if (a === 'analytics' && b === 'analyze-member-tag-distribution') return cmdAnalyticsAnalyzeMemberTagDistribution(argv.slice(2));
  if (a === 'analytics' && b === 'analyze-member-field-distribution') return cmdAnalyticsAnalyzeMemberFieldDistribution(argv.slice(2));
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
  if (a === 'statistics' && b === 'get-workspace-member-overview') return cmdStatisticsGetWorkspaceMemberOverview(argv.slice(2));
  if (a === 'statistics' && b === 'get-line-friend-count-series') return cmdStatisticsGetLineFriendCountSeries(argv.slice(2));
  if (a === 'statistics' && b === 'get-line-friend-count-total') return cmdStatisticsGetLineFriendCountTotal(argv.slice(2));
  if (a === 'statistics' && b === 'get-active-member-count-series') return cmdStatisticsGetActiveMemberCountSeries(argv.slice(2));
  if (a === 'statistics' && b === 'get-active-member-count-total') return cmdStatisticsGetActiveMemberCountTotal(argv.slice(2));
  if (a === 'statistics' && b === 'get-member-interaction-count-series') return cmdStatisticsGetMemberInteractionCountSeries(argv.slice(2));
  if (a === 'statistics' && b === 'get-member-interaction-count-total') return cmdStatisticsGetMemberInteractionCountTotal(argv.slice(2));
  if (a === 'statistics' && b === 'get-line-follow-insight') return cmdStatisticsGetLineFollowInsight(argv.slice(2));
  if (a === 'statistics' && b === 'list-broadcast-six-hour-interaction-batch') return cmdStatisticsListBroadcastSixHourInteractionBatch(argv.slice(2));
  if (a === 'statistics' && b === 'search-broadcast-six-hour-interaction') return cmdStatisticsSearchBroadcastSixHourInteraction(argv.slice(2));
  if (a === 'statistics' && b === 'get-tag-member-count') return cmdStatisticsGetTagMemberCount(argv.slice(2));
  if (a === 'statistics' && b === 'get-tag-member-count-series') return cmdStatisticsGetTagMemberCountSeries(argv.slice(2));
  if (a === 'statistics' && b === 'get-tag-member-count-total') return cmdStatisticsGetTagMemberCountTotal(argv.slice(2));

  console.log(`未知指令：${a}`);
  printUsage();
  process.exit(1);
}

main();
