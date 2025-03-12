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
- [ ] Backup and recovery procedures tested
- [ ] Backup storage service configured and accessible
- [ ] Backup retention policies defined and implemented
- [ ] Backup encryption keys securely stored

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
- [ ] Initial backup completed successfully
- [ ] Backup restoration test performed
- [ ] Offsite backup transfer verified
- [ ] Backup notification system working

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

## 7. Advanced Production Considerations

### 7.1 High Availability Configuration

#### 7.1.1 PostgreSQL High Availability
```yaml
# Add to docker-compose.prod.yml
services:
  postgres-hq-primary:
    # ... existing configuration ...
    
  postgres-hq-standby:
    image: postgres:15.4
    env_file: ./config/hq.env
    environment:
      - POSTGRES_HOST_STANDBY_MODE=hot_standby
      - PRIMARY_CONNINFO=host=postgres-hq-primary port=5432 user=replicator password=strong_replication_password
    volumes:
      - postgres-hq-standby-data:/var/lib/postgresql/data
      - ./config/postgresql.standby.conf:/etc/postgresql/postgresql.conf
    command: postgres -c config_file=/etc/postgresql/postgresql.conf
    depends_on:
      - postgres-hq-primary
    logging: *default-logging
    restart: unless-stopped
    networks:
      - banking-network
      
  pgpool:
    image: bitnami/pgpool:4.4
    environment:
      - PGPOOL_BACKEND_NODES=0:postgres-hq-primary:5432,1:postgres-hq-standby:5432
      - PGPOOL_SR_CHECK_USER=replicator
      - PGPOOL_SR_CHECK_PASSWORD=strong_replication_password
      - PGPOOL_ENABLE_LOAD_BALANCING=yes
      - PGPOOL_POSTGRES_USERNAME=erpnext
      - PGPOOL_POSTGRES_PASSWORD=strong_password_here
    ports:
      - "5432:5432"
    depends_on:
      - postgres-hq-primary
      - postgres-hq-standby
    networks:
      - banking-network
```

#### 7.1.2 ERPNext High Availability
```yaml
# Add to docker-compose.prod.yml
services:
  erpnext-hq-1:
    # ... existing configuration ...
    
  erpnext-hq-2:
    # ... duplicate of erpnext-hq-1 configuration ...
    
  nginx-lb:
    image: nginx:latest
    volumes:
      - ./config/nginx-lb.conf:/etc/nginx/nginx.conf:ro
      - ./ssl/hq:/etc/nginx/ssl:ro
    ports:
      - "80:80"
      - "443:443"
    depends_on:
      - erpnext-hq-1
      - erpnext-hq-2
    networks:
      - banking-network
```

```nginx
# /opt/banking-system/config/nginx-lb.conf
events {
    worker_connections 1024;
}

http {
    upstream erpnext_backend {
        server erpnext-hq-1:8000;
        server erpnext-hq-2:8000;
    }
    
    server {
        listen 80;
        server_name hq.banking.local;
        return 301 https://$host$request_uri;
    }
    
    server {
        listen 443 ssl;
        server_name hq.banking.local;
        
        ssl_certificate /etc/nginx/ssl/fullchain.pem;
        ssl_certificate_key /etc/nginx/ssl/privkey.pem;
        
        location / {
            proxy_pass http://erpnext_backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
}
```

### 7.2 Scaling Considerations

#### 7.2.1 Horizontal Scaling
- **ERPNext Workers**: Add more ERPNext worker containers to handle increased load
- **Database Read Replicas**: Add read replicas for reporting and analytics
- **Load Balancing**: Implement proper load balancing for all services

```bash
# Scale ERPNext workers
docker-compose -f docker-compose.prod.yml up -d --scale erpnext-hq-worker=3

# Add read replica for reporting
cat > /opt/banking-system/config/postgresql.read.conf << EOL
hot_standby = on
hot_standby_feedback = on
max_standby_streaming_delay = 30s
max_standby_archive_delay = 30s
EOL

# Add to docker-compose.prod.yml
services:
  postgres-hq-read:
    image: postgres:15.4
    env_file: ./config/hq.env
    environment:
      - POSTGRES_HOST_STANDBY_MODE=hot_standby
      - PRIMARY_CONNINFO=host=postgres-hq-primary port=5432 user=replicator password=strong_replication_password
    volumes:
      - postgres-hq-read-data:/var/lib/postgresql/data
      - ./config/postgresql.read.conf:/etc/postgresql/postgresql.conf
    command: postgres -c config_file=/etc/postgresql/postgresql.conf
    depends_on:
      - postgres-hq-primary
    logging: *default-logging
    restart: unless-stopped
    networks:
      - banking-network
```

#### 7.2.2 Vertical Scaling
- Increase CPU and RAM allocations for critical services
- Optimize storage with faster disks or RAID configurations
- Tune JVM and Node.js memory settings for better performance

```yaml
# Resource constraints in docker-compose.prod.yml
services:
  erpnext-hq:
    # ... existing configuration ...
    deploy:
      resources:
        limits:
          cpus: '4'
          memory: 8G
        reservations:
          cpus: '2'
          memory: 4G
          
  postgres-hq:
    # ... existing configuration ...
    deploy:
      resources:
        limits:
          cpus: '4'
          memory: 16G
        reservations:
          cpus: '2'
          memory: 8G
```

### 7.3 Disaster Recovery Site

#### 7.3.1 Setting Up a DR Site
```bash
# Create DR site configuration
mkdir -p /opt/banking-system-dr
cp -r /opt/banking-system/config /opt/banking-system-dr/
cp -r /opt/banking-system/ssl /opt/banking-system-dr/

# Modify DR site configuration
sed -i 's/banking.local/banking-dr.local/g' /opt/banking-system-dr/config/*.env
sed -i 's/banking.local/banking-dr.local/g' /opt/banking-system-dr/config/*.conf

# Create DR docker-compose file
cp /opt/banking-system/docker-compose.prod.yml /opt/banking-system-dr/docker-compose.dr.yml
```

#### 7.3.2 DR Synchronization
```bash
# Create DR sync script
cat > /opt/banking-system/scripts/sync-to-dr.sh << 'EOL'
#!/bin/bash
set -e

# Sync PostgreSQL data
pg_basebackup -h postgres-hq-primary -U replicator -D /tmp/pg_basebackup -Fp -Xs -P
rsync -avz --delete /tmp/pg_basebackup/ dr-server:/opt/banking-system-dr/pg_data/
rm -rf /tmp/pg_basebackup

# Sync ERPNext sites
rsync -avz --delete /opt/banking-system/sites/ dr-server:/opt/banking-system-dr/sites/

# Sync configuration files
rsync -avz --delete /opt/banking-system/config/ dr-server:/opt/banking-system-dr/config/
EOL
chmod +x /opt/banking-system/scripts/sync-to-dr.sh

# Schedule DR sync
echo "0 */4 * * * /opt/banking-system/scripts/sync-to-dr.sh >> /var/log/banking-system/dr-sync.log 2>&1" | crontab -
```

#### 7.3.3 DR Failover Procedure
```bash
# Create DR failover script
cat > /opt/banking-system/scripts/dr-failover.sh << 'EOL'
#!/bin/bash
set -e

# Activate DR site
ssh dr-server "cd /opt/banking-system-dr && docker-compose -f docker-compose.dr.yml up -d"

# Update DNS records to point to DR site
# This would typically be done through your DNS provider's API
# Example with AWS Route53:
# aws route53 change-resource-record-sets --hosted-zone-id ZXXXXX --change-batch file://dns-changes.json

# Send notification
echo "DR site activated at $(date)" | mail -s "ALERT: Banking System DR Failover" admin@banking.local
EOL
chmod +x /opt/banking-system/scripts/dr-failover.sh
```

### 7.4 Performance Tuning

#### 7.4.1 PostgreSQL Performance Tuning
```bash
# Create optimized PostgreSQL configuration
cat > /opt/banking-system/config/postgresql.perf.conf << EOL
# Memory Configuration
shared_buffers = 8GB                  # 25% of available RAM
effective_cache_size = 24GB           # 75% of available RAM
work_mem = 64MB                       # Depends on max_connections
maintenance_work_mem = 1GB            # For maintenance operations

# Checkpoint Configuration
checkpoint_timeout = 15min
checkpoint_completion_target = 0.9
max_wal_size = 16GB
min_wal_size = 4GB

# Write Ahead Log
wal_buffers = 16MB
wal_writer_delay = 200ms
wal_writer_flush_after = 1MB

# Background Writer
bgwriter_delay = 200ms
bgwriter_lru_maxpages = 100
bgwriter_lru_multiplier = 2.0

# Query Planner
random_page_cost = 1.1                # For SSD storage
effective_io_concurrency = 200        # For SSD storage
default_statistics_target = 100

# Parallel Query
max_worker_processes = 16             # Based on CPU cores
max_parallel_workers_per_gather = 4   # Based on CPU cores
max_parallel_workers = 16             # Based on CPU cores
parallel_leader_participation = on

# Logging for Performance Analysis
log_min_duration_statement = 1000     # Log queries taking more than 1s
log_checkpoints = on
log_lock_waits = on
log_temp_files = 0
EOL
```

#### 7.4.2 ERPNext Performance Tuning
```bash
# Create optimized ERPNext configuration
cat > /opt/banking-system/config/erpnext-site-config.json << EOL
{
  "db_host": "pgpool",
  "db_port": 5432,
  "db_name": "erpnext_hq",
  "db_user": "erpnext",
  "db_password": "strong_password_here",
  "redis_cache": "redis-cache:6379",
  "redis_queue": "redis-queue:6379",
  "redis_socketio": "redis-socketio:6379",
  "socketio_port": 9000,
  "webserver_port": 8000,
  "server_script_enabled": true,
  "developer_mode": 0,
  "logging": 1,
  "rate_limit": {
    "limit": 120,
    "window": 3600
  },
  "background_workers": 5,
  "monitor": 1,
  "max_file_size": 10485760,
  "max_background_workers": 10,
  "max_worker_threads": 20,
  "scheduler_interval": 300,
  "enable_telemetry": 0
}
EOL
```

#### 7.4.3 Node.js Performance Tuning
```bash
# Create optimized Node.js environment variables
cat > /opt/banking-system/config/nodejs.env << EOL
NODE_ENV=production
NODE_OPTIONS=--max-old-space-size=4096
UV_THREADPOOL_SIZE=16
EOL
```

### 7.5 Additional Security Hardening

#### 7.5.1 Docker Security
```bash
# Create Docker daemon security configuration
cat > /etc/docker/daemon.json << EOL
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  },
  "icc": false,
  "userns-remap": "default",
  "no-new-privileges": true,
  "live-restore": true,
  "userland-proxy": false,
  "seccomp-profile": "/etc/docker/seccomp-profile.json"
}
EOL
```

#### 7.5.2 Database Encryption
```bash
# Enable PostgreSQL data encryption
cat >> /opt/banking-system/config/postgresql.conf << EOL
# Data Encryption
ssl = on
ssl_cert_file = '/etc/ssl/certs/ssl-cert-snakeoil.pem'
ssl_key_file = '/etc/ssl/private/ssl-cert-snakeoil.key'
ssl_ciphers = 'HIGH:!MEDIUM:!LOW:!aNULL:!NULL:!eNULL'
ssl_prefer_server_ciphers = on
password_encryption = scram-sha-256
EOL
```

#### 7.5.3 Web Application Firewall
```bash
# Install ModSecurity WAF with NGINX
apt install -y nginx-plus-module-modsecurity

# Configure ModSecurity
cat > /etc/nginx/modsec/main.conf << EOL
SecRuleEngine On
SecRequestBodyAccess On
SecRequestBodyLimit 10485760
SecRequestBodyNoFilesLimit 131072
SecResponseBodyAccess On
SecResponseBodyLimit 10485760

# Include OWASP Core Rule Set
Include /etc/nginx/modsec/owasp-crs/crs-setup.conf
Include /etc/nginx/modsec/owasp-crs/rules/*.conf

# Banking-specific rules
SecRule REQUEST_FILENAME "/api/method/transfer_funds" \
    "chain,phase:2,deny,status:403,log,msg:'Suspicious fund transfer attempt'"
SecRule REQUEST_HEADERS:User-Agent "@contains bot" ""
EOL

# Update NGINX configuration
cat >> /opt/banking-system/config/nginx-lb.conf << EOL
    # ModSecurity configuration
    modsecurity on;
    modsecurity_rules_file /etc/nginx/modsec/main.conf;
EOL
```

#### 7.5.4 Intrusion Detection System
```bash
# Install Wazuh IDS
curl -s https://packages.wazuh.com/key/GPG-KEY-WAZUH | apt-key add -
echo "deb https://packages.wazuh.com/4.x/apt/ stable main" | tee /etc/apt/sources.list.d/wazuh.list
apt update
apt install -y wazuh-manager

# Configure Wazuh for banking system
cat > /var/ossec/etc/ossec.conf << EOL
<ossec_config>
  <global>
    <email_notification>yes</email_notification>
    <email_to>admin@banking.local</email_to>
    <smtp_server>smtp.banking.local</smtp_server>
    <email_from>wazuh@banking.local</email_from>
  </global>

  <syscheck>
    <directories check_all="yes">/opt/banking-system/config</directories>
    <directories check_all="yes">/opt/banking-system/ssl</directories>
  </syscheck>

  <rootcheck>
    <rootkit_files>/var/ossec/etc/rootcheck/rootkit_files.txt</rootkit_files>
    <rootkit_trojans>/var/ossec/etc/rootcheck/rootkit_trojans.txt</rootkit_trojans>
  </rootcheck>

  <alerts>
    <log_alert_level>3</log_alert_level>
    <email_alert_level>7</email_alert_level>
  </alerts>
</ossec_config>
EOL

# Start Wazuh service
systemctl enable wazuh-manager
systemctl start wazuh-manager
```

### 7.6 Comprehensive Backup Strategy

#### 7.6.1 Multi-Tier Backup Architecture
```bash
# Create a multi-tier backup configuration
cat > /opt/banking-system/config/backup-config.json << EOL
{
  "backup_tiers": [
    {
      "tier": "local",
      "retention": {
        "hourly": 24,
        "daily": 7,
        "weekly": 4,
        "monthly": 12
      },
      "location": "/backup/local",
      "encryption": true
    },
    {
      "tier": "onsite",
      "retention": {
        "daily": 30,
        "weekly": 12,
        "monthly": 24
      },
      "location": "/backup/onsite",
      "encryption": true
    },
    {
      "tier": "offsite",
      "retention": {
        "weekly": 52,
        "monthly": 60
      },
      "location": "s3://banking-backup-offsite",
      "encryption": true
    }
  ],
  "encryption": {
    "algorithm": "AES-256-GCM",
    "key_rotation": "quarterly"
  }
}
EOL
```

#### 7.6.2 Backup Verification and Testing
```bash
# Create backup verification script
cat > /opt/banking-system/scripts/verify-backups.sh << 'EOL'
#!/bin/bash
set -e

# Configuration
BACKUP_DIR="/backup"
LOG_FILE="/var/log/banking-system/backup-verification.log"
NOTIFICATION_EMAIL="admin@banking.local"

# Function to verify PostgreSQL backup
verify_postgres_backup() {
  local backup_file=$1
  echo "Verifying PostgreSQL backup: $backup_file"
  
  # Check if file exists and is not empty
  if [ ! -s "$backup_file" ]; then
    echo "ERROR: Backup file is empty or does not exist: $backup_file"
    return 1
  fi
  
  # Verify backup integrity
  pg_restore -l "$backup_file" > /dev/null
  if [ $? -ne 0 ]; then
    echo "ERROR: Backup file is corrupted: $backup_file"
    return 1
  fi
  
  echo "Backup verification successful: $backup_file"
  return 0
}

# Function to verify ERPNext backup
verify_erpnext_backup() {
  local backup_dir=$1
  echo "Verifying ERPNext backup: $backup_dir"
  
  # Check if directory exists
  if [ ! -d "$backup_dir" ]; then
    echo "ERROR: Backup directory does not exist: $backup_dir"
    return 1
  fi
  
  # Check for database backup
  if ! ls "$backup_dir"/*.sql.gz > /dev/null 2>&1; then
    echo "ERROR: No database backup found in: $backup_dir"
    return 1
  fi
  
  # Check for files backup if applicable
  if ! ls "$backup_dir"/*.tar > /dev/null 2>&1; then
    echo "WARNING: No files backup found in: $backup_dir"
  fi
  
  echo "Backup verification successful: $backup_dir"
  return 0
}

# Main verification logic
echo "Starting backup verification at $(date)" | tee -a "$LOG_FILE"

# Verify latest PostgreSQL backups
latest_pg_hq=$(find "$BACKUP_DIR/postgres" -name "erpnext_hq_*.backup" -type f -mtime -1 | sort -r | head -1)
if [ -n "$latest_pg_hq" ]; then
  verify_postgres_backup "$latest_pg_hq" | tee -a "$LOG_FILE"
else
  echo "ERROR: No recent HQ PostgreSQL backup found" | tee -a "$LOG_FILE"
fi

# Verify latest ERPNext backups
latest_erpnext_hq=$(find "$BACKUP_DIR/erpnext" -name "hq_*" -type d -mtime -1 | sort -r | head -1)
if [ -n "$latest_erpnext_hq" ]; then
  verify_erpnext_backup "$latest_erpnext_hq" | tee -a "$LOG_FILE"
else
  echo "ERROR: No recent HQ ERPNext backup found" | tee -a "$LOG_FILE"
fi

# Send notification with results
grep -E "ERROR|WARNING" "$LOG_FILE" > /tmp/backup_issues.txt
if [ -s /tmp/backup_issues.txt ]; then
  mail -s "ALERT: Backup Verification Issues Detected" "$NOTIFICATION_EMAIL" < /tmp/backup_issues.txt
fi

echo "Backup verification completed at $(date)" | tee -a "$LOG_FILE"
EOL

chmod +x /opt/banking-system/scripts/verify-backups.sh

# Schedule regular verification
echo "0 7 * * * /opt/banking-system/scripts/verify-backups.sh" | crontab -
```

#### 7.6.3 Offsite Backup Transfer
```bash
# Create offsite backup transfer script
cat > /opt/banking-system/scripts/offsite-backup-transfer.sh << 'EOL'
#!/bin/bash
set -e

# Configuration
SOURCE_DIR="/backup"
DESTINATION="s3://banking-backup-offsite"
LOG_FILE="/var/log/banking-system/offsite-transfer.log"
ENCRYPTION_KEY="/opt/banking-system/config/backup-encryption.key"

# Ensure AWS CLI is installed
if ! command -v aws &> /dev/null; then
  echo "AWS CLI not found. Installing..."
  apt update && apt install -y awscli
fi

# Function to encrypt and transfer backup
encrypt_and_transfer() {
  local source_file=$1
  local dest_path=$2
  local filename=$(basename "$source_file")
  
  echo "Encrypting and transferring: $filename"
  
  # Encrypt the file
  openssl enc -aes-256-cbc -salt -in "$source_file" -out "/tmp/$filename.enc" -pass file:"$ENCRYPTION_KEY"
  
  # Transfer to S3
  aws s3 cp "/tmp/$filename.enc" "$dest_path/$filename.enc" --storage-class STANDARD_IA
  
  # Clean up
  rm "/tmp/$filename.enc"
  
  echo "Transfer completed: $filename"
}

# Main transfer logic
echo "Starting offsite backup transfer at $(date)" | tee -a "$LOG_FILE"

# Transfer PostgreSQL backups
find "$SOURCE_DIR/postgres" -name "*.backup" -type f -mtime -7 | while read backup_file; do
  encrypt_and_transfer "$backup_file" "$DESTINATION/postgres" | tee -a "$LOG_FILE"
done

# Transfer ERPNext backups
find "$SOURCE_DIR/erpnext" -name "*.tar" -type f -mtime -7 | while read backup_file; do
  encrypt_and_transfer "$backup_file" "$DESTINATION/erpnext" | tee -a "$LOG_FILE"
done

echo "Offsite backup transfer completed at $(date)" | tee -a "$LOG_FILE"
EOL

chmod +x /opt/banking-system/scripts/offsite-backup-transfer.sh

# Schedule weekly offsite transfer
echo "0 1 * * 0 /opt/banking-system/scripts/offsite-backup-transfer.sh" | crontab -
```

#### 7.6.4 Backup Monitoring and Reporting
```bash
# Create backup monitoring script
cat > /opt/banking-system/scripts/backup-monitoring.sh << 'EOL'
#!/bin/bash

# Configuration
BACKUP_DIR="/backup"
REPORT_FILE="/var/www/html/backup-report.html"
EMAIL_RECIPIENTS="admin@banking.local,manager@banking.local"

# Generate backup report
generate_report() {
  cat > "$REPORT_FILE" << HTML
<!DOCTYPE html>
<html>
<head>
  <title>Banking System Backup Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background-color: #f2f2f2; }
    .success { color: green; }
    .warning { color: orange; }
    .error { color: red; }
  </style>
</head>
<body>
  <h1>Banking System Backup Report</h1>
  <p>Generated on: $(date)</p>
  
  <h2>PostgreSQL Backups</h2>
  <table>
    <tr>
      <th>Backup Type</th>
      <th>Latest Backup</th>
      <th>Size</th>
      <th>Age</th>
      <th>Status</th>
    </tr>
HTML

  # Add PostgreSQL backup info
  for type in hq branch1 branch2; do
    latest=$(find "$BACKUP_DIR/postgres" -name "erpnext_${type}_*.backup" | sort -r | head -1)
    if [ -n "$latest" ]; then
      size=$(du -h "$latest" | cut -f1)
      age=$(( ($(date +%s) - $(stat -c %Y "$latest")) / 3600 ))
      
      if [ $age -lt 24 ]; then
        status="<span class='success'>OK</span>"
      elif [ $age -lt 48 ]; then
        status="<span class='warning'>Warning: Backup is over 24 hours old</span>"
      else
        status="<span class='error'>Error: Backup is over 48 hours old</span>"
      fi
      
      echo "    <tr>" >> "$REPORT_FILE"
      echo "      <td>$type</td>" >> "$REPORT_FILE"
      echo "      <td>$(basename "$latest")</td>" >> "$REPORT_FILE"
      echo "      <td>$size</td>" >> "$REPORT_FILE"
      echo "      <td>${age}h</td>" >> "$REPORT_FILE"
      echo "      <td>$status</td>" >> "$REPORT_FILE"
      echo "    </tr>" >> "$REPORT_FILE"
    else
      echo "    <tr>" >> "$REPORT_FILE"
      echo "      <td>$type</td>" >> "$REPORT_FILE"
      echo "      <td colspan='3'>No backup found</td>" >> "$REPORT_FILE"
      echo "      <td><span class='error'>Error: No backup available</span></td>" >> "$REPORT_FILE"
      echo "    </tr>" >> "$REPORT_FILE"
    fi
  done

  # Complete the report
  cat >> "$REPORT_FILE" << HTML
  </table>
  
  <h2>ERPNext Backups</h2>
  <table>
    <tr>
      <th>Backup Type</th>
      <th>Latest Backup</th>
      <th>Database Size</th>
      <th>Files Size</th>
      <th>Age</th>
      <th>Status</th>
    </tr>
HTML

  # Add ERPNext backup info
  for type in hq branch1 branch2; do
    latest_dir=$(find "$BACKUP_DIR/erpnext" -name "${type}_*" -type d | sort -r | head -1)
    if [ -n "$latest_dir" ]; then
      db_file=$(find "$latest_dir" -name "*.sql.gz" | head -1)
      files_file=$(find "$latest_dir" -name "*.tar" | head -1)
      
      db_size="N/A"
      if [ -n "$db_file" ]; then
        db_size=$(du -h "$db_file" | cut -f1)
      fi
      
      files_size="N/A"
      if [ -n "$files_file" ]; then
        files_size=$(du -h "$files_file" | cut -f1)
      fi
      
      age=$(( ($(date +%s) - $(stat -c %Y "$latest_dir")) / 3600 ))
      
      if [ $age -lt 24 ]; then
        status="<span class='success'>OK</span>"
      elif [ $age -lt 48 ]; then
        status="<span class='warning'>Warning: Backup is over 24 hours old</span>"
      else
        status="<span class='error'>Error: Backup is over 48 hours old</span>"
      fi
      
      echo "    <tr>" >> "$REPORT_FILE"
      echo "      <td>$type</td>" >> "$REPORT_FILE"
      echo "      <td>$(basename "$latest_dir")</td>" >> "$REPORT_FILE"
      echo "      <td>$db_size</td>" >> "$REPORT_FILE"
      echo "      <td>$files_size</td>" >> "$REPORT_FILE"
      echo "      <td>${age}h</td>" >> "$REPORT_FILE"
      echo "      <td>$status</td>" >> "$REPORT_FILE"
      echo "    </tr>" >> "$REPORT_FILE"
    else
      echo "    <tr>" >> "$REPORT_FILE"
      echo "      <td>$type</td>" >> "$REPORT_FILE"
      echo "      <td colspan='4'>No backup found</td>" >> "$REPORT_FILE"
      echo "      <td><span class='error'>Error: No backup available</span></td>" >> "$REPORT_FILE"
      echo "    </tr>" >> "$REPORT_FILE"
    fi
  done

  # Complete the report
  cat >> "$REPORT_FILE" << HTML
  </table>
  
  <h2>Offsite Backup Status</h2>
  <table>
    <tr>
      <th>Backup Type</th>
      <th>Last Successful Transfer</th>
      <th>Status</th>
    </tr>
HTML

  # Add offsite backup info
  last_transfer=$(grep "Offsite backup transfer completed" /var/log/banking-system/offsite-transfer.log | tail -1)
  if [ -n "$last_transfer" ]; then
    transfer_date=$(echo "$last_transfer" | sed 's/.*completed at \(.*\)/\1/')
    transfer_age=$(( ($(date +%s) - $(date -d "$transfer_date" +%s)) / 86400 ))
    
    if [ $transfer_age -lt 7 ]; then
      status="<span class='success'>OK</span>"
    elif [ $transfer_age -lt 14 ]; then
      status="<span class='warning'>Warning: Last transfer over 7 days ago</span>"
    else
      status="<span class='error'>Error: Last transfer over 14 days ago</span>"
    fi
    
    echo "    <tr>" >> "$REPORT_FILE"
    echo "      <td>All Backups</td>" >> "$REPORT_FILE"
    echo "      <td>$transfer_date</td>" >> "$REPORT_FILE"
    echo "      <td>$status</td>" >> "$REPORT_FILE"
    echo "    </tr>" >> "$REPORT_FILE"
  else
    echo "    <tr>" >> "$REPORT_FILE"
    echo "      <td>All Backups</td>" >> "$REPORT_FILE"
    echo "      <td>No transfer record found</td>" >> "$REPORT_FILE"
    echo "      <td><span class='error'>Error: No offsite transfer recorded</span></td>" >> "$REPORT_FILE"
    echo "    </tr>" >> "$REPORT_FILE"
  fi

  # Complete the report
  cat >> "$REPORT_FILE" << HTML
  </table>
  
  <p><small>This report is automatically generated. Please do not reply to this email.</small></p>
</body>
</html>
HTML
}

# Generate the report
generate_report

# Email the report
if command -v mutt &> /dev/null; then
  echo "Backup status report for $(date +%Y-%m-%d)" | mutt -e "set content_type=text/html" -s "Banking System Backup Report" -a "$REPORT_FILE" -- $EMAIL_RECIPIENTS
else
  mail -s "Banking System Backup Report" $EMAIL_RECIPIENTS < "$REPORT_FILE"
fi

# Keep a copy for historical reference
cp "$REPORT_FILE" "$BACKUP_DIR/reports/backup-report-$(date +%Y%m%d).html"
EOL

chmod +x /opt/banking-system/scripts/backup-monitoring.sh

# Schedule daily backup monitoring
echo "0 8 * * * /opt/banking-system/scripts/backup-monitoring.sh" | crontab -
```

This completes the advanced production considerations section, providing comprehensive guidance for deploying a robust, secure, and high-performance multi-branch banking system. 