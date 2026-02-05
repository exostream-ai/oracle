# Exostream Deployment Guide

## Architecture

```
                    Cloudflare
                        |
           +------------+------------+
           |                         |
    exostream.ai            api.exostream.ai
           |                         |
           v                         v
    +-------------+           +-------------+
    |  Cloud Run  |           |  Cloud Run  |
    |  Frontend   |           |    API      |
    |  (Next.js)  |           |   (Hono)    |
    +-------------+           +-------------+
```

## Prerequisites

1. **GCP Account** with billing enabled
2. **gcloud CLI** installed and authenticated
3. **Docker** installed locally
4. **Cloudflare** account with exostream.ai domain

## Quick Deploy

```bash
# Set your GCP project ID
export GCP_PROJECT_ID=your-project-id
export GCP_REGION=us-central1

# Run deployment script
./deploy.sh
```

## Manual Deployment Steps

### 1. GCP Setup

```bash
# Set project
gcloud config set project $GCP_PROJECT_ID

# Enable APIs
gcloud services enable \
  cloudbuild.googleapis.com \
  run.googleapis.com \
  artifactregistry.googleapis.com

# Create Artifact Registry repository
gcloud artifacts repositories create exostream \
  --repository-format=docker \
  --location=$GCP_REGION \
  --description="Exostream container images"

# Configure Docker auth
gcloud auth configure-docker $GCP_REGION-docker.pkg.dev
```

### 2. Build & Push Images

```bash
# Build API
docker build -t $GCP_REGION-docker.pkg.dev/$GCP_PROJECT_ID/exostream/api:latest .

# Build Frontend
docker build \
  --build-arg NEXT_PUBLIC_API_URL=https://api.exostream.ai \
  -t $GCP_REGION-docker.pkg.dev/$GCP_PROJECT_ID/exostream/frontend:latest \
  frontend

# Push images
docker push $GCP_REGION-docker.pkg.dev/$GCP_PROJECT_ID/exostream/api:latest
docker push $GCP_REGION-docker.pkg.dev/$GCP_PROJECT_ID/exostream/frontend:latest
```

### 3. Deploy to Cloud Run

```bash
# Deploy API
gcloud run deploy exostream-api \
  --image $GCP_REGION-docker.pkg.dev/$GCP_PROJECT_ID/exostream/api:latest \
  --region $GCP_REGION \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --memory 512Mi

# Deploy Frontend
gcloud run deploy exostream-frontend \
  --image $GCP_REGION-docker.pkg.dev/$GCP_PROJECT_ID/exostream/frontend:latest \
  --region $GCP_REGION \
  --platform managed \
  --allow-unauthenticated \
  --port 3000 \
  --memory 512Mi
```

### 4. Domain Mapping (Cloud Run)

```bash
# Verify domain ownership first (one-time)
gcloud domains verify exostream.ai

# Map domains
gcloud run domain-mappings create \
  --service exostream-frontend \
  --domain exostream.ai \
  --region $GCP_REGION

gcloud run domain-mappings create \
  --service exostream-api \
  --domain api.exostream.ai \
  --region $GCP_REGION

# Get DNS records to add
gcloud run domain-mappings describe \
  --domain exostream.ai \
  --region $GCP_REGION
```

### 5. Cloudflare DNS Configuration

After running domain-mappings, Cloud Run will provide DNS records. Add these in Cloudflare:

| Type  | Name | Content                                      | Proxy |
|-------|------|----------------------------------------------|-------|
| CNAME | @    | ghs.googlehosted.com                         | Yes   |
| CNAME | api  | ghs.googlehosted.com                         | Yes   |
| CNAME | www  | exostream.ai                                 | Yes   |

**Cloudflare SSL Settings:**
1. Go to SSL/TLS → Overview
2. Set encryption mode to **Full (strict)**

**Cloudflare Page Rules (optional):**
- `http://exostream.ai/*` → Always Use HTTPS
- `http://api.exostream.ai/*` → Always Use HTTPS

## Environment Variables

### API (Cloud Run)
```
NODE_ENV=production
PORT=8080
DATABASE_URL=postgresql://... (if using Cloud SQL)
```

### Frontend (Cloud Run)
```
NODE_ENV=production
PORT=3000
NEXT_PUBLIC_API_URL=https://api.exostream.ai
```

## CI/CD with Cloud Build

The `cloudbuild.yaml` enables automatic deployments:

```bash
# Trigger build manually
gcloud builds submit --config cloudbuild.yaml

# Set up GitHub trigger
gcloud builds triggers create github \
  --repo-name=exostream \
  --repo-owner=your-org \
  --branch-pattern="^main$" \
  --build-config=cloudbuild.yaml
```

## Monitoring

```bash
# View logs
gcloud run services logs read exostream-api --region $GCP_REGION
gcloud run services logs read exostream-frontend --region $GCP_REGION

# View metrics
gcloud run services describe exostream-api --region $GCP_REGION
```

## Rollback

```bash
# List revisions
gcloud run revisions list --service exostream-api --region $GCP_REGION

# Rollback to previous revision
gcloud run services update-traffic exostream-api \
  --to-revisions REVISION_NAME=100 \
  --region $GCP_REGION
```

## Costs

Estimated monthly cost (low traffic):
- Cloud Run: ~$0-10 (pay per request, free tier: 2M requests/month)
- Artifact Registry: ~$0.10/GB storage
- Cloudflare: Free tier sufficient

## Troubleshooting

### "Permission denied" on domain mapping
Run `gcloud domains verify exostream.ai` and add the TXT record to Cloudflare.

### SSL certificate pending
Cloud Run managed certificates take 15-60 minutes to provision. Ensure Cloudflare proxy is enabled.

### API CORS errors
Check that the API is configured to allow requests from `https://exostream.ai`.
