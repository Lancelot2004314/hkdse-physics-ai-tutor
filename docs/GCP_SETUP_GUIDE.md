# GCP Setup Guide for Vertex AI RAG Engine

## 1. Create or Select GCP Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Note down your **Project ID** (e.g., `hkdse-physics-rag`)

## 2. Enable Required APIs

Run these commands in Cloud Shell or with `gcloud` CLI:

```bash
# Set your project
gcloud config set project YOUR_PROJECT_ID

# Enable APIs
gcloud services enable aiplatform.googleapis.com
gcloud services enable documentai.googleapis.com
gcloud services enable storage.googleapis.com
```

Or enable via Console:
- Go to "APIs & Services" > "Enable APIs and Services"
- Search and enable:
  - **Vertex AI API**
  - **Document AI API**
  - **Cloud Storage API**

## 3. Create GCS Bucket

```bash
# Create bucket (choose region that supports RAG Engine)
# Recommended: us-central1, us-east1, europe-west1, asia-northeast1
gsutil mb -l asia-east1 gs://YOUR_BUCKET_NAME

# Example:
gsutil mb -l asia-east1 gs://hkdse-physics-docs
```

Or via Console:
- Go to "Cloud Storage" > "Buckets" > "Create"
- Name: `hkdse-physics-docs` (or your choice)
- Location: `asia-east1` (Hong Kong nearby) or `us-central1`
- Storage class: Standard
- Access control: Uniform

## 4. Create Service Account

```bash
# Create service account
gcloud iam service-accounts create hkdse-rag-sa \
    --display-name="HKDSE RAG Service Account"

# Grant Storage Admin on bucket
gsutil iam ch serviceAccount:hkdse-rag-sa@YOUR_PROJECT_ID.iam.gserviceaccount.com:roles/storage.objectAdmin \
    gs://YOUR_BUCKET_NAME

# Grant Vertex AI User role
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
    --member="serviceAccount:hkdse-rag-sa@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/aiplatform.user"

# Generate JSON key
gcloud iam service-accounts keys create ~/hkdse-rag-sa-key.json \
    --iam-account=hkdse-rag-sa@YOUR_PROJECT_ID.iam.gserviceaccount.com
```

## 5. Create RAG Corpus

Via Console:
1. Go to "Vertex AI" > "RAG Engine" (may be under "Grounding")
2. Click "Create corpus"
3. Configure:
   - Name: `hkdse-physics-kb`
   - Region: `us-central1` (RAG Engine has limited region support)
   - Embedding model: `text-embedding-004` (or latest)
   - Vector DB: Vertex AI Vector Search (default)
4. Advanced options:
   - Chunk size: 1024 tokens (default, good for DSE questions)
   - Chunk overlap: 256 tokens
   - Enable Document AI layout parser: **YES**
5. Create and note down the **Corpus ID** (resource name)

The corpus resource name looks like:
```
projects/YOUR_PROJECT_ID/locations/us-central1/ragCorpora/CORPUS_ID
```

## 6. Set Cloudflare Environment Variables

In Cloudflare Dashboard > Pages > Your Project > Settings > Environment Variables:

| Variable | Value |
|----------|-------|
| `GCP_PROJECT_ID` | Your GCP project ID |
| `GCP_LOCATION` | `us-central1` (or your chosen region) |
| `GCS_BUCKET_NAME` | Your bucket name (e.g., `hkdse-physics-docs`) |
| `VERTEX_RAG_CORPUS_ID` | Just the ID part (not full resource name) |
| `GCP_SERVICE_ACCOUNT_JSON` | Entire content of the JSON key file |

For `GCP_SERVICE_ACCOUNT_JSON`, paste the entire JSON:
```json
{
  "type": "service_account",
  "project_id": "...",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  ...
}
```

## 7. Verify Setup

After deploying the updated code:
1. Go to `/admin-kb`
2. Upload a test PDF
3. Check if status changes from `pending` → `processing` → `ready`
4. Test search functionality

## Troubleshooting

### "Permission denied" errors
- Ensure service account has `roles/aiplatform.user` on the project
- Ensure service account has `roles/storage.objectAdmin` on the bucket

### "Corpus not found"
- Verify the corpus exists in the correct region
- Check `VERTEX_RAG_CORPUS_ID` matches

### "Document AI not enabled"
- Ensure Document AI API is enabled
- RAG Engine may need additional Document AI permissions

## Cost Considerations

- **GCS Storage**: ~$0.02/GB/month
- **Vertex AI RAG Engine**: Pay per query and storage
- **Document AI**: Pay per page processed
- For DSE papers (~50 pages each), expect ~$0.01-0.05 per document for parsing
