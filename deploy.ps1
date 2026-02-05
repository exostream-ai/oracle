# Exostream GCP Cloud Run Deployment Script (PowerShell)
# Run this in PowerShell with: .\deploy.ps1

$ErrorActionPreference = "Stop"

# Configuration
$PROJECT_ID = if ($env:GCP_PROJECT_ID) { $env:GCP_PROJECT_ID } else { "exostream-prod" }
$REGION = if ($env:GCP_REGION) { $env:GCP_REGION } else { "us-central1" }
$REPO_NAME = "exostream"

Write-Host "=== Exostream Deployment to GCP Cloud Run ===" -ForegroundColor Cyan
Write-Host "Project: $PROJECT_ID"
Write-Host "Region: $REGION"
Write-Host ""

# Check prerequisites
Write-Host ">>> Checking prerequisites..." -ForegroundColor Yellow

# Find gcloud
$gcloudPath = Get-Command gcloud -ErrorAction SilentlyContinue
if (-not $gcloudPath) {
    $sdkPath = "$env:LOCALAPPDATA\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd"
    if (Test-Path $sdkPath) {
        $gcloudPath = $sdkPath
    } else {
        Write-Host "ERROR: gcloud not found. Install from: https://cloud.google.com/sdk/install" -ForegroundColor Red
        exit 1
    }
}
Write-Host "gcloud found: $gcloudPath" -ForegroundColor Green

# Find docker
$dockerPath = Get-Command docker -ErrorAction SilentlyContinue
if (-not $dockerPath) {
    Write-Host "ERROR: Docker not found. Install Docker Desktop from: https://docker.com" -ForegroundColor Red
    exit 1
}
Write-Host "docker found" -ForegroundColor Green

# Step 1: Set project
Write-Host ""
Write-Host ">>> Setting GCP project..." -ForegroundColor Yellow
& gcloud config set project $PROJECT_ID

# Step 2: Enable required APIs
Write-Host ">>> Enabling required APIs..." -ForegroundColor Yellow
& gcloud services enable cloudbuild.googleapis.com run.googleapis.com artifactregistry.googleapis.com --quiet

# Step 3: Create Artifact Registry repository
Write-Host ">>> Creating Artifact Registry repository..." -ForegroundColor Yellow
& gcloud artifacts repositories create $REPO_NAME `
    --repository-format=docker `
    --location=$REGION `
    --description="Exostream container images" `
    --quiet 2>$null
if ($LASTEXITCODE -ne 0) { Write-Host "Repository may already exist, continuing..." -ForegroundColor Gray }

# Step 4: Configure Docker authentication
Write-Host ">>> Configuring Docker authentication..." -ForegroundColor Yellow
& gcloud auth configure-docker "$REGION-docker.pkg.dev" --quiet

# Step 5: Build and push API image
Write-Host ">>> Building API image..." -ForegroundColor Yellow
& docker build -t "$REGION-docker.pkg.dev/$PROJECT_ID/$REPO_NAME/api:latest" .
if ($LASTEXITCODE -ne 0) { Write-Host "API build failed" -ForegroundColor Red; exit 1 }

Write-Host ">>> Pushing API image..." -ForegroundColor Yellow
& docker push "$REGION-docker.pkg.dev/$PROJECT_ID/$REPO_NAME/api:latest"

# Step 6: Build and push Frontend image
Write-Host ">>> Building Frontend image..." -ForegroundColor Yellow
Push-Location frontend
& docker build `
    --build-arg NEXT_PUBLIC_API_URL=https://api.exostream.ai `
    -t "$REGION-docker.pkg.dev/$PROJECT_ID/$REPO_NAME/frontend:latest" `
    .
if ($LASTEXITCODE -ne 0) { Write-Host "Frontend build failed" -ForegroundColor Red; Pop-Location; exit 1 }
Pop-Location

Write-Host ">>> Pushing Frontend image..." -ForegroundColor Yellow
& docker push "$REGION-docker.pkg.dev/$PROJECT_ID/$REPO_NAME/frontend:latest"

# Step 7: Deploy API to Cloud Run
Write-Host ">>> Deploying API to Cloud Run..." -ForegroundColor Yellow
& gcloud run deploy exostream-api `
    --image "$REGION-docker.pkg.dev/$PROJECT_ID/$REPO_NAME/api:latest" `
    --region $REGION `
    --platform managed `
    --allow-unauthenticated `
    --port 8080 `
    --memory 512Mi `
    --cpu 1 `
    --min-instances 0 `
    --max-instances 10 `
    --set-env-vars "NODE_ENV=production"

# Step 8: Deploy Frontend to Cloud Run
Write-Host ">>> Deploying Frontend to Cloud Run..." -ForegroundColor Yellow
& gcloud run deploy exostream-frontend `
    --image "$REGION-docker.pkg.dev/$PROJECT_ID/$REPO_NAME/frontend:latest" `
    --region $REGION `
    --platform managed `
    --allow-unauthenticated `
    --port 3000 `
    --memory 512Mi `
    --cpu 1 `
    --min-instances 0 `
    --max-instances 10 `
    --set-env-vars "NODE_ENV=production"

# Step 9: Get service URLs
Write-Host ""
Write-Host "=== Deployment Complete ===" -ForegroundColor Green
Write-Host ""

$API_URL = & gcloud run services describe exostream-api --region $REGION --format "value(status.url)"
$FRONTEND_URL = & gcloud run services describe exostream-frontend --region $REGION --format "value(status.url)"

Write-Host "API URL: $API_URL" -ForegroundColor Cyan
Write-Host "Frontend URL: $FRONTEND_URL" -ForegroundColor Cyan

Write-Host ""
Write-Host "=== Next Steps: Domain Mapping ===" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Map api.exostream.ai to API:"
Write-Host "   gcloud run domain-mappings create --service exostream-api --domain api.exostream.ai --region $REGION" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Map exostream.ai to Frontend:"
Write-Host "   gcloud run domain-mappings create --service exostream-frontend --domain exostream.ai --region $REGION" -ForegroundColor Gray
Write-Host ""
Write-Host "3. In Cloudflare, add CNAME records pointing to: ghs.googlehosted.com" -ForegroundColor Gray
Write-Host "   - @ -> ghs.googlehosted.com (proxied)"
Write-Host "   - api -> ghs.googlehosted.com (proxied)"
Write-Host ""
Write-Host "4. Set Cloudflare SSL mode to 'Full (strict)'" -ForegroundColor Gray
