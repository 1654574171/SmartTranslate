// background.js - Service Worker
// 负责调用大模型 API 翻译（避免 content script 的 CORS 限制）
const PDF_VIEWER_PATH = 'pdf-viewer.html';
const pdfBypassTabs = new Map();

chrome.webNavigation.onCommitted.addListener((details) => {
  if (details.frameId !== 0 || !isPdfUrl(details.url)) return;
  openPdfInViewer(details.tabId, details.url);
});

chrome.webRequest.onHeadersReceived.addListener(
  (details) => {
    if (details.tabId < 0 || !isPdfResponse(details.responseHeaders)) return;
    openPdfInViewer(details.tabId, details.url);
  },
  { urls: ['http://*/*', 'https://*/*', 'file://*/*'], types: ['main_frame'] },
  ['responseHeaders']
);

function openPdfInViewer(tabId, url) {
  if (shouldBypassPdfViewer(tabId, url)) {
    return;
  }

  const viewerUrl = chrome.runtime.getURL(
    `${PDF_VIEWER_PATH}?src=${encodeURIComponent(url)}`
  );

  chrome.tabs.update(tabId, { url: viewerUrl });
}

function shouldBypassPdfViewer(tabId, url) {
  const bypass = pdfBypassTabs.get(tabId);
  if (!bypass) return false;

  if (bypass.url !== url || bypass.expiresAt < Date.now()) {
    pdfBypassTabs.delete(tabId);
    return false;
  }

  bypass.remaining -= 1;
  if (bypass.remaining <= 0) {
    pdfBypassTabs.delete(tabId);
  } else {
    pdfBypassTabs.set(tabId, bypass);
  }

  return true;
}

function isPdfUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'chrome-extension:') return false;
    if (!['http:', 'https:', 'file:'].includes(parsed.protocol)) return false;
    return parsed.pathname.toLowerCase().endsWith('.pdf');
  } catch (err) {
    return false;
  }
}

function isPdfResponse(headers = []) {
  return headers.some((header) => {
    const name = header.name?.toLowerCase();
    const value = header.value?.toLowerCase() || '';
    return (
      (name === 'content-type' && value.includes('application/pdf')) ||
      (name === 'content-disposition' && value.includes('.pdf'))
    );
  });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'openOriginalPdf' && request.url && sender.tab?.id) {
    pdfBypassTabs.set(sender.tab.id, {
      url: request.url,
      remaining: 2,
      expiresAt: Date.now() + 15000
    });
    chrome.tabs.update(sender.tab.id, { url: request.url });
    sendResponse({ success: true });
    return false;
  }

  if (request.action === 'translate') {
    handleTranslate(request.text, request.targetLang)
      .then(result => sendResponse({ success: true, translation: result }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true; // 保持消息通道开放（异步响应）
  }
  if (request.action === 'getSettings') {
    chrome.storage.sync.get(getDefaultSettings(), (settings) => {
      sendResponse(settings);
    });
    return true;
  }
});

function getDefaultSettings() {
  return {
    provider: 'deepseek',
    deepseekApiKey: '',
    minimaxApiKey: '',
    minimaxGroupId: '',
    targetLang: 'zh-CN',
    sourceLang: 'auto',
    model: 'deepseek-v4-flash',
    enableFloatButton: true,
    autoTranslate: false,
    enableHoverTranslate: false,
    hoverTranslateKey: 'shift',
    inlineTranslationStyle: 'quote',
    maxTokens: 300,
    temperature: 0.3,
    translationDomain: 'general',
    customPrompt: ''
  };
}

async function handleTranslate(text, targetLangOverride) {
  const settings = await new Promise(resolve =>
    chrome.storage.sync.get(getDefaultSettings(), resolve)
  );

  const targetLang = targetLangOverride || settings.targetLang;
  const provider = settings.provider;

  if (provider === 'deepseek') {
    return await translateWithDeepSeek(text, targetLang, settings);
  } else if (provider === 'minimax') {
    return await translateWithMiniMax(text, targetLang, settings);
  } else {
    throw new Error('未配置翻译服务商');
  }
}

function buildTranslationPrompt(targetLangName, settings) {
  const domainInstruction = getDomainInstruction(settings.translationDomain);
  const customPrompt = (settings.customPrompt || '').trim();

  return [
    `你是一位专业翻译，请将用户提供的文本翻译成${targetLangName}。要求：`,
    '1. 只输出译文，不要加解释或注释',
    '2. 保持原文的语气、结构和风格',
    '3. 专业术语保持准确，不确定时保留原文术语',
    '4. 如果是单个词，同时给出词性和简短例句（用换行隔开）',
    domainInstruction ? `领域要求：${domainInstruction}` : '',
    customPrompt ? `用户自定义要求：${customPrompt}` : ''
  ].filter(Boolean).join('\n');
}

function getDomainInstruction(domain) {
  const domainMap = {
    general: '',
    cs: '面向计算机科学、软件工程、人工智能、网络、数据库和系统文档翻译。准确处理 API、CLI、变量名、函数名、协议、算法和论文术语；代码、命令、配置项、文件路径和英文缩写通常保持原文。',
    medical: '面向医学、药学、临床、生命科学和医疗文档翻译。优先使用规范医学术语，准确处理疾病、症状、药物、剂量、检查指标、解剖结构和诊疗流程；不要自行补充诊断或治疗建议。',
    finance: '面向金融、会计、投资、宏观经济和商业文档翻译。准确处理财务指标、证券、衍生品、估值、风险、监管和市场术语；保留数字、单位、币种和比例。',
    legal: '面向法律、合同、合规和政策文本翻译。保持条款结构和法律语气，准确处理权利义务、责任、期限、管辖、定义和例外；不要扩写法律意见。',
    academic: '面向学术论文、研究报告和技术材料翻译。保持严谨、中性、正式的学术表达，准确处理摘要、方法、实验、结果、引用和术语；不要改写结论。'
  };

  return domainMap[domain] || domainMap.general;
}

// ── DeepSeek 翻译 ──────────────────────────────────────────────
async function translateWithDeepSeek(text, targetLang, settings) {
  if (!settings.deepseekApiKey) throw new Error('请先在设置中填写 DeepSeek API Key');

  const langMap = {
    'zh-CN': '简体中文',
    'zh-TW': '繁体中文',
    'en': '英文',
    'ja': '日文',
    'ko': '韩文',
    'fr': '法文',
    'de': '德文',
    'es': '西班牙文',
    'ru': '俄文',
    'ar': '阿拉伯文'
  };
  const targetLangName = langMap[targetLang] || targetLang;

  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${settings.deepseekApiKey}`
    },
    body: JSON.stringify({
      model: settings.model || 'deepseek-v4-flash',
      messages: [
        {
          role: 'system',
          content: buildTranslationPrompt(targetLangName, settings)
        },
        {
          role: 'user',
          content: text
        }
      ],
      max_tokens: settings.maxTokens || 300,
      temperature: settings.temperature || 0.3
    })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`DeepSeek API 错误: ${err.error?.message || response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || '翻译结果为空';
}

// ── MiniMax 翻译 ──────────────────────────────────────────────
async function translateWithMiniMax(text, targetLang, settings) {
  if (!settings.minimaxApiKey) throw new Error('请先在设置中填写 MiniMax API Key');
  if (!settings.minimaxGroupId) throw new Error('请先在设置中填写 MiniMax Group ID');

  const langMap = {
    'zh-CN': '简体中文',
    'zh-TW': '繁体中文',
    'en': '英语',
    'ja': '日语',
    'ko': '韩语',
    'fr': '法语',
    'de': '德语',
    'es': '西班牙语',
    'ru': '俄语',
    'ar': '阿拉伯语'
  };
  const targetLangName = langMap[targetLang] || targetLang;

  const response = await fetch(
    `https://api.minimax.chat/v1/text/chatcompletion_v2?GroupId=${settings.minimaxGroupId}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.minimaxApiKey}`
      },
      body: JSON.stringify({
        model: 'abab6.5s-chat',
        messages: [
          {
            role: 'system',
            content: buildTranslationPrompt(targetLangName, settings)
          },
          {
            role: 'user',
            content: text
          }
        ],
        max_tokens: settings.maxTokens || 300,
        temperature: settings.temperature || 0.3
      })
    }
  );

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`MiniMax API 错误: ${err.base_resp?.status_msg || response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || '翻译结果为空';
}
