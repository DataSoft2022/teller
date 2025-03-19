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
9. [Working with Private Repositories](#working-with-private-repositories)

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
6. **Git authentication configured** (if using a private repository)

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

2. **Customize the script** (optional):
   ```bash
   # Edit the script to change configuration variables if needed
   nano setup_hq.sh
   
   # Particularly, update the TELLER_REPO variable with the correct URL
   # If using a private repository, see the "Working with Private Repositories" section
   ```

3. **Run the setup script**:
   ```bash
   ./setup_hq.sh
   ```
   This creates all necessary configuration files and scripts.

4. **Configure firewall** (if needed):
   ```bash
   cd banking-prototype
   ./scripts/configure_firewall.sh
   ```

5. **Start HQ services**:
   ```bash
   ./start_hq.sh
   ```
   Wait for containers to be fully running (about 30-60 seconds).

6. **Initialize ERPNext and install apps**:
   ```bash
   ./post_setup_hq.sh
   ```

7. **Record the HQ IP address**:
   The script saves the HQ IP to `hq_ip.txt`, which you'll need to provide to all branch setups.

## Setting Up Branches

For each branch, perform these steps on a separate physical machine:

1. **Download the setup script**:
   ```bash
   curl -O https://raw.githubusercontent.com/yourusername/teller/main/documentation/setup_branch.sh
   chmod +x setup_branch.sh
   ```

2. **Customize the script** (optional):
   ```bash
   # Edit the script to change configuration variables if needed
   nano setup_branch.sh
   
   # Particularly, update the TELLER_REPO variable to match what you used for HQ
   ```

3. **Run the setup script with branch ID and HQ IP**:
   ```bash
   ./setup_branch.sh BR01 192.168.1.100
   ```
   Replace `BR01` with your branch ID and `192.168.1.100` with your actual HQ IP address.

4. **Configure firewall** (if needed):
   ```bash
   cd banking-prototype
   ./scripts/configure_firewall.sh
   ```

5. **Start branch services**:
   ```bash
   ./start_branch.sh
   ```
   Wait for containers to be fully running (about 30-60 seconds).

6. **Initialize ERPNext and install apps**:
   ```bash
   ./post_setup_branch.sh
   ```

7. **Record the branch IP address**:
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

## Working with Private Repositories

If your Teller app is in a private repository, you have two options for authentication:

### Option 1: SSH Keys (Most Secure)

1. **Generate an SSH key** on each machine where you'll run the setup scripts:
   ```bash
   ssh-keygen -t ed25519 -C "your_email@example.com"
   ```

2. **Add the SSH key to your GitHub account** as a deploy key:
   - Copy the public key: `cat ~/.ssh/id_ed25519.pub`
   - Go to your GitHub repository → Settings → Deploy keys → Add deploy key
   - Paste the public key and enable write access if needed

3. **Update the repository URL** in both setup scripts:
   ```bash
   # Edit the scripts and change
   TELLER_REPO="https://github.com/yourusername/teller.git"
   # to
   TELLER_REPO="git@github.com:yourusername/teller.git"
   ```

4. **Ensure the SSH agent is running** before executing the setup scripts:
   ```bash
   eval "$(ssh-agent -s)"
   ssh-add ~/.ssh/id_ed25519
   ```

### Option 2: Personal Access Token (Simpler)

1. **Create a Personal Access Token (PAT)** in GitHub:
   - Go to GitHub → Settings → Developer settings → Personal access tokens
   - Generate a new token with `repo` scope
   - Copy the token

2. **Update the repository URL** in both setup scripts:
   ```bash
   # Edit the scripts and change
   TELLER_REPO="https://github.com/yourusername/teller.git"
   # to
   TELLER_REPO="https://username:your_token_here@github.com/yourusername/teller.git"
   ```
   Replace `username` with your GitHub username and `your_token_here` with the token you generated.

3. **Keep your tokens secure** - do not share the modified scripts with the token included.

### Troubleshooting Repository Access

If you encounter issues cloning the repository:

1. **Test authentication** before running the setup scripts:
   ```bash
   # For SSH
   ssh -T git@github.com
   
   # For HTTPS with token
   git clone https://username:your_token_here@github.com/yourusername/teller.git test-repo
   ```

2. **Manual cloning** - The scripts now include a fallback option where you can manually clone the repository if automatic cloning fails.

## Customizing the Scripts

If you need to customize the scripts:

1. **Teller Repository URL**: Change the `TELLER_REPO` variable in the script
2. **Database Passwords**: Change the password variables in the script
3. **Site Names**: Change the site name variables 

Simply edit the script before running it to make these changes. 