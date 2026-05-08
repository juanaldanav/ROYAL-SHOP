#!/bin/bash
# Idempotente: crea DBs y users solo si no existen
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    -- n8n database
    DO \$\$
    BEGIN
        IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '${N8N_DB_USER:-n8n_user}') THEN
            CREATE ROLE "${N8N_DB_USER:-n8n_user}" WITH LOGIN PASSWORD '${N8N_DB_PASSWORD}';
        END IF;
    END
    \$\$;

    SELECT 'CREATE DATABASE "${N8N_DB_NAME:-n8n_db}" OWNER "${N8N_DB_USER:-n8n_user}"'
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${N8N_DB_NAME:-n8n_db}')
    \gexec

    GRANT ALL PRIVILEGES ON DATABASE "${N8N_DB_NAME:-n8n_db}" TO "${N8N_DB_USER:-n8n_user}";

    -- Chatwoot database
    DO \$\$
    BEGIN
        IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '${CHATWOOT_DB_USER:-chatwoot_user}') THEN
            CREATE ROLE "${CHATWOOT_DB_USER:-chatwoot_user}" WITH LOGIN PASSWORD '${CHATWOOT_DB_PASSWORD}';
        END IF;
    END
    \$\$;

    SELECT 'CREATE DATABASE "${CHATWOOT_DB_NAME:-chatwoot_db}" OWNER "${CHATWOOT_DB_USER:-chatwoot_user}"'
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${CHATWOOT_DB_NAME:-chatwoot_db}')
    \gexec

    GRANT ALL PRIVILEGES ON DATABASE "${CHATWOOT_DB_NAME:-chatwoot_db}" TO "${CHATWOOT_DB_USER:-chatwoot_user}";

    -- Evolution API database
    SELECT 'CREATE DATABASE "evolution_db" OWNER "${POSTGRES_USER}"'
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'evolution_db')
    \gexec
EOSQL

echo "Lighthouse databases initialized (idempotent)"
