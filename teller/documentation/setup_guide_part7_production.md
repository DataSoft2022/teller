# Comprehensive Setup Guide - Part 7: Production Deployment

## 1. Production Environment Requirements

### 1.1 Hardware Requirements

#### Headquarters (HQ)
- CPU: Minimum 8 cores, recommended 16 cores
- RAM: Minimum 32GB, recommended 64GB
- Storage: Minimum 500GB SSD, recommended 1TB NVMe SSD
- Network: 1Gbps dedicated connection

#### Branch Servers (Per Branch)
- CPU: Minimum 4 cores, recommended 8 cores
- RAM: Minimum 16GB, recommended 32GB
- Storage: Minimum 256GB SSD, recommended 512GB SSD
- Network: Minimum 100Mbps dedicated connection

### 1.2 Network Requirements
- Dedicated VPN connection between branches and HQ
- Static IP addresses for all servers
- Firewall rules for inter-branch communication
- SSL/TLS certificates for secure communication

### 1.3 Software Requirements
- Ubuntu Server 22.04 LTS
- Docker Engine 24.0.x
- Docker Compose v2.x
- PostgreSQL 15.x
- ERPNext v14.x
- Node.js 18.x LTS
- RabbitMQ 3.12.x

## 2. Security Considerations

### 2.1 Network Security
```bash
# Sample UFW (Uncomplicated Firewall) rules
ufw default deny incoming
ufw default allow outgoing
ufw allow from [HQ-IP] to any port 5432 proto tcp  # PostgreSQL
ufw allow from [HQ-IP] to any port 5672 proto tcp  # RabbitMQ
ufw allow from [HQ-IP] to any port 15672 proto tcp # RabbitMQ Management
ufw allow from [HQ-IP] to any port 8000 proto tcp  # ERPNext
ufw allow 22/tcp  # SSH
ufw enable
```

### 2.2 Database Security
- Enable SSL for PostgreSQL connections
- Use strong passwords and role-based access control
- Implement connection pooling with PgBouncer
- Regular security audits and monitoring

### 2.3 Application Security
- Use secure environment variables
- Implement rate limiting
- Enable audit logging
- Regular security patches and updates
- Multi-factor authentication for all users

### 2.4 Data Protection
- Encryption at rest for all databases
- TLS 1.3 for all communications
- Regular backup encryption
- Secure key management system 

## 3. Production Deployment Process

### 3.1 Server Preparation
```bash
# Update system packages
apt update && apt upgrade -y

# Install required packages
apt install -y apt-transport-https ca-certificates curl software-properties-common

# Install Docker
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
echo "deb [arch=amd64 signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
apt update
apt install -y docker-ce docker-ce-cli containerd.io

# Install Docker Compose
curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Create necessary directories
mkdir -p /opt/banking-system/{hq,branch1,branch2}
mkdir -p /opt/banking-system/shared
mkdir -p /var/log/banking-system
```

### 3.2 Configuration Management
```bash
# Create configuration directory
mkdir -p /opt/banking-system/config

# Create environment files
cat > /opt/banking-system/config/hq.env << EOL
POSTGRES_DB=erpnext_hq
POSTGRES_USER=erpnext
POSTGRES_PASSWORD=strong_password_here
RABBITMQ_DEFAULT_USER=banking_system
RABBITMQ_DEFAULT_PASS=strong_password_here
ERPNEXT_SITE_NAME=hq.banking.local
EOL

# Create branch environment files (repeat for each branch)
cat > /opt/banking-system/config/branch1.env << EOL
POSTGRES_DB=erpnext_branch1
POSTGRES_USER=erpnext
POSTGRES_PASSWORD=strong_password_here
HQ_SYNC_URL=http://hq.banking.local
BRANCH_ID=branch1
EOL

# Set proper permissions
chmod 600 /opt/banking-system/config/*.env
chown root:root /opt/banking-system/config/*.env
```

### 3.3 SSL Certificate Setup
```bash
# Generate SSL certificates using Let's Encrypt
apt install -y certbot
certbot certonly --standalone -d hq.banking.local
certbot certonly --standalone -d branch1.banking.local
certbot certonly --standalone -d branch2.banking.local

# Copy certificates to appropriate locations
mkdir -p /opt/banking-system/ssl
cp /etc/letsencrypt/live/hq.banking.local/* /opt/banking-system/ssl/hq/
cp /etc/letsencrypt/live/branch1.banking.local/* /opt/banking-system/ssl/branch1/
cp /etc/letsencrypt/live/branch2.banking.local/* /opt/banking-system/ssl/branch2/

# Set proper permissions
chmod -R 600 /opt/banking-system/ssl
chown -R root:root /opt/banking-system/ssl
```

### 3.4 System Limits and Optimization
```bash
# Add system limits configuration
cat > /etc/security/limits.d/banking-system.conf << EOL
*               soft    nofile          65536
*               hard    nofile          65536
*               soft    nproc           32768
*               hard    nproc           32768
EOL

# Add sysctl optimizations
cat > /etc/sysctl.d/60-banking-system.conf << EOL
# Network optimizations
net.core.somaxconn = 65536
net.ipv4.tcp_max_syn_backlog = 65536
net.ipv4.tcp_fin_timeout = 30
net.ipv4.tcp_keepalive_time = 300
net.ipv4.tcp_keepalive_probes = 5
net.ipv4.tcp_keepalive_intvl = 15

# File system optimizations
fs.file-max = 2097152
fs.inotify.max_user_watches = 524288

# VM optimizations
vm.swappiness = 10
vm.dirty_ratio = 60
vm.dirty_background_ratio = 2
EOL

# Apply sysctl settings
sysctl --system
``` 

## 4. Service Deployment

### 4.1 Production Docker Compose Configuration
```yaml
# /opt/banking-system/docker-compose.prod.yml
version: '3.8'

x-logging: &default-logging
  driver: "json-file"
  options:
    max-size: "100m"
    max-file: "5"

services:
  erpnext-hq:
    image: custom-erpnext:14.0.0
    environment:
      - POSTGRES_HOST=postgres-hq
    env_file: ./config/hq.env
    volumes:
      - ./sites:/home/frappe/frappe-bench/sites
      - ./ssl/hq:/etc/nginx/ssl:ro
    depends_on:
      - postgres-hq
      - redis-hq
    logging: *default-logging
    restart: unless-stopped
    networks:
      - banking-network

  postgres-hq:
    image: postgres:15.4
    env_file: ./config/hq.env
    volumes:
      - postgres-hq-data:/var/lib/postgresql/data
      - ./config/postgresql.conf:/etc/postgresql/postgresql.conf
    command: postgres -c config_file=/etc/postgresql/postgresql.conf
    logging: *default-logging
    restart: unless-stopped
    networks:
      - banking-network

  sync-service:
    image: banking-sync-service:1.0.0
    env_file: ./config/sync.env
    volumes:
      - ./logs:/app/logs
    depends_on:
      - rabbitmq
    logging: *default-logging
    restart: unless-stopped
    networks:
      - banking-network

volumes:
  postgres-hq-data:
  redis-hq-data:

networks:
  banking-network:
    driver: bridge
```

### 4.2 Production Monitoring Setup

#### 4.2.1 Prometheus Configuration
```yaml
# /opt/banking-system/monitoring/prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'banking-system'
    static_configs:
      - targets: ['localhost:9090']
        labels:
          service: 'prometheus'
      
  - job_name: 'node-exporter'
    static_configs:
      - targets: ['node-exporter:9100']
        labels:
          service: 'node-metrics'

  - job_name: 'postgres-exporter'
    static_configs:
      - targets: ['postgres-exporter:9187']
        labels:
          service: 'postgres-metrics'
```

#### 4.2.2 Grafana Dashboard Setup
```bash
# Install Grafana
apt install -y grafana

# Configure Grafana
cat > /etc/grafana/grafana.ini << EOL
[security]
admin_user = admin
admin_password = strong_password_here
disable_gravatar = true
cookie_secure = true
cookie_samesite = strict

[auth]
disable_login_form = false
oauth_auto_login = false

[server]
domain = monitoring.banking.local
root_url = https://monitoring.banking.local
EOL

# Start Grafana service
systemctl enable grafana-server
systemctl start grafana-server
```

## 5. Production Deployment Checklist

### 5.1 Pre-deployment Checks
- [ ] All system requirements met
- [ ] Network security configured
- [ ] SSL certificates installed
- [ ] Environment variables set
- [ ] Database backups configured
- [ ] Monitoring tools installed

### 5.2 Deployment Steps
1. Stop development services
   ```bash
   docker-compose down
   ```

2. Deploy production services
   ```bash
   docker-compose -f docker-compose.prod.yml up -d
   ```

3. Verify services
   ```bash
   docker-compose -f docker-compose.prod.yml ps
   docker-compose -f docker-compose.prod.yml logs
   ```

### 5.3 Post-deployment Verification
- [ ] ERPNext sites accessible
- [ ] Database replication working
- [ ] Message queue operational
- [ ] Monitoring dashboards active
- [ ] Backup system functional
- [ ] SSL certificates valid

### 5.4 Production Support
- Monitor system logs
- Set up alert notifications
- Document incident response procedures
- Maintain backup schedule
- Plan regular maintenance windows
- Keep security patches up to date

## 6. Troubleshooting Guide

### 6.1 Common Issues
1. Database Connection Issues
   ```bash
   # Check PostgreSQL logs
   docker-compose -f docker-compose.prod.yml logs postgres-hq
   
   # Verify PostgreSQL connection
   docker exec -it postgres-hq psql -U erpnext -d erpnext_hq -c "\dl"
   ```

2. Sync Service Issues
   ```bash
   # Check sync service logs
   docker-compose -f docker-compose.prod.yml logs sync-service
   
   # Verify RabbitMQ connection
   docker exec -it rabbitmq rabbitmqctl list_connections
   ```

3. ERPNext Issues
   ```bash
   # Check ERPNext logs
   docker-compose -f docker-compose.prod.yml logs erpnext-hq
   
   # Verify site status
   docker exec -it erpnext-hq bench --site hq.banking.local status
   ```

### 6.2 Recovery Procedures
1. Service Recovery
   ```bash
   # Restart specific service
   docker-compose -f docker-compose.prod.yml restart [service-name]
   
   # Rebuild and restart service
   docker-compose -f docker-compose.prod.yml up -d --build [service-name]
   ```

2. Data Recovery
   ```bash
   # Restore from backup
   ./scripts/restore-backup.sh [backup-file] [target-service]
   ```

This concludes the production deployment guide. Ensure all steps are followed carefully and maintain regular system monitoring and maintenance schedules. 