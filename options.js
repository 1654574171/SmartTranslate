// options.js - 设置页面逻辑

const DEFAULT_SETTINGS = {
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
  customPrompt: '',
  theme: 'purple'
};

// ── Tab 切换 ──────────────────────────────────────────────────
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', e => {
    e.preventDefault();
    const tab = item.dataset.tab;

    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));

    item.classList.add('active');
    document.getElementById(`tab-${tab}`).classList.add('active');
  });
});

// ── 加载设置 ──────────────────────────────────────────────────
function loadSettings() {
  chrome.storage.sync.get(DEFAULT_SETTINGS, (s) => {
    // 服务商
    const radio = document.querySelector(`input[name="provider"][value="${s.provider}"]`);
    if (radio) radio.checked = true;
    updateProviderSection(s.provider);

    // API Keys
    document.getElementById('deepseekApiKey').value = s.deepseekApiKey || '';
    document.getElementById('minimaxApiKey').value = s.minimaxApiKey || '';
    document.getElementById('minimaxGroupId').value = s.minimaxGroupId || '';

    // 模型
    const modelSelect = document.getElementById('deepseekModel');
    if (modelSelect) modelSelect.value = s.model || 'deepseek-v4-flash';

    // 翻译设置
    document.getElementById('targetLang').value = s.targetLang || 'zh-CN';
    document.getElementById('translationDomain').value = s.translationDomain || 'general';
    document.getElementById('customPrompt').value = s.customPrompt || '';
    document.getElementById('autoTranslate').checked = !!s.autoTranslate;
    document.getElementById('enableFloatButton').checked = s.enableFloatButton !== false;
    document.getElementById('enableHoverTranslate').checked = !!s.enableHoverTranslate;
    document.getElementById('hoverTranslateKey').value = s.hoverTranslateKey || 'shift';
    document.getElementById('inlineTranslationStyle').value = s.inlineTranslationStyle || 'quote';

    // 高级参数
    const maxTokens = document.getElementById('maxTokens');
    const temperature = document.getElementById('temperature');
    maxTokens.value = s.maxTokens || 300;
    temperature.value = s.temperature || 0.3;
    document.getElementById('maxTokensVal').textContent = maxTokens.value;
    document.getElementById('temperatureVal').textContent = parseFloat(temperature.value).toFixed(1);

    // 主题
    const themeRadio = document.querySelector(`input[name="theme"][value="${s.theme || 'purple'}"]`);
    if (themeRadio) themeRadio.checked = true;
  });
}

// ── 服务商切换 ────────────────────────────────────────────────
document.querySelectorAll('input[name="provider"]').forEach(radio => {
  radio.addEventListener('change', () => {
    updateProviderSection(radio.value);
  });
});

function updateProviderSection(provider) {
  const dsSection = document.getElementById('section-deepseek');
  const mmSection = document.getElementById('section-minimax');

  if (provider === 'deepseek') {
    dsSection.style.display = 'block';
    mmSection.style.display = 'none';
  } else if (provider === 'minimax') {
    dsSection.style.display = 'none';
    mmSection.style.display = 'block';
  }
}

// ── 密码可见性切换 ────────────────────────────────────────────
document.querySelectorAll('.toggle-visibility').forEach(btn => {
  btn.addEventListener('click', () => {
    const input = document.getElementById(btn.dataset.target);
    input.type = input.type === 'password' ? 'text' : 'password';
  });
});

// ── Range 实时显示 ────────────────────────────────────────────
document.getElementById('maxTokens').addEventListener('input', function () {
  document.getElementById('maxTokensVal').textContent = this.value;
});

document.getElementById('temperature').addEventListener('input', function () {
  document.getElementById('temperatureVal').textContent = parseFloat(this.value).toFixed(1);
});

// ── 显示 Toast ────────────────────────────────────────────────
function showToast(id) {
  const toast = document.getElementById(id);
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2000);
}

// ── 保存按钮 ──────────────────────────────────────────────────
document.getElementById('saveProviderBtn').addEventListener('click', () => {
  const provider = document.querySelector('input[name="provider"]:checked')?.value || 'deepseek';
  const toSave = {
    provider,
    deepseekApiKey: document.getElementById('deepseekApiKey').value.trim(),
    minimaxApiKey: document.getElementById('minimaxApiKey').value.trim(),
    minimaxGroupId: document.getElementById('minimaxGroupId').value.trim(),
    model: document.getElementById('deepseekModel').value
  };
  chrome.storage.sync.set(toSave, () => showToast('providerToast'));
});

document.getElementById('saveTranslateBtn').addEventListener('click', () => {
  const toSave = {
    targetLang: document.getElementById('targetLang').value,
    translationDomain: document.getElementById('translationDomain').value,
    customPrompt: document.getElementById('customPrompt').value.trim(),
    autoTranslate: document.getElementById('autoTranslate').checked,
    enableFloatButton: document.getElementById('enableFloatButton').checked,
    enableHoverTranslate: document.getElementById('enableHoverTranslate').checked,
    hoverTranslateKey: document.getElementById('hoverTranslateKey').value,
    inlineTranslationStyle: document.getElementById('inlineTranslationStyle').value,
    maxTokens: parseInt(document.getElementById('maxTokens').value),
    temperature: parseFloat(document.getElementById('temperature').value)
  };
  chrome.storage.sync.set(toSave, () => showToast('translateToast'));
});

document.getElementById('saveAppearanceBtn').addEventListener('click', () => {
  const theme = document.querySelector('input[name="theme"]:checked')?.value || 'purple';
  chrome.storage.sync.set({ theme }, () => showToast('appearanceToast'));
});

// ── 初始化 ────────────────────────────────────────────────────
loadSettings();
