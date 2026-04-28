# SmartTranslate - AI 划词翻译插件

基于 DeepSeek / MiniMax 大语言模型的 Chrome 浏览器翻译插件，支持**划词翻译**，结果以**悬浮框**形式展示。

---

## ✨ 功能特性

- **划词翻译** — 选中网页文字自动弹出翻译小图标，点击即翻译
- **悬浮框展示** — 翻译结果显示在选中文字上方，不打断阅读流
- **多模型支持** — 已接入 DeepSeek、MiniMax，可随时切换
- **10+ 目标语言** — 中文、英文、日文、韩文、法文、德文等
- **Popup 翻译框** — 点击扩展图标可直接输入文字翻译
- **一键复制** — 翻译结果可一键复制到剪贴板
- **完整设置页** — 可视化配置 API Key、模型、语言偏好等

---

## 📁 项目结构

```
webTranslate/
├── manifest.json          # MV3 扩展清单
├── popup.html / .css / .js  # 弹出翻译框
├── options.html / .css / .js # 设置页面
└── src/
    ├── background.js      # Service Worker（调用 LLM API）
    ├── content.js         # 划词逻辑 + 悬浮翻译框
    ├── content.css        # 悬浮框样式
    └── icons/             # 扩展图标 (SVG)
```

---

## 🚀 安装步骤

1. 打开 Chrome，访问 `chrome://extensions/`
2. 右上角开启 **开发者模式**
3. 点击 **加载已解压的扩展程序**
4. 选择本项目根目录 `webTranslate/`
5. 安装完成后，点击工具栏中的扩展图标 → 进入设置 → 填写 API Key

---

## 🔑 获取 API Key

### DeepSeek（推荐）
1. 访问 https://platform.deepseek.com/
2. 注册并登录
3. 进入「API Keys」页面新建 Key
4. 复制 `sk-xxx` 格式的 Key 到设置页

### MiniMax
1. 访问 https://platform.minimaxi.com/
2. 注册登录后，在「账户信息」获取 Group ID
3. 在「接口密钥」创建 API Key
4. 将两项均填入设置页

---

## ⚙️ 配置说明

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| 服务商 | 选择 DeepSeek 或 MiniMax | DeepSeek |
| API Key | 对应服务商的密钥 | - |
| 默认目标语言 | 翻译的目标语言 | 简体中文 |
| 自动翻译 | 选词后直接翻译（无需点图标）| 关闭 |
| 显示翻译按钮 | 选词后显示小图标 | 开启 |
| 最大 Token | 控制翻译结果长度 | 300 |
| 温度 | 控制翻译创造性 | 0.3 |

---

## 🛠️ 扩展其他模型

在 `src/background.js` 中参照 `translateWithDeepSeek` 函数添加新的翻译函数，
并在 `handleTranslate` 函数的 `if/else` 分支中注册即可。

---

## 📝 注意事项

- API Key 仅存储在浏览器本地（`chrome.storage.sync`），不会上传到任何服务器
- 翻译请求由 Chrome 扩展的 Service Worker 发起，规避页面级 CORS 限制
- 插件不会在任何页面注入广告或收集数据
