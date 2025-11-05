#!/bin/sh
# Security monitoring workflow - runs hourly

echo "[$(date)] Starting security monitoring workflow..."

# Call the security monitor API
response=$(curl -s -w "\n%{http_code}" -X POST "${APP_URL:-http://app:3000}/api/workflows/security-monitor" \
  -H "Content-Type: application/json" \
  -d '{
    "logDirectory": "logs",
    "severity": "medium"
  }')

# Extract HTTP code and body
http_code=$(echo "$response" | tail -n 1)
body=$(echo "$response" | sed '$d')

if [ "$http_code" = "200" ]; then
  echo "[$(date)] Security scan completed successfully"
  echo "$body" | grep -o '"severity":"[^"]*"' || true
  echo "$body" | grep -o '"issuesFound":[0-9]*' || true
else
  echo "[$(date)] Security scan failed with HTTP $http_code"
  echo "$body"
  exit 1
fi
