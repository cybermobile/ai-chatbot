#!/bin/bash
# Enable pgvector extension in TimescaleDB

echo "Enabling pgvector extension..."
docker exec -it chatbot-db-1 psql -U postgres -c "CREATE EXTENSION IF NOT EXISTS vector;"

echo "Verifying pgvector is enabled..."
docker exec -it chatbot-db-1 psql -U postgres -c "SELECT * FROM pg_extension WHERE extname = 'vector';"

echo "Done! pgvector is now enabled."
