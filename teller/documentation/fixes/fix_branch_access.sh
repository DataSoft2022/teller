#!/bin/bash

# fix_branch_access.sh - Fix site access issues in the branch setup
# This script resolves the discrepancy between the configured bench directory and actual site location
# Usage: ./fix_branch_access.sh BRANCH_ID

# Check if branch ID is provided
if [ $# -lt 1 ]; then
    echo "Error: Branch ID is required."
    echo "Usage: $0 BRANCH_ID"
    echo "Example: $0 BR01"
    exit 1
fi

BRANCH_ID=$1
BRANCH_SITE_NAME="${BRANCH_ID,,}.banking.local"

echo "=========================================================="
echo "       FIXING SITE ACCESS FOR BRANCH ${BRANCH_ID}         "
echo "=========================================================="

# Check for Docker
if ! command -v docker &> /dev/null; then
    echo "Error: Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if container is running
CONTAINER_RUNNING=$(docker ps | grep erpnext-${BRANCH_ID,,} | wc -l)
if [ "$CONTAINER_RUNNING" -eq 0 ]; then
    echo "Error: erpnext-${BRANCH_ID,,} container is not running. Please start it first."
    exit 1
fi

# Set the site as default
echo "[1/4] Setting site as default..."
docker exec -it erpnext-${BRANCH_ID,,} bench use ${BRANCH_SITE_NAME}

# Create symbolic link between directories
echo "[2/4] Creating symbolic link for site access..."
docker exec -u 0 -it erpnext-${BRANCH_ID,,} bash -c "mkdir -p /home/frappe/frappe-bench-branch/sites && ln -sf /home/frappe/frappe-bench/sites/${BRANCH_SITE_NAME} /home/frappe/frappe-bench-branch/sites/ && chown -R frappe:frappe /home/frappe/frappe-bench-branch"

# Also create a procfile to fix the 'bench start' command
echo "[3/4] Creating Procfile for bench start command..."
docker exec -u 0 -it erpnext-${BRANCH_ID,,} bash -c "echo 'web: bench serve --port 8000' > /home/frappe/frappe-bench/Procfile && chown frappe:frappe /home/frappe/frappe-bench/Procfile"

# Restart the container to apply changes
echo "[4/4] Restarting container to apply changes..."
docker restart erpnext-${BRANCH_ID,,}
sleep 5

echo "=========================================================="
echo "                   FIX COMPLETED!                         "
echo "=========================================================="
echo "You can now access ERPNext at: http://$(hostname -I | awk '{print $1}'):8000"
echo "Login with username: Administrator and password: admin"
echo "==========================================================" 