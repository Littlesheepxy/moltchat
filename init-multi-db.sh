#!/bin/bash
# Initialize multiple databases in PostgreSQL
# This script runs when the PostgreSQL container first starts

set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<-EOSQL
    -- Create synapse database for Matrix
    CREATE DATABASE synapse;
    
    -- Grant privileges to the moltchat user
    GRANT ALL PRIVILEGES ON DATABASE synapse TO $POSTGRES_USER;
    
    -- Connect to synapse database and set up permissions
    \c synapse
    GRANT ALL ON SCHEMA public TO $POSTGRES_USER;
EOSQL

echo "Created synapse database successfully"
