# Comprehensive Setup Guide - Part 1: Prerequisites and Initial Setup

## Overview

This guide provides detailed instructions for setting up a multi-branch banking system prototype using ERPNext with PostgreSQL. The prototype demonstrates database replication and synchronization between headquarters (HQ) and multiple branches.

## Prerequisites

### Hardware Requirements
- **Development/Testing Machine**: 
  - Minimum 8GB RAM, 4 CPU cores
  - 50GB free disk space
  - Operating system: Ubuntu 20.04+ or Windows 10/11 with WSL2

- **For Multi-Machine Testing**:
  - At least 3 machines (1 for HQ, 2 for branches)
  - Connected via network (preferably on the same LAN)
  - Each machine with minimum 4GB RAM

### Software Prerequisites

#### For Ubuntu/Linux:

1. **Update System Packages**:
   ```bash
   sudo apt update
   sudo apt upgrade -y
   ```

2. **Install Docker and Docker Compose**:
   ```bash
   # Install required packages
   sudo apt install -y apt-transport-https ca-certificates curl software-properties-common

   # Add Docker's official GPG key
   curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo apt-key add -

   # Add Docker repository
   sudo add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable"

   # Install Docker
   sudo apt update
   sudo apt install -y docker-ce docker-ce-cli containerd.io

   # Install Docker Compose
   sudo curl -L "https://github.com/docker/compose/releases/download/v2.15.1/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
   sudo chmod +x /usr/local/bin/docker-compose

   # Add your user to the docker group to run docker without sudo
   sudo usermod -aG docker $USER
   ```
   
   **Note**: After adding yourself to the docker group, you'll need to log out and log back in for the changes to take effect.

3. **Install Git**:
   ```bash
   sudo apt install -y git
   ```

#### For Windows:

1. **Install WSL2 (Windows Subsystem for Linux)**:
   - Open PowerShell as Administrator and run:
   ```powershell
   wsl --install
   ```
   - Restart your computer
   - Complete the Ubuntu setup when it opens

2. **Install Docker Desktop for Windows**:
   - Download from [Docker Desktop](https://www.docker.com/products/docker-desktop)
   - During installation, ensure the "Use WSL 2 instead of Hyper-V" option is selected
   - Complete the installation and restart if prompted
   - Start Docker Desktop and ensure it's running properly

3. **Install Git for Windows**:
   - Download from [Git for Windows](https://gitforwindows.org/)
   - Use default installation options

## Directory Structure Setup

Create a base directory for the prototype:

```bash
# Create the main project directory
mkdir -p banking-prototype
cd banking-prototype

# Create directories for HQ and branches
mkdir -p hq/data branch1/data branch2/data
mkdir -p shared/sync-service

# Create directories for configuration files
mkdir -p config/postgres config/erpnext config/rabbitmq
```

## Network Setup

Create a Docker network for communication between containers:

```bash
# Create a network for the prototype
docker network create banking-prototype-network
```

## Next Steps

After completing the prerequisites installation and directory setup, proceed to [Part 2: Database Setup](setup_guide_part2_database.md) to configure the PostgreSQL databases for HQ and branches. 