#!/bin/bash

# setup_hq.sh - Automated setup script for Headquarters node in multi-branch banking system
# This script sets up the HQ component of the multi-branch banking system on a single machine

# Configuration Variables - Change these as needed
TELLER_REPO="https://github.com/DataSoft2022/teller.git"
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

# Function to check if a command exists
command_exists() {
    command -v "$1" &> /dev/null
}

# Function to check for Windows line endings
check_line_endings() {
    if grep -q $'\r' "$0"; then
        echo "WARNING: This script has Windows-style line endings (CRLF) which may cause errors."
        echo "Would you like to fix the line endings now? [y/N]"
        read -r answer
        if [[ "$answer" =~ ^[Yy]$ ]]; then
            if command_exists dos2unix; then
                dos2unix "$0"
                echo "Line endings fixed. Please run the script again."
                exit 0
            else
                if command_exists apt-get; then
                    echo "Installing dos2unix tool..."
                    sudo apt-get update && sudo apt-get install -y dos2unix
                    dos2unix "$0"
                    echo "Line endings fixed. Please run the script again."
                    exit 0
                else
                    echo "Cannot automatically install dos2unix. Please install it manually or fix line endings."
                    exit 1
                fi
            fi
        fi
    fi
}

# Find the requirements.txt file
find_requirements_file() {
    # Try to find the requirements.txt in various locations
    local script_dir="$(dirname "$(readlink -f "$0")")"
    local possible_locations=(
        "./requirements.txt"
        "../requirements.txt"
        "${script_dir}/requirements.txt"
        "${script_dir}/../requirements.txt"
        "${script_dir}/../../requirements.txt"
        "${script_dir}/../documentation/requirements.txt"
    )

    for location in "${possible_locations[@]}"; do
        if [ -f "$location" ]; then
            echo "$location"
            return 0
        fi
    done

    # If we can't find the file, return a default list of dependencies
    echo ""
    return 1
}

# Check and install dependencies
check_and_install_dependencies() {
    local missing_deps=()
    local system_deps=("docker" "docker-compose" "git")
    local requirements_file=$(find_requirements_file)

    echo "Checking required dependencies..."
    
    # If requirements file found, read system dependencies from it
    if [ -n "$requirements_file" ]; then
        echo "Using requirements from: $requirements_file"
        # Extract system dependencies from requirements.txt (lines starting with # System Dependencies)
        read_system_deps=false
        while IFS= read -r line; do
            if [[ "$line" == "# System Dependencies" ]]; then
                read_system_deps=true
                continue
            elif [[ "$line" == "#"* && "$line" != "# "* ]]; then
                read_system_deps=false
            fi

            if [ "$read_system_deps" = true ] && [[ "$line" != "#"* ]] && [ -n "$line" ]; then
                # Extract package name (before >= or ==)
                dep=$(echo "$line" | sed 's/\([a-zA-Z0-9_-]*\).*/\1/')
                if [ -n "$dep" ]; then
                    system_deps+=("$dep")
                fi
            fi
        done < "$requirements_file"
    else
        echo "Requirements file not found, using default dependencies."
    fi
    
    # Check all dependencies
    for dep in "${system_deps[@]}"; do
        if ! command_exists "$dep"; then
            missing_deps+=("$dep")
        else
            echo "✓ $dep is installed"
            # Optionally check version if needed
            if [ "$dep" = "docker" ]; then
                docker_version=$(docker --version | awk '{print $3}' | sed 's/,//')
                echo "  Version: $docker_version"
            elif [ "$dep" = "docker-compose" ]; then
                compose_version=$(docker-compose --version | awk '{print $3}' | sed 's/,//')
                echo "  Version: $compose_version"
            fi
        fi
    done
    
    # If there are missing dependencies
    if [ ${#missing_deps[@]} -gt 0 ]; then
        echo "The following required dependencies are missing:"
        for dep in "${missing_deps[@]}"; do
            echo "  - $dep"
        done
        
        echo "Would you like to install the missing dependencies? [y/N]"
        read -r answer
        if [[ "$answer" =~ ^[Yy]$ ]]; then
            if command_exists apt-get; then
                echo "Installing missing dependencies..."
                
                for dep in "${missing_deps[@]}"; do
                    case "$dep" in
                        docker)
                            echo "Installing Docker..."
                            sudo apt-get update
                            sudo apt-get install -y apt-transport-https ca-certificates curl gnupg lsb-release
                            curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
                            echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
                            sudo apt-get update
                            sudo apt-get install -y docker-ce docker-ce-cli containerd.io
                            sudo usermod -aG docker $USER
                            echo "Docker installed. You may need to log out and back in for group changes to take effect."
                            ;;
                        docker-compose)
                            echo "Installing Docker Compose..."
                            sudo curl -L "https://github.com/docker/compose/releases/download/v2.18.1/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
                            sudo chmod +x /usr/local/bin/docker-compose
                            ;;
                        git)
                            sudo apt-get update && sudo apt-get install -y git
                            ;;
                        dos2unix)
                            sudo apt-get update && sudo apt-get install -y dos2unix
                            ;;
                        *)
                            # For other dependencies, try to install via apt-get
                            sudo apt-get update && sudo apt-get install -y "$dep"
                            ;;
                    esac
                done
                
                echo "Dependencies installed. Checking again..."
                # Recheck dependencies
                for dep in "${missing_deps[@]}"; do
                    if command_exists "$dep"; then
                        echo "✓ $dep is now installed"
                    else
                        echo "⚠ $dep installation may have failed. Please install it manually."
                        exit 1
                    fi
                done
            else
                echo "Cannot automatically install dependencies. Please install them manually:"
                echo "  - Docker: https://docs.docker.com/engine/install/"
                echo "  - Docker Compose: https://docs.docker.com/compose/install/"
                echo "  - Git: Install using your distribution's package manager"
                for dep in "${missing_deps[@]}"; do
                    if [ "$dep" != "docker" ] && [ "$dep" != "docker-compose" ] && [ "$dep" != "git" ]; then
                        echo "  - $dep: Install using your distribution's package manager"
                    fi
                done
                exit 1
            fi
        else
            echo "Dependencies must be installed to continue. Exiting."
            exit 1
        fi
    fi
    
    # Install Python dependencies if requirements file is found
    if [ -n "$requirements_file" ]; then
        if command_exists pip; then
            echo "Installing Python dependencies from requirements file..."
            pip install -r "$requirements_file" || echo "Warning: Some Python dependencies could not be installed."
        elif command_exists pip3; then
            echo "Installing Python dependencies from requirements file..."
            pip3 install -r "$requirements_file" || echo "Warning: Some Python dependencies could not be installed."
        else
            echo "Warning: pip not found. Python dependencies will not be installed."
        fi
    fi
    
    # Check if Docker service is running
    if ! systemctl is-active --quiet docker; then
        echo "Docker service is not running. Starting it now..."
        sudo systemctl start docker
        if ! systemctl is-active --quiet docker; then
            echo "Failed to start Docker service. Please start it manually with: sudo systemctl start docker"
            exit 1
        fi
    fi
    
    echo "All dependencies are installed and ready."
}

# Check for line ending issues
check_line_endings

# Check and install dependencies
check_and_install_dependencies

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
      - ../config/postgres:/etc/postgresql/custom
    command: postgres -c config_file=/etc/postgresql/custom/postgresql-hq.conf
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
      - FRAPPE_BENCH_DIR=/home/frappe/frappe-bench-hq
    command: tail -f /dev/null
    volumes:
      - ./data/erpnext:/home/frappe/frappe-bench-hq/sites
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

CREATE TABLE IF NOT EXISTS teller_invoice_details (
    name VARCHAR(140) PRIMARY KEY,
    creation TIMESTAMP,
    modified TIMESTAMP,
    modified_by VARCHAR(140),
    owner VARCHAR(140),
    docstatus INT,
    parent VARCHAR(140),
    total DECIMAL(18,6),
    status VARCHAR(140)
);

CREATE TABLE IF NOT EXISTS booking_interbank (
    name VARCHAR(140) PRIMARY KEY,
    creation TIMESTAMP,
    modified TIMESTAMP,
    owner VARCHAR(140),
    docstatus INT,
    status VARCHAR(140)
);

CREATE TABLE IF NOT EXISTS booked_currency (
    name VARCHAR(140) PRIMARY KEY,
    creation TIMESTAMP,
    modified TIMESTAMP,
    owner VARCHAR(140),
    docstatus INT,
    parent VARCHAR(140),
    status VARCHAR(140)
);

CREATE TABLE IF NOT EXISTS branch_interbank_request (
    name VARCHAR(140) PRIMARY KEY,
    creation TIMESTAMP,
    modified TIMESTAMP,
    owner VARCHAR(140),
    docstatus INT,
    status VARCHAR(140)
);

CREATE TABLE IF NOT EXISTS branch_request_details (
    name VARCHAR(140) PRIMARY KEY,
    creation TIMESTAMP,
    modified TIMESTAMP,
    owner VARCHAR(140),
    docstatus INT,
    parent VARCHAR(140)
);

-- Create publications for tables to be replicated to branches
CREATE PUBLICATION branch_to_hq_pub FOR TABLE 
    currency_exchange, 
    update_currency_exchange,
    booking_interbank,
    booked_currency,
    branch_interbank_request;
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

# Create apps.txt in current directory where we have permissions
echo "[1/5] Creating apps.txt file..."
# First make a local apps.txt file
echo -e "frappe\nerpnext" > apps.txt
# Then copy it into the container
docker cp apps.txt erpnext-hq:/home/frappe/frappe-bench/
# Set correct ownership 
docker exec -it erpnext-hq bash -c "chown frappe:frappe /home/frappe/frappe-bench/apps.txt"

# Initialize ERPNext site
echo "[2/5] Initializing ERPNext site..."
docker exec -it erpnext-hq bench new-site ${HQ_SITE_NAME} \
  --db-type postgres \
  --db-name erpnext_hq \
  --db-root-username postgres \
  --db-root-password ${HQ_DB_PASSWORD} \
  --db-host postgres-hq \
  --db-port 5432 \
  --admin-password ${HQ_ADMIN_PASSWORD}

# Install ERPNext app
echo "[3/5] Installing ERPNext app..."
docker exec -it erpnext-hq bench --site ${HQ_SITE_NAME} install-app erpnext

# Install Payments app
echo "[4/5] Installing Payments app..."
docker exec -it erpnext-hq bench get-app payments
docker exec -it erpnext-hq bench --site ${HQ_SITE_NAME} install-app payments

# Install HRMS app
echo "[5/5] Installing HRMS app..."
# First make a local apps.txt file that includes hrms
echo -e "frappe\nerpnext\nhrms" > apps.txt
# Then copy it into the container
docker cp apps.txt erpnext-hq:/home/frappe/frappe-bench/
# Set correct ownership 
docker exec -it erpnext-hq bash -c "chown frappe:frappe /home/frappe/frappe-bench/apps.txt"

# Create a skip_patches.json file to skip failing patches
echo '[
  {
    "patch_module": "hrms.patches.post_install",
    "patch_file": "move_payroll_setting_separately_from_hr_settings"
  }
]' > skip_patches.json
docker cp skip_patches.json erpnext-hq:/home/frappe/frappe-bench/
docker exec -it erpnext-hq bash -c "chown frappe:frappe /home/frappe/frappe-bench/skip_patches.json"

# Create a common_site_config.json file to ensure proper configuration
echo '{
  "socketio_port": 9000,
  "developer_mode": 1,
  "logging": 1,
  "db_host": "postgres-hq",
  "db_port": 5432,
  "db_name": "erpnext_hq",
  "db_password": "'${HQ_DB_PASSWORD}'",
  "auto_update": false
}' > common_site_config.json
# Ensure the sites directory exists
docker exec -u 0 -it erpnext-hq bash -c "mkdir -p /home/frappe/frappe-bench/sites"
docker cp common_site_config.json erpnext-hq:/home/frappe/frappe-bench/sites/common_site_config.json
docker exec -it erpnext-hq bash -c "chown frappe:frappe /home/frappe/frappe-bench/sites/common_site_config.json"

# Try installing HRMS with a more resilient approach
docker exec -it erpnext-hq bash -c "cd /home/frappe/frappe-bench && bench get-app --branch version-15 hrms || echo 'App may already exist, continuing'"
# Try various fallback methods if installation fails
docker exec -it erpnext-hq bash -c "cd /home/frappe/frappe-bench && (bench --site ${HQ_SITE_NAME} install-app hrms --skip-failing-patches || bench --site ${HQ_SITE_NAME} install-app hrms --force || echo 'HRMS installation had issues but continuing with setup')"

# Clone and install Teller app
echo "[+] Installing Teller app..."
if [ ! -d "./teller" ]; then
    echo "Cloning Teller app repository..."
    # Try cloning the repository
    if ! git clone -b mustafa-development ${TELLER_REPO} ./teller; then
        echo "Failed to clone repository automatically."
        echo "This might be because the repository is private."
        echo ""
        echo "Options:"
        echo "1. If using SSH key authentication, ensure your SSH key is set up properly."
        echo "2. If using HTTPS, make sure your token is included in the repository URL."
        echo "3. You can manually clone the repository and continue:"
        echo "   git clone -b mustafa-development <your-repo-url> ./teller"
        echo ""
        read -p "Press enter to continue once you've manually cloned the repository, or Ctrl+C to cancel..." dummy
        
        if [ ! -d "./teller" ]; then
            echo "Teller app directory still not found. Cannot proceed."
            exit 1
        fi
    fi
fi

# Check if the apps directory exists in the container and create it if needed
echo "Checking if apps directory exists in container..."
docker exec -u 0 -it erpnext-hq bash -c "mkdir -p /home/frappe/frappe-bench/apps/teller_temp"

# First copy the Teller app to a temporary location in the container
echo "Copying Teller app to container..."
docker cp ./teller erpnext-hq:/home/frappe/frappe-bench/apps/teller_temp/
docker exec -u 0 -it erpnext-hq bash -c "mkdir -p /home/frappe/frappe-bench/apps/teller"

# Fix directory structure - copy the actual module files to the proper location
echo "Fixing app directory structure..."
docker exec -u 0 -it erpnext-hq bash -c "cp -r /home/frappe/frappe-bench/apps/teller_temp/teller/teller/* /home/frappe/frappe-bench/apps/teller/ && cp /home/frappe/frappe-bench/apps/teller_temp/teller/hooks.py /home/frappe/frappe-bench/apps/teller/ && cp /home/frappe/frappe-bench/apps/teller_temp/teller/modules.txt /home/frappe/frappe-bench/apps/teller/ 2>/dev/null || echo 'No modules.txt to copy'"

# Create the required files for a Frappe app
docker exec -u 0 -it erpnext-hq bash -c "echo '__version__ = \"0.1.0\"' > /home/frappe/frappe-bench/apps/teller/__init__.py"
docker exec -u 0 -it erpnext-hq bash -c "echo 'Teller' > /home/frappe/frappe-bench/apps/teller/modules.txt 2>/dev/null || true"
docker exec -u 0 -it erpnext-hq bash -c "echo 'from setuptools import setup, find_packages\n\nsetup(\n    name=\"teller\",\n    version=\"0.1.0\",\n    packages=find_packages(),\n    install_requires=[],\n)' > /home/frappe/frappe-bench/apps/teller/setup.py"

# Set correct ownership
docker exec -u 0 -it erpnext-hq bash -c "chown -R frappe:frappe /home/frappe/frappe-bench/apps"

# Remove temporary directory
docker exec -u 0 -it erpnext-hq bash -c "rm -rf /home/frappe/frappe-bench/apps/teller_temp"

# Install the app's dependencies
echo "Installing Teller app dependencies..."
docker exec -it erpnext-hq bash -c "cd /home/frappe/frappe-bench && echo 'teller' >> sites/apps.txt"
docker exec -it erpnext-hq bash -c "cd /home/frappe/frappe-bench/apps/teller && pip install -e ."

# Install the app to the site with retry mechanism
echo "Installing Teller app to site..."
docker exec -it erpnext-hq bash -c "cd /home/frappe/frappe-bench && bench build"
# Try multiple approaches and continue even if there are issues
docker exec -it erpnext-hq bash -c "cd /home/frappe/frappe-bench && (bench --site ${HQ_SITE_NAME} install-app teller || bench --site ${HQ_SITE_NAME} install-app teller --force || bench --site ${HQ_SITE_NAME} migrate || echo 'Teller app installation had issues but continuing with setup')"

# Configure HQ-specific settings
docker exec -it erpnext-hq bench --site ${HQ_SITE_NAME} set-config branch_code "${HQ_CODE}"
docker exec -it erpnext-hq bench --site ${HQ_SITE_NAME} set-config sync_service_url "http://rabbitmq-hq:3000/sync"

# Create a Procfile for bench start
docker exec -u 0 -it erpnext-hq bash -c "echo 'web: bench serve --port 8000' > /home/frappe/frappe-bench/Procfile && chown frappe:frappe /home/frappe/frappe-bench/Procfile"

# Start the bench process
docker exec -d erpnext-hq bash -c "cd /home/frappe/frappe-bench && bench start"

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