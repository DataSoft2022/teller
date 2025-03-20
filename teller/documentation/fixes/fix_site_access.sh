#!/bin/bash

# fix_site_access.sh - Fix site access issues in the multi-branch banking setup
# This script resolves the discrepancy between the configured bench directory and actual site location

echo "=========================================================="
echo "        FIXING SITE ACCESS FOR ERPNEXT CONTAINER          "
echo "=========================================================="

# Check for Docker
if ! command -v docker &> /dev/null; then
    echo "Error: Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if container is running
CONTAINER_RUNNING=$(docker ps | grep erpnext-hq | wc -l)
if [ "$CONTAINER_RUNNING" -eq 0 ]; then
    echo "Error: erpnext-hq container is not running. Please start it first."
    exit 1
fi

# Set the site as default
echo "[1/4] Setting site as default..."
docker exec -it erpnext-hq bench use hq.banking.local

# Create symbolic link between directories
echo "[2/4] Creating symbolic link for site access..."
docker exec -u 0 -it erpnext-hq bash -c "mkdir -p /home/frappe/frappe-bench-hq/sites && ln -sf /home/frappe/frappe-bench/sites/hq.banking.local /home/frappe/frappe-bench-hq/sites/ && chown -R frappe:frappe /home/frappe/frappe-bench-hq"

# Also create a procfile to fix the 'bench start' command
echo "[3/4] Creating Procfile for bench start command..."
docker exec -u 0 -it erpnext-hq bash -c "echo 'web: bench serve --port 8000' > /home/frappe/frappe-bench/Procfile && chown frappe:frappe /home/frappe/frappe-bench/Procfile"

# Restart the container to apply changes
echo "[4/4] Restarting container to apply changes..."
docker restart erpnext-hq
sleep 5

echo "=========================================================="
echo "                   FIX COMPLETED!                         "
echo "=========================================================="
echo "You can now access ERPNext at: http://$(hostname -I | awk '{print $1}'):8000"
echo "Login with username: Administrator and password: admin"
echo "==========================================================" 