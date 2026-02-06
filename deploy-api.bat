@echo off
call "C:\Users\farha\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd" artifacts repositories create exostream --repository-format=docker --location=us-central1 --description="Exostream container images" --quiet
call "C:\Users\farha\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd" builds submit --tag us-central1-docker.pkg.dev/exostream-486513/exostream/api:latest
call "C:\Users\farha\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd" run deploy exostream-api --image us-central1-docker.pkg.dev/exostream-486513/exostream/api:latest --region us-central1 --allow-unauthenticated --platform managed --port 8080
