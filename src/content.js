// content.js - 划词翻译核心逻辑

(function () {
  'use strict';

  // ── 状态变量 ──────────────────────────────────────────────
  let floatPanel = null;        // 悬浮翻译框
  let floatButton = null;       // 小图标按钮
  let lastSelectedText = '';
  let hideTimer = null;
  let settings = {};
  let extensionContextValid = true;

  const defaultSettings = {
    provider: 'deepseek',
    deepseekApiKey: '',
    minimaxApiKey: '',
    minimaxGroupId: '',
    targetLang: 'zh-CN',
    sourceLang: 'auto',
    model: 'deepseek-chat',
    enableFloatButton: true,
    autoTranslate: false,
    maxTokens: 300,
    temperature: 0.3
  };

  // 拖拽状态
  let isDragging = false;
  let dragOffsetX = 0;
  let dragOffsetY = 0;

  // ── 初始化 ──────────────────────────────────────────────
  async function init() {
    settings = await getSettings().catch(() => ({ ...defaultSettings }));
    createFloatButton();
    createFloatPanel();
    bindEvents();
  }

  async function getSettings() {
    const response = await sendRuntimeMessage({ action: 'getSettings' });
    return { ...defaultSettings, ...(response || {}) };
  }

  function sendRuntimeMessage(message) {
    return new Promise((resolve, reject) => {
      if (!extensionContextValid || typeof chrome === 'undefined' || !chrome.runtime?.id) {
        reject(new Error('插件已重新加载，请刷新当前页面后再使用翻译功能'));
        return;
      }

      try {
        chrome.runtime.sendMessage(message, (response) => {
          const runtimeError = chrome.runtime.lastError;
          if (runtimeError) {
            const err = new Error(runtimeError.message);
            if (runtimeError.message?.includes('Extension context invalidated')) {
              extensionContextValid = false;
            }
            reject(err);
            return;
          }
          resolve(response);
        });
      } catch (err) {
        if (err.message?.includes('Extension context invalidated')) {
          extensionContextValid = false;
          reject(new Error('插件已重新加载，请刷新当前页面后再使用翻译功能'));
          return;
        }
        reject(err);
      }
    });
  }

  // ── 创建悬浮小按钮 ──────────────────────────────────────
  function createFloatButton() {
    floatButton = document.createElement('div');
    floatButton.id = 'smart-translate-btn';
    floatButton.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12.87 15.07l-2.54-2.51.03-.03c1.74-1.94 2.98-4.17 3.71-6.53H17V4h-7V2H8v2H1v1.99h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z" fill="currentColor"/>
      </svg>
    `;
    floatButton.style.display = 'none';
    document.body.appendChild(floatButton);

    floatButton.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (lastSelectedText) {
        showPanel(lastSelectedText);
        floatButton.style.display = 'none';
      }
    });

    floatButton.addEventListener('mouseenter', () => {
      clearTimeout(hideTimer);
    });
  }

  // ── 创建悬浮翻译面板 ──────────────────────────────────────
  function createFloatPanel() {
    floatPanel = document.createElement('div');
    floatPanel.id = 'smart-translate-panel';
    floatPanel.innerHTML = `
      <div class="stp-header">
        <div class="stp-header-left">
          <span class="stp-logo">
            <svg viewBox="0 0 24 24" fill="none"><path d="M12.87 15.07l-2.54-2.51.03-.03c1.74-1.94 2.98-4.17 3.71-6.53H17V4h-7V2H8v2H1v1.99h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z" fill="currentColor"/></svg>
          </span>
          <span class="stp-title">SmartTranslate</span>
        </div>
        <div class="stp-header-right">
          <select class="stp-lang-select" id="stp-target-lang">
            <option value="zh-CN">中文</option>
            <option value="en">English</option>
            <option value="ja">日本語</option>
            <option value="ko">한국어</option>
            <option value="fr">Français</option>
            <option value="de">Deutsch</option>
            <option value="es">Español</option>
            <option value="ru">Русский</option>
          </select>
          <button class="stp-icon-btn stp-copy-btn" title="复制译文" id="stp-copy-btn">
            <svg viewBox="0 0 24 24" fill="none"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z" fill="currentColor"/></svg>
          </button>
          <button class="stp-icon-btn stp-close-btn" title="关闭" id="stp-close-btn">
            <svg viewBox="0 0 24 24" fill="none"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" fill="currentColor"/></svg>
          </button>
        </div>
      </div>
      <div class="stp-source">
        <span class="stp-source-label">原文</span>
        <div class="stp-source-text" id="stp-source-text"></div>
      </div>
      <div class="stp-divider"></div>
      <div class="stp-result" id="stp-result">
        <div class="stp-loading" id="stp-loading">
          <span class="stp-dot"></span>
          <span class="stp-dot"></span>
          <span class="stp-dot"></span>
        </div>
        <div class="stp-translation" id="stp-translation" style="display:none;"></div>
        <div class="stp-error" id="stp-error" style="display:none;"></div>
      </div>
      <div class="stp-footer">
        <span class="stp-provider" id="stp-provider-label">AI 驱动</span>
        <button class="stp-retranslate-btn" id="stp-retranslate-btn">
          <svg viewBox="0 0 24 24" fill="none"><path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" fill="currentColor"/></svg>
          重新翻译
        </button>
      </div>
    `;
    floatPanel.style.display = 'none';
    document.body.appendChild(floatPanel);

    // 设置默认目标语言
    const langSelect = floatPanel.querySelector('#stp-target-lang');
    if (settings.targetLang) langSelect.value = settings.targetLang;

    // 绑定面板内事件
    floatPanel.querySelector('#stp-close-btn').addEventListener('click', hidePanel);
    floatPanel.querySelector('#stp-copy-btn').addEventListener('click', copyTranslation);
    floatPanel.querySelector('#stp-retranslate-btn').addEventListener('click', () => {
      if (lastSelectedText) doTranslate(lastSelectedText);
    });
    floatPanel.addEventListener('click', e => e.stopPropagation());

    // 阻止面板内选词触发外部逻辑
    floatPanel.addEventListener('mouseup', e => e.stopPropagation());

    // ── 拖拽逻辑（通过 header 区域拖动） ──────────────────
    const header = floatPanel.querySelector('.stp-header');
    header.addEventListener('pointerdown', onDragStart);
  }

  // ── 拖拽事件处理 ──────────────────────────────────────────
  function onDragStart(e) {
    // 右键、或点击到下拉/按钮时不触发拖拽
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (e.target.closest('select, button')) return;

    e.preventDefault();
    e.stopPropagation();

    isDragging = true;
    clearTimeout(hideTimer);

    // 切换为 fixed 定位（相对视口，不随滚动偏移）
    const rect = floatPanel.getBoundingClientRect();
    floatPanel.style.position = 'fixed';
    floatPanel.style.left = `${rect.left}px`;
    floatPanel.style.top = `${rect.top}px`;
    floatPanel.classList.add('stp-dragging');

    // 记录鼠标在面板内的偏移量
    dragOffsetX = e.clientX - rect.left;
    dragOffsetY = e.clientY - rect.top;

    e.currentTarget.setPointerCapture?.(e.pointerId);
    window.addEventListener('pointermove', onDragMove, true);
    window.addEventListener('pointerup', onDragEnd, true);
    window.addEventListener('pointercancel', onDragEnd, true);
  }

  function onDragMove(e) {
    if (!isDragging) return;
    e.preventDefault();
    e.stopPropagation();

    let newX = e.clientX - dragOffsetX;
    let newY = e.clientY - dragOffsetY;

    // 边界限制：不超出视口
    const panelW = floatPanel.offsetWidth;
    const panelH = floatPanel.offsetHeight;
    newX = Math.max(4, Math.min(newX, window.innerWidth - panelW - 4));
    newY = Math.max(4, Math.min(newY, window.innerHeight - panelH - 4));

    floatPanel.style.left = `${newX}px`;
    floatPanel.style.top = `${newY}px`;
  }

  function onDragEnd(e) {
    if (!isDragging) return;
    e.preventDefault();
    e.stopPropagation();

    isDragging = false;
    floatPanel.classList.remove('stp-dragging');
    window.removeEventListener('pointermove', onDragMove, true);
    window.removeEventListener('pointerup', onDragEnd, true);
    window.removeEventListener('pointercancel', onDragEnd, true);
  }

  // ── 绑定全局事件 ──────────────────────────────────────────
  function bindEvents() {
    document.addEventListener('mouseup', onMouseUp);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') hideAll();
    });
    document.addEventListener('click', (e) => {
      if (!floatPanel.contains(e.target) && !floatButton.contains(e.target)) {
        hideAll();
      }
    });
  }

  function onMouseUp(e) {
    if (isDragging) return;

    // 如果点击在面板或按钮内，忽略
    if (floatPanel.contains(e.target) || floatButton.contains(e.target)) return;

    setTimeout(() => {
      const selection = window.getSelection();
      const text = selection?.toString().trim();

      if (!text || text.length < 1) {
        scheduleHide();
        return;
      }

      lastSelectedText = text;
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();

      if (settings.autoTranslate) {
        // 自动翻译：直接弹翻译面板
        positionPanel(rect);
        showPanel(text);
      } else {
        // 非自动翻译：先显示小图标
        positionButton(rect);
        showFloatButton();
      }
    }, 10);
  }

  // ── 定位工具 ──────────────────────────────────────────────
  function positionButton(rect) {
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    const btnSize = 34;

    let x = rect.right + scrollX - btnSize / 2;
    let y = rect.top + scrollY - btnSize - 8;

    // 边界检测
    x = Math.max(scrollX + 4, Math.min(x, scrollX + window.innerWidth - btnSize - 4));
    y = Math.max(scrollY + 4, y);

    floatButton.style.left = `${x}px`;
    floatButton.style.top = `${y}px`;
  }

  function positionPanel(rect) {
    // 每次重新定位时，恢复为 absolute（相对文档流），消除上次拖动残留的 fixed
    floatPanel.style.position = 'absolute';

    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    const panelWidth = 360;
    const panelMinHeight = 180;
    const gap = 12;

    let x = rect.left + scrollX + (rect.width - panelWidth) / 2;
    let y = rect.top + scrollY - panelMinHeight - gap;

    // 如果上方空间不足，显示在下方
    if (rect.top < panelMinHeight + gap + 20) {
      y = rect.bottom + scrollY + gap;
    }

    // 水平边界
    x = Math.max(scrollX + 8, Math.min(x, scrollX + window.innerWidth - panelWidth - 8));

    floatPanel.style.left = `${x}px`;
    floatPanel.style.top = `${y}px`;
  }

  // ── 显示/隐藏 ──────────────────────────────────────────────
  function showFloatButton() {
    clearTimeout(hideTimer);
    floatButton.style.display = 'flex';
    floatButton.classList.add('stp-show');
  }

  function showPanel(text) {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const rect = selection.getRangeAt(0).getBoundingClientRect();
      positionPanel(rect);
    }

    floatPanel.style.display = 'flex';
    requestAnimationFrame(() => floatPanel.classList.add('stp-show'));

    // 填充原文
    const sourceEl = floatPanel.querySelector('#stp-source-text');
    sourceEl.textContent = text.length > 100 ? text.slice(0, 100) + '…' : text;

    // 更新提供商标签
    updateProviderLabel();

    // 开始翻译
    doTranslate(text);
  }

  function updateProviderLabel() {
    const label = floatPanel.querySelector('#stp-provider-label');
    const providerName = settings.provider === 'minimax' ? 'MiniMax' : 'DeepSeek';
    label.textContent = `由 ${providerName} 提供`;
  }

  function hidePanel() {
    floatPanel.classList.remove('stp-show');
    setTimeout(() => {
      if (!floatPanel.classList.contains('stp-show')) {
        floatPanel.style.display = 'none';
      }
    }, 250);
  }

  function hideAll() {
    hidePanel();
    floatButton.classList.remove('stp-show');
    setTimeout(() => {
      if (!floatButton.classList.contains('stp-show')) {
        floatButton.style.display = 'none';
      }
    }, 200);
  }

  function scheduleHide() {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      if (!floatPanel.matches(':hover') && !floatButton.matches(':hover')) {
        hideAll();
      }
    }, 300);
  }

  // ── 翻译逻辑 ──────────────────────────────────────────────
  async function doTranslate(text) {
    const loadingEl = floatPanel.querySelector('#stp-loading');
    const translationEl = floatPanel.querySelector('#stp-translation');
    const errorEl = floatPanel.querySelector('#stp-error');
    const langSelect = floatPanel.querySelector('#stp-target-lang');

    // 重置状态
    loadingEl.style.display = 'flex';
    translationEl.style.display = 'none';
    errorEl.style.display = 'none';
    translationEl.textContent = '';

    // 刷新设置（用户可能刚改过）
    try {
      settings = await getSettings();
      updateProviderLabel();

      const targetLang = langSelect.value;
      const response = await sendRuntimeMessage({ action: 'translate', text, targetLang });
      if (!response?.success) {
        throw new Error(response?.error || '翻译失败');
      }
      const result = response.translation;
      /*
              reject(new Error(response?.error || '翻译失败'));
            }
          }
        );
      });

      */
      loadingEl.style.display = 'none';
      translationEl.style.display = 'block';
      // 支持换行
      translationEl.innerHTML = result
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br>');

    } catch (err) {
      loadingEl.style.display = 'none';
      errorEl.style.display = 'flex';
      errorEl.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" fill="currentColor"/></svg>
        <span>${err.message}</span>
      `;
    }
  }

  function copyTranslation() {
    const translationEl = floatPanel.querySelector('#stp-translation');
    const text = translationEl.textContent;
    if (!text) return;

    navigator.clipboard.writeText(text).then(() => {
      const copyBtn = floatPanel.querySelector('#stp-copy-btn');
      copyBtn.classList.add('stp-copied');
      setTimeout(() => copyBtn.classList.remove('stp-copied'), 1500);
    });
  }

  // ── 启动 ──────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
