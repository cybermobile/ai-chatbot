#!/bin/sh
# RAG document ingestion workflow - runs daily

echo "[$(date)] Starting RAG document ingestion workflow..."

# Call the RAG ingest API
response=$(curl -s -w "\n%{http_code}" -X POST "${APP_URL:-http://app:3000}/api/workflows/rag-ingest" \
  -H "Content-Type: application/json" \
  -d '{
    "documentDirectory": "documents",
    "filePattern": "*.txt",
    "chunkSize": 500
  }')

# Extract HTTP code and body
http_code=$(echo "$response" | tail -n 1)
body=$(echo "$response" | sed '$d')

if [ "$http_code" = "200" ]; then
  echo "[$(date)] RAG ingestion completed successfully"
  echo "$body" | grep -o '"documentsProcessed":[0-9]*' || true
  echo "$body" | grep -o '"embeddingsCreated":[0-9]*' || true
else
  echo "[$(date)] RAG ingestion failed with HTTP $http_code"
  echo "$body"
  exit 1
fi
