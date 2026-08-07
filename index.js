// ============================================================
// Cloudflare Worker شبیه‌سازی کامل اپلیکیشن DeepSeek
// ============================================================

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

// ============================================================
// تنظیمات
// ============================================================
const CONFIG = {
  // API کلید (در Environment Variables تنظیم کنید)
  API_KEY: 'YOUR_API_KEY_HERE',
  
  // API‌های پشتیبانی شده
  API_ENDPOINTS: {
    deepseek: 'https://api.deepseek.com/v1/chat/completions',
    together: 'https://api.together.xyz/v1/chat/completions',
    openrouter: 'https://openrouter.ai/api/v1/chat/completions'
  },
  
  // مدل پیش‌فرض
  DEFAULT_MODEL: 'deepseek-ai/deepseek-coder-6.7b-instruct',
  
  // ذخیره‌سازی (KV Namespace)
  KV_NAMESPACE: 'DEEPSEEK_HISTORY'
};

// ============================================================
// هندلر اصلی
// ============================================================
async function handleRequest(request) {
  const url = new URL(request.url);
  const path = url.pathname;

  // مدیریت CORS
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  // مسیریابی
  try {
    switch (path) {
      case '/':
      case '/index.html':
        return serveMainUI();
      
      case '/chat':
        return handleChat(request);
      
      case '/history':
        return getHistory(request);
      
      case '/search':
        return searchMessages(request);
      
      case '/delete':
        return deleteChat(request);
      
      case '/voice':
        return handleVoice(request);
      
      case '/settings':
        return handleSettings(request);
      
      case '/health':
        return new Response(JSON.stringify({ 
          status: 'healthy', 
          version: '2.2.2',
          timestamp: new Date().toISOString()
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      
      default:
        return new Response('Not Found', { status: 404 });
    }
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// ============================================================
// صفحه اصلی (UI کامل)
// ============================================================
async function serveMainUI() {
  const html = `
<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <title>DeepSeek Coder - دستیار هوشمند</title>
  <style>
    /* ===== استایل‌های کامل ===== */
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

    /* ===== اسکرول‌بار ===== */
    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: var(--text-muted); border-radius: 3px; }
    ::-webkit-scrollbar-thumb:hover { background: var(--text-secondary); }

    /* ===== هدر ===== */
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
    .header-brand {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .header-brand h1 {
      font-size: 20px;
      font-weight: 700;
      background: linear-gradient(135deg, #58a6ff, #238636);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .header-status {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      color: var(--text-secondary);
    }
    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      display: inline-block;
    }
    .status-dot.online { background: var(--green); }
    .status-dot.offline { background: var(--red); }
    .status-dot.loading { background: var(--orange); animation: pulse 0.8s infinite; }
    
    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.5; transform: scale(0.8); }
    }

    .header-actions {
      display: flex;
      gap: 8px;
      align-items: center;
    }
    .header-actions button {
      background: none;
      border: none;
      color: var(--text-secondary);
      font-size: 20px;
      cursor: pointer;
      padding: 6px 10px;
      border-radius: 8px;
      transition: all 0.2s;
    }
    .header-actions button:hover {
      background: var(--bg-hover);
      color: var(--text-primary);
    }

    /* ===== بدنه ===== */
    .app-body {
      display: flex;
      flex: 1;
      overflow: hidden;
    }

    /* ===== سایدبار ===== */
    .sidebar {
      width: 280px;
      background: var(--bg-secondary);
      border-left: 1px solid var(--border-color);
      display: flex;
      flex-direction: column;
      flex-shrink: 0;
      overflow: hidden;
    }
    @media (max-width: 768px) {
      .sidebar {
        display: none;
        position: fixed;
        top: 0;
        left: 0;
        bottom: 0;
        width: 100%;
        z-index: 200;
        border-left: none;
        border-right: 1px solid var(--border-color);
      }
      .sidebar.open {
        display: flex;
      }
    }

    .sidebar-header {
      padding: 12px 16px;
      border-bottom: 1px solid var(--border-color);
      display: flex;
      gap: 8px;
      align-items: center;
    }
    .sidebar-header input {
      flex: 1;
      padding: 8px 12px;
      background: var(--bg-primary);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      color: var(--text-primary);
      font-size: 14px;
    }
    .sidebar-header input:focus {
      outline: none;
      border-color: var(--blue);
    }
    .sidebar-header input::placeholder {
      color: var(--text-muted);
    }
    .sidebar-header .close-sidebar {
      display: none;
      background: none;
      border: none;
      color: var(--text-secondary);
      font-size: 24px;
      cursor: pointer;
    }
    @media (max-width: 768px) {
      .sidebar-header .close-sidebar {
        display: block;
      }
    }

    .chat-list {
      flex: 1;
      overflow-y: auto;
      padding: 8px 12px;
    }

    .chat-item {
      padding: 10px 12px;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.15s;
      margin-bottom: 2px;
      position: relative;
    }
    .chat-item:hover {
      background: var(--bg-hover);
    }
    .chat-item.active {
      background: var(--bg-hover);
      border-right: 3px solid var(--blue);
    }
    .chat-item.pinned {
      border-right: 3px solid var(--orange);
    }
    .chat-item .title {
      font-size: 14px;
      font-weight: 500;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .chat-item .title .pin-icon {
      color: var(--orange);
      font-size: 12px;
    }
    .chat-item .preview {
      font-size: 12px;
      color: var(--text-secondary);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      margin-top: 2px;
    }
    .chat-item .timestamp {
      font-size: 10px;
      color: var(--text-muted);
      margin-top: 2px;
    }
    .chat-item .delete-btn {
      position: absolute;
      right: 8px;
      top: 50%;
      transform: translateY(-50%);
      background: none;
      border: none;
      color: var(--text-muted);
      cursor: pointer;
      display: none;
      font-size: 14px;
    }
    .chat-item:hover .delete-btn {
      display: block;
    }
    .chat-item .delete-btn:hover {
      color: var(--red);
    }

    .sidebar-footer {
      padding: 12px 16px;
      border-top: 1px solid var(--border-color);
      font-size: 12px;
      color: var(--text-muted);
      text-align: center;
    }

    /* ===== منطقه چت ===== */
    .main {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-width: 0;
      background: var(--bg-primary);
    }

    .chat-area {
      flex: 1;
      overflow-y: auto;
      padding: 20px 24px;
      scroll-behavior: smooth;
    }
    @media (max-width: 768px) {
      .chat-area { padding: 12px 16px; }
    }

    .message {
      margin-bottom: 16px;
      display: flex;
      gap: 12px;
      animation: fadeIn 0.3s ease;
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .message.user {
      flex-direction: row-reverse;
    }
    .message .avatar {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
      flex-shrink: 0;
      user-select: none;
    }
    .message.user .avatar {
      background: var(--blue);
    }
    .message.assistant .avatar {
      background: var(--green);
    }
    .message .content {
      background: var(--bg-secondary);
      padding: 12px 16px;
      border-radius: 14px;
      max-width: 80%;
      border: 1px solid var(--border-color);
      line-height: 1.7;
      font-size: 15px;
      word-wrap: break-word;
      overflow-wrap: break-word;
    }
    .message.user .content {
      background: var(--blue);
      border-color: var(--blue);
      color: white;
    }
    .message .content pre {
      background: var(--bg-primary);
      padding: 12px;
      border-radius: 8px;
      overflow-x: auto;
      margin: 8px 0;
      font-family: 'Courier New', monospace;
      font-size: 13px;
      border: 1px solid var(--border-color);
    }
    .message .content code {
      font-family: 'Courier New', monospace;
      font-size: 13px;
      background: var(--bg-primary);
      padding: 2px 6px;
      border-radius: 4px;
    }
    .message .content .copy-btn {
      background: var(--bg-primary);
      border: 1px solid var(--border-color);
      color: var(--text-secondary);
      padding: 4px 10px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 12px;
      margin-top: 4px;
      transition: all 0.2s;
    }
    .message .content .copy-btn:hover {
      background: var(--bg-hover);
      color: var(--text-primary);
    }

    /* ===== تایپینگ ===== */
    .typing-indicator {
      display: flex;
      gap: 4px;
      padding: 4px 0;
    }
    .typing-indicator span {
      width: 8px;
      height: 8px;
      background: var(--text-secondary);
      border-radius: 50%;
      animation: typingAnim 1.4s infinite;
    }
    .typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
    .typing-indicator span:nth-child(3) { animation-delay: 0.4s; }
    @keyframes typingAnim {
      0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
      30% { transform: translateY(-8px); opacity: 1; }
    }

    /* ===== ورودی ===== */
    .input-area {
      padding: 12px 20px 16px;
      border-top: 1px solid var(--border-color);
      display: flex;
      gap: 12px;
      align-items: flex-end;
      background: var(--bg-primary);
      flex-shrink: 0;
    }
    @media (max-width: 768px) {
      .input-area { padding: 8px 12px 12px; gap: 8px; }
    }

    .input-wrapper {
      flex: 1;
      position: relative;
      display: flex;
      align-items: flex-end;
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 14px;
      transition: border-color 0.2s;
    }
    .input-wrapper:focus-within {
      border-color: var(--blue);
    }
    .input-wrapper textarea {
      flex: 1;
      padding: 10px 14px;
      background: transparent;
      border: none;
      color: var(--text-primary);
      resize: none;
      font-size: 15px;
      font-family: inherit;
      min-height: 44px;
      max-height: 200px;
      line-height: 1.5;
      outline: none;
    }
    .input-wrapper textarea::placeholder {
      color: var(--text-muted);
    }
    .input-wrapper .input-actions {
      display: flex;
      gap: 4px;
      padding: 4px 8px;
      align-items: center;
    }
    .input-wrapper .input-actions button {
      background: none;
      border: none;
      color: var(--text-muted);
      cursor: pointer;
      padding: 6px 8px;
      border-radius: 8px;
      font-size: 18px;
      transition: all 0.2s;
    }
    .input-wrapper .input-actions button:hover {
      background: var(--bg-hover);
      color: var(--text-primary);
    }

    .send-btn {
      padding: 10px 24px;
      background: var(--green);
      color: white;
      border: none;
      border-radius: 14px;
      cursor: pointer;
      font-weight: 600;
      font-size: 15px;
      transition: all 0.2s;
      white-space: nowrap;
      height: 48px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .send-btn:hover:not(:disabled) {
      background: var(--green-hover);
      transform: scale(1.02);
    }
    .send-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none;
    }

    /* ===== مودال تنظیمات ===== */
    .modal-overlay {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.7);
      z-index: 1000;
      align-items: center;
      justify-content: center;
      backdrop-filter: blur(4px);
    }
    .modal-overlay.open {
      display: flex;
    }
    .modal-content {
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 20px;
      padding: 28px;
      max-width: 440px;
      width: 92%;
      max-height: 85vh;
      overflow-y: auto;
      animation: modalIn 0.3s ease;
    }
    @keyframes modalIn {
      from { opacity: 0; transform: scale(0.95) translateY(10px); }
      to { opacity: 1; transform: scale(1) translateY(0); }
    }
    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }
    .modal-header h2 {
      font-size: 22px;
      font-weight: 700;
    }
    .modal-header .close-modal {
      background: none;
      border: none;
      color: var(--text-secondary);
      font-size: 28px;
      cursor: pointer;
      padding: 0 4px;
    }
    .modal-header .close-modal:hover {
      color: var(--text-primary);
    }

    .setting-group {
      margin-bottom: 20px;
    }
    .setting-group label {
      display: block;
      font-size: 13px;
      color: var(--text-secondary);
      margin-bottom: 4px;
    }
    .setting-item {
      padding: 12px 0;
      border-bottom: 1px solid var(--border-color);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .setting-item:last-child {
      border-bottom: none;
    }
    .setting-item .label {
      font-size: 14px;
    }
    .setting-item .value {
      color: var(--text-secondary);
      font-size: 14px;
    }
    .setting-item select,
    .setting-item input[type="range"] {
      background: var(--bg-primary);
      color: var(--text-primary);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 4px 8px;
      font-size: 14px;
    }
    .setting-item select:focus {
      outline: none;
      border-color: var(--blue);
    }
    .setting-item .toggle {
      width: 44px;
      height: 24px;
      background: var(--text-muted);
      border-radius: 12px;
      position: relative;
      cursor: pointer;
      transition: background 0.3s;
    }
    .setting-item .toggle.active {
      background: var(--green);
    }
    .setting-item .toggle::after {
      content: '';
      position: absolute;
      width: 18px;
      height: 18px;
      background: white;
      border-radius: 50%;
      top: 3px;
      left: 3px;
      transition: transform 0.3s;
    }
    .setting-item .toggle.active::after {
      transform: translateX(20px);
    }

    .logout-btn {
      width: 100%;
      padding: 12px;
      background: var(--red);
      color: white;
      border: none;
      border-radius: 12px;
      cursor: pointer;
      font-weight: 600;
      font-size: 15px;
      margin-top: 8px;
      transition: opacity 0.2s;
    }
    .logout-btn:hover {
      opacity: 0.9;
    }

    .version-info {
      text-align: center;
      color: var(--text-muted);
      font-size: 12px;
      margin-top: 16px;
    }

    /* ===== هَمبرگر (موبایل) ===== */
    .hamburger {
      display: none;
      background: none;
      border: none;
      color: var(--text-primary);
      font-size: 24px;
      cursor: pointer;
      padding: 4px 8px;
    }
    @media (max-width: 768px) {
      .hamburger { display: block; }
    }

    /* ===== پاسخگویی ===== */
    @media (max-width: 480px) {
      .header { padding: 8px 12px; }
      .header-brand h1 { font-size: 17px; }
      .message .content { max-width: 90%; font-size: 14px; }
      .send-btn { padding: 8px 16px; font-size: 14px; height: 44px; }
    }
  </style>
</head>
<body>

  <!-- ===== هدر ===== -->
  <header class="header">
    <div class="header-brand">
      <button class="hamburger" onclick="toggleSidebar()">☰</button>
      <h1>🤖 DeepSeek</h1>
    </div>
    <div class="header-status">
      <span id="statusText">آنلاین</span>
      <span class="status-dot online" id="statusDot"></span>
    </div>
    <div class="header-actions">
      <button onclick="openSettings()" title="تنظیمات">⚙️</button>
      <button onclick="newChat()" title="مکالمه جدید">➕</button>
    </div>
  </header>

  <!-- ===== بدنه ===== -->
  <div class="app-body">
    <!-- سایدبار -->
    <aside class="sidebar" id="sidebar">
      <div class="sidebar-header">
        <input type="text" id="searchInput" placeholder="🔍 جستجوی مکالمات..." oninput="searchChats(this.value)">
        <button class="close-sidebar" onclick="toggleSidebar()">✕</button>
      </div>
      <div class="chat-list" id="chatList">
        <!-- آیتم‌های چت توسط JS ساخته می‌شوند -->
      </div>
      <div class="sidebar-footer">
        نسخه 2.2.2 (236)
      </div>
    </aside>

    <!-- منطقه اصلی -->
    <main class="main">
      <div class="chat-area" id="chatArea">
        <!-- پیام‌ها توسط JS ساخته می‌شوند -->
        <div class="message assistant" id="welcomeMessage">
          <div class="avatar">🤖</div>
          <div class="content">
            <strong>سلام! 👋</strong><br>
            من دستیار هوشمند DeepSeek هستم. می‌توانید سوالات برنامه‌نویسی خود را بپرسید یا هر موضوع دیگری.<br>
            <span style="color:var(--text-secondary);font-size:13px;">برای شروع تایپ کنید...</span>
          </div>
        </div>
      </div>

      <!-- ورودی -->
      <div class="input-area">
        <div class="input-wrapper">
          <textarea id="messageInput" rows="1" placeholder="Type a message or hold to speak..." onkeydown="handleKey(event)" oninput="autoResize(this)"></textarea>
          <div class="input-actions">
            <button onclick="startVoice()" title="ورودی صوتی">🎤</button>
            <button onclick="attachFile()" title="ضمیمه">📎</button>
          </div>
        </div>
        <button class="send-btn" id="sendBtn" onclick="sendMessage()">
          <span>ارسال</span>
          <span>➤</span>
        </button>
      </div>
    </main>
  </div>

  <!-- ===== مودال تنظیمات ===== -->
  <div class="modal-overlay" id="settingsModal">
    <div class="modal-content">
      <div class="modal-header">
        <h2>⚙️ تنظیمات</h2>
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
          <span class="label">🎨 ظاهر</span>
          <select id="themeSelect">
            <option value="system">سیستم</option>
            <option value="light">روشن</option>
            <option value="dark">تاریک</option>
          </select>
        </div>
        <div class="setting-item">
          <span class="label">📏 اندازه قلم</span>
          <input type="range" id="fontSizeRange" min="12" max="24" value="16" step="1">
        </div>
        <div class="setting-item">
          <span class="label">🎤 ورودی صوتی</span>
          <div class="toggle active" id="voiceToggle" onclick="toggleVoice()"></div>
        </div>
        <div class="setting-item">
          <span class="label">📌 پین خودکار</span>
          <div class="toggle" id="autoPinToggle" onclick="toggleAutoPin()"></div>
        </div>
      </div>

      <button class="logout-btn" onclick="logout()">🚪 خروج از حساب</button>
      <div class="version-info">نسخه 2.2.2 (236) • ساخته شده با ❤️</div>
    </div>
  </div>

  <!-- ===== جاوااسکریپت کامل ===== -->
  <script>
    // ============================================================
    // STATE
    // ============================================================
    const state = {
      currentChatId: null,
      chats: [],
      messages: [],
      isTyping: false,
      isPinned: false
    };

    // ============================================================
    // DOM REFS
    // ============================================================
    const chatArea = document.getElementById('chatArea');
    const messageInput = document.getElementById('messageInput');
    const sendBtn = document.getElementById('sendBtn');
    const chatList = document.getElementById('chatList');
    const sidebar = document.getElementById('sidebar');
    const searchInput = document.getElementById('searchInput');
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');

    // ============================================================
    // CHAT FUNCTIONS
    // ============================================================
    
    // ارسال پیام
    async function sendMessage() {
      const message = messageInput.value.trim();
      if (!message || state.isTyping) return;

      // حذف پیام خوش‌آمدگویی
      const welcome = document.getElementById('welcomeMessage');
      if (welcome) welcome.remove();

      // نمایش پیام کاربر
      appendMessage('user', message);
      messageInput.value = '';
      messageInput.style.height = 'auto';
      sendBtn.disabled = true;
      state.isTyping = true;
      updateStatus('loading', 'در حال پردازش...');

      // نمایش تایپینگ
      showTyping(true);

      try {
        const response = await fetch('/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [{ role: 'user', content: message }],
            model: 'deepseek-coder',
            temperature: 0.7,
            max_tokens: 2048
          })
        });

        if (!response.ok) {
          const error = await response.text();
          throw new Error('خطا در ارتباط با سرور: ' + response.status);
        }

        const data = await response.json();
        const reply = data.choices?.[0]?.message?.content || 'پاسخی دریافت نشد.';

        showTyping(false);
        appendMessage('assistant', reply);

        // ذخیره در تاریخچه
        saveChat(message, reply);

      } catch (error) {
        showTyping(false);
        appendMessage('assistant', '❌ خطا: ' + error.message);
      } finally {
        state.isTyping = false;
        sendBtn.disabled = false;
        updateStatus('online', 'آنلاین');
        messageInput.focus();
        scrollToBottom();
      }
    }

    // افزودن پیام
    function appendMessage(role, content) {
      const div = document.createElement('div');
      div.className = 'message ' + role;
      
      const avatar = role === 'user' ? '👤' : '🤖';
      const formattedContent = formatContent(content);
      
      div.innerHTML = \`
        <div class="avatar">\${avatar}</div>
        <div class="content">\${formattedContent}</div>
      \`;
      
      chatArea.appendChild(div);
      scrollToBottom();
      
      state.messages.push({ role, content });
    }

    // فرمت کردن محتوا (تشخیص کد)
    function formatContent(content) {
      // تشخیص بلاک‌های کد
      let formatted = content;
      
      // جایگزینی ```code``` با <pre>
      formatted = formatted.replace(/\\\`\\\`\\\`(\\w*)\\n?([\\s\\S]*?)\\n?\\\`\\\`\\\`/g, (match, lang, code) => {
        return \`<pre><code class="language-\${lang}">\${escapeHtml(code.trim())}</code></pre>\`;
      });
      
      // جایگزینی `code` با <code>
      formatted = formatted.replace(/\\\`([^\\\`]+)\\\`/g, (match, code) => {
        return \`<code>\${escapeHtml(code)}</code>\`;
      });
      
      // تبدیل خطوط جدید به <br>
      formatted = formatted.replace(/\\n/g, '<br>');
      
      return formatted;
    }

    // Escape HTML
    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    // نمایش تایپینگ
    function showTyping(show) {
      const existing = document.getElementById('typingIndicator');
      if (show && !existing) {
        const div = document.createElement('div');
        div.className = 'message assistant';
        div.id = 'typingIndicator';
        div.innerHTML = \`
          <div class="avatar">🤖</div>
          <div class="content">
            <div class="typing-indicator">
              <span></span><span></span><span></span>
            </div>
          </div>
        \`;
        chatArea.appendChild(div);
        scrollToBottom();
      } else if (!show && existing) {
        existing.remove();
      }
    }

    // اسکرول به پایین
    function scrollToBottom() {
      setTimeout(() => {
        chatArea.scrollTop = chatArea.scrollHeight;
      }, 50);
    }

    // ============================================================
    // KEYBOARD & INPUT
    // ============================================================
    
    function handleKey(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    }

    function autoResize(el) {
      el.style.height = 'auto';
      el.style.height = el.scrollHeight + 'px';
    }

    // ============================================================
    // HISTORY (ذخیره در KV)
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

    // بارگذاری تاریخچه
    async function loadChats() {
      try {
        const response = await fetch('/history');
        const data = await response.json();
        state.chats = data.chats || [];
        renderChatList();
      } catch (error) {
        console.error('Failed to load chats:', error);
      }
    }

    // رندر لیست مکالمات
    function renderChatList() {
      chatList.innerHTML = '';
      
      if (state.chats.length === 0) {
        chatList.innerHTML = \`
          <div style="text-align:center;color:var(--text-muted);padding:40px 20px;font-size:14px;">
            هیچ مکالمه‌ای وجود ندارد<br>
            <span style="font-size:12px;">برای شروع تایپ کنید...</span>
          </div>
        \`;
        return;
      }

      state.chats.forEach(chat => {
        const div = document.createElement('div');
        div.className = 'chat-item' + (chat.pinned ? ' pinned' : '');
        if (chat.id === state.currentChatId) div.classList.add('active');
        
        const preview = chat.messages?.length > 0 
          ? chat.messages[chat.messages.length - 1].content.slice(0, 50) + '...'
          : 'مکالمه جدید';
        
        div.innerHTML = \`
          <div class="title">
            <span>\${chat.pinned ? '📌 ' : ''}\${chat.title || 'مکالمه جدید'}</span>
            \${chat.pinned ? '<span class="pin-icon">📌</span>' : ''}
          </div>
          <div class="preview">\${preview}</div>
          <div class="timestamp">\${new Date(chat.timestamp).toLocaleDateString('fa-IR')}</div>
          <button class="delete-btn" onclick="deleteChat('\${chat.id}')">🗑️</button>
        \`;
        
        div.addEventListener('click', () => loadChat(chat.id));
        chatList.appendChild(div);
      });
    }

    // بارگذاری یک مکالمه
    async function loadChat(chatId) {
      try {
        const response = await fetch('/history?id=' + chatId);
        const data = await response.json();
        
        if (data.chat) {
          state.currentChatId = chatId;
          state.messages = data.chat.messages || [];
          renderMessages();
          renderChatList();
        }
      } catch (error) {
        console.error('Failed to load chat:', error);
      }
    }

    // رندر پیام‌ها
    function renderMessages() {
      chatArea.innerHTML = '';
      state.messages.forEach(msg => {
        appendMessage(msg.role, msg.content);
      });
      if (state.messages.length === 0) {
        chatArea.innerHTML = \`
          <div class="message assistant" id="welcomeMessage">
            <div class="avatar">🤖</div>
            <div class="content">
              <strong>سلام! 👋</strong><br>
              من دستیار هوشمند DeepSeek هستم. سوالات خود را بپرسید.
            </div>
          </div>
        \`;
      }
      scrollToBottom();
    }

    // حذف مکالمه
    async function deleteChat(chatId) {
      if (!confirm('آیا مطمئن هستید؟')) return;
      
      try {
        await fetch('/delete?id=' + chatId, { method: 'DELETE' });
        state.chats = state.chats.filter(c => c.id !== chatId);
        if (state.currentChatId === chatId) {
          state.currentChatId = null;
          state.messages = [];
          renderMessages();
        }
        renderChatList();
      } catch (error) {
        console.error('Failed to delete chat:', error);
      }
    }

    // جستجو
    function searchChats(query) {
      const items = chatList.querySelectorAll('.chat-item');
      items.forEach(item => {
        const text = item.textContent.toLowerCase();
        item.style.display = text.includes(query.toLowerCase()) ? 'block' : 'none';
      });
    }

    // ============================================================
    // VOICE (ورودی صوتی)
    // ============================================================
    
    function startVoice() {
      if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        alert('مرورگر شما از ورودی صوتی پشتیبانی نمی‌کند.\nلطفاً از Chrome استفاده کنید.');
        return;
      }

      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.lang = 'fa-IR';
      recognition.continuous = false;
      recognition.interimResults = true;

      recognition.onstart = () => {
        messageInput.placeholder = '🎤 در حال گوش دادن...';
        updateStatus('loading', 'در حال ضبط...');
      };

      recognition.onresult = (event) => {
        let transcript = '';
        for (let i = 0; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        messageInput.value = transcript;
        autoResize(messageInput);
      };

      recognition.onend = () => {
        messageInput.placeholder = 'Type a message or hold to speak...';
        updateStatus('online', 'آنلاین');
        if (messageInput.value.trim()) {
          sendMessage();
        }
      };

      recognition.onerror = (event) => {
        console.error('Speech error:', event.error);
        messageInput.placeholder = 'Type a message or hold to speak...';
        updateStatus('online', 'آنلاین');
        if (event.error === 'not-allowed') {
          alert('دسترسی به میکروفون مجاز نیست.');
        }
      };

      recognition.start();
    }

    // ============================================================
    // SETTINGS
    // ============================================================
    
    function openSettings() {
      document.getElementById('settingsModal').classList.add('open');
    }

    function closeSettings() {
      document.getElementById('settingsModal').classList.remove('open');
    }

    // بستن مودال با کلیک روی overlay
    document.getElementById('settingsModal').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) closeSettings();
    });

    // تغییر تم
    document.getElementById('themeSelect').addEventListener('change', (e) => {
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
      // system - از سیستم پیروی می‌کند
    });

    // تغییر اندازه قلم
    document.getElementById('fontSizeRange').addEventListener('input', (e) => {
      const size = e.target.value + 'px';
      document.querySelector('.chat-area').style.fontSize = size;
    });

    // تغییر زبان
    document.getElementById('langSelect').addEventListener('change', (e) => {
      // پیاده‌سازی تغییر زبان
    });

    // Toggle Voice
    function toggleVoice() {
      const toggle = document.getElementById('voiceToggle');
      toggle.classList.toggle('active');
    }

    // Toggle Auto Pin
    function toggleAutoPin() {
      const toggle = document.getElementById('autoPinToggle');
      toggle.classList.toggle('active');
    }

    // ============================================================
    // SIDEBAR (موبایل)
    // ============================================================
    
    function toggleSidebar() {
      sidebar.classList.toggle('open');
    }

    // بستن سایدبار با کلیک خارج
    document.addEventListener('click', (e) => {
      if (window.innerWidth <= 768) {
        if (!sidebar.contains(e.target) && e.target.closest('.hamburger') === null) {
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
      if (window.innerWidth <= 768) {
        sidebar.classList.remove('open');
      }
    }

    // ============================================================
    // STATUS
    // ============================================================
    
    function updateStatus(status, text) {
      statusDot.className = 'status-dot ' + status;
      statusText.textContent = text;
    }

    // ============================================================
    // LOGOUT
    // ============================================================
    
    function logout() {
      if (confirm('آیا مطمئن هستید که می‌خواهید خارج شوید؟')) {
        // پاک کردن داده‌های محلی
        localStorage.clear();
        // هدایت به صفحه اصلی
        window.location.reload();
      }
    }

    // ============================================================
    // ATTACH FILE (ضمیمه)
    // ============================================================
    
    function attachFile() {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.txt,.js,.py,.java,.cpp,.html,.css,.json';
      input.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            const content = event.target.result;
            messageInput.value = \`محتویات فایل \${file.name}:\n\\\`\\\`\\\`\n\${content}\n\\\`\\\`\\\`\`;
            autoResize(messageInput);
          };
          reader.readAsText(file);
        }
      };
      input.click();
    }

    // ============================================================
    // KEYBOARD SHORTCUTS
    // ============================================================
    
    document.addEventListener('keydown', (e) => {
      // Ctrl+K = جستجو
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchInput.focus();
      }
      // Escape = بستن مودال
      if (e.key === 'Escape') {
        closeSettings();
        if (sidebar.classList.contains('open')) {
          sidebar.classList.remove('open');
        }
      }
    });

    // ============================================================
    // INIT
    // ============================================================
    
    document.addEventListener('DOMContentLoaded', () => {
      loadChats();
      messageInput.focus();
      
      // چک کردن API
      fetch('/health')
        .then(res => res.json())
        .then(data => {
          updateStatus('online', 'آنلاین');
        })
        .catch(() => {
          updateStatus('offline', 'آفلاین');
        });
    });

    // Auto-resize on input
    messageInput.addEventListener('input', () => autoResize(messageInput));

    // Click on chat area to focus input
    chatArea.addEventListener('click', () => messageInput.focus());

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
    window.toggleAutoPin = toggleAutoPin;
  </script>
</body>
</html>
  `;

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html',
      'Cache-Control': 'public, max-age=3600',
    }
  });
}

// ============================================================
// API HANDLERS
// ============================================================

// ===== چت =====
async function handleChat(request) {
  try {
    const body = await request.json();
    const { messages, model = 'deepseek-coder', temperature = 0.7, max_tokens = 2048 } = body;

    // دریافت API Key از Environment Variables
    const apiKey = CONFIG.API_KEY || 'YOUR_API_KEY';
    
    // استفاده از Together.ai (رایگان)
    const response = await fetch(CONFIG.API_ENDPOINTS.together, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
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
      throw new Error(`API Error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    return new Response(JSON.stringify(data), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (error) {
    return new Response(JSON.stringify({ 
      error: error.message,
      choices: [{ message: { content: '⚠️ خطا در ارتباط با API. لطفاً بعداً تلاش کنید.' } }]
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}

// ===== تاریخچه (KV Storage) =====
async function getHistory(request) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    
    // اگر KV در دسترس نباشد، از حافظه موقت استفاده می‌کنیم
    // برای استفاده واقعی، KV Namespace را تنظیم کنید
    
    if (id) {
      // دریافت یک مکالمه خاص
      const chat = await getChatFromKV(id);
      return new Response(JSON.stringify({ chat }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } else {
      // دریافت لیست مکالمات
      const chats = await getChatsFromKV();
      return new Response(JSON.stringify({ chats }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message, chats: [] }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// ===== ذخیره تاریخچه =====
async function saveHistory(request) {
  try {
    const chat = await request.json();
    await saveChatToKV(chat);
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

// ===== حذف مکالمه =====
async function deleteChat(request) {
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

// ===== توابع KV (placeholder) =====
// برای استفاده واقعی، KV Namespace را در تنظیمات Worker اضافه کنید

async function getChatsFromKV() {
  // در صورت وجود KV
  if (typeof DEEPSEEK_HISTORY !== 'undefined') {
    const data = await DEEPSEEK_HISTORY.get('chats', 'json');
    return data || [];
  }
  // fallback: داده‌های نمونه
  return [
    {
      id: '1',
      title: 'سلام',
      messages: [{ role: 'user', content: 'سلام' }, { role: 'assistant', content: 'سلام! چطور می‌توانم کمک کنم؟' }],
      timestamp: new Date().toISOString(),
      pinned: false
    },
    {
      id: '2',
      title: 'کد پایتون برای مرتب‌سازی',
      messages: [{ role: 'user', content: 'یک تابع مرتب‌سازی در پایتون بنویس' }, { role: 'assistant', content: 'def quick_sort(arr): ...' }],
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

// ===== Voice Handler =====
async function handleVoice(request) {
  // پیاده‌سازی تبدیل صدا به متن (با استفاده از APIهای خارجی)
  return new Response(JSON.stringify({ text: 'نمونه متن از صدا' }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

// ===== Settings Handler =====
async function handleSettings(request) {
  if (request.method === 'GET') {
    const settings = await getSettingsFromKV();
    return new Response(JSON.stringify(settings), {
      headers: { 'Content-Type': 'application/json' }
    });
  } else if (request.method === 'POST') {
    const settings = await request.json();
    await saveSettingsToKV(settings);
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function getSettingsFromKV() {
  if (typeof DEEPSEEK_HISTORY !== 'undefined') {
    const settings = await DEEPSEEK_HISTORY.get('settings', 'json');
    return settings || { language: 'fa', theme: 'dark', fontSize: 16, voiceInput: true };
  }
  return { language: 'fa', theme: 'dark', fontSize: 16, voiceInput: true };
}

async function saveSettingsToKV(settings) {
  if (typeof DEEPSEEK_HISTORY !== 'undefined') {
    await DEEPSEEK_HISTORY.put('settings', JSON.stringify(settings));
  }
}
