#!/bin/sh
set -e

echo "Starting cron service for AI chatbot workflows..."

# Install curl for API calls
apk add --no-cache curl

# Create crontab file
cat > /etc/crontabs/root <<'EOF'
# Security monitoring - every hour
0 * * * * /scripts/security-monitor.sh >> /var/log/cron.log 2>&1

# RAG document ingestion - daily at 2 AM
0 2 * * * /scripts/rag-ingest.sh >> /var/log/cron.log 2>&1

# Health check - every 5 minutes
*/5 * * * * echo "[$(date)] Cron is alive" >> /var/log/cron.log 2>&1
EOF

# Make scripts executable
chmod +x /scripts/*.sh

# Create log file
touch /var/log/cron.log

echo "Cron jobs configured:"
cat /etc/crontabs/root

# Start crond in foreground
echo "Starting crond..."
crond -f -l 2
