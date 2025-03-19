# Part 8: Multi-Machine Deployment Guide

This guide provides detailed instructions for deploying the Teller app across multiple physical machines in a real-world scenario. It covers setting up the HQ instance and branch instances on separate machines, configuring network connectivity, and managing the system.

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Setting Up HQ (First Machine)](#setting-up-hq-first-machine)
4. [Setting Up Branches (Additional Machines)](#setting-up-branches-additional-machines)
5. [Network Configuration](#network-configuration)
6. [Application Installation](#application-installation)
7. [Testing the System](#testing-the-system)
8. [Adding New Branches](#adding-new-branches)
9. [Troubleshooting](#troubleshooting)

## Overview

This guide assumes you're setting up a multi-branch banking system where:
- HQ is on one physical machine
- Each branch is on a separate physical machine
- All machines are connected via a network (local or public)
- Each machine has its own Docker environment

## Prerequisites

Before starting, ensure each machine has:
1. Docker and Docker Compose installed
2. Git installed
3. Sufficient disk space (at least 20GB recommended)
4. Network connectivity between machines
5. Static IP addresses (recommended) or dynamic DNS setup
6. Firewall access for required ports (5432, 5672, 8000)
7. Access to the Teller app repository

## Setting Up HQ (First Machine)

### 1. Clone Repository and Create Directories

```bash
git clone https://github.com/yourusername/teller.git
mkdir -p banking-prototype/hq
cd banking-prototype
```

### 2. Configure PostgreSQL for HQ

```bash
mkdir -p config/postgres
cat > config/postgres/postgresql-hq.conf << 'EOF'
listen_addresses = '*'
max_connections = 100
shared_buffers = 128MB
wal_level = logical
max_wal_senders = 10
max_replication_slots = 10
max_worker_processes = 10
max_logical_replication_workers = 4
max_sync_workers_per_subscription = 2
EOF
```

### 3. Create HQ Docker Compose File

```bash
cat > hq/docker-compose.yml << 'EOF'
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
    command: postgres -c config_file=/etc/postgresql/postgresql.conf
    ports:
      - "5432:5432"
    networks:
      - banking-network

  erpnext-hq:
    image: frappe/erpnext:v15
    container_name: erpnext-hq
    restart: unless-stopped
    environment:
      - ADMIN_PASSWORD=admin
      - DB_HOST=postgres-hq
      - DB_PORT=5432
      - DB_NAME=erpnext_hq
      - DB_PASSWORD=postgres_hq_password
    volumes:
      - ./data/erpnext:/home/frappe/frappe-bench/sites
    ports:
      - "8000:8000"
    depends_on:
      - postgres-hq
    networks:
      - banking-network

  rabbitmq:
    image: rabbitmq:3-management
    container_name: rabbitmq-hq
    restart: unless-stopped
    environment:
      - RABBITMQ_DEFAULT_USER=admin
      - RABBITMQ_DEFAULT_PASS=admin
    ports:
      - "5672:5672"
      - "15672:15672"
    networks:
      - banking-network

networks:
  banking-network:
    driver: bridge
EOF
```

### 4. Start HQ Services

```bash
cd hq
docker-compose up -d
cd ..
```

### 5. Initialize PostgreSQL Tables

```bash
cat > scripts/init-hq-db.sql << 'EOF'
-- Create tables for Teller app
CREATE TABLE teller_invoice (
    name VARCHAR(140) PRIMARY KEY,
    creation TIMESTAMP,
    modified TIMESTAMP,
    modified_by VARCHAR(140),
    owner VARCHAR(140),
    docstatus INT,
    total DECIMAL(18,6),
    status VARCHAR(140)
);

CREATE TABLE update_currency_exchange (
    name VARCHAR(140) PRIMARY KEY,
    creation TIMESTAMP,
    modified TIMESTAMP,
    modified_by VARCHAR(140),
    owner VARCHAR(140),
    docstatus INT,
    date DATE
);

CREATE TABLE currency_exchange (
    name VARCHAR(140) PRIMARY KEY,
    from_currency VARCHAR(140),
    to_currency VARCHAR(140),
    exchange_rate DECIMAL(18,6),
    date DATE
);

-- Create publications for tables to be replicated to branches
CREATE PUBLICATION branch_to_hq_pub FOR TABLE 
    currency_exchange, 
    update_currency_exchange;
EOF

docker cp scripts/init-hq-db.sql postgres-hq:/tmp/
docker exec -it postgres-hq psql -U postgres -d erpnext_hq -f /tmp/init-hq-db.sql
```

### 6. Record HQ IP Address

```bash
HQ_IP=$(hostname -I | awk '{print $1}')
echo "HQ IP address: $HQ_IP"
```

## Setting Up Branches (Additional Machines)

### 1. Clone Repository and Create Directories

```bash
git clone https://github.com/yourusername/teller.git
mkdir -p banking-prototype/branch1
cd banking-prototype
```

### 2. Configure PostgreSQL for Branch

```bash
mkdir -p config/postgres
cat > config/postgres/postgresql-branch.conf << 'EOF'
listen_addresses = '*'
max_connections = 100
shared_buffers = 128MB
wal_level = logical
max_wal_senders = 10
max_replication_slots = 10
max_worker_processes = 10
max_logical_replication_workers = 4
max_sync_workers_per_subscription = 2
EOF
```

### 3. Create Branch Docker Compose File

```bash
cat > branch1/docker-compose.yml << 'EOF'
version: '3.8'

services:
  postgres-branch:
    image: postgres:14
    container_name: postgres-branch1
    restart: unless-stopped
    environment:
      POSTGRES_PASSWORD: postgres_branch1_password
      POSTGRES_DB: erpnext_branch1
    volumes:
      - ./data/postgres:/var/lib/postgresql/data
      - ../config/postgres/postgresql-branch.conf:/etc/postgresql/postgresql.conf
    command: postgres -c config_file=/etc/postgresql/postgresql.conf
    ports:
      - "5432:5432"
    networks:
      - banking-network

  erpnext-branch:
    image: frappe/erpnext:v15
    container_name: erpnext-branch1
    restart: unless-stopped
    environment:
      - ADMIN_PASSWORD=admin
      - DB_HOST=postgres-branch
      - DB_PORT=5432
      - DB_NAME=erpnext_branch1
      - DB_PASSWORD=postgres_branch1_password
    volumes:
      - ./data/erpnext:/home/frappe/frappe-bench/sites
    ports:
      - "8000:8000"
    depends_on:
      - postgres-branch
    networks:
      - banking-network

networks:
  banking-network:
    driver: bridge
EOF
```

### 4. Start Branch Services

```bash
cd branch1
docker-compose up -d
cd ..
```

### 5. Initialize PostgreSQL Tables

```bash
# Replace HQ_IP_ADDRESS with the actual IP of your HQ machine
cat > scripts/init-branch-db.sql << EOF
-- Create tables for Teller app
CREATE TABLE teller_invoice (
    name VARCHAR(140) PRIMARY KEY,
    creation TIMESTAMP,
    modified TIMESTAMP,
    modified_by VARCHAR(140),
    owner VARCHAR(140),
    docstatus INT,
    total DECIMAL(18,6),
    status VARCHAR(140)
);

CREATE TABLE update_currency_exchange (
    name VARCHAR(140) PRIMARY KEY,
    creation TIMESTAMP,
    modified TIMESTAMP,
    modified_by VARCHAR(140),
    owner VARCHAR(140),
    docstatus INT,
    date DATE
);

CREATE TABLE currency_exchange (
    name VARCHAR(140) PRIMARY KEY,
    from_currency VARCHAR(140),
    to_currency VARCHAR(140),
    exchange_rate DECIMAL(18,6),
    date DATE
);

-- Create publications for tables to be replicated to HQ
CREATE PUBLICATION branch_to_hq_pub FOR TABLE 
    teller_invoice, 
    update_currency_exchange;

-- Create subscription to HQ
CREATE SUBSCRIPTION hq_to_branch1_sub 
CONNECTION 'host=HQ_IP_ADDRESS port=5432 user=postgres password=postgres_hq_password dbname=erpnext_hq' 
PUBLICATION branch_to_hq_pub;
EOF

# Replace HQ_IP_ADDRESS with the actual IP
sed -i "s/HQ_IP_ADDRESS/$HQ_IP/g" scripts/init-branch-db.sql

docker cp scripts/init-branch-db.sql postgres-branch1:/tmp/
docker exec -it postgres-branch1 psql -U postgres -d erpnext_branch1 -f /tmp/init-branch-db.sql
```

### 6. Record Branch IP Address

```bash
BRANCH_IP=$(hostname -I | awk '{print $1}')
echo "Branch IP address: $BRANCH_IP"
```

## Network Configuration

### On the HQ Machine

1. **Configure HQ to accept connections from branches:**

```bash
# Replace BRANCH_IP_ADDRESS with the actual IP of your branch machine
cat > scripts/hq-branch-connection.sql << EOF
-- Create replication slot for branch
SELECT pg_create_logical_replication_slot('branch1_slot', 'pgoutput');

-- Create subscription to Branch1
CREATE SUBSCRIPTION branch1_to_hq_sub 
CONNECTION 'host=BRANCH_IP_ADDRESS port=5432 user=postgres password=postgres_branch1_password dbname=erpnext_branch1' 
PUBLICATION branch_to_hq_pub;
EOF

# Replace BRANCH_IP_ADDRESS with the actual IP
sed -i "s/BRANCH_IP_ADDRESS/$BRANCH_IP/g" scripts/hq-branch-connection.sql

docker cp scripts/hq-branch-connection.sql postgres-hq:/tmp/
docker exec -it postgres-hq psql -U postgres -d erpnext_hq -f /tmp/hq-branch-connection.sql
```

2. **Configure firewall:**

```bash
sudo ufw allow 5432/tcp
sudo ufw allow 5672/tcp
sudo ufw allow 8000/tcp
```

### On Each Branch Machine

1. **Configure firewall:**

```bash
sudo ufw allow 5432/tcp
sudo ufw allow 8000/tcp
```

## Application Installation

### On the HQ Machine

1. **Initialize ERPNext site:**

```bash
docker exec -it erpnext-hq bench new-site hq.banking.local \
  --db-type postgres \
  --db-host postgres-hq \
  --db-port 5432 \
  --db-name erpnext_hq \
  --db-user postgres \
  --db-password postgres_hq_password \
  --admin-password admin
```

2. **Install ERPNext app:**

```bash
docker exec -it erpnext-hq bench --site hq.banking.local install-app erpnext
```

3. **Install Payments app:**

```bash
docker exec -it erpnext-hq bench get-app payments
docker exec -it erpnext-hq bench --site hq.banking.local install-app payments
```

4. **Install HRMS app:**

```bash
docker exec -it erpnext-hq bench get-app hrms
docker exec -it erpnext-hq bench --site hq.banking.local install-app hrms
```

5. **Install Teller app:**

```bash
# Clone the Teller app repository if not already done
# Replace the URL with the actual Teller app repository URL
git clone https://github.com/yourusername/teller.git ./teller-app

# Copy the Teller app to the container
docker cp ./teller-app erpnext-hq:/home/frappe/frappe-bench/apps/teller

# Install the app's dependencies
docker exec -it erpnext-hq bash -c "cd /home/frappe/frappe-bench/apps/teller && pip install -e ."

# Install the app to the site
docker exec -it erpnext-hq bench --site hq.banking.local install-app teller
```

6. **Configure HQ-specific settings:**

```bash
docker exec -it erpnext-hq bench --site hq.banking.local set-config branch_code "HQ"
docker exec -it erpnext-hq bench --site hq.banking.local set-config sync_service_url "http://rabbitmq-hq:3000/sync"
```

### On Each Branch Machine

1. **Initialize ERPNext site:**

```bash
docker exec -it erpnext-branch1 bench new-site branch1.banking.local \
  --db-type postgres \
  --db-host postgres-branch \
  --db-port 5432 \
  --db-name erpnext_branch1 \
  --db-user postgres \
  --db-password postgres_branch1_password \
  --admin-password admin
```

2. **Install ERPNext app:**

```bash
docker exec -it erpnext-branch1 bench --site branch1.banking.local install-app erpnext
```

3. **Install Payments app:**

```bash
docker exec -it erpnext-branch1 bench get-app payments
docker exec -it erpnext-branch1 bench --site branch1.banking.local install-app payments
```

4. **Install HRMS app:**

```bash
docker exec -it erpnext-branch1 bench get-app hrms
docker exec -it erpnext-branch1 bench --site branch1.banking.local install-app hrms
```

5. **Install Teller app:**

```bash
# Clone the Teller app repository if not already done
# Replace the URL with the actual Teller app repository URL
git clone https://github.com/yourusername/teller.git ./teller-app

# Copy the Teller app to the container
docker cp ./teller-app erpnext-branch1:/home/frappe/frappe-bench/apps/teller

# Install the app's dependencies
docker exec -it erpnext-branch1 bash -c "cd /home/frappe/frappe-bench/apps/teller && pip install -e ."

# Install the app to the site
docker exec -it erpnext-branch1 bench --site branch1.banking.local install-app teller
```

6. **Configure Branch-specific settings:**

```bash
docker exec -it erpnext-branch1 bench --site branch1.banking.local set-config branch_code "BR01"
docker exec -it erpnext-branch1 bench --site branch1.banking.local set-config sync_service_url "http://$HQ_IP:3000/sync"
```

## Testing the System

### 1. Test Database Replication from HQ to Branch

```bash
# On HQ
docker exec -it postgres-hq psql -U postgres -d erpnext_hq -c "INSERT INTO currency_exchange (name, from_currency, to_currency, exchange_rate, date) VALUES ('TEST-HQ-TO-BRANCH', 'USD', 'EUR', 0.85, CURRENT_DATE);"

# On Branch
docker exec -it postgres-branch1 psql -U postgres -d erpnext_branch1 -c "SELECT * FROM currency_exchange WHERE name = 'TEST-HQ-TO-BRANCH';"
```

### 2. Test Database Replication from Branch to HQ

```bash
# On Branch
docker exec -it postgres-branch1 psql -U postgres -d erpnext_branch1 -c "INSERT INTO teller_invoice (name, creation, docstatus, total, status) VALUES ('TEST-BRANCH-TO-HQ', CURRENT_TIMESTAMP, 0, 100.00, 'Draft');"

# On HQ
docker exec -it postgres-hq psql -U postgres -d erpnext_hq -c "SELECT * FROM teller_invoice WHERE name = 'TEST-BRANCH-TO-HQ';"
```

## Adding New Branches

To add a new branch (e.g., Branch2) to an existing network:

1. **Set up the new branch** following the "Setting Up Branches" section above, but change branch1 to branch2 in all commands

2. **Configure networking** from new branch to HQ:
   ```bash
   # On the new branch machine
   # In the init-branch-db.sql script
   CREATE SUBSCRIPTION hq_to_branch2_sub 
   CONNECTION 'host=HQ_IP_ADDRESS port=5432 user=postgres password=postgres_hq_password dbname=erpnext_hq' 
   PUBLICATION branch_to_hq_pub;
   ```

3. **Configure HQ to connect to the new branch:**
   ```bash
   # On HQ machine
   # Create slot and subscription for the new branch
   SELECT pg_create_logical_replication_slot('branch2_slot', 'pgoutput');
   
   CREATE SUBSCRIPTION branch2_to_hq_sub 
   CONNECTION 'host=BRANCH2_IP_ADDRESS port=5432 user=postgres password=postgres_branch2_password dbname=erpnext_branch2' 
   PUBLICATION branch_to_hq_pub;
   ```

4. **Install and configure all required apps** on the new branch following the "Application Installation" section

5. **Update branch-specific settings:**
   ```bash
   docker exec -it erpnext-branch2 bench --site branch2.banking.local set-config branch_code "BR02"
   ```

## Troubleshooting

### Network Connectivity Issues

**Problem**: Branches cannot connect to HQ database
**Solution**:
```bash
# Check if PostgreSQL is accepting connections
sudo netstat -tulpn | grep 5432

# Make sure PostgreSQL is configured to listen on all interfaces
# Check postgresql.conf for: listen_addresses = '*'

# Test connection manually
psql -h HQ_IP_ADDRESS -U postgres -d erpnext_hq
```

### Replication Issues

**Problem**: Data is not replicating between instances
**Solution**:
```bash
# Check replication status on HQ
docker exec -it postgres-hq psql -U postgres -d erpnext_hq -c "SELECT * FROM pg_stat_replication;"

# Check subscription status
docker exec -it postgres-hq psql -U postgres -d erpnext_hq -c "SELECT * FROM pg_stat_subscription;"

# If needed, drop and recreate the subscription
docker exec -it postgres-branch1 psql -U postgres -d erpnext_branch1 -c "DROP SUBSCRIPTION hq_to_branch1_sub;"
docker exec -it postgres-branch1 psql -U postgres -d erpnext_branch1 -c "CREATE SUBSCRIPTION hq_to_branch1_sub CONNECTION 'host=HQ_IP_ADDRESS port=5432 user=postgres password=postgres_hq_password dbname=erpnext_hq' PUBLICATION branch_to_hq_pub;"
```

### ERPNext Issues

**Problem**: ERPNext site not working
**Solution**:
```bash
# Check ERPNext logs
docker logs erpnext-hq

# Rebuild the site
docker exec -it erpnext-hq bench --site hq.banking.local migrate
docker exec -it erpnext-hq bench --site hq.banking.local clear-cache
```

## Next Steps

After completing the multi-machine setup:

1. Review the [Backup and Recovery Guide](setup_guide_part6_backup.md) to ensure proper data protection
2. Follow the [Testing Guide](setup_guide_part5_testing.md) to verify system functionality
3. Consider the [Production Deployment Guide](setup_guide_part7_production.md) for production environment setup 