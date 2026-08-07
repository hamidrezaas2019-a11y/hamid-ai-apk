// ============================================================
// Cloudflare Worker - نسخه کامل DeepSeek Coder
// ============================================================

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

const CONFIG = {
  API_KEY: 'YOUR_API_KEY_HERE',
  API_ENDPOINTS: {
    together: 'https://api.together.xyz/v1/chat/completions',
    openrouter: 'https://openrouter.ai/api/v1/chat/completions'
  },
  DEFAULT_MODEL: 'deepseek-ai/deepseek-coder-6.7b-instruct',
  MAX_TOKENS: 4096,
  TEMPERATURE: 0.7
};

// ============================================================
// هندلر اصلی
// ============================================================
async function handleRequest(request) {
  const url = new URL(request.url);
  const path = url.pathname;

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400'
      }
    });
  }

  try {
    switch (path) {
      case '/':
      case '/index.html':
        return serveFullUI();
      case '/chat':
        return handleChat(request);
      case '/chat/stream':
        return handleStream(request);
      case '/history':
        return handleHistory(request);
      case '/history/delete':
        return deleteHistory(request);
      case '/code':
        return handleCode(request);
      case '/health':
        return healthCheck();
      default:
        return new Response(JSON.stringify({ error: 'Not Found' }), { 
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
    }
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// ============================================================
// صفحه اصلی کامل
// ============================================================
async function serveFullUI() {
  const html = `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <title>DeepSeek Coder - دستیار هوشمند</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    :root {
      --bg-primary: #0d1117;
      --bg-secondary: #161b22;
      --bg-hover: #1c2333;
      --border-color: #30363d;
      --text-primary: #c9d1d9;
      --text-secondary: #8b949e;
      --text-muted: #484f58;
      --blue: #58a6ff;
      --green: #238636;
      --green-hover: #2ea043;
      --red: #da3633;
      --orange: #eab308;
      --purple: #8957e5;
      --radius: 12px;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: var(--bg-primary);
      color: var(--text-primary);
      height: 100vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: var(--text-muted); border-radius: 3px; }
    ::-webkit-scrollbar-thumb:hover { background: var(--text-secondary); }
    
    /* ===== HEADER ===== */
    .header {
      background: var(--bg-secondary);
      border-bottom: 1px solid var(--border-color);
      padding: 10px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-shrink: 0;
      z-index: 100;
    }
    .header-brand { display: flex; align-items: center; gap: 12px; }
    .header-brand h1 { font-size: 20px; font-weight: 700; background: linear-gradient(135deg, #58a6ff, #238636); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
    .header-status { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--text-secondary); }
    .status-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
    .status-dot.online { background: var(--green); box-shadow: 0 0 10px var(--green); }
    .status-dot.offline { background: var(--red); }
    .status-dot.loading { background: var(--orange); animation: pulse 0.8s infinite; }
    @keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(0.8); } }
    .header-actions { display: flex; gap: 6px; align-items: center; }
    .header-actions button {
      background: none; border: none; color: var(--text-secondary);
      font-size: 18px; cursor: pointer; padding: 6px 10px;
      border-radius: 8px; transition: all 0.2s;
    }
    .header-actions button:hover { background: var(--bg-hover); color: var(--text-primary); }
    
    /* ===== SIDEBAR ===== */
    .app-body { display: flex; flex: 1; overflow: hidden; }
    .sidebar {
      width: 280px; background: var(--bg-secondary);
      border-left: 1px solid var(--border-color);
      display: flex; flex-direction: column; flex-shrink: 0; overflow: hidden;
    }
    @media (max-width: 768px) {
      .sidebar { display: none; position: fixed; top: 0; left: 0; bottom: 0; width: 100%; z-index: 200; border-left: none; border-right: 1px solid var(--border-color); }
      .sidebar.open { display: flex; }
    }
    .sidebar-header { padding: 12px 16px; border-bottom: 1px solid var(--border-color); display: flex; gap: 8px; align-items: center; }
    .sidebar-header input { flex: 1; padding: 8px 12px; background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 8px; color: var(--text-primary); font-size: 14px; }
    .sidebar-header input:focus { outline: none; border-color: var(--blue); }
    .sidebar-header input::placeholder { color: var(--text-muted); }
    .sidebar-header .close-sidebar { display: none; background: none; border: none; color: var(--text-secondary); font-size: 24px; cursor: pointer; }
    @media (max-width: 768px) { .sidebar-header .close-sidebar { display: block; } }
    .chat-list { flex: 1; overflow-y: auto; padding: 8px 12px; }
    .chat-item {
      padding: 10px 12px; border-radius: 8px; cursor: pointer;
      transition: all 0.15s; margin-bottom: 2px; position: relative;
    }
    .chat-item:hover { background: var(--bg-hover); }
    .chat-item.active { background: var(--bg-hover); border-right: 3px solid var(--blue); }
    .chat-item.pinned { border-right: 3px solid var(--orange); }
    .chat-item .title { font-size: 14px; font-weight: 500; display: flex; justify-content: space-between; align-items: center; }
    .chat-item .preview { font-size: 12px; color: var(--text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-top: 2px; }
    .chat-item .timestamp { font-size: 10px; color: var(--text-muted); margin-top: 2px; }
    .chat-item .delete-btn {
      position: absolute; right: 8px; top: 50%; transform: translateY(-50%);
      background: none; border: none; color: var(--text-muted); cursor: pointer;
      display: none; font-size: 14px; padding: 4px 8px; border-radius: 4px;
    }
    .chat-item:hover .delete-btn { display: block; }
    .chat-item .delete-btn:hover { background: var(--red); color: white; }
    .sidebar-footer { padding: 12px 16px; border-top: 1px solid var(--border-color); font-size: 12px; color: var(--text-muted); text-align: center; }
    
    /* ===== MAIN ===== */
    .main { flex: 1; display: flex; flex-direction: column; min-width: 0; background: var(--bg-primary); }
    .chat-area { flex: 1; overflow-y: auto; padding: 20px 24px; scroll-behavior: smooth; }
    @media (max-width: 768px) { .chat-area { padding: 12px 16px; } }
    
    .message { margin-bottom: 16px; display: flex; gap: 12px; animation: fadeIn 0.3s ease; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
    .message.user { flex-direction: row-reverse; }
    .message .avatar {
      width: 36px; height: 36px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 18px; flex-shrink: 0; user-select: none;
    }
    .message.user .avatar { background: var(--blue); }
    .message.assistant .avatar { background: var(--green); }
    .message .content {
      background: var(--bg-secondary); padding: 12px 16px;
      border-radius: 14px; max-width: 85%;
      border: 1px solid var(--border-color);
      line-height: 1.7; font-size: 15px;
      word-wrap: break-word; overflow-wrap: break-word;
      position: relative;
    }
    .message.user .content { background: var(--blue); border-color: var(--blue); color: white; }
    .message .content pre {
      background: var(--bg-primary); padding: 12px;
      border-radius: 8px; overflow-x: auto; margin: 8px 0;
      font-family: 'Courier New', monospace; font-size: 13px;
      border: 1px solid var(--border-color);
      position: relative;
    }
    .message .content pre .copy-code-btn {
      position: absolute; top: 4px; right: 4px;
      background: var(--bg-secondary); border: 1px solid var(--border-color);
      color: var(--text-secondary); padding: 4px 10px;
      border-radius: 6px; cursor: pointer; font-size: 12px;
      transition: all 0.2s; opacity: 0;
    }
    .message .content pre:hover .copy-code-btn { opacity: 1; }
    .message .content pre .copy-code-btn:hover { background: var(--bg-hover); color: var(--text-primary); }
    .message .content code {
      font-family: 'Courier New', monospace; font-size: 13px;
      background: var(--bg-primary); padding: 2px 6px; border-radius: 4px;
    }
    .message .content .inline-code {
      background: var(--bg-primary); padding: 2px 6px;
      border-radius: 4px; font-family: 'Courier New', monospace;
      font-size: 13px; color: var(--orange);
    }
    
    /* ===== TYPING ===== */
    .typing-indicator { display: flex; gap: 4px; padding: 4px 0; }
    .typing-indicator span {
      width: 8px; height: 8px; background: var(--text-secondary);
      border-radius: 50%; animation: typingAnim 1.4s infinite;
    }
    .typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
    .typing-indicator span:nth-child(3) { animation-delay: 0.4s; }
    @keyframes typingAnim { 0%, 60%, 100% { transform: translateY(0); opacity: 0.4; } 30% { transform: translateY(-8px); opacity: 1; } }
    
    /* ===== INPUT ===== */
    .input-area {
      padding: 12px 20px 16px; border-top: 1px solid var(--border-color);
      display: flex; gap: 12px; align-items: flex-end;
      background: var(--bg-primary); flex-shrink: 0;
    }
    @media (max-width: 768px) { .input-area { padding: 8px 12px 12px; gap: 8px; } }
    .input-wrapper {
      flex: 1; position: relative; display: flex; align-items: flex-end;
      background: var(--bg-secondary); border: 1px solid var(--border-color);
      border-radius: 14px; transition: border-color 0.2s;
    }
    .input-wrapper:focus-within { border-color: var(--blue); }
    .input-wrapper textarea {
      flex: 1; padding: 10px 14px; background: transparent;
      border: none; color: var(--text-primary); resize: none;
      font-size: 15px; font-family: inherit; min-height: 44px;
      max-height: 200px; line-height: 1.5; outline: none;
    }
    .input-wrapper textarea::placeholder { color: var(--text-muted); }
    .input-wrapper .input-actions { display: flex; gap: 4px; padding: 4px 8px; align-items: center; }
    .input-wrapper .input-actions button {
      background: none; border: none; color: var(--text-muted);
      cursor: pointer; padding: 6px 8px; border-radius: 8px;
      font-size: 18px; transition: all 0.2s;
    }
    .input-wrapper .input-actions button:hover { background: var(--bg-hover); color: var(--text-primary); }
    .send-btn {
      padding: 10px 24px; background: var(--green); color: white;
      border: none; border-radius: 14px; cursor: pointer;
      font-weight: 600; font-size: 15px; transition: all 0.2s;
      white-space: nowrap; height: 48px; display: flex;
      align-items: center; gap: 6px;
    }
    .send-btn:hover:not(:disabled) { background: var(--green-hover); transform: scale(1.02); }
    .send-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
    
    /* ===== MODAL ===== */
    .modal-overlay {
      display: none; position: fixed; inset: 0;
      background: rgba(0,0,0,0.7); z-index: 1000;
      align-items: center; justify-content: center;
      backdrop-filter: blur(4px);
    }
    .modal-overlay.open { display: flex; }
    .modal-content {
      background: var(--bg-secondary); border: 1px solid var(--border-color);
      border-radius: 20px; padding: 28px; max-width: 480px;
      width: 92%; max-height: 85vh; overflow-y: auto;
      animation: modalIn 0.3s ease;
    }
    @keyframes modalIn { from { opacity: 0; transform: scale(0.95) translateY(10px); } to { opacity: 1; transform: scale(1) translateY(0); } }
    .modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
    .modal-header h2 { font-size: 22px; font-weight: 700; }
    .modal-header .close-modal { background: none; border: none; color: var(--text-secondary); font-size: 28px; cursor: pointer; padding: 0 4px; }
    .modal-header .close-modal:hover { color: var(--text-primary); }
    .setting-group { margin-bottom: 20px; }
    .setting-item { padding: 12px 0; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; }
    .setting-item:last-child { border-bottom: none; }
    .setting-item .label { font-size: 14px; }
    .setting-item select, .setting-item input[type="range"] {
      background: var(--bg-primary); color: var(--text-primary);
      border: 1px solid var(--border-color); border-radius: 8px;
      padding: 4px 8px; font-size: 14px;
    }
    .setting-item select:focus { outline: none; border-color: var(--blue); }
    .setting-item .toggle {
      width: 44px; height: 24px; background: var(--text-muted);
      border-radius: 12px; position: relative; cursor: pointer;
      transition: background 0.3s;
    }
    .setting-item .toggle.active { background: var(--green); }
    .setting-item .toggle::after {
      content: ''; position: absolute; width: 18px; height: 18px;
      background: white; border-radius: 50%; top: 3px; left: 3px;
      transition: transform 0.3s;
    }
    .setting-item .toggle.active::after { transform: translateX(20px); }
    .logout-btn {
      width: 100%; padding: 12px; background: var(--red);
      color: white; border: none; border-radius: 12px;
      cursor: pointer; font-weight: 600; font-size: 15px;
      margin-top: 8px; transition: opacity 0.2s;
    }
    .logout-btn:hover { opacity: 0.9; }
    .version-info { text-align: center; color: var(--text-muted); font-size: 12px; margin-top: 16px; }
    
    .hamburger {
      display: none; background: none; border: none;
      color: var(--text-primary); font-size: 24px;
      cursor: pointer; padding: 4px 8px;
    }
    @media (max-width: 768px) { .hamburger { display: block; } }
    @media (max-width: 480px) {
      .header { padding: 8px 12px; }
      .header-brand h1 { font-size: 17px; }
      .message .content { max-width: 90%; font-size: 14px; }
      .send-btn { padding: 8px 16px; font-size: 14px; height: 44px; }
    }
    
    /* ===== TOAST NOTIFICATION ===== */
    .toast {
      position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%);
      background: var(--bg-secondary); border: 1px solid var(--border-color);
      padding: 10px 20px; border-radius: 12px;
      font-size: 14px; color: var(--text-primary);
      opacity: 0; transition: opacity 0.3s; z-index: 999;
      pointer-events: none; max-width: 90%;
    }
    .toast.show { opacity: 1; }
    .toast.success { border-color: var(--green); }
    .toast.error { border-color: var(--red); }
    
    /* ===== BADGE ===== */
    .badge {
      display: inline-block; padding: 2px 8px;
      border-radius: 12px; font-size: 10px;
      font-weight: 600; background: var(--blue);
      color: white; margin-right: 4px;
    }
    .badge.green { background: var(--green); }
    .badge.orange { background: var(--orange); }
  </style>
</head>
<body>

  <header class="header">
    <div class="header-brand">
      <button class="hamburger" onclick="toggleSidebar()">☰</button>
      <h1>🤖 DeepSeek Coder</h1>
      <span class="badge green">v2.2</span>
    </div>
    <div class="header-status">
      <span id="statusText">آنلاین</span>
      <span class="status-dot online" id="statusDot"></span>
    </div>
    <div class="header-actions">
      <button onclick="clearChat()" title="پاک کردن مکالمه">🗑️</button>
      <button onclick="openSettings()" title="تنظیمات">⚙️</button>
      <button onclick="newChat()" title="مکالمه جدید">➕</button>
    </div>
  </header>

  <div class="app-body">
    <aside class="sidebar" id="sidebar">
      <div class="sidebar-header">
        <input type="text" id="searchInput" placeholder="🔍 جستجوی مکالمات..." oninput="searchChats(this.value)">
        <button class="close-sidebar" onclick="toggleSidebar()">✕</button>
      </div>
      <div class="chat-list" id="chatList"></div>
      <div class="sidebar-footer">نسخه 2.2.2 • <span id="chatCount">۰</span> مکالمه</div>
    </aside>

    <main class="main">
      <div class="chat-area" id="chatArea">
        <div class="message assistant" id="welcomeMessage">
          <div class="avatar">🤖</div>
          <div class="content">
            <strong>سلام! 👋</strong><br>
            من <strong>DeepSeek Coder</strong> هستم، دستیار برنامه‌نویسی هوشمند.<br><br>
            <span style="color:var(--text-secondary);font-size:13px;">
              💡 می‌توانید:<br>
              • سوالات برنامه‌نویسی بپرسید<br>
              • کد بنویسید یا بهینه کنید<br>
              • از فایل‌های کد استفاده کنید<br>
              • دستورات صوتی بدهید
            </span>
          </div>
        </div>
      </div>

      <div class="input-area">
        <div class="input-wrapper">
          <textarea id="messageInput" rows="1" placeholder="Type a message or hold to speak..." onkeydown="handleKey(event)" oninput="autoResize(this)"></textarea>
          <div class="input-actions">
            <button onclick="startVoice()" title="ورودی صوتی (🎤)">🎤</button>
            <button onclick="attachFile()" title="ضمیمه فایل (📎)">📎</button>
            <button onclick="insertCodeTemplate()" title="قالب کد (📄)">📄</button>
          </div>
        </div>
        <button class="send-btn" id="sendBtn" onclick="sendMessage()">
          <span>ارسال</span>
          <span>➤</span>
        </button>
      </div>
    </main>
  </div>

  <!-- ===== MODAL SETTINGS ===== -->
  <div class="modal-overlay" id="settingsModal">
    <div class="modal-content">
      <div class="modal-header">
        <h2>⚙️ تنظیمات پیشرفته</h2>
        <button class="close-modal" onclick="closeSettings()">✕</button>
      </div>
      <div class="setting-group">
        <div class="setting-item">
          <span class="label">🌐 زبان</span>
          <select id="langSelect">
            <option value="fa">فارسی</option>
            <option value="en">English</option>
            <option value="ar">العربية</option>
          </select>
        </div>
        <div class="setting-item">
          <span class="label">🎨 تم</span>
          <select id="themeSelect">
            <option value="system">سیستم</option>
            <option value="light">روشن</option>
            <option value="dark" selected>تاریک</option>
          </select>
        </div>
        <div class="setting-item">
          <span class="label">📏 اندازه قلم</span>
          <input type="range" id="fontSizeRange" min="12" max="24" value="16" step="1">
          <span id="fontSizeLabel">16</span>
        </div>
        <div class="setting-item">
          <span class="label">🎤 ورودی صوتی</span>
          <div class="toggle active" id="voiceToggle" onclick="toggleVoice()"></div>
        </div>
        <div class="setting-item">
          <span class="label">📌 ذخیره خودکار</span>
          <div class="toggle active" id="autoSaveToggle" onclick="toggleAutoSave()"></div>
        </div>
        <div class="setting-item">
          <span class="label">🧠 دمای خلاقیت</span>
          <input type="range" id="temperatureRange" min="0" max="100" value="70" step="5">
          <span id="temperatureLabel">0.7</span>
        </div>
        <div class="setting-item">
          <span class="label">📊 حداکثر توکن</span>
          <select id="maxTokensSelect">
            <option value="1024">۱,۰۲۴</option>
            <option value="2048" selected>۲,۰۴۸</option>
            <option value="4096">۴,۰۹۶</option>
            <option value="8192">۸,۱۹۲</option>
          </select>
        </div>
      </div>
      <div style="display:flex;gap:8px;">
        <button class="logout-btn" onclick="exportData()" style="background:var(--blue);flex:1;">📤 خروجی داده</button>
        <button class="logout-btn" onclick="importData()" style="background:var(--purple);flex:1;">📥 ورودی داده</button>
      </div>
      <button class="logout-btn" onclick="logout()">🚪 خروج از حساب</button>
      <div class="version-info">نسخه 2.2.2 (236) • <span id="messageCount">۰</span> پیام • ساخته شده با ❤️</div>
    </div>
  </div>

  <!-- ===== TOAST ===== -->
  <div class="toast" id="toast"></div>

  <script>
    // ============================================================
    // STATE
    // ============================================================
    const state = {
      currentChatId: null,
      chats: [],
      messages: [],
      isTyping: false,
      isPinned: false,
      autoSave: true,
      temperature: 0.7,
      maxTokens: 2048
    };

    // ============================================================
    // DOM REFS
    // ============================================================
    const $ = id => document.getElementById(id);
    const chatArea = $('chatArea');
    const messageInput = $('messageInput');
    const sendBtn = $('sendBtn');
    const chatList = $('chatList');
    const sidebar = $('sidebar');
    const searchInput = $('searchInput');
    const statusDot = $('statusDot');
    const statusText = $('statusText');
    const toast = $('toast');

    // ============================================================
    // TOAST
    // ============================================================
    function showToast(message, type = 'success') {
      toast.textContent = message;
      toast.className = 'toast ' + type + ' show';
      clearTimeout(toast._timeout);
      toast._timeout = setTimeout(() => toast.classList.remove('show'), 3000);
    }

    // ============================================================
    // FORMAT CONTENT (با دکمه کپی)
    // ============================================================
    function formatContent(content) {
      if (!content) return '';
      let formatted = content;
      
      // کد بلاک‌ها با دکمه کپی
      formatted = formatted.replace(/\\\`\\\`\\\`(\\w*)\\n?([\\s\\S]*?)\\n?\\\`\\\`\\\`/g, function(match, lang, code) {
        const escaped = escapeHtml(code.trim());
        const langLabel = lang || 'text';
        return '<pre><code class="language-' + langLabel + '">' + escaped + 
               '</code><button class="copy-code-btn" onclick="copyCode(this)">📋 کپی</button></pre>';
      });
      
      // کدهای خطی
      formatted = formatted.replace(/\\\`([^\\\`]+)\\\`/g, function(match, code) {
        return '<span class="inline-code">' + escapeHtml(code) + '</span>';
      });
      
      // خطوط جدید
      formatted = formatted.replace(/\\n/g, '<br>');
      
      return formatted;
    }

    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    // ============================================================
    // COPY CODE
    // ============================================================
    function copyCode(btn) {
      const pre = btn.closest('pre');
      const code = pre ? pre.querySelector('code') : null;
      if (code) {
        navigator.clipboard.writeText(code.textContent).then(() => {
          const orig = btn.textContent;
          btn.textContent = '✅ کپی شد!';
          setTimeout(() => btn.textContent = orig, 2000);
          showToast('📋 کد کپی شد!', 'success');
        }).catch(() => {
          showToast('❌ خطا در کپی', 'error');
        });
      }
    }

    // ============================================================
    // APPEND MESSAGE
    // ============================================================
    function appendMessage(role, content) {
      const div = document.createElement('div');
      div.className = 'message ' + role;
      const avatar = role === 'user' ? '👤' : '🤖';
      const formattedContent = formatContent(content);
      div.innerHTML = '<div class="avatar">' + avatar + '</div><div class="content">' + formattedContent + '</div>';
      chatArea.appendChild(div);
      scrollToBottom();
      state.messages.push({ role: role, content: content });
      updateStats();
    }

    // ============================================================
    // TYPING
    // ============================================================
    function showTyping(show) {
      const existing = $('typingIndicator');
      if (show && !existing) {
        const div = document.createElement('div');
        div.className = 'message assistant';
        div.id = 'typingIndicator';
        div.innerHTML = '<div class="avatar">🤖</div><div class="content"><div class="typing-indicator"><span></span><span></span><span></span></div></div>';
        chatArea.appendChild(div);
        scrollToBottom();
      } else if (!show && existing) {
        existing.remove();
      }
    }

    function scrollToBottom() {
      setTimeout(() => { chatArea.scrollTop = chatArea.scrollHeight; }, 50);
    }

    // ============================================================
    // SEND MESSAGE
    // ============================================================
    async function sendMessage() {
      const message = messageInput.value.trim();
      if (!message || state.isTyping) return;
      
      const welcome = $('welcomeMessage');
      if (welcome) welcome.remove();
      
      appendMessage('user', message);
      messageInput.value = '';
      messageInput.style.height = 'auto';
      sendBtn.disabled = true;
      state.isTyping = true;
      updateStatus('loading', 'در حال پردازش...');
      showTyping(true);
      
      try {
        const response = await fetch('/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [{ role: 'user', content: message }],
            model: 'deepseek-coder',
            temperature: state.temperature,
            max_tokens: state.maxTokens
          })
        });
        
        if (!response.ok) {
          const error = await response.text();
          throw new Error('خطا: ' + response.status + ' - ' + error);
        }
        
        const data = await response.json();
        const reply = data.choices?.[0]?.message?.content || 'پاسخی دریافت نشد.';
        
        showTyping(false);
        appendMessage('assistant', reply);
        
        if (state.autoSave) {
          saveChat(message, reply);
        }
        
      } catch (error) {
        showTyping(false);
        appendMessage('assistant', '❌ خطا: ' + error.message);
        showToast('❌ ' + error.message, 'error');
      } finally {
        state.isTyping = false;
        sendBtn.disabled = false;
        updateStatus('online', 'آنلاین');
        messageInput.focus();
        scrollToBottom();
      }
    }

    // ============================================================
    // SAVE / LOAD HISTORY
    // ============================================================
    async function saveChat(userMessage, assistantReply) {
      const chatId = state.currentChatId || Date.now().toString();
      const chatData = {
        id: chatId,
        title: userMessage.slice(0, 30) + (userMessage.length > 30 ? '...' : ''),
        messages: state.messages,
        timestamp: new Date().toISOString(),
        pinned: state.isPinned
      };
      
      try {
        await fetch('/history', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(chatData)
        });
        state.currentChatId = chatId;
        loadChats();
      } catch (error) {
        console.error('Failed to save chat:', error);
      }
    }

    async function loadChats() {
      try {
        const response = await fetch('/history');
        const data = await response.json();
        state.chats = data.chats || [];
        renderChatList();
        $('chatCount').textContent = state.chats.length;
      } catch (error) {
        console.error('Failed to load chats:', error);
      }
    }

    function renderChatList() {
      chatList.innerHTML = '';
      if (state.chats.length === 0) {
        chatList.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:40px 20px;font-size:14px;">هیچ مکالمه‌ای وجود ندارد<br><span style="font-size:12px;">برای شروع تایپ کنید...</span></div>';
        return;
      }
      
      state.chats.forEach(function(chat) {
        const div = document.createElement('div');
        div.className = 'chat-item' + (chat.pinned ? ' pinned' : '');
        if (chat.id === state.currentChatId) div.classList.add('active');
        
        const preview = chat.messages?.length > 0 
          ? chat.messages[chat.messages.length - 1].content.slice(0, 50) + '...' 
          : 'مکالمه جدید';
        
        div.innerHTML = 
          '<div class="title"><span>' + (chat.pinned ? '📌 ' : '') + (chat.title || 'مکالمه جدید') + '</span>' + 
          (chat.pinned ? '<span class="pin-icon">📌</span>' : '') + '</div>' +
          '<div class="preview">' + preview + '</div>' +
          '<div class="timestamp">' + new Date(chat.timestamp).toLocaleDateString('fa-IR') + '</div>' +
          '<button class="delete-btn" onclick="deleteChat(\\'' + chat.id + '\\')">🗑️</button>';
        
        div.addEventListener('click', function() { loadChat(chat.id); });
        chatList.appendChild(div);
      });
    }

    async function loadChat(chatId) {
      try {
        const response = await fetch('/history?id=' + chatId);
        const data = await response.json();
        if (data.chat) {
          state.currentChatId = chatId;
          state.messages = data.chat.messages || [];
          renderMessages();
          renderChatList();
          showToast('📂 مکالمه بارگذاری شد', 'success');
        }
      } catch (error) {
        console.error('Failed to load chat:', error);
        showToast('❌ خطا در بارگذاری', 'error');
      }
    }

    function renderMessages() {
      chatArea.innerHTML = '';
      state.messages.forEach(function(msg) { 
        appendMessage(msg.role, msg.content); 
      });
      if (state.messages.length === 0) {
        chatArea.innerHTML = 
          '<div class="message assistant" id="welcomeMessage">' +
          '<div class="avatar">🤖</div>' +
          '<div class="content"><strong>سلام! 👋</strong><br>من دستیار هوشمند DeepSeek هستم. سوالات خود را بپرسید.</div>' +
          '</div>';
      }
      scrollToBottom();
      updateStats();
    }

    async function deleteChat(chatId) {
      if (!confirm('آیا مطمئن هستید؟')) return;
      try {
        await fetch('/history/delete?id=' + chatId, { method: 'DELETE' });
        state.chats = state.chats.filter(function(c) { return c.id !== chatId; });
        if (state.currentChatId === chatId) {
          state.currentChatId = null;
          state.messages = [];
          renderMessages();
        }
        renderChatList();
        $('chatCount').textContent = state.chats.length;
        showToast('🗑️ مکالمه حذف شد', 'success');
      } catch (error) {
        console.error('Failed to delete chat:', error);
        showToast('❌ خطا در حذف', 'error');
      }
    }

    function searchChats(query) {
      const items = chatList.querySelectorAll('.chat-item');
      items.forEach(function(item) {
        const text = item.textContent.toLowerCase();
        item.style.display = text.includes(query.toLowerCase()) ? 'block' : 'none';
      });
    }

    // ============================================================
    // CLEAR CHAT
    // ============================================================
    function clearChat() {
      if (!confirm('آیا می‌خواهید همه پیام‌های فعلی را پاک کنید؟')) return;
      state.messages = [];
      renderMessages();
      showToast('🧹 مکالمه پاک شد', 'success');
    }

    // ============================================================
    // CODE TEMPLATE
    // ============================================================
    function insertCodeTemplate() {
      const templates = [
        'function solution() {\\n  // your code\\n}',
        'class MyClass {\\n  constructor() {}\\n}',
        'async function fetchData() {\\n  const response = await fetch(url);\\n  return response.json();\\n}',
        'const express = require(\\'express\\');\\nconst app = express();\\napp.get(\\'\\', (req, res) => {\\n  res.send(\\'Hello World!\\');\\n});'
      ];
      const selected = templates[Math.floor(Math.random() * templates.length)];
      messageInput.value = selected;
      autoResize(messageInput);
      messageInput.focus();
      showToast('📄 قالب کد اضافه شد', 'success');
    }

    // ============================================================
    // VOICE
    // ============================================================
    function startVoice() {
      if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        showToast('❌ مرورگر پشتیبانی نمی‌کند', 'error');
        return;
      }
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.lang = 'fa-IR';
      recognition.continuous = false;
      recognition.interimResults = true;
      
      recognition.onstart = function() {
        messageInput.placeholder = '🎤 در حال گوش دادن...';
        updateStatus('loading', 'در حال ضبط...');
      };
      
      recognition.onresult = function(event) {
        let transcript = '';
        for (let i = 0; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        messageInput.value = transcript;
        autoResize(messageInput);
      };
      
      recognition.onend = function() {
        messageInput.placeholder = 'Type a message or hold to speak...';
        updateStatus('online', 'آنلاین');
        if (messageInput.value.trim()) {
          sendMessage();
        }
      };
      
      recognition.onerror = function(event) {
        console.error('Speech error:', event.error);
        messageInput.placeholder = 'Type a message or hold to speak...';
        updateStatus('online', 'آنلاین');
        if (event.error === 'not-allowed') {
          showToast('❌ دسترسی به میکروفون مجاز نیست', 'error');
        }
      };
      
      recognition.start();
    }

    // ============================================================
    // ATTACH FILE
    // ============================================================
    function attachFile() {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.txt,.js,.py,.java,.cpp,.html,.css,.json,.go,.rs,.ts,.jsx,.tsx';
      input.multiple = false;
      input.onchange = function(e) {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = function(event) {
            const content = event.target.result;
            const ext = file.name.split('.').pop() || 'txt';
            messageInput.value = 'فایل: ' + file.name + ' (' + (file.size / 1024).toFixed(1) + 'KB)\\n\\n\\`\\`\\`' + ext + '\\n' + content + '\\n\\`\\`\\`\\n\\nلطفاً این کد را بررسی کن.';
            autoResize(messageInput);
            showToast('📎 فایل ضمیمه شد: ' + file.name, 'success');
          };
          reader.readAsText(file);
        }
      };
      input.click();
    }

    // ============================================================
    // SETTINGS
    // ============================================================
    function openSettings() { $('settingsModal').classList.add('open'); }
    function closeSettings() { $('settingsModal').classList.remove('open'); }
    
    $('settingsModal').addEventListener('click', function(e) {
      if (e.target === e.currentTarget) closeSettings();
    });

    // Theme
    $('themeSelect').addEventListener('change', function(e) {
      const theme = e.target.value;
      if (theme === 'light') {
        document.documentElement.style.setProperty('--bg-primary', '#ffffff');
        document.documentElement.style.setProperty('--bg-secondary', '#f6f8fa');
        document.documentElement.style.setProperty('--bg-hover', '#f0f2f5');
        document.documentElement.style.setProperty('--border-color', '#d0d7de');
        document.documentElement.style.setProperty('--text-primary', '#24292f');
        document.documentElement.style.setProperty('--text-secondary', '#57606a');
        document.documentElement.style.setProperty('--text-muted', '#8b949e');
      } else if (theme === 'dark') {
        document.documentElement.style.setProperty('--bg-primary', '#0d1117');
        document.documentElement.style.setProperty('--bg-secondary', '#161b22');
        document.documentElement.style.setProperty('--bg-hover', '#1c2333');
        document.documentElement.style.setProperty('--border-color', '#30363d');
        document.documentElement.style.setProperty('--text-primary', '#c9d1d9');
        document.documentElement.style.setProperty('--text-secondary', '#8b949e');
        document.documentElement.style.setProperty('--text-muted', '#484f58');
      }
      showToast('🎨 تم تغییر کرد', 'success');
    });

    // Font Size
    $('fontSizeRange').addEventListener('input', function(e) {
      const size = e.target.value + 'px';
      document.querySelector('.chat-area').style.fontSize = size;
      $('fontSizeLabel').textContent = e.target.value;
    });

    // Temperature
    $('temperatureRange').addEventListener('input', function(e) {
      const val = (e.target.value / 100).toFixed(1);
      state.temperature = parseFloat(val);
      $('temperatureLabel').textContent = val;
    });

    // Max Tokens
    $('maxTokensSelect').addEventListener('change', function(e) {
      state.maxTokens = parseInt(e.target.value);
    });

    function toggleVoice() { $('voiceToggle').classList.toggle('active'); }
    function toggleAutoSave() { 
      $('autoSaveToggle').classList.toggle('active');
      state.autoSave = $('autoSaveToggle').classList.contains('active');
      showToast('💾 ذخیره خودکار: ' + (state.autoSave ? 'فعال' : 'غیرفعال'), 'success');
    }

    // ============================================================
    // EXPORT / IMPORT DATA
    // ============================================================
    function exportData() {
      const data = {
        chats: state.chats,
        settings: {
          theme: $('themeSelect').value,
          fontSize: $('fontSizeRange').value,
          temperature: state.temperature,
          maxTokens: state.maxTokens
        },
        exportedAt: new Date().toISOString()
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'deepseek_backup_' + Date.now() + '.json';
      a.click();
      URL.revokeObjectURL(url);
      showToast('📤 داده‌ها صادر شدند', 'success');
    }

    function importData() {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.onchange = function(e) {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = function(event) {
            try {
              const data = JSON.parse(event.target.result);
              if (data.chats) {
                state.chats = data.chats;
                renderChatList();
                showToast('📥 داده‌ها وارد شدند: ' + data.chats.length + ' مکالمه', 'success');
              }
            } catch (err) {
              showToast('❌ فایل نامعتبر است', 'error');
            }
          };
          reader.readAsText(file);
        }
      };
      input.click();
    }

    // ============================================================
    // SIDEBAR
    // ============================================================
    function toggleSidebar() { sidebar.classList.toggle('open'); }
    
    document.addEventListener('click', function(e) {
      if (window.innerWidth <= 768) {
        if (!sidebar.contains(e.target) && e.target.closest('.hamburger') === null && !e.target.closest('.sidebar')) {
          sidebar.classList.remove('open');
        }
      }
    });

    // ============================================================
    // NEW CHAT
    // ============================================================
    function newChat() {
      state.currentChatId = null;
      state.messages = [];
      state.isPinned = false;
      renderMessages();
      renderChatList();
      messageInput.focus();
      if (window.innerWidth <= 768) sidebar.classList.remove('open');
      showToast('✨ مکالمه جدید', 'success');
    }

    // ============================================================
    // STATUS
    // ============================================================
    function updateStatus(status, text) {
      statusDot.className = 'status-dot ' + status;
      statusText.textContent = text;
    }

    // ============================================================
    // STATS
    // ============================================================
    function updateStats() {
      $('messageCount').textContent = state.messages.length;
    }

    // ============================================================
    // LOGOUT
    // ============================================================
    function logout() {
      if (confirm('آیا مطمئن هستید که می‌خواهید خارج شوید؟')) {
        localStorage.clear();
        window.location.reload();
      }
    }

    // ============================================================
    // KEYBOARD SHORTCUTS
    // ============================================================
    document.addEventListener('keydown', function(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchInput.focus();
      }
      if (e.key === 'Escape') {
        closeSettings();
        if (sidebar.classList.contains('open')) sidebar.classList.remove('open');
      }
      // Ctrl+N = new chat
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        newChat();
      }
    });

    // ============================================================
    // INIT
    // ============================================================
    document.addEventListener('DOMContentLoaded', function() {
      loadChats();
      messageInput.focus();
      
      // Load saved settings
      const savedTheme = localStorage.getItem('theme');
      if (savedTheme) {
        $('themeSelect').value = savedTheme;
        $('themeSelect').dispatchEvent(new Event('change'));
      }
      
      fetch('/health')
        .then(function(res) { return res.json(); })
        .then(function() { updateStatus('online', 'آنلاین'); })
        .catch(function() { updateStatus('offline', 'آفلاین'); });
    });

    messageInput.addEventListener('input', function() { autoResize(messageInput); });
    chatArea.addEventListener('click', function() { messageInput.focus(); });

    // Auto-resize
    function autoResize(el) {
      el.style.height = 'auto';
      el.style.height = el.scrollHeight + 'px';
    }

    function handleKey(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    }

    // ============================================================
    // EXPOSE GLOBALS
    // ============================================================
    window.sendMessage = sendMessage;
    window.handleKey = handleKey;
    window.autoResize = autoResize;
    window.startVoice = startVoice;
    window.openSettings = openSettings;
    window.closeSettings = closeSettings;
    window.toggleSidebar = toggleSidebar;
    window.newChat = newChat;
    window.logout = logout;
    window.attachFile = attachFile;
    window.searchChats = searchChats;
    window.deleteChat = deleteChat;
    window.toggleVoice = toggleVoice;
    window.toggleAutoSave = toggleAutoSave;
    window.clearChat = clearChat;
    window.insertCodeTemplate = insertCodeTemplate;
    window.copyCode = copyCode;
    window.exportData = exportData;
    window.importData = importData;
  </script>
</body>
</html>`;

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html',
      'Cache-Control': 'public, max-age=3600'
    }
  });
}

// ============================================================
// API HANDLERS
// ============================================================

async function handleChat(request) {
  try {
    const body = await request.json();
    const { messages, model, temperature = 0.7, max_tokens = 2048 } = body;
    
    const apiKey = CONFIG.API_KEY || 'YOUR_API_KEY';
    
    const response = await fetch(CONFIG.API_ENDPOINTS.together, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey
      },
      body: JSON.stringify({
        model: CONFIG.DEFAULT_MODEL,
        messages: messages,
        temperature: temperature,
        max_tokens: max_tokens,
        top_p: 0.95,
        top_k: 50,
        repetition_penalty: 1.1,
        stop: ['<|EOT|>', '### Instruction:', '### Response:']
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error('API Error: ' + response.status);
    }

    const data = await response.json();
    return new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });

  } catch (error) {
    return new Response(JSON.stringify({
      error: error.message,
      choices: [{ message: { content: '⚠️ خطا در ارتباط با API. لطفاً بعداً تلاش کنید.' } }]
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}

async function handleStream(request) {
  // پیاده‌سازی استریم برای پاسخ‌های تدریجی
  try {
    const body = await request.json();
    const { messages } = body;
    
    const apiKey = CONFIG.API_KEY || 'YOUR_API_KEY';
    
    const response = await fetch(CONFIG.API_ENDPOINTS.together, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey
      },
      body: JSON.stringify({
        model: CONFIG.DEFAULT_MODEL,
        messages: messages,
        temperature: 0.7,
        max_tokens: 2048,
        stream: true
      })
    });

    return new Response(response.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function handleHistory(request) {
  try {
    if (request.method === 'POST') {
      const chat = await request.json();
      await saveChatToKV(chat);
      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    
    if (id) {
      const chat = await getChatFromKV(id);
      return new Response(JSON.stringify({ chat }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } else {
      const chats = await getChatsFromKV();
      return new Response(JSON.stringify({ chats }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message, chats: [] }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function deleteHistory(request) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    await deleteChatFromKV(id);
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function handleCode(request) {
  try {
    const body = await request.json();
    const { instruction, language = 'python', code = '' } = body;
    
    let prompt = '';
    if (code) {
      prompt = 'Improve this ' + language + ' code:\\n\\n```' + language + '\\n' + code + '\\n```';
    } else {
      prompt = 'Write ' + language + ' code for: ' + instruction;
    }
    
    const response = await fetch('/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: 'You are an expert programmer. Generate clean, efficient, well-commented code. Only respond with the code, no explanations.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 4096
      })
    });
    
    const data = await response.json();
    return new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
    
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function healthCheck() {
  return new Response(JSON.stringify({
    status: 'healthy',
    version: '2.2.2',
    timestamp: new Date().toISOString(),
    uptime: process.uptime ? process.uptime() : 'N/A'
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

// ============================================================
// KV FUNCTIONS
// ============================================================

async function getChatsFromKV() {
  try {
    if (typeof DEEPSEEK_HISTORY !== 'undefined') {
      const data = await DEEPSEEK_HISTORY.get('chats', 'json');
      return data || [];
    }
  } catch (e) {}
  return [
    {
      id: '1',
      title: 'سلام',
      messages: [
        { role: 'user', content: 'سلام' },
        { role: 'assistant', content: 'سلام! چطور می‌توانم کمک کنم؟' }
      ],
      timestamp: new Date().toISOString(),
      pinned: false
    },
    {
      id: '2',
      title: 'کد پایتون برای مرتب‌سازی',
      messages: [
        { role: 'user', content: 'یک تابع مرتب‌سازی در پایتون بنویس' },
        { role: 'assistant', content: 'def quick_sort(arr):\\n    if len(arr) <= 1:\\n        return arr\\n    pivot = arr[0]\\n    left = [x for x in arr[1:] if x <= pivot]\\n    right = [x for x in arr[1:] if x > pivot]\\n    return quick_sort(left) + [pivot] + quick_sort(right)' }
      ],
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      pinned: true
    }
  ];
}

async function getChatFromKV(id) {
  const chats = await getChatsFromKV();
  return chats.find(c => c.id === id) || null;
}

async function saveChatToKV(chat) {
  const chats = await getChatsFromKV();
  const index = chats.findIndex(c => c.id === chat.id);
  if (index >= 0) {
    chats[index] = chat;
  } else {
    chats.unshift(chat);
  }
  if (typeof DEEPSEEK_HISTORY !== 'undefined') {
    await DEEPSEEK_HISTORY.put('chats', JSON.stringify(chats));
  }
}

async function deleteChatFromKV(id) {
  const chats = await getChatsFromKV();
  const filtered = chats.filter(c => c.id !== id);
  if (typeof DEEPSEEK_HISTORY !== 'undefined') {
    await DEEPSEEK_HISTORY.put('chats', JSON.stringify(filtered));
  }
}
