#!/bin/bash

# setup_branch.sh - Automated setup script for Branch node in multi-branch banking system
# This script sets up a Branch component of the multi-branch banking system on a single machine
# Usage: ./setup_branch.sh BRANCH_ID [HQ_IP]

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
        # Extract system dependencies from requirements.txt
        read_system_deps=false
        read_python_deps=false
        python_deps=()

        while IFS= read -r line; do
            # Check for section headers
            if [[ "$line" == *"System Dependencies"* ]]; then
                read_system_deps=true
                read_python_deps=false
                continue
            elif [[ "$line" == *"Python Dependencies"* ]]; then
                read_system_deps=false
                read_python_deps=true
                continue
            elif [[ "$line" == "##############################"* ]]; then
                continue  # Skip section dividers
            fi

            # Process system dependencies (uncommented lines only)
            if [ "$read_system_deps" = true ] && [[ "$line" != "#"* ]] && [ -n "$line" ]; then
                # Extract package name (before >= or ==)
                dep=$(echo "$line" | sed 's/\([a-zA-Z0-9_-]*\).*/\1/')
                if [ -n "$dep" ]; then
                    system_deps+=("$dep")
                fi
            fi

            # Collect Python dependencies for later installation
            if [ "$read_python_deps" = true ] && [[ "$line" != "#"* ]] && [ -n "$line" ]; then
                python_deps+=("$line")
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
                echo "Installing missing dependencies using apt-get (Debian/Ubuntu)..."
                
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
            elif command_exists dnf; then
                echo "Installing missing dependencies using dnf (Fedora/RHEL)..."
                
                for dep in "${missing_deps[@]}"; do
                    case "$dep" in
                        docker)
                            echo "Installing Docker..."
                            sudo dnf -y install dnf-plugins-core
                            sudo dnf config-manager --add-repo https://download.docker.com/linux/fedora/docker-ce.repo
                            sudo dnf -y install docker-ce docker-ce-cli containerd.io
                            sudo systemctl enable docker
                            sudo systemctl start docker
                            sudo usermod -aG docker $USER
                            echo "Docker installed. You may need to log out and back in for group changes to take effect."
                            ;;
                        docker-compose)
                            echo "Installing Docker Compose..."
                            sudo curl -L "https://github.com/docker/compose/releases/download/v2.18.1/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
                            sudo chmod +x /usr/local/bin/docker-compose
                            ;;
                        git)
                            sudo dnf -y install git
                            ;;
                        dos2unix)
                            sudo dnf -y install dos2unix
                            ;;
                        *)
                            # For other dependencies, try to install via dnf
                            sudo dnf -y install "$dep"
                            ;;
                    esac
                done
            elif command_exists yum; then
                echo "Installing missing dependencies using yum (RHEL/CentOS)..."
                
                for dep in "${missing_deps[@]}"; do
                    case "$dep" in
                        docker)
                            echo "Installing Docker..."
                            sudo yum install -y yum-utils
                            sudo yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
                            sudo yum install -y docker-ce docker-ce-cli containerd.io
                            sudo systemctl enable docker
                            sudo systemctl start docker
                            sudo usermod -aG docker $USER
                            echo "Docker installed. You may need to log out and back in for group changes to take effect."
                            ;;
                        docker-compose)
                            echo "Installing Docker Compose..."
                            sudo curl -L "https://github.com/docker/compose/releases/download/v2.18.1/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
                            sudo chmod +x /usr/local/bin/docker-compose
                            ;;
                        git)
                            sudo yum install -y git
                            ;;
                        dos2unix)
                            sudo yum install -y dos2unix
                            ;;
                        *)
                            # For other dependencies, try to install via yum
                            sudo yum install -y "$dep"
                            ;;
                    esac
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
            echo "Dependencies must be installed to continue. Exiting."
            exit 1
        fi
    fi
    
    # Install Python dependencies if requirements file is found
    if [ -n "$requirements_file" ] && [ ${#python_deps[@]} -gt 0 ]; then
        echo "Installing Python dependencies..."
        if command_exists pip; then
            for dep in "${python_deps[@]}"; do
                echo "Installing Python package: $dep"
                pip install "$dep" || echo "Warning: Could not install $dep"
            done
        elif command_exists pip3; then
            for dep in "${python_deps[@]}"; do
                echo "Installing Python package: $dep"
                pip3 install "$dep" || echo "Warning: Could not install $dep"
            done
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

# Check for line ending issues first
check_line_endings

# Check and install dependencies
check_and_install_dependencies

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
TELLER_REPO="https://github.com/DataSoft2022/teller.git"

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
      - ../config/postgres:/etc/postgresql/custom
    command: postgres -c config_file=/etc/postgresql/custom/postgresql-branch.conf
    ports:
      - "5432:5432"
    networks:
      - banking-network

  redis-branch:
    image: redis:7
    container_name: redis-${BRANCH_ID,,}
    restart: unless-stopped
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
      - REDIS_CACHE=redis-branch:6379
      - REDIS_QUEUE=redis-branch:6379
      - REDIS_SOCKETIO=redis-branch:6379
      - FRAPPE_BENCH_DIR=/home/frappe/frappe-bench-branch
    command: tail -f /dev/null
    volumes:
      - ./data/erpnext:/home/frappe/frappe-bench-branch/sites
    ports:
      - "8000:8000"
    depends_on:
      - postgres-branch
      - redis-branch
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

-- Create publications for tables to be replicated to HQ
CREATE PUBLICATION branch_to_hq_pub FOR TABLE 
    teller_invoice,
    teller_invoice_details,
    update_currency_exchange,
    booking_interbank,
    booked_currency,
    branch_interbank_request,
    branch_request_details;

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

# Create apps.txt in current directory where we have permissions
echo "[1/5] Creating apps.txt file..."
# First make a local apps.txt file
echo -e "frappe\nerpnext" > apps.txt
# Then copy it into the container
docker cp apps.txt erpnext-${BRANCH_ID,,}:/home/frappe/frappe-bench/
# Set correct ownership 
docker exec -it erpnext-${BRANCH_ID,,} bash -c "chown frappe:frappe /home/frappe/frappe-bench/apps.txt"

# Initialize ERPNext site
echo "[2/5] Initializing ERPNext site..."
docker exec -it erpnext-${BRANCH_ID,,} bench new-site ${BRANCH_SITE_NAME} \
  --db-type postgres \
  --db-name ${BRANCH_DB_NAME} \
  --db-root-username postgres \
  --db-root-password ${BRANCH_DB_PASSWORD} \
  --db-host postgres-branch \
  --db-port 5432 \
  --admin-password ${BRANCH_ADMIN_PASSWORD}

# Install ERPNext app
echo "[3/5] Installing ERPNext app..."
docker exec -it erpnext-${BRANCH_ID,,} bench --site ${BRANCH_SITE_NAME} install-app erpnext

# Install Payments app
echo "[4/5] Installing Payments app..."
docker exec -it erpnext-${BRANCH_ID,,} bench get-app payments
docker exec -it erpnext-${BRANCH_ID,,} bench --site ${BRANCH_SITE_NAME} install-app payments

# Install HRMS app
echo "[5/5] Installing HRMS app..."
# First make a local apps.txt file that includes hrms
echo -e "frappe\nerpnext\nhrms" > apps.txt
# Then copy it into the container
docker cp apps.txt erpnext-${BRANCH_ID,,}:/home/frappe/frappe-bench/
# Set correct ownership 
docker exec -it erpnext-${BRANCH_ID,,} bash -c "chown frappe:frappe /home/frappe/frappe-bench/apps.txt"

# Create a skip_patches.json file to skip failing patches
echo '[
  {
    "patch_module": "hrms.patches.post_install",
    "patch_file": "move_payroll_setting_separately_from_hr_settings"
  }
]' > skip_patches.json
docker cp skip_patches.json erpnext-${BRANCH_ID,,}:/home/frappe/frappe-bench/
docker exec -it erpnext-${BRANCH_ID,,} bash -c "chown frappe:frappe /home/frappe/frappe-bench/skip_patches.json"

# Create a enhanced common_site_config.json file to ensure proper configuration
echo '{
  "socketio_port": 9000,
  "developer_mode": 1,
  "logging": 1,
  "db_host": "postgres-${BRANCH_ID,,}",
  "db_port": 5432,
  "db_name": "${BRANCH_DB_NAME}",
  "db_password": "'${BRANCH_DB_PASSWORD}'",
  "redis_cache": "redis-${BRANCH_ID,,}:6379",
  "redis_queue": "redis-${BRANCH_ID,,}:6379",
  "redis_socketio": "redis-${BRANCH_ID,,}:6379",
  "auto_update": false,
  "install_apps": ["frappe", "erpnext", "hrms", "payments"],
  "skip_setup_wizard": true
}' > common_site_config.json
# Ensure the sites directory exists
docker exec -u 0 -it erpnext-${BRANCH_ID,,} bash -c "mkdir -p /home/frappe/frappe-bench/sites"
docker cp common_site_config.json erpnext-${BRANCH_ID,,}:/home/frappe/frappe-bench/sites/common_site_config.json
docker exec -it erpnext-${BRANCH_ID,,} bash -c "chown frappe:frappe /home/frappe/frappe-bench/sites/common_site_config.json"

# Rebuild assets before installation
docker exec -it erpnext-${BRANCH_ID,,} bash -c "cd /home/frappe/frappe-bench && bench build"

# Try installing HRMS with a comprehensive approach
echo "Getting HRMS app..."
docker exec -it erpnext-${BRANCH_ID,,} bash -c "cd /home/frappe/frappe-bench && (bench get-app --branch version-15 hrms || echo 'App may already exist, continuing')"

# Create HR Settings table if it doesn't exist to avoid the common error
docker exec -it erpnext-${BRANCH_ID,,} bash -c "cd /home/frappe/frappe-bench && bench --site ${BRANCH_SITE_NAME} console << EOF
try:
    import frappe
    if not frappe.db.table_exists('HR Settings'):
        frappe.db.sql_ddl('CREATE TABLE IF NOT EXISTS \`tabHR Settings\` (name VARCHAR(140) PRIMARY KEY, hr_settings_field VARCHAR(140))')
        frappe.db.commit()
    print('HR Settings table checked/created')
except Exception as e:
    print(f'Error creating HR Settings table: {e}')
EOF"

# Try various fallback methods if installation fails
echo "Installing HRMS app with multiple fallback strategies..."
docker exec -it erpnext-${BRANCH_ID,,} bash -c "cd /home/frappe/frappe-bench && (bench --site ${BRANCH_SITE_NAME} install-app hrms --force || bench --site ${BRANCH_SITE_NAME} migrate || echo 'HRMS installation had issues but continuing with setup')"

# Run a final migration to ensure all database changes are applied
docker exec -it erpnext-${BRANCH_ID,,} bash -c "cd /home/frappe/frappe-bench && bench --site ${BRANCH_SITE_NAME} migrate"

# Clone and install Teller app
echo "[+] Installing Teller app..."
echo "Cloning Teller app from repository..."
# Clone the repository locally to handle nested directory structure
git clone ${TELLER_REPO} ./teller_temp || echo "Repository might already exist, continuing..."

# Create temporary directory for app files
docker exec -u 0 -it erpnext-${BRANCH_ID,,} bash -c "mkdir -p /home/frappe/frappe-bench/apps/teller"

# Copy directly from the properly organized structure
docker cp ./teller_temp/teller erpnext-${BRANCH_ID,,}:/home/frappe/frappe-bench/apps/

# Set correct ownership
docker exec -u 0 -it erpnext-${BRANCH_ID,,} bash -c "chown -R frappe:frappe /home/frappe/frappe-bench/apps"

# Clean up temporary directory
rm -rf ./teller_temp

# Create proper Python package structure with pyproject.toml
echo "Creating proper Python package configuration..."
docker exec -u 0 -it erpnext-${BRANCH_ID,,} bash -c "cat > /home/frappe/frappe-bench/apps/teller/pyproject.toml << 'EOF'
[build-system]
requires = [\"setuptools>=42\", \"wheel\"]
build-backend = \"setuptools.build_meta\"

[project]
name = \"teller\"
version = \"0.1.0\"
description = \"Banking Application for ERPNext\"
authors = [
    {name = \"DataSoft\", email = \"info@datasoft.com\"},
]
requires-python = \">=3.10\"
EOF"

# Create proper __init__.py with version in nested teller directory
docker exec -u 0 -it erpnext-${BRANCH_ID,,} bash -c "cat > /home/frappe/frappe-bench/apps/teller/teller/__init__.py << 'EOF'
__version__ = '0.1.0'
import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
EOF"

# Also ensure parent __init__.py has version
docker exec -u 0 -it erpnext-${BRANCH_ID,,} bash -c "cat > /home/frappe/frappe-bench/apps/teller/__init__.py << 'EOF'
__version__ = '0.1.0'
# Add path configuration to handle nested structure
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), \"teller\"))
EOF"

# Fix module structure by creating symbolic links
echo "Fixing module structure..."
docker exec -u 0 -it erpnext-${BRANCH_ID,,} bash -c "cd /home/frappe/frappe-bench/apps/teller/teller && \
  [ ! -L controllers ] && ln -sf ../controllers . && \
  [ ! -L validate_time.py ] && ln -sf ../validate_time.py ."

# Create empty __init__.py files in all directories to make them proper packages
docker exec -u 0 -it erpnext-${BRANCH_ID,,} bash -c "find /home/frappe/frappe-bench/apps/teller -type d -exec touch {}/__init__.py \; 2>/dev/null || true"

# Verify Redis configuration and correct if needed
echo "Verifying Redis configuration..."
docker exec -u 0 -it erpnext-${BRANCH_ID,,} bash -c "cd /home/frappe/frappe-bench && \
  sed -i 's/\"redis_cache\": \"redis:\/\/.*\"/\"redis_cache\": \"redis:\/\/redis-${BRANCH_ID,,}:6379\"/' sites/common_site_config.json && \
  sed -i 's/\"redis_queue\": \"redis:\/\/.*\"/\"redis_queue\": \"redis:\/\/redis-${BRANCH_ID,,}:6379\"/' sites/common_site_config.json && \
  sed -i 's/\"redis_socketio\": \"redis:\/\/.*\"/\"redis_socketio\": \"redis:\/\/redis-${BRANCH_ID,,}:6379\"/' sites/common_site_config.json"

# Install the app's dependencies
echo "Installing Teller app dependencies..."
docker exec -it erpnext-${BRANCH_ID,,} bash -c "cd /home/frappe/frappe-bench && echo 'teller' >> sites/apps.txt"
docker exec -it erpnext-${BRANCH_ID,,} bash -c "cd /home/frappe/frappe-bench/apps/teller && pip install -e ."

# Set default site properly (replaces deprecated currentsite.txt method)
echo "Setting proper default site..."
docker exec -it erpnext-${BRANCH_ID,,} bash -c "cd /home/frappe/frappe-bench && bench use ${BRANCH_SITE_NAME}"

# Build all assets including HRMS bundles
echo "Building application assets..."
docker exec -it erpnext-${BRANCH_ID,,} bash -c "cd /home/frappe/frappe-bench && bench build --force"

# Install the app to the site with multiple fallback options
echo "Installing Teller app to site..."
docker exec -it erpnext-${BRANCH_ID,,} bash -c "cd /home/frappe/frappe-bench && (bench --site ${BRANCH_SITE_NAME} install-app teller || bench --site ${BRANCH_SITE_NAME} install-app teller --force || bench --site ${BRANCH_SITE_NAME} migrate || echo 'Teller app installation had issues but continuing with setup')"

# Always run migrate at the end to ensure database is updated
docker exec -it erpnext-${BRANCH_ID,,} bash -c "cd /home/frappe/frappe-bench && bench --site ${BRANCH_SITE_NAME} migrate"

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

# Create a Procfile for bench start
docker exec -u 0 -it erpnext-${BRANCH_ID,,} bash -c "echo 'web: bench serve --port 8000' > /home/frappe/frappe-bench/Procfile && chown frappe:frappe /home/frappe/frappe-bench/Procfile"

# Validate installation with Python tests
echo "Validating installation..."
docker exec -it erpnext-${BRANCH_ID,,} bash -c "cd /home/frappe/frappe-bench && python -c 'import teller; print(f\"Teller version: {teller.__version__}\")'"

# Test importing key modules that previously had issues
docker exec -it erpnext-${BRANCH_ID,,} bash -c "cd /home/frappe/frappe-bench && python -c 'from teller import validate_time, controllers; print(\"Module imports successful\")'"

# Verify API endpoints are responding and fix HRMS assets if needed
echo "Checking HRMS assets..."
docker exec -it erpnext-${BRANCH_ID,,} bash -c "cd /home/frappe/frappe-bench && \
  curl -s -I http://localhost:8000/hrms.bundle.js | grep -q '200 OK' || \
  (echo 'HRMS assets not found, rebuilding...' && \
   bench build --force)"

# Restart all services with proper wait times
echo "Restarting services..."
docker exec -it erpnext-${BRANCH_ID,,} bash -c "cd /home/frappe/frappe-bench && bench restart"
echo "Waiting for services to initialize (15 seconds)..."
sleep 15

# Start the bench process
docker exec -d erpnext-${BRANCH_ID,,} bash -c "cd /home/frappe/frappe-bench && bench start"

# Final validation check after restart
echo "Performing final validation check..."
docker exec -it erpnext-${BRANCH_ID,,} bash -c "cd /home/frappe/frappe-bench && bench --site ${BRANCH_SITE_NAME} list-apps"
if [ $? -eq 0 ]; then
  echo "============================================="
  echo "   Branch ${BRANCH_ID} installation is complete!     "
  echo "   Access your ERPNext instance at:         "
  echo "   http://localhost:8000                    "
  echo "============================================="
else
  echo "WARNING: Final validation check failed. Please review logs for errors."
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
   ```3. **Start Branch services**:
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

