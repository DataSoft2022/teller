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

Create configuration files for the branch PostgreSQL instances:

```bash
# Branch 1 PostgreSQL Configuration
cat > config/postgres/postgresql-branch1.conf << 'EOF'
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

# Branch 2 PostgreSQL Configuration
cat > config/postgres/postgresql-branch2.conf << 'EOF'
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

### 2. Create Database Initialization Scripts

Create a script to initialize the database schema for the Teller app:

```bash
cat > config/postgres/init-teller-schema.sql << 'EOF'
-- Create branch registry table
CREATE TABLE branch_registry (
    id VARCHAR(20) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    address TEXT,
    contact_person VARCHAR(100),
    phone VARCHAR(20),
    email VARCHAR(100),
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create sync outbox table for change data capture
CREATE TABLE sync_outbox (
    id SERIAL PRIMARY KEY,
    table_name VARCHAR(100) NOT NULL,
    record_id VARCHAR(100) NOT NULL,
    operation VARCHAR(10) NOT NULL,
    payload JSONB NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP,
    branch_id VARCHAR(20),
    UNIQUE (table_name, record_id, operation, status)
);

-- Create sync conflicts table
CREATE TABLE sync_conflicts (
    id SERIAL PRIMARY KEY,
    table_name VARCHAR(100) NOT NULL,
    record_id VARCHAR(100) NOT NULL,
    branch_id VARCHAR(20) NOT NULL,
    local_data JSONB NOT NULL,
    remote_data JSONB NOT NULL,
    conflict_type VARCHAR(50) NOT NULL,
    resolution VARCHAR(20),
    resolved_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP
);

-- Create tables for Teller app
CREATE TABLE teller_invoice (
    name VARCHAR(140) PRIMARY KEY,
    creation TIMESTAMP,
    modified TIMESTAMP,
    modified_by VARCHAR(140),
    owner VARCHAR(140),
    docstatus INT,
    parent VARCHAR(140),
    parentfield VARCHAR(140),
    parenttype VARCHAR(140),
    idx INT,
    treasury_code VARCHAR(140),
    branch_name VARCHAR(140),
    date DATE,
    client VARCHAR(140),
    client_type VARCHAR(140),
    customer_name VARCHAR(140),
    nationality VARCHAR(140),
    national_id VARCHAR(140),
    passport_number VARCHAR(140),
    military_number VARCHAR(140),
    address TEXT,
    phone VARCHAR(140),
    mobile_number VARCHAR(140),
    job_title VARCHAR(140),
    total DECIMAL(18,6),
    status VARCHAR(140),
    branch_no VARCHAR(140),
    is_returned BOOLEAN DEFAULT FALSE,
    reason_for_selling VARCHAR(140),
    shift VARCHAR(140),
    teller VARCHAR(140)
);

CREATE TABLE teller_invoice_details (
    name VARCHAR(140) PRIMARY KEY,
    creation TIMESTAMP,
    modified TIMESTAMP,
    modified_by VARCHAR(140),
    owner VARCHAR(140),
    docstatus INT,
    parent VARCHAR(140),
    parentfield VARCHAR(140),
    parenttype VARCHAR(140),
    idx INT,
    currency VARCHAR(140),
    currency_code VARCHAR(140),
    quantity DECIMAL(18,6),
    exchange_rate DECIMAL(18,6),
    amount DECIMAL(18,6),
    egy_amount DECIMAL(18,6),
    account VARCHAR(140),
    booking_interbank VARCHAR(140)
);

CREATE TABLE update_currency_exchange (
    name VARCHAR(140) PRIMARY KEY,
    creation TIMESTAMP,
    modified TIMESTAMP,
    modified_by VARCHAR(140),
    owner VARCHAR(140),
    docstatus INT,
    parent VARCHAR(140),
    parentfield VARCHAR(140),
    parenttype VARCHAR(140),
    idx INT,
    date DATE,
    time TIME,
    user VARCHAR(140),
    notes TEXT
);

CREATE TABLE currency_exchange (
    name VARCHAR(140) PRIMARY KEY,
    creation TIMESTAMP,
    modified TIMESTAMP,
    modified_by VARCHAR(140),
    owner VARCHAR(140),
    docstatus INT,
    from_currency VARCHAR(140),
    to_currency VARCHAR(140),
    exchange_rate DECIMAL(18,6),
    custom_selling_exchange_rate DECIMAL(18,6),
    date DATE
);

CREATE TABLE booking_interbank (
    name VARCHAR(140) PRIMARY KEY,
    creation TIMESTAMP,
    modified TIMESTAMP,
    modified_by VARCHAR(140),
    owner VARCHAR(140),
    docstatus INT,
    date DATE,
    time TIME,
    customer VARCHAR(140),
    user VARCHAR(140),
    branch VARCHAR(140),
    status VARCHAR(140),
    transaction VARCHAR(140),
    interbank_refrence VARCHAR(140)
);

CREATE TABLE booked_currency (
    name VARCHAR(140) PRIMARY KEY,
    creation TIMESTAMP,
    modified TIMESTAMP,
    modified_by VARCHAR(140),
    owner VARCHAR(140),
    docstatus INT,
    parent VARCHAR(140),
    parentfield VARCHAR(140),
    parenttype VARCHAR(140),
    idx INT,
    currency VARCHAR(140),
    currency_code VARCHAR(140),
    rate DECIMAL(18,6),
    qty DECIMAL(18,6),
    booking_qty DECIMAL(18,6),
    interbank_reference VARCHAR(140),
    request_reference VARCHAR(140),
    status VARCHAR(140)
);

CREATE TABLE branch_interbank_request (
    name VARCHAR(140) PRIMARY KEY,
    creation TIMESTAMP,
    modified TIMESTAMP,
    modified_by VARCHAR(140),
    owner VARCHAR(140),
    docstatus INT,
    date DATE,
    time TIME,
    user VARCHAR(140),
    branch VARCHAR(140),
    status VARCHAR(140),
    transaction VARCHAR(140),
    describtion TEXT
);

CREATE TABLE branch_request_details (
    name VARCHAR(140) PRIMARY KEY,
    creation TIMESTAMP,
    modified TIMESTAMP,
    modified_by VARCHAR(140),
    owner VARCHAR(140),
    docstatus INT,
    parent VARCHAR(140),
    parentfield VARCHAR(140),
    parenttype VARCHAR(140),
    idx INT,
    currency VARCHAR(140),
    currency_code VARCHAR(140),
    interbank_balance DECIMAL(18,6),
    rate DECIMAL(18,6),
    qty DECIMAL(18,6),
    remaining DECIMAL(18,6)
);

-- Create indexes for better performance
CREATE INDEX idx_teller_invoice_branch ON teller_invoice(branch_name);
CREATE INDEX idx_teller_invoice_date ON teller_invoice(date);
CREATE INDEX idx_teller_invoice_client ON teller_invoice(client);
CREATE INDEX idx_teller_invoice_details_parent ON teller_invoice_details(parent);
CREATE INDEX idx_currency_exchange_from_currency ON currency_exchange(from_currency);
CREATE INDEX idx_currency_exchange_date ON currency_exchange(date);
CREATE INDEX idx_booking_interbank_date ON booking_interbank(date);
CREATE INDEX idx_booking_interbank_status ON booking_interbank(status);
CREATE INDEX idx_booked_currency_parent ON booked_currency(parent);
CREATE INDEX idx_branch_interbank_request_date ON branch_interbank_request(date);
CREATE INDEX idx_branch_interbank_request_status ON branch_interbank_request(status);
CREATE INDEX idx_branch_request_details_parent ON branch_request_details(parent);
EOF
```

### 3. Create Docker Compose Files for PostgreSQL

Create Docker Compose files for the PostgreSQL instances:

```bash
# HQ PostgreSQL Docker Compose
cat > hq/docker-compose-postgres.yml << 'EOF'
version: '3.8'

services:
  postgres-hq:
    image: postgres:14
    container_name: postgres-hq
    restart: unless-stopped
    environment:
      POSTGRES_PASSWORD: postgres_hq_password
      POSTGRES_DB: erpnext_hq
    volumes:
      - ./data/postgres:/var/lib/postgresql/data
      - ../config/postgres/postgresql-hq.conf:/etc/postgresql/postgresql.conf
      - ../config/postgres/init-teller-schema.sql:/docker-entrypoint-initdb.d/init-teller-schema.sql
    command: postgres -c config_file=/etc/postgresql/postgresql.conf
    ports:
      - "5432:5432"
    networks:
      - banking-prototype-network

networks:
  banking-prototype-network:
    external: true
EOF

# Branch 1 PostgreSQL Docker Compose
cat > branch1/docker-compose-postgres.yml << 'EOF'
version: '3.8'

services:
  postgres-branch1:
    image: postgres:14
    container_name: postgres-branch1
    restart: unless-stopped
    environment:
      POSTGRES_PASSWORD: postgres_branch1_password
      POSTGRES_DB: erpnext_branch1
    volumes:
      - ./data/postgres:/var/lib/postgresql/data
      - ../config/postgres/postgresql-branch1.conf:/etc/postgresql/postgresql.conf
      - ../config/postgres/init-teller-schema.sql:/docker-entrypoint-initdb.d/init-teller-schema.sql
    command: postgres -c config_file=/etc/postgresql/postgresql.conf
    ports:
      - "5433:5432"
    networks:
      - banking-prototype-network

networks:
  banking-prototype-network:
    external: true
EOF

# Branch 2 PostgreSQL Docker Compose
cat > branch2/docker-compose-postgres.yml << 'EOF'
version: '3.8'

services:
  postgres-branch2:
    image: postgres:14
    container_name: postgres-branch2
    restart: unless-stopped
    environment:
      POSTGRES_PASSWORD: postgres_branch2_password
      POSTGRES_DB: erpnext_branch2
    volumes:
      - ./data/postgres:/var/lib/postgresql/data
      - ../config/postgres/postgresql-branch2.conf:/etc/postgresql/postgresql.conf
      - ../config/postgres/init-teller-schema.sql:/docker-entrypoint-initdb.d/init-teller-schema.sql
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

### 4. Start PostgreSQL Containers

Start the PostgreSQL containers:

```bash
# Create the Docker network
docker network create banking-prototype-network

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

### 5. Configure Logical Replication

Configure logical replication between the PostgreSQL instances:

```bash
# Create a script to set up replication
cat > config/postgres/setup-replication.sh << 'EOF'
#!/bin/bash

# Wait for PostgreSQL to be ready
sleep 10

# Create publications in HQ for HQ-to-branch replication
docker exec -i postgres-hq psql -U postgres -d erpnext_hq << 'EOL'
-- Create publication for HQ-to-branch replication
CREATE PUBLICATION branch_to_hq_pub FOR TABLE 
    currency_exchange, 
    update_currency_exchange;
EOL

# Create publications in Branch 1 for branch-to-HQ replication
docker exec -i postgres-branch1 psql -U postgres -d erpnext_branch1 << 'EOL'
-- Create publication for branch-to-HQ replication
CREATE PUBLICATION branch1_to_hq_pub FOR TABLE 
    teller_invoice, 
    teller_invoice_details,
    booking_interbank, 
    booked_currency, 
    branch_interbank_request, 
    branch_request_details,
    update_currency_exchange;
EOL

# Create publications in Branch 2 for branch-to-HQ replication
docker exec -i postgres-branch2 psql -U postgres -d erpnext_branch2 << 'EOL'
-- Create publication for branch-to-HQ replication
CREATE PUBLICATION branch2_to_hq_pub FOR TABLE 
    teller_invoice, 
    teller_invoice_details,
    booking_interbank, 
    booked_currency, 
    branch_interbank_request, 
    branch_request_details,
    update_currency_exchange;
EOL

# Create subscriptions in HQ for branch-to-HQ replication
docker exec -i postgres-hq psql -U postgres -d erpnext_hq << 'EOL'
-- Create subscription for Branch 1 to HQ
CREATE SUBSCRIPTION branch1_to_hq_sub 
CONNECTION 'host=postgres-branch1 port=5432 user=postgres password=postgres_branch1_password dbname=erpnext_branch1' 
PUBLICATION branch1_to_hq_pub;

-- Create subscription for Branch 2 to HQ
CREATE SUBSCRIPTION branch2_to_hq_sub 
CONNECTION 'host=postgres-branch2 port=5432 user=postgres password=postgres_branch2_password dbname=erpnext_branch2' 
PUBLICATION branch2_to_hq_pub;
EOL

# Create subscriptions in Branch 1 for HQ-to-branch replication
docker exec -i postgres-branch1 psql -U postgres -d erpnext_branch1 << 'EOL'
-- Create subscription for HQ to Branch 1
CREATE SUBSCRIPTION hq_to_branch1_sub 
CONNECTION 'host=postgres-hq port=5432 user=postgres password=postgres_hq_password dbname=erpnext_hq' 
PUBLICATION branch_to_hq_pub;
EOL

# Create subscriptions in Branch 2 for HQ-to-branch replication
docker exec -i postgres-branch2 psql -U postgres -d erpnext_branch2 << 'EOL'
-- Create subscription for HQ to Branch 2
CREATE SUBSCRIPTION hq_to_branch2_sub 
CONNECTION 'host=postgres-hq port=5432 user=postgres password=postgres_hq_password dbname=erpnext_hq' 
PUBLICATION branch_to_hq_pub;
EOL
EOF

# Make the script executable
chmod +x config/postgres/setup-replication.sh

# Run the replication setup script
./config/postgres/setup-replication.sh
```

## Next Steps

After setting up the PostgreSQL databases with logical replication, proceed to [Part 3: Message Queue Setup](setup_guide_part3_message_queue.md) to configure RabbitMQ for message-based synchronization. 