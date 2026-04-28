// popup.js

const DEFAULT_SETTINGS = {
  provider: 'deepseek',
  deepseekApiKey: '',
  minimaxApiKey: '',
  targetLang: 'zh-CN',
  sourceLang: 'auto',
  model: 'deepseek-chat'
};

// ── DOM 引用 ──────────────────────────────────────────────────
const inputText = document.getElementById('inputText');
const clearBtn = document.getElementById('clearBtn');
const translateBtn = document.getElementById('translateBtn');
const sourceLangSelect = document.getElementById('sourceLang');
const targetLangSelect = document.getElementById('targetLangPopup');
const resultPlaceholder = document.getElementById('resultPlaceholder');
const resultLoading = document.getElementById('resultLoading');
const resultText = document.getElementById('resultText');
const resultError = document.getElementById('resultError');
const resultActions = document.getElementById('resultActions');
const copyResultBtn = document.getElementById('copyResultBtn');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');

// ── 初始化 ──────────────────────────────────────────────────
async function init() {
  const settings = await getSettings();
  if (settings.targetLang) targetLangSelect.value = settings.targetLang;

  // 检查 API Key 状态
  const hasKey = settings.provider === 'minimax'
    ? !!settings.minimaxApiKey
    : !!settings.deepseekApiKey;

  if (!hasKey) {
    setStatus('warn', '未配置 API Key');
  } else {
    const providerName = settings.provider === 'minimax' ? 'MiniMax' : 'DeepSeek';
    setStatus('ok', `${providerName} 已就绪`);
  }
}

function getSettings() {
  return new Promise(resolve =>
    chrome.storage.sync.get(DEFAULT_SETTINGS, resolve)
  );
}

function setStatus(type, text) {
  statusDot.className = `status-dot ${type}`;
  statusText.textContent = text;
}

// ── 翻译 ──────────────────────────────────────────────────
async function doTranslate() {
  const text = inputText.value.trim();
  if (!text) return;

  // 显示加载
  resultPlaceholder.style.display = 'none';
  resultLoading.style.display = 'flex';
  resultText.style.display = 'none';
  resultError.style.display = 'none';
  resultActions.style.display = 'none';
  translateBtn.disabled = true;

  try {
    const targetLang = targetLangSelect.value;
    const result = await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        { action: 'translate', text, targetLang },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else if (response?.success) {
            resolve(response.translation);
          } else {
            reject(new Error(response?.error || '翻译失败'));
          }
        }
      );
    });

    resultLoading.style.display = 'none';
    resultText.style.display = 'block';
    resultText.innerHTML = result
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>');
    resultActions.style.display = 'flex';
    setStatus('ok', '翻译完成');

  } catch (err) {
    resultLoading.style.display = 'none';
    resultError.style.display = 'flex';
    resultError.textContent = err.message;
    setStatus('error', '翻译失败');
  }

  translateBtn.disabled = false;
}

// ── 复制 ──────────────────────────────────────────────────
copyResultBtn.addEventListener('click', () => {
  const text = resultText.textContent;
  if (!text) return;
  navigator.clipboard.writeText(text).then(() => {
    copyResultBtn.textContent = '✓ 已复制';
    setTimeout(() => {
      copyResultBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z" fill="currentColor"/></svg>
        复制
      `;
    }, 1500);
  });
});

// ── 清空 ──────────────────────────────────────────────────
clearBtn.addEventListener('click', () => {
  inputText.value = '';
  resultPlaceholder.style.display = 'flex';
  resultText.style.display = 'none';
  resultError.style.display = 'none';
  resultActions.style.display = 'none';
  resultLoading.style.display = 'none';
  inputText.focus();
});

// ── 快捷键 ──────────────────────────────────────────────
inputText.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') doTranslate();
});

translateBtn.addEventListener('click', doTranslate);

// ── 设置跳转 ──────────────────────────────────────────────
document.getElementById('openSettings').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

document.getElementById('openOptions').addEventListener('click', (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

// ── 启动 ──────────────────────────────────────────────────
init();
