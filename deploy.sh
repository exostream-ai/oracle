#!/bin/bash
set -e

# Exostream GCP Cloud Run Deployment Script
# Prerequisites: gcloud CLI installed and authenticated

PROJECT_ID="${GCP_PROJECT_ID:-exostream-prod}"
REGION="${GCP_REGION:-us-central1}"
REPO_NAME="exostream"

echo "=== Exostream Deployment to GCP Cloud Run ==="
echo "Project: $PROJECT_ID"
echo "Region: $REGION"
echo ""

# Step 1: Set project
echo ">>> Setting GCP project..."
gcloud config set project $PROJECT_ID

# Step 2: Enable required APIs
echo ">>> Enabling required APIs..."
gcloud services enable \
  cloudbuild.googleapis.com \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  --quiet

# Step 3: Create Artifact Registry repository (if not exists)
echo ">>> Creating Artifact Registry repository..."
gcloud artifacts repositories create $REPO_NAME \
  --repository-format=docker \
  --location=$REGION \
  --description="Exostream container images" \
  --quiet 2>/dev/null || echo "Repository already exists"

# Step 4: Configure Docker authentication
echo ">>> Configuring Docker authentication..."
gcloud auth configure-docker $REGION-docker.pkg.dev --quiet

# Step 5: Build and push API image
echo ">>> Building API image..."
docker build -t $REGION-docker.pkg.dev/$PROJECT_ID/$REPO_NAME/api:latest .

echo ">>> Pushing API image..."
docker push $REGION-docker.pkg.dev/$PROJECT_ID/$REPO_NAME/api:latest

# Step 6: Build and push Frontend image
echo ">>> Building Frontend image..."
docker build \
  --build-arg NEXT_PUBLIC_API_URL=https://api.exostream.ai \
  -t $REGION-docker.pkg.dev/$PROJECT_ID/$REPO_NAME/frontend:latest \
  frontend

echo ">>> Pushing Frontend image..."
docker push $REGION-docker.pkg.dev/$PROJECT_ID/$REPO_NAME/frontend:latest

# Step 7: Deploy API to Cloud Run
echo ">>> Deploying API to Cloud Run..."
gcloud run deploy exostream-api \
  --image $REGION-docker.pkg.dev/$PROJECT_ID/$REPO_NAME/api:latest \
  --region $REGION \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 10 \
  --set-env-vars "NODE_ENV=production"

# Step 8: Deploy Frontend to Cloud Run
echo ">>> Deploying Frontend to Cloud Run..."
gcloud run deploy exostream-frontend \
  --image $REGION-docker.pkg.dev/$PROJECT_ID/$REPO_NAME/frontend:latest \
  --region $REGION \
  --platform managed \
  --allow-unauthenticated \
  --port 3000 \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 10 \
  --set-env-vars "NODE_ENV=production"

# Step 9: Get service URLs
echo ""
echo "=== Deployment Complete ==="
echo ""
API_URL=$(gcloud run services describe exostream-api --region $REGION --format 'value(status.url)')
FRONTEND_URL=$(gcloud run services describe exostream-frontend --region $REGION --format 'value(status.url)')

echo "API URL: $API_URL"
echo "Frontend URL: $FRONTEND_URL"
echo ""
echo "=== Next Steps: Domain Mapping ==="
echo ""
echo "1. Map api.exostream.ai to API:"
echo "   gcloud run domain-mappings create --service exostream-api --domain api.exostream.ai --region $REGION"
echo ""
echo "2. Map exostream.ai to Frontend:"
echo "   gcloud run domain-mappings create --service exostream-frontend --domain exostream.ai --region $REGION"
echo ""
echo "3. Configure Cloudflare DNS (see DEPLOYMENT.md for details)"
