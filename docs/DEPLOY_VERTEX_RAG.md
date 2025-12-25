# Deployment Guide: Vertex AI RAG Engine Migration

## 前置条件

完成 `GCP_SETUP_GUIDE.md` 中的所有步骤后，你应该有：
- GCP Project ID
- GCS Bucket 名称
- Vertex AI RAG Corpus ID
- Service Account JSON key

## 1. 设置 Cloudflare 环境变量

在 Cloudflare Dashboard 中设置以下环境变量：

```bash
# 进入项目目录
cd hkdse-physics-ai-tutor

# 使用 wrangler CLI 设置 secrets
wrangler pages secret put GCP_PROJECT_ID
# 输入你的 GCP Project ID

wrangler pages secret put GCP_LOCATION
# 输入: us-central1 (或你的 RAG corpus 所在区域)

wrangler pages secret put GCS_BUCKET_NAME
# 输入你的 GCS bucket 名称

wrangler pages secret put VERTEX_RAG_CORPUS_ID
# 输入你的 RAG corpus ID

wrangler pages secret put GCP_SERVICE_ACCOUNT_JSON
# 粘贴整个 Service Account JSON 内容
```

或在 Cloudflare Dashboard 中：
1. 进入 Pages > 你的项目 > Settings > Environment variables
2. 添加上述变量

## 2. 运行数据库迁移

添加新字段到 D1 数据库：

```bash
# 先检查 D1 database 名称
wrangler d1 list

# 运行迁移
wrangler d1 execute hkdse-physics-tutor-db --file=migrations/0008_vertex_fields.sql
```

## 3. 部署代码

```bash
# 确保在项目目录
cd hkdse-physics-ai-tutor

# 部署到 Cloudflare Pages
wrangler pages deploy frontend
```

或者通过 Git：
```bash
git add .
git commit -m "Migrate to Vertex AI RAG Engine"
git push origin main
```

## 4. 验证部署

### 4.1 检查连接状态

1. 访问 `/admin-kb`
2. 点击 "Test Connections" 标签页
3. 点击 "Run All Tests"
4. 确认以下服务显示 ✅:
   - D1 Database
   - Vertex AI RAG Engine
   - Google Cloud Storage

### 4.2 测试上传

1. 在 "Upload" 标签页上传一个测试 PDF
2. 观察状态变化：`pending` → `processing` → `ready`
3. 如果卡在 `processing`，点击 "Refresh Status"

### 4.3 测试搜索

1. 在 "Test Search" 标签页输入搜索词
2. 确认能返回相关结果

### 4.4 测试题目生成

1. 访问 `/free-practice`
2. 选择题目设置并生成
3. 检查控制台日志确认使用了 `vertex_rag` 后端

## 5. 迁移现有文档

如果有现有的 R2 文档需要迁移：

### 方法 A: 使用本地脚本（推荐用于批量上传新文件）

```bash
# 创建 .env 文件
cat > .env << 'EOF'
GCP_SERVICE_ACCOUNT_JSON=/path/to/your-service-account.json
GCP_PROJECT_ID=your-project-id
GCP_LOCATION=us-central1
GCS_BUCKET_NAME=your-bucket-name
VERTEX_RAG_CORPUS_ID=your-corpus-id
EOF

# 上传文件夹
node scripts/vertex-upload.cjs ./papers/2023/ --lang=en

# 上传单个文件
node scripts/vertex-upload.cjs ./2023-physics-1a.pdf --lang=zh
```

### 方法 B: 通过 Admin UI

1. 访问 `/admin-kb`
2. 使用 "Upload" 功能逐个上传文件

## 6. 回滚（如需要）

如果遇到问题需要回滚到 Vectorize：

1. 在环境变量中删除或留空 `GCP_SERVICE_ACCOUNT_JSON`
2. 系统会自动 fallback 到 Vectorize
3. 通过 admin-kb 检查 "Test Connections" 确认使用 Vectorize

## 故障排除

### "Corpus not found" 错误
- 检查 `VERTEX_RAG_CORPUS_ID` 是否正确
- 确认 corpus 在正确的 region（与 `GCP_LOCATION` 匹配）

### "Permission denied" 错误
- 检查 Service Account 是否有 `roles/aiplatform.user` 权限
- 检查 GCS bucket 是否有 `roles/storage.objectAdmin` 权限

### 文档卡在 "processing"
- 使用 "Refresh Status" 按钮检查实际状态
- 查看 GCP Console > Vertex AI > RAG Engine 中的操作状态
- 大型 PDF 可能需要几分钟处理

### 搜索返回空结果
- 确认文档状态为 `ready`
- 检查 RAG corpus 中是否有文件（在 GCP Console 中查看）
- 尝试更通用的搜索词

## 新架构概览

```
用户上传 PDF
    ↓
Cloudflare Functions (upload.js)
    ↓
Google Cloud Storage (存储文件)
    ↓
Vertex AI RAG Engine (解析、分块、embedding、索引)
    ↓
用户搜索/生成题目
    ↓
Vertex RAG Retrieve (语义检索)
    ↓
DeepSeek (生成题目 with styleContext)
```

优势：
- 🚀 **自动处理**：无需手动 OCR，Vertex 自动处理 PDF
- 📊 **更好的解析**：Document AI layout parser 支持复杂 PDF
- ⚡ **更快检索**：Google 基础设施的向量搜索
- 🔄 **自动扩展**：无需管理 Vectorize 索引大小
