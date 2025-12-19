# HKDSE Physics AI Tutor 📚⚛️

一個專為 HKDSE 物理科設計的 AI 教學助手，支援圖片題目識別、純文字題目、分步講解和追問對話。

## ✨ 功能

- 📷 **圖片題目識別**：上傳物理題目照片，AI 自動識別並分析
- ✏️ **純文字題目**：直接輸入題目文字，無需圖片也能獲得講解
- 📝 **DSE 風格講解**：分步解題，包含公式、單位、常見錯誤
- 💬 **追問對話**：針對題目繼續提問，支持上下文記憶
- 🎯 **考試技巧**：提供 Exam Tips 和術語對照表
- 📱 **手機友好**：響應式設計，適合手機使用
- 🔐 **Google 登入**：一鍵用 Google 帳號登入
- 📚 **歷史記錄**：雲端同步，跨設備查看解題歷史

## 🛠 技術架構

- **前端**：HTML/CSS/JavaScript（無框架，輕量快速）
- **後端**：Cloudflare Pages Functions
- **數據庫**：Cloudflare D1（SQLite）
- **AI**：通義千問 Vision (Qwen-VL) + DeepSeek
- **認證**：Google OAuth 2.0
- **部署**：Cloudflare Pages（全球 CDN）

## 🚀 部署指南

### 1. Fork 此倉庫

### 2. 創建 Google OAuth 憑據

1. 前往 [Google Cloud Console](https://console.cloud.google.com/)
2. 創建新項目或選擇現有項目
3. 啟用 Google+ API（APIs & Services → Enable APIs → Google+ API）
4. 創建 OAuth 憑據：
   - APIs & Services → Credentials → Create Credentials → OAuth client ID
   - Application type: Web application
   - Authorized redirect URIs: `https://your-project.pages.dev/`
5. 記錄 `Client ID` 和 `Client Secret`

### 3. 創建 Cloudflare D1 數據庫

```bash
# 安裝 Wrangler CLI
npm install -g wrangler

# 登入 Cloudflare
wrangler login

# 創建 D1 數據庫
wrangler d1 create hkdse-physics-tutor-db

# 記錄返回的 database_id，更新 wrangler.toml
```

更新 `wrangler.toml` 中的 `database_id`。

### 4. 運行數據庫遷移

```bash
wrangler d1 execute hkdse-physics-tutor-db --remote --file=./migrations/0001_initial_schema.sql
```

### 5. 連接 Cloudflare Pages

1. 登入 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. 進入 Pages → Create a project
3. 連接 GitHub 倉庫
4. 設定：
   - Build command: 留空
   - Build output directory: `frontend`

### 6. 配置環境變量（Secrets）

在 Cloudflare Pages 的 Settings → Environment variables 中添加：

| 變量名 | 說明 |
|--------|------|
| `QWEN_API_KEY` | 通義千問 API Key（用於圖片識別） |
| `DEEPSEEK_API_KEY` | DeepSeek API Key（用於文字解題和追問） |
| `AUTH_SECRET` | 用於簽名 Session Cookie 的密鑰（執行 `openssl rand -hex 32` 生成） |
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Client Secret |

⚠️ **重要**：永遠不要把 API Key 寫進代碼！

### 7. 綁定 D1 數據庫

在 Cloudflare Pages 的 Settings → Functions → D1 database bindings 中：
- Variable name: `DB`
- D1 database: 選擇 `hkdse-physics-tutor-db`

### 8. 部署

每次 push 到 main 分支會自動部署。

## 📂 項目結構

```
hkdse-physics-ai-tutor/
├── frontend/                 # 前端靜態文件
│   ├── index.html
│   ├── css/
│   │   └── style.css
│   └── js/
│       └── app.js
├── functions/                # Cloudflare Pages Functions
│   └── api/
│       ├── explain-image.js  # 圖片題目 API
│       ├── explain-text.js   # 純文字題目 API
│       ├── followup.js       # 追問對話 API
│       ├── auth/             # 認證 API
│       │   ├── google/       # Google OAuth
│       │   │   ├── url.js
│       │   │   └── callback.js
│       │   ├── me.js
│       │   └── logout.js
│       └── history/          # 歷史記錄 API
│           ├── save.js
│           ├── list.js
│           └── get.js
├── shared/                   # 共享代碼
│   ├── prompts.js           # AI Prompts
│   └── auth.js              # 認證工具函數
├── migrations/               # D1 數據庫遷移
│   └── 0001_initial_schema.sql
├── package.json
├── wrangler.toml
└── README.md
```

## 🔧 本地開發

```bash
# 安裝依賴
npm install

# 啟動本地開發服務器
npm run dev

# 訪問 http://localhost:8788
```

## 🔒 安全說明

- API Keys 只存儲在 Cloudflare Secrets 中
- 使用 Google OAuth 2.0 安全認證
- Session Cookie 設置為 HttpOnly、Secure、SameSite=Lax
- 圖片不會被持久保存
- 所有通信使用 HTTPS

## 📄 License

MIT License

---

Made with ❤️ for HKDSE Physics students
