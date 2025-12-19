# HKDSE Physics AI Tutor 📚⚛️

一個專為 HKDSE 物理科設計的 AI 教學助手，支援圖片題目識別、分步講解和追問對話。

## ✨ 功能

- 📷 **圖片題目識別**：上傳物理題目照片，AI 自動識別並分析
- 📝 **DSE 風格講解**：分步解題，包含公式、單位、常見錯誤
- 💬 **追問對話**：針對題目繼續提問，支持上下文記憶
- 🎯 **考試技巧**：提供 Exam Tips 和術語對照表
- 📱 **手機友好**：響應式設計，適合手機使用

## 🛠 技術架構

- **前端**：HTML/CSS/JavaScript（無框架，輕量快速）
- **後端**：Cloudflare Pages Functions
- **AI**：Google Gemini Vision + DeepSeek
- **部署**：Cloudflare Pages（全球 CDN）

## 🚀 部署指南

### 1. Fork 此倉庫

### 2. 連接 Cloudflare Pages

1. 登入 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. 進入 Pages → Create a project
3. 連接 GitHub 倉庫
4. 設定：
   - Build command: 留空
   - Build output directory: `frontend`

### 3. 配置環境變量（Secrets）

在 Cloudflare Pages 的 Settings → Environment variables 中添加：

| 變量名 | 說明 |
|--------|------|
| `GOOGLE_GEMINI_API_KEY` | Google Gemini API Key |
| `DEEPSEEK_API_KEY` | DeepSeek API Key |

⚠️ **重要**：永遠不要把 API Key 寫進代碼！

### 4. 部署

每次 push 到 main 分支會自動部署。

## 📂 項目結構

```
hkdse-physics-ai-tutor/
├── frontend/           # 前端靜態文件
│   ├── index.html
│   ├── css/
│   │   └── style.css
│   └── js/
│       └── app.js
├── functions/          # Cloudflare Pages Functions
│   └── api/
│       ├── explain-image.js
│       └── followup.js
├── shared/             # 共享代碼（prompts）
│   └── prompts.js
├── package.json
├── wrangler.toml
└── README.md
```

## 🔒 安全說明

- API Keys 只存儲在 Cloudflare Secrets 中
- 圖片不會被持久保存
- 所有通信使用 HTTPS

## 📄 License

MIT License

---

Made with ❤️ for HKDSE Physics students
