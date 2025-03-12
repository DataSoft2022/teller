# Comprehensive Setup Guide - Part 2: Database Setup

## PostgreSQL Setup for HQ and Branches

In this section, we'll set up PostgreSQL databases for the headquarters and branches, including the necessary configuration for logical replication.

### 1. Create PostgreSQL Configuration Files

#### HQ PostgreSQL Configuration

Create a configuration file for the HQ PostgreSQL instance:

```bash
cd banking-prototype
cat > config/postgres/postgresql-hq.conf << 'EOF'
listen_addresses = '*'
max_connections = 100
shared_buffers = 128MB
dynamic_shared_memory_type = posix
max_wal_size = 1GB
min_wal_size = 80MB
log_timezone = 'UTC'
datestyle = 'iso, mdy'
timezone = 'UTC'
lc_messages = 'en_US.utf8'
lc_monetary = 'en_US.utf8'
lc_numeric = 'en_US.utf8'
lc_time = 'en_US.utf8'
default_text_search_config = 'pg_catalog.english'

# Replication settings
wal_level = logical
max_wal_senders = 10
max_replication_slots = 10
max_worker_processes = 10
max_logical_replication_workers = 4
max_sync_workers_per_subscription = 2
EOF
```

#### Branch PostgreSQL Configuration

Create a configuration file for the branch PostgreSQL instances:

```bash
cat > config/postgres/postgresql-branch.conf << 'EOF'
listen_addresses = '*'
max_connections = 100
shared_buffers = 128MB
dynamic_shared_memory_type = posix
max_wal_size = 1GB
min_wal_size = 80MB
log_timezone = 'UTC'
datestyle = 'iso, mdy'
timezone = 'UTC'
lc_messages = 'en_US.utf8'
lc_monetary = 'en_US.utf8'
lc_numeric = 'en_US.utf8'
lc_time = 'en_US.utf8'
default_text_search_config = 'pg_catalog.english'

# Replication settings
wal_level = logical
max_wal_senders = 10
max_replication_slots = 10
max_worker_processes = 10
max_logical_replication_workers = 4
max_sync_workers_per_subscription = 2
EOF
```

### 2. Create Docker Compose Files for PostgreSQL

#### HQ PostgreSQL Docker Compose

Create a Docker Compose file for the HQ PostgreSQL instance:

```bash
cat > hq/docker-compose-postgres.yml << 'EOF'
version: '3.8'

services:
  postgres-hq:
    image: postgres:14
    container_name: postgres-hq
    restart: unless-stopped
    environment:
      POSTGRES_PASSWORD: postgres_hq_password
      POSTGRES_USER: postgres
      POSTGRES_DB: erpnext_hq
    volumes:
      - ./data/postgres:/var/lib/postgresql/data
      - ../config/postgres/postgresql-hq.conf:/etc/postgresql/postgresql.conf
    command: postgres -c config_file=/etc/postgresql/postgresql.conf
    ports:
      - "5432:5432"
    networks:
      - banking-prototype-network

networks:
  banking-prototype-network:
    external: true
EOF
```

#### Branch 1 PostgreSQL Docker Compose

Create a Docker Compose file for Branch 1 PostgreSQL instance:

```bash
cat > branch1/docker-compose-postgres.yml << 'EOF'
version: '3.8'

services:
  postgres-branch1:
    image: postgres:14
    container_name: postgres-branch1
    restart: unless-stopped
    environment:
      POSTGRES_PASSWORD: postgres_branch1_password
      POSTGRES_USER: postgres
      POSTGRES_DB: erpnext_branch1
    volumes:
      - ./data/postgres:/var/lib/postgresql/data
      - ../config/postgres/postgresql-branch.conf:/etc/postgresql/postgresql.conf
    command: postgres -c config_file=/etc/postgresql/postgresql.conf
    ports:
      - "5433:5432"
    networks:
      - banking-prototype-network

networks:
  banking-prototype-network:
    external: true
EOF
```

#### Branch 2 PostgreSQL Docker Compose

Create a Docker Compose file for Branch 2 PostgreSQL instance:

```bash
cat > branch2/docker-compose-postgres.yml << 'EOF'
version: '3.8'

services:
  postgres-branch2:
    image: postgres:14
    container_name: postgres-branch2
    restart: unless-stopped
    environment:
      POSTGRES_PASSWORD: postgres_branch2_password
      POSTGRES_USER: postgres
      POSTGRES_DB: erpnext_branch2
    volumes:
      - ./data/postgres:/var/lib/postgresql/data
      - ../config/postgres/postgresql-branch.conf:/etc/postgresql/postgresql.conf
    command: postgres -c config_file=/etc/postgresql/postgresql.conf
    ports:
      - "5434:5432"
    networks:
      - banking-prototype-network

networks:
  banking-prototype-network:
    external: true
EOF
```

### 3. Start PostgreSQL Containers

Start the PostgreSQL containers for HQ and branches:

```bash
# Start HQ PostgreSQL
cd banking-prototype/hq
docker-compose -f docker-compose-postgres.yml up -d

# Start Branch 1 PostgreSQL
cd ../branch1
docker-compose -f docker-compose-postgres.yml up -d

# Start Branch 2 PostgreSQL
cd ../branch2
docker-compose -f docker-compose-postgres.yml up -d

# Return to the main directory
cd ..
```

### 4. Initialize Database Schema

Create SQL initialization scripts for the databases:

```bash
cat > config/postgres/init-schema.sql << 'EOF'
-- Create tables for banking operations

-- Teller Invoice Table
CREATE TABLE IF NOT EXISTS teller_invoice (
    id SERIAL PRIMARY KEY,
    invoice_number VARCHAR(50) UNIQUE NOT NULL,
    customer_name VARCHAR(100) NOT NULL,
    transaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    amount DECIMAL(15, 2) NOT NULL,
    currency VARCHAR(10) NOT NULL,
    branch_code VARCHAR(20) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    created_by VARCHAR(50),
    modified_by VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    modified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    sync_status VARCHAR(20) DEFAULT 'pending',
    global_transaction_id UUID DEFAULT gen_random_uuid()
);

-- Currency Exchange Table
CREATE TABLE IF NOT EXISTS currency_exchange (
    id SERIAL PRIMARY KEY,
    from_currency VARCHAR(10) NOT NULL,
    to_currency VARCHAR(10) NOT NULL,
    exchange_rate DECIMAL(15, 6) NOT NULL,
    effective_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    branch_code VARCHAR(20) NOT NULL,
    created_by VARCHAR(50),
    modified_by VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    modified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    sync_status VARCHAR(20) DEFAULT 'pending',
    global_transaction_id UUID DEFAULT gen_random_uuid()
);

-- Teller Treasury Table
CREATE TABLE IF NOT EXISTS teller_treasury (
    id SERIAL PRIMARY KEY,
    treasury_code VARCHAR(50) UNIQUE NOT NULL,
    currency VARCHAR(10) NOT NULL,
    opening_balance DECIMAL(15, 2) NOT NULL,
    current_balance DECIMAL(15, 2) NOT NULL,
    branch_code VARCHAR(20) NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    created_by VARCHAR(50),
    modified_by VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    modified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    sync_status VARCHAR(20) DEFAULT 'pending',
    global_transaction_id UUID DEFAULT gen_random_uuid()
);

-- Exchange Rates Table
CREATE TABLE IF NOT EXISTS exchange_rates (
    id SERIAL PRIMARY KEY,
    currency_code VARCHAR(10) NOT NULL,
    rate_to_base DECIMAL(15, 6) NOT NULL,
    effective_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_base_currency BOOLEAN DEFAULT FALSE,
    created_by VARCHAR(50),
    modified_by VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    modified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    sync_status VARCHAR(20) DEFAULT 'pending',
    global_transaction_id UUID DEFAULT gen_random_uuid(),
    UNIQUE(currency_code, effective_date)
);

-- Branch Registry Table
CREATE TABLE IF NOT EXISTS branch_registry (
    id SERIAL PRIMARY KEY,
    branch_code VARCHAR(20) UNIQUE NOT NULL,
    branch_name VARCHAR(100) NOT NULL,
    location VARCHAR(200),
    ip_address VARCHAR(50),
    port INTEGER,
    is_active BOOLEAN DEFAULT TRUE,
    last_sync_time TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    modified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Synchronization Outbox Table
CREATE TABLE IF NOT EXISTS sync_outbox (
    id SERIAL PRIMARY KEY,
    table_name VARCHAR(50) NOT NULL,
    record_id INTEGER NOT NULL,
    operation VARCHAR(10) NOT NULL, -- INSERT, UPDATE, DELETE
    data JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP,
    status VARCHAR(20) DEFAULT 'pending',
    destination VARCHAR(50), -- 'hq' or 'branch_code'
    global_transaction_id UUID,
    UNIQUE(table_name, record_id, operation, status)
);

-- Synchronization Status Table
CREATE TABLE IF NOT EXISTS sync_status (
    id SERIAL PRIMARY KEY,
    source VARCHAR(50) NOT NULL, -- 'hq' or 'branch_code'
    destination VARCHAR(50) NOT NULL, -- 'hq' or 'branch_code'
    last_sync_time TIMESTAMP,
    status VARCHAR(20) DEFAULT 'pending',
    record_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    modified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Synchronization Conflicts Table
CREATE TABLE IF NOT EXISTS sync_conflicts (
    id SERIAL PRIMARY KEY,
    table_name VARCHAR(50) NOT NULL,
    record_id INTEGER NOT NULL,
    source_data JSONB,
    destination_data JSONB,
    conflict_type VARCHAR(50),
    resolution VARCHAR(50),
    resolved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    global_transaction_id UUID
);

-- Create triggers for synchronization

-- Function to capture changes for synchronization
CREATE OR REPLACE FUNCTION capture_changes_for_sync()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO sync_outbox (table_name, record_id, operation, data, global_transaction_id, destination)
        VALUES (TG_TABLE_NAME, NEW.id, TG_OP, row_to_json(NEW), NEW.global_transaction_id, 
                CASE WHEN TG_TABLE_NAME = 'branch_registry' THEN 'all' 
                     WHEN current_setting('app.current_branch_code', true) = 'hq' THEN NEW.branch_code
                     ELSE 'hq' END);
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO sync_outbox (table_name, record_id, operation, data, global_transaction_id, destination)
        VALUES (TG_TABLE_NAME, NEW.id, TG_OP, row_to_json(NEW), NEW.global_transaction_id,
                CASE WHEN TG_TABLE_NAME = 'branch_registry' THEN 'all' 
                     WHEN current_setting('app.current_branch_code', true) = 'hq' THEN NEW.branch_code
                     ELSE 'hq' END);
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO sync_outbox (table_name, record_id, operation, data, global_transaction_id, destination)
        VALUES (TG_TABLE_NAME, OLD.id, TG_OP, row_to_json(OLD), OLD.global_transaction_id,
                CASE WHEN TG_TABLE_NAME = 'branch_registry' THEN 'all' 
                     WHEN current_setting('app.current_branch_code', true) = 'hq' THEN OLD.branch_code
                     ELSE 'hq' END);
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for each table
CREATE TRIGGER teller_invoice_sync_trigger
AFTER INSERT OR UPDATE OR DELETE ON teller_invoice
FOR EACH ROW EXECUTE FUNCTION capture_changes_for_sync();

CREATE TRIGGER currency_exchange_sync_trigger
AFTER INSERT OR UPDATE OR DELETE ON currency_exchange
FOR EACH ROW EXECUTE FUNCTION capture_changes_for_sync();

CREATE TRIGGER teller_treasury_sync_trigger
AFTER INSERT OR UPDATE OR DELETE ON teller_treasury
FOR EACH ROW EXECUTE FUNCTION capture_changes_for_sync();

CREATE TRIGGER exchange_rates_sync_trigger
AFTER INSERT OR UPDATE OR DELETE ON exchange_rates
FOR EACH ROW EXECUTE FUNCTION capture_changes_for_sync();

-- Insert sample branch data
INSERT INTO branch_registry (branch_code, branch_name, location, ip_address, port)
VALUES 
('HQ', 'Headquarters', 'Main City', 'postgres-hq', 5432),
('BR001', 'Branch 1', 'North City', 'postgres-branch1', 5432),
('BR002', 'Branch 2', 'South City', 'postgres-branch2', 5432);

-- Set the current branch code (this would be set by the application in a real scenario)
SELECT set_config('app.current_branch_code', 'hq', false);
EOF
```

### 5. Apply Database Schema

Apply the schema to all PostgreSQL instances:

```bash
# Apply schema to HQ
docker exec -i postgres-hq psql -U postgres -d erpnext_hq < config/postgres/init-schema.sql

# Apply schema to Branch 1
docker exec -i postgres-branch1 psql -U postgres -d erpnext_branch1 < config/postgres/init-schema.sql

# Apply schema to Branch 2
docker exec -i postgres-branch2 psql -U postgres -d erpnext_branch2 < config/postgres/init-schema.sql
```

### 6. Configure Logical Replication

Set up logical replication between HQ and branches:

```bash
# Create publications in HQ for branch-to-HQ replication
docker exec -i postgres-hq psql -U postgres -d erpnext_hq << 'EOF'
-- Set branch code for HQ
SELECT set_config('app.current_branch_code', 'hq', false);

-- Create publication for branch-to-HQ replication
CREATE PUBLICATION branch_to_hq_pub FOR TABLE 
    teller_invoice, 
    currency_exchange, 
    teller_treasury, 
    exchange_rates;
EOF

# Create publications in Branch 1 for HQ-to-branch replication
docker exec -i postgres-branch1 psql -U postgres -d erpnext_branch1 << 'EOF'
-- Set branch code for Branch 1
SELECT set_config('app.current_branch_code', 'BR001', false);

-- Create publication for branch-to-HQ replication
CREATE PUBLICATION branch1_to_hq_pub FOR TABLE 
    teller_invoice, 
    currency_exchange, 
    teller_treasury, 
    exchange_rates;
EOF

# Create publications in Branch 2 for HQ-to-branch replication
docker exec -i postgres-branch2 psql -U postgres -d erpnext_branch2 << 'EOF'
-- Set branch code for Branch 2
SELECT set_config('app.current_branch_code', 'BR002', false);

-- Create publication for branch-to-HQ replication
CREATE PUBLICATION branch2_to_hq_pub FOR TABLE 
    teller_invoice, 
    currency_exchange, 
    teller_treasury, 
    exchange_rates;
EOF

# Create subscriptions in HQ for branch-to-HQ replication
docker exec -i postgres-hq psql -U postgres -d erpnext_hq << 'EOF'
-- Create subscription for Branch 1 to HQ
CREATE SUBSCRIPTION branch1_to_hq_sub 
CONNECTION 'host=postgres-branch1 port=5432 user=postgres password=postgres_branch1_password dbname=erpnext_branch1' 
PUBLICATION branch1_to_hq_pub;

-- Create subscription for Branch 2 to HQ
CREATE SUBSCRIPTION branch2_to_hq_sub 
CONNECTION 'host=postgres-branch2 port=5432 user=postgres password=postgres_branch2_password dbname=erpnext_branch2' 
PUBLICATION branch2_to_hq_pub;
EOF

# Create subscriptions in Branch 1 for HQ-to-branch replication
docker exec -i postgres-branch1 psql -U postgres -d erpnext_branch1 << 'EOF'
-- Create subscription for HQ to Branch 1
CREATE SUBSCRIPTION hq_to_branch1_sub 
CONNECTION 'host=postgres-hq port=5432 user=postgres password=postgres_hq_password dbname=erpnext_hq' 
PUBLICATION branch_to_hq_pub;
EOF

# Create subscriptions in Branch 2 for HQ-to-branch replication
docker exec -i postgres-branch2 psql -U postgres -d erpnext_branch2 << 'EOF'
-- Create subscription for HQ to Branch 2
CREATE SUBSCRIPTION hq_to_branch2_sub 
CONNECTION 'host=postgres-hq port=5432 user=postgres password=postgres_hq_password dbname=erpnext_hq' 
PUBLICATION branch_to_hq_pub;
EOF
```

## Next Steps

After setting up the PostgreSQL databases with logical replication, proceed to [Part 3: Message Queue Setup](setup_guide_part3_message_queue.md) to configure RabbitMQ for message-based synchronization. 