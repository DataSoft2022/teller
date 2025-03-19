#!/bin/bash

# setup_branch.sh - Automated setup script for Branch node in multi-branch banking system
# This script sets up a Branch component of the multi-branch banking system on a single machine
# Usage: ./setup_branch.sh BRANCH_ID [HQ_IP]

# Check if branch ID is provided
if [ $# -lt 1 ]; then
    echo "Error: Branch ID is required."
    echo "Usage: $0 BRANCH_ID [HQ_IP]"
    echo "Example: $0 BR01 192.168.1.100"
    exit 1
fi

# Configuration Variables
BRANCH_ID=$1
BRANCH_CODE=$1
BRANCH_DB_NAME="erpnext_${BRANCH_ID,,}"
BRANCH_DB_PASSWORD="postgres_${BRANCH_ID,,}_password"
BRANCH_ADMIN_PASSWORD="admin"
BRANCH_SITE_NAME="${BRANCH_ID,,}.banking.local"
TELLER_REPO="https://github.com/yourusername/teller.git"

# If HQ_IP is provided as parameter, use it
if [ $# -ge 2 ]; then
    HQ_IP=$2
    HQ_IP_PROVIDED=true
else
    HQ_IP="REPLACE_WITH_HQ_IP"
    HQ_IP_PROVIDED=false
fi
HQ_DB_PASSWORD="postgres_hq_password"

# Print header
echo "=========================================================="
echo "        MULTI-BRANCH BANKING SYSTEM - BRANCH SETUP        "
echo "         Branch ID: $BRANCH_ID                            "
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
echo "[1/7] Creating directory structure..."
mkdir -p banking-prototype/{branch-${BRANCH_ID,,},shared}
cd banking-prototype

# Configure PostgreSQL for Branch
echo "[2/7] Setting up PostgreSQL configuration..."
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

# Create Branch Docker Compose File
echo "[3/7] Creating Docker Compose file for Branch $BRANCH_ID..."
mkdir -p branch-${BRANCH_ID,,}
cat > branch-${BRANCH_ID,,}/docker-compose.yml << EOF
version: '3.8'

services:
  postgres-branch:
    image: postgres:14
    container_name: postgres-${BRANCH_ID,,}
    restart: unless-stopped
    environment:
      POSTGRES_PASSWORD: ${BRANCH_DB_PASSWORD}
      POSTGRES_DB: ${BRANCH_DB_NAME}
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
    container_name: erpnext-${BRANCH_ID,,}
    restart: unless-stopped
    environment:
      - ADMIN_PASSWORD=${BRANCH_ADMIN_PASSWORD}
      - DB_HOST=postgres-branch
      - DB_PORT=5432
      - DB_NAME=${BRANCH_DB_NAME}
      - DB_PASSWORD=${BRANCH_DB_PASSWORD}
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

# Create scripts directory
echo "[4/7] Creating scripts for database initialization..."
mkdir -p scripts

# Create Database Initialization Script
cat > scripts/init-branch-db.sql << EOF
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

-- Create publications for tables to be replicated to HQ
CREATE PUBLICATION branch_to_hq_pub FOR TABLE 
    teller_invoice, 
    update_currency_exchange;

-- Create subscription to HQ (will be executed only if HQ_IP is provided)
CREATE SUBSCRIPTION hq_to_${BRANCH_ID,,}_sub 
CONNECTION 'host=${HQ_IP} port=5432 user=postgres password=${HQ_DB_PASSWORD} dbname=erpnext_hq' 
PUBLICATION branch_to_hq_pub;
EOF

# Create Firewall configuration script
echo "[5/7] Creating firewall configuration script..."
cat > scripts/configure_firewall.sh << 'EOF'
#!/bin/bash
# Configure firewall to allow necessary ports
sudo ufw allow 5432/tcp
sudo ufw allow 8000/tcp
echo "Firewall configured to allow PostgreSQL and ERPNext ports"
EOF
chmod +x scripts/configure_firewall.sh

# Create HQ connection script
echo "[6/7] Creating HQ connection script..."
cat > scripts/connect_to_hq.sh << 'EOF'
#!/bin/bash
# Script to connect this branch to HQ
# Usage: ./connect_to_hq.sh HQ_IP [BRANCH_ID]

if [ $# -lt 1 ]; then
    echo "Usage: $0 HQ_IP [BRANCH_ID]"
    echo "Example: $0 192.168.1.100 BR01"
    exit 1
fi

HQ_IP=$1

# If branch ID is provided as parameter, use it, otherwise try to determine from directory name
if [ $# -ge 2 ]; then
    BRANCH_ID=$2
else
    CURRENT_DIR=$(basename $(pwd))
    if [[ $CURRENT_DIR =~ ^branch-(.*)$ ]]; then
        BRANCH_ID=${BASH_REMATCH[1]^^}
    else
        echo "Error: Could not determine branch ID. Please provide it as parameter."
        exit 1
    fi
fi

BRANCH_DB_NAME="erpnext_${BRANCH_ID,,}"
BRANCH_DB_PASSWORD="postgres_${BRANCH_ID,,}_password"

echo "Connecting branch $BRANCH_ID to HQ at $HQ_IP..."

# Update subscription in the database
cat > /tmp/connect-to-hq.sql << EOL
-- Drop subscription if exists
DROP SUBSCRIPTION IF EXISTS hq_to_${BRANCH_ID,,}_sub;

-- Create subscription to HQ
CREATE SUBSCRIPTION hq_to_${BRANCH_ID,,}_sub 
CONNECTION 'host=${HQ_IP} port=5432 user=postgres password=postgres_hq_password dbname=erpnext_hq' 
PUBLICATION branch_to_hq_pub;
EOL

# Execute SQL script
docker cp /tmp/connect-to-hq.sql postgres-${BRANCH_ID,,}:/tmp/
docker exec -it postgres-${BRANCH_ID,,} psql -U postgres -d ${BRANCH_DB_NAME} -f /tmp/connect-to-hq.sql

echo "Branch $BRANCH_ID is now connected to HQ at $HQ_IP."
echo "Important: You must also configure HQ to connect to this branch."
echo "On the HQ machine, run: ./scripts/connect_branch.sh ${BRANCH_ID} $(hostname -I | awk '{print $1}') ${BRANCH_DB_PASSWORD}"
EOF
chmod +x scripts/connect_to_hq.sh

# Create start and post-setup scripts
echo "[7/7] Creating operational scripts..."

# Start Branch script
cat > start_branch.sh << EOF
#!/bin/bash
echo "Starting Branch ${BRANCH_ID} services..."
cd branch-${BRANCH_ID,,}
docker-compose up -d
cd ..

# Store the Branch IP address for reference
BRANCH_IP=\$(hostname -I | awk '{print \$1}')
echo "Branch ${BRANCH_ID} IP address: \$BRANCH_IP" > branch_${BRANCH_ID,,}_ip.txt
echo "Branch ${BRANCH_ID} started successfully! IP address saved to branch_${BRANCH_ID,,}_ip.txt"
echo "Access ERPNext at: http://\$BRANCH_IP:8000"
EOF
chmod +x start_branch.sh

# Post-setup script for Branch
cat > post_setup_branch.sh << EOF
#!/bin/bash
echo "Performing post-setup configuration for Branch ${BRANCH_ID}..."

# Initialize ERPNext site
echo "[1/5] Initializing ERPNext site..."
docker exec -it erpnext-${BRANCH_ID,,} bench new-site ${BRANCH_SITE_NAME} \\
  --db-type postgres \\
  --db-host postgres-branch \\
  --db-port 5432 \\
  --db-name ${BRANCH_DB_NAME} \\
  --db-user postgres \\
  --db-password ${BRANCH_DB_PASSWORD} \\
  --admin-password ${BRANCH_ADMIN_PASSWORD}

# Install ERPNext app
echo "[2/5] Installing ERPNext app..."
docker exec -it erpnext-${BRANCH_ID,,} bench --site ${BRANCH_SITE_NAME} install-app erpnext

# Install Payments app
echo "[3/5] Installing Payments app..."
docker exec -it erpnext-${BRANCH_ID,,} bench get-app payments
docker exec -it erpnext-${BRANCH_ID,,} bench --site ${BRANCH_SITE_NAME} install-app payments

# Install HRMS app
echo "[4/5] Installing HRMS app..."
docker exec -it erpnext-${BRANCH_ID,,} bench get-app hrms
docker exec -it erpnext-${BRANCH_ID,,} bench --site ${BRANCH_SITE_NAME} install-app hrms

# Clone and install Teller app
echo "[5/5] Installing Teller app..."
if [ ! -d "./teller-app" ]; then
    echo "Cloning Teller app repository..."
    # Try cloning the repository
    if ! git clone ${TELLER_REPO} ./teller-app; then
        echo "Failed to clone repository automatically."
        echo "This might be because the repository is private."
        echo ""
        echo "Options:"
        echo "1. If using SSH key authentication, ensure your SSH key is set up properly."
        echo "2. If using HTTPS, make sure your token is included in the repository URL."
        echo "3. You can manually clone the repository and continue:"
        echo "   git clone <your-repo-url> ./teller-app"
        echo ""
        read -p "Press enter to continue once you've manually cloned the repository, or Ctrl+C to cancel..." dummy
        
        if [ ! -d "./teller-app" ]; then
            echo "Teller app directory still not found. Cannot proceed."
            exit 1
        fi
    fi
fi

# Copy the Teller app to the container
echo "Copying Teller app to container..."
docker cp ./teller-app erpnext-${BRANCH_ID,,}:/home/frappe/frappe-bench/apps/teller

# Install the app's dependencies
echo "Installing Teller app dependencies..."
docker exec -it erpnext-${BRANCH_ID,,} bash -c "cd /home/frappe/frappe-bench/apps/teller && pip install -e ."

# Install the app to the site
echo "Installing Teller app to site..."
docker exec -it erpnext-${BRANCH_ID,,} bench --site ${BRANCH_SITE_NAME} install-app teller

# Configure Branch-specific settings
docker exec -it erpnext-${BRANCH_ID,,} bench --site ${BRANCH_SITE_NAME} set-config branch_code "${BRANCH_CODE}"

# Configure sync service URL if HQ IP is provided
if [ "$HQ_IP_PROVIDED" = true ]; then
    docker exec -it erpnext-${BRANCH_ID,,} bench --site ${BRANCH_SITE_NAME} set-config sync_service_url "http://${HQ_IP}:3000/sync"
    echo "Configured to connect to HQ at ${HQ_IP}"
else
    echo "HQ IP not provided. You will need to update the sync_service_url later."
    echo "Run: docker exec -it erpnext-${BRANCH_ID,,} bench --site ${BRANCH_SITE_NAME} set-config sync_service_url \"http://HQ_IP:3000/sync\""
fi

echo "Branch ${BRANCH_ID} post-setup configuration complete!"
echo "You can now access the ERPNext instance at: http://\$(hostname -I | awk '{print \$1}'):8000"
echo "Login with username: Administrator and password: ${BRANCH_ADMIN_PASSWORD}"
EOF
chmod +x post_setup_branch.sh

# Create a readme file to explain the process
cat > README_BRANCH.md << EOF
# Branch ${BRANCH_ID} Node Setup Instructions

This directory contains scripts to set up the Branch ${BRANCH_ID} node for the multi-branch banking system.

## Setup Process

1. **Run the setup script**:
   ```
   ./setup_branch.sh ${BRANCH_ID} [HQ_IP]
   ```
   This will create the necessary files and directories.

2. **Configure firewall** (if needed):
   ```
   ./scripts/configure_firewall.sh
   ```

3. **Start Branch services**:
   ```
   ./start_branch.sh
   ```
   Wait for containers to be fully running (about 30-60 seconds).

4. **Initialize ERPNext and install apps**:
   ```
   ./post_setup_branch.sh
   ```
   This will set up ERPNext with the required apps.

5. **Record your Branch IP address**:
   The Branch IP address is saved to \`branch_${BRANCH_ID,,}_ip.txt\` - you'll need to provide this to HQ.

## Connecting to HQ

If HQ IP wasn't provided during setup or needs to be updated:
```
./scripts/connect_to_hq.sh HQ_IP_ADDRESS
```

## Important Note

After connecting this branch to HQ, you must also configure HQ to accept connections from this branch.

On the HQ machine, someone must run:
```
./scripts/connect_branch.sh ${BRANCH_ID} YOUR_BRANCH_IP ${BRANCH_DB_PASSWORD}
```
Where \`YOUR_BRANCH_IP\` is the IP address of this machine.

## Accessing Services

- ERPNext: http://BRANCH_IP:8000
EOF

echo "=========================================================="
echo "               BRANCH ${BRANCH_ID} SETUP COMPLETED!                "
echo "=========================================================="
echo "To start Branch ${BRANCH_ID} services:"
echo "  ./start_branch.sh"
echo ""
echo "After services are running, initialize ERPNext and apps:"
echo "  ./post_setup_branch.sh"
echo ""
if [ "$HQ_IP_PROVIDED" = false ]; then
echo "To connect to HQ later:"
echo "  ./scripts/connect_to_hq.sh HQ_IP_ADDRESS"
echo ""
fi
echo "See README_BRANCH.md for more details"
echo "==========================================================" 