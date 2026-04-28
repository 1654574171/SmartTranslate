// background.js - Service Worker
// 负责调用大模型 API 翻译（避免 content script 的 CORS 限制）

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
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
    model: 'deepseek-chat',
    enableFloatButton: true,
    autoTranslate: false,
    maxTokens: 300,
    temperature: 0.3
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
      model: settings.model || 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content: `你是一位专业翻译，请将用户提供的文本翻译成${targetLangName}。要求：
1. 只输出译文，不要加解释或注释
2. 保持原文的语气和风格
3. 专业术语保持准确
4. 如果是单个词，同时给出词性和简短例句（用换行隔开）`
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
            content: `你是一位专业翻译，将用户的文本精准翻译成${targetLangName}，只输出译文。`
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
