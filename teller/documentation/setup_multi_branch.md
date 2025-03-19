# Multi-Branch Banking System Automated Setup Guide

This guide explains how to use the automated setup scripts to deploy the multi-branch banking system across multiple physical machines. These scripts simplify the setup process for each node type (HQ or Branch).

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Scripts Overview](#scripts-overview)
4. [Setting Up HQ](#setting-up-hq)
5. [Setting Up Branches](#setting-up-branches)
6. [Connecting HQ and Branches](#connecting-hq-and-branches)
7. [Testing the System](#testing-the-system)
8. [Troubleshooting](#troubleshooting)

## Overview

The automated setup scripts allow you to quickly deploy a multi-branch banking system across several physical machines with minimal manual configuration. The system consists of:

- One **Headquarters (HQ)** node
- Multiple **Branch** nodes (BR01, BR02, etc.)
- Each node running PostgreSQL, ERPNext, and the Teller app
- The HQ node running RabbitMQ for message queuing

## Prerequisites

Before using these scripts, ensure each machine has:

1. **Docker and Docker Compose installed**
2. **Git installed**
3. **Sudo access** (for firewall configuration)
4. **Network connectivity** between all machines
5. **Sufficient disk space** (at least 20GB recommended)

## Scripts Overview

The system comes with three main scripts:

1. **`setup_hq.sh`**: Sets up the Headquarters node
2. **`setup_branch.sh`**: Sets up a Branch node
3. **`setup_prototype.sh`**: Sets up the entire system on a single machine (for testing only)

For a real-world deployment across multiple machines, you'll use the first two scripts.

## Setting Up HQ

The HQ should be set up first, as branches need to connect to it.

### On the HQ Machine:

1. **Download the setup script**:
   ```bash
   curl -O https://raw.githubusercontent.com/yourusername/teller/main/documentation/setup_hq.sh
   chmod +x setup_hq.sh
   ```

2. **Run the setup script**:
   ```bash
   ./setup_hq.sh
   ```
   This creates all necessary configuration files and scripts.

3. **Configure firewall** (if needed):
   ```bash
   cd banking-prototype
   ./scripts/configure_firewall.sh
   ```

4. **Start HQ services**:
   ```bash
   ./start_hq.sh
   ```
   Wait for containers to be fully running (about 30-60 seconds).

5. **Initialize ERPNext and install apps**:
   ```bash
   ./post_setup_hq.sh
   ```

6. **Record the HQ IP address**:
   The script saves the HQ IP to `hq_ip.txt`, which you'll need to provide to all branch setups.

## Setting Up Branches

For each branch, perform these steps on a separate physical machine:

1. **Download the setup script**:
   ```bash
   curl -O https://raw.githubusercontent.com/yourusername/teller/main/documentation/setup_branch.sh
   chmod +x setup_branch.sh
   ```

2. **Run the setup script with branch ID and HQ IP**:
   ```bash
   ./setup_branch.sh BR01 192.168.1.100
   ```
   Replace `BR01` with your branch ID and `192.168.1.100` with your actual HQ IP address.

3. **Configure firewall** (if needed):
   ```bash
   cd banking-prototype
   ./scripts/configure_firewall.sh
   ```

4. **Start branch services**:
   ```bash
   ./start_branch.sh
   ```
   Wait for containers to be fully running (about 30-60 seconds).

5. **Initialize ERPNext and install apps**:
   ```bash
   ./post_setup_branch.sh
   ```

6. **Record the branch IP address**:
   The script saves the branch IP to `branch_brXX_ip.txt`.

## Connecting HQ and Branches

To establish bidirectional communication between HQ and each branch:

### On the HQ Machine:

For each branch, run:
```bash
cd banking-prototype
./scripts/connect_branch.sh BR01 192.168.1.101 postgres_br01_password
```
Replace with the actual branch ID, IP address, and password.

### On Each Branch Machine:

If you provided the HQ IP during setup, this is already configured. Otherwise, run:
```bash
cd banking-prototype
./scripts/connect_to_hq.sh 192.168.1.100
```
Replace with the actual HQ IP address.

## Testing the System

After setting up HQ and all branches, perform these tests to verify the system:

### 1. Test Database Replication from HQ to Branch

```bash
# On HQ
docker exec -it postgres-hq psql -U postgres -d erpnext_hq -c "INSERT INTO currency_exchange (name, from_currency, to_currency, exchange_rate, date) VALUES ('TEST-HQ-TO-BRANCH', 'USD', 'EUR', 0.85, CURRENT_DATE);"

# On Branch
docker exec -it postgres-br01 psql -U postgres -d erpnext_br01 -c "SELECT * FROM currency_exchange WHERE name = 'TEST-HQ-TO-BRANCH';"
```

### 2. Test Database Replication from Branch to HQ

```bash
# On Branch
docker exec -it postgres-br01 psql -U postgres -d erpnext_br01 -c "INSERT INTO teller_invoice (name, creation, docstatus, total, status) VALUES ('TEST-BRANCH-TO-HQ', CURRENT_TIMESTAMP, 0, 100.00, 'Draft');"

# On HQ
docker exec -it postgres-hq psql -U postgres -d erpnext_hq -c "SELECT * FROM teller_invoice WHERE name = 'TEST-BRANCH-TO-HQ';"
```

## Troubleshooting

### Network Connectivity Issues

**Problem**: Branches cannot connect to HQ database
**Solution**:
```bash
# Check if PostgreSQL is accepting connections
sudo netstat -tulpn | grep 5432

# Make sure PostgreSQL is configured to listen on all interfaces
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

## Customizing the Scripts

If you need to customize the scripts:

1. **Teller Repository URL**: Change the `TELLER_REPO` variable in the script
2. **Database Passwords**: Change the password variables in the script
3. **Site Names**: Change the site name variables 

Simply edit the script before running it to make these changes. 