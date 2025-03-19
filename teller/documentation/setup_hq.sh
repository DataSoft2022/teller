#!/bin/bash

# setup_hq.sh - Automated setup script for Headquarters node in multi-branch banking system
# This script sets up the HQ component of the multi-branch banking system on a single machine

# Configuration Variables - Change these as needed
TELLER_REPO="https://github.com/yourusername/teller.git"
HQ_CODE="HQ"
HQ_DB_PASSWORD="postgres_hq_password"
HQ_ADMIN_PASSWORD="admin"
HQ_SITE_NAME="hq.banking.local"
RABBITMQ_USER="admin"
RABBITMQ_PASS="admin"

# Print header
echo "=========================================================="
echo "         MULTI-BRANCH BANKING SYSTEM - HQ SETUP           "
echo "=========================================================="

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "Error: Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "Error: Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Create directory structure
echo "[1/8] Creating directory structure..."
mkdir -p banking-prototype/{hq,shared}
cd banking-prototype

# Configure PostgreSQL for HQ
echo "[2/8] Setting up PostgreSQL configuration..."
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

# Create HQ Docker Compose File
echo "[3/8] Creating Docker Compose file for HQ..."
mkdir -p hq
cat > hq/docker-compose.yml << EOF
version: '3.8'

services:
  postgres-hq:
    image: postgres:14
    container_name: postgres-hq
    restart: unless-stopped
    environment:
      POSTGRES_PASSWORD: ${HQ_DB_PASSWORD}
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
      - ADMIN_PASSWORD=${HQ_ADMIN_PASSWORD}
      - DB_HOST=postgres-hq
      - DB_PORT=5432
      - DB_NAME=erpnext_hq
      - DB_PASSWORD=${HQ_DB_PASSWORD}
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
      - RABBITMQ_DEFAULT_USER=${RABBITMQ_USER}
      - RABBITMQ_DEFAULT_PASS=${RABBITMQ_PASS}
    ports:
      - "5672:5672"
      - "15672:15672"
    networks:
      - banking-network

networks:
  banking-network:
    driver: bridge
EOF

# Create scripts directory
echo "[4/8] Creating scripts for database initialization..."
mkdir -p scripts

# Create Database Initialization Script
cat > scripts/init-hq-db.sql << 'EOF'
-- Create tables for Teller app
CREATE TABLE IF NOT EXISTS teller_invoice (
    name VARCHAR(140) PRIMARY KEY,
    creation TIMESTAMP,
    modified TIMESTAMP,
    modified_by VARCHAR(140),
    owner VARCHAR(140),
    docstatus INT,
    total DECIMAL(18,6),
    status VARCHAR(140)
);

CREATE TABLE IF NOT EXISTS update_currency_exchange (
    name VARCHAR(140) PRIMARY KEY,
    creation TIMESTAMP,
    modified TIMESTAMP,
    modified_by VARCHAR(140),
    owner VARCHAR(140),
    docstatus INT,
    date DATE
);

CREATE TABLE IF NOT EXISTS currency_exchange (
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

# Create Firewall configuration script
echo "[5/8] Creating firewall configuration script..."
cat > scripts/configure_firewall.sh << 'EOF'
#!/bin/bash
# Configure firewall to allow necessary ports
sudo ufw allow 5432/tcp
sudo ufw allow 5672/tcp
sudo ufw allow 8000/tcp
sudo ufw allow 15672/tcp
echo "Firewall configured to allow PostgreSQL, RabbitMQ, and ERPNext ports"
EOF
chmod +x scripts/configure_firewall.sh

# Create branch connection script template
echo "[6/8] Creating branch connection script template..."
cat > scripts/connect_branch.sh << 'EOF'
#!/bin/bash
# Script to connect a new branch to HQ
# Usage: ./connect_branch.sh BRANCH_ID BRANCH_IP BRANCH_DB_PASSWORD

if [ $# -ne 3 ]; then
    echo "Usage: $0 BRANCH_ID BRANCH_IP BRANCH_DB_PASSWORD"
    echo "Example: $0 BR01 192.168.1.101 postgres_branch1_password"
    exit 1
fi

BRANCH_ID=$1
BRANCH_IP=$2
BRANCH_DB_PASSWORD=$3
BRANCH_DB_NAME="erpnext_${BRANCH_ID,,}"

echo "Connecting branch $BRANCH_ID at $BRANCH_IP to HQ..."

# Create replication slot and subscription for the branch
cat > /tmp/connect-branch.sql << EOL
-- Create replication slot for branch
SELECT pg_create_logical_replication_slot('${BRANCH_ID,,}_slot', 'pgoutput');

-- Create subscription to Branch
CREATE SUBSCRIPTION ${BRANCH_ID,,}_to_hq_sub 
CONNECTION 'host=$BRANCH_IP port=5432 user=postgres password=$BRANCH_DB_PASSWORD dbname=$BRANCH_DB_NAME' 
PUBLICATION branch_to_hq_pub;
EOL

# Execute SQL script
docker cp /tmp/connect-branch.sql postgres-hq:/tmp/
docker exec -it postgres-hq psql -U postgres -d erpnext_hq -f /tmp/connect-branch.sql

echo "Branch $BRANCH_ID connection configuration complete!"
EOF
chmod +x scripts/connect_branch.sh

# Create start and post-setup scripts
echo "[7/8] Creating operational scripts..."

# Start HQ script
cat > start_hq.sh << 'EOF'
#!/bin/bash
echo "Starting HQ services..."
cd hq
docker-compose up -d
cd ..

# Store the HQ IP address for reference
HQ_IP=$(hostname -I | awk '{print $1}')
echo "HQ IP address: $HQ_IP" > hq_ip.txt
echo "HQ started successfully! IP address saved to hq_ip.txt"
echo "Access ERPNext at: http://$HQ_IP:8000"
echo "Access RabbitMQ management at: http://$HQ_IP:15672"
EOF
chmod +x start_hq.sh

# Post-setup script for HQ
cat > post_setup_hq.sh << EOF
#!/bin/bash
echo "Performing post-setup configuration for HQ..."

# Initialize ERPNext site
echo "[1/5] Initializing ERPNext site..."
docker exec -it erpnext-hq bench new-site ${HQ_SITE_NAME} \\
  --db-type postgres \\
  --db-host postgres-hq \\
  --db-port 5432 \\
  --db-name erpnext_hq \\
  --db-user postgres \\
  --db-password ${HQ_DB_PASSWORD} \\
  --admin-password ${HQ_ADMIN_PASSWORD}

# Install ERPNext app
echo "[2/5] Installing ERPNext app..."
docker exec -it erpnext-hq bench --site ${HQ_SITE_NAME} install-app erpnext

# Install Payments app
echo "[3/5] Installing Payments app..."
docker exec -it erpnext-hq bench get-app payments
docker exec -it erpnext-hq bench --site ${HQ_SITE_NAME} install-app payments

# Install HRMS app
echo "[4/5] Installing HRMS app..."
docker exec -it erpnext-hq bench get-app hrms
docker exec -it erpnext-hq bench --site ${HQ_SITE_NAME} install-app hrms

# Clone and install Teller app
echo "[5/5] Installing Teller app..."
if [ ! -d "./teller-app" ]; then
    echo "Cloning Teller app repository..."
    git clone ${TELLER_REPO} ./teller-app
fi

# Copy the Teller app to the container
docker cp ./teller-app erpnext-hq:/home/frappe/frappe-bench/apps/teller

# Install the app's dependencies
docker exec -it erpnext-hq bash -c "cd /home/frappe/frappe-bench/apps/teller && pip install -e ."

# Install the app to the site
docker exec -it erpnext-hq bench --site ${HQ_SITE_NAME} install-app teller

# Configure HQ-specific settings
docker exec -it erpnext-hq bench --site ${HQ_SITE_NAME} set-config branch_code "${HQ_CODE}"
docker exec -it erpnext-hq bench --site ${HQ_SITE_NAME} set-config sync_service_url "http://rabbitmq-hq:3000/sync"

echo "HQ post-setup configuration complete!"
echo "You can now access the ERPNext instance at: http://\$(hostname -I | awk '{print \$1}'):8000"
echo "Login with username: Administrator and password: ${HQ_ADMIN_PASSWORD}"
EOF
chmod +x post_setup_hq.sh

# Create a readme file to explain the process
echo "[8/8] Creating README file..."
cat > README_HQ.md << 'EOF'
# HQ Node Setup Instructions

This directory contains scripts to set up the HQ node for the multi-branch banking system.

## Setup Process

1. **Review the configuration**: Examine the `setup_hq.sh` script to adjust any configuration variables if needed.

2. **Run the setup script**:
   ```
   ./setup_hq.sh
   ```
   This will create the necessary files and directories.

3. **Configure firewall** (if needed):
   ```
   ./scripts/configure_firewall.sh
   ```

4. **Start HQ services**:
   ```
   ./start_hq.sh
   ```
   Wait for containers to be fully running (about 30-60 seconds).

5. **Initialize ERPNext and install apps**:
   ```
   ./post_setup_hq.sh
   ```
   This will set up ERPNext with the required apps.

6. **Record your HQ IP address**:
   The HQ IP address is saved to `hq_ip.txt` - you'll need to provide this to branch setups.

## Connecting Branches

When a branch is ready to connect to HQ, use:
```
./scripts/connect_branch.sh BRANCH_ID BRANCH_IP BRANCH_PASSWORD
```
Example:
```
./scripts/connect_branch.sh BR01 192.168.1.101 postgres_branch1_password
```

## Accessing Services

- ERPNext: http://HQ_IP:8000
- RabbitMQ Management: http://HQ_IP:15672 (username: admin, password: admin)
EOF

echo "=========================================================="
echo "                  HQ SETUP COMPLETED!                     "
echo "=========================================================="
echo "To start HQ services:"
echo "  ./start_hq.sh"
echo ""
echo "After services are running, initialize ERPNext and apps:"
echo "  ./post_setup_hq.sh"
echo ""
echo "To connect a branch later:"
echo "  ./scripts/connect_branch.sh BRANCH_ID BRANCH_IP BRANCH_PASSWORD"
echo ""
echo "See README_HQ.md for more details"
echo "==========================================================" 