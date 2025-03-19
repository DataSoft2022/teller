# Comprehensive Setup Guide - Part 4: ERPNext Setup

## ERPNext with PostgreSQL Setup

In this section, we'll set up ERPNext with PostgreSQL for the banking system. This involves creating a custom Docker image for ERPNext that uses PostgreSQL instead of the default MariaDB.

### 1. Create Custom ERPNext Dockerfile

Create a custom Dockerfile for ERPNext with PostgreSQL support:

```bash
cd banking-prototype
mkdir -p config/erpnext
cat > config/erpnext/Dockerfile << 'EOF'
FROM frappe/erpnext:v14

USER root

# Install PostgreSQL client and Python dependencies
RUN apt-get update && apt-get install -y \
    postgresql-client \
    python3-dev \
    libpq-dev \
    && pip3 install psycopg2-binary

# Copy custom site config
COPY site_config_postgres.json /opt/frappe/sites/site_config_template.json

# Switch back to frappe user
USER frappe

EOF
```

### 2. Create Site Configuration for PostgreSQL

Create a site configuration file for ERPNext with PostgreSQL:

```bash
cat > config/erpnext/site_config_postgres.json << 'EOF'
{
    "db_host": "postgres-hq",
    "db_port": 5432,
    "db_name": "erpnext_site",
    "db_password": "erpnext_password",
    "db_type": "postgres",
    "auto_update": false,
    "serve_default_site": true,
    "developer_mode": 1,
    "disable_website_cache": true,
    "admin_password": "admin"
}
EOF
```

### 3. Understanding ERPNext Site Configuration

#### What is an ERPNext Site?

In ERPNext, a "site" is a specific tenant or instance of the application. Each site has its own:
- Database connection
- File storage
- Users and permissions
- Apps and configurations

#### Site Configuration in Multi-Branch Setup

In our multi-branch banking system, we create three separate ERPNext sites:
1. `hq.banking.local` - For the headquarters
2. `branch1.banking.local` - For Branch 1
3. `branch2.banking.local` - For Branch 2

Each site connects to its own PostgreSQL database but runs the same Teller app with similar configurations.

#### Do I Need to Create a New Website Every Time?

No, you do not need to create a new website every time you run the setup. The Docker Compose files and setup scripts handle this for you automatically. Once the initial setup is complete, the sites will persist in the Docker volumes.

If you restart the containers, the sites will still be available. If you want to completely reset the system, you would need to remove the Docker volumes and run the setup again.

#### Site-Specific Configuration for Teller App

For the Teller app to work properly in the multi-branch setup, each site needs certain configurations:

```bash
# For HQ
docker exec -it erpnext-hq bench --site hq.banking.local set-config branch_code "HQ"
docker exec -it erpnext-hq bench --site hq.banking.local set-config sync_service_url "http://rabbitmq-hq:3000/sync"

# For Branch 1
docker exec -it erpnext-branch1 bench --site branch1.banking.local set-config branch_code "BR01"
docker exec -it erpnext-branch1 bench --site branch1.banking.local set-config sync_service_url "http://rabbitmq-branch1:3000/sync"

# For Branch 2
docker exec -it erpnext-branch2 bench --site branch2.banking.local set-config branch_code "BR02"
docker exec -it erpnext-branch2 bench --site branch2.banking.local set-config sync_service_url "http://rabbitmq-branch2:3000/sync"
```

These configurations help identify each branch and connect to the appropriate synchronization service.

### 4. Create Docker Compose Files for ERPNext

#### HQ ERPNext Docker Compose

Create a Docker Compose file for the HQ ERPNext instance:

```bash
cat > hq/docker-compose-erpnext.yml << 'EOF'
version: '3.8'

services:
  erpnext-hq:
    build:
      context: ../config/erpnext
      dockerfile: Dockerfile
    container_name: erpnext-hq
    restart: unless-stopped
    environment:
      - POSTGRES_HOST=postgres-hq
      - POSTGRES_PORT=5432
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres_hq_password
      - SITE_NAME=hq.banking.local
      - ADMIN_PASSWORD=admin
      - DB_TYPE=postgres
    volumes:
      - ./data/erpnext:/home/frappe/frappe-bench/sites
    ports:
      - "8000:8000"
      - "9000:9000"
    depends_on:
      - postgres-hq
    networks:
      - banking-prototype-network

networks:
  banking-prototype-network:
    external: true
EOF
```

#### Branch 1 ERPNext Docker Compose

Create a Docker Compose file for Branch 1 ERPNext instance:

```bash
cat > branch1/docker-compose-erpnext.yml << 'EOF'
version: '3.8'

services:
  erpnext-branch1:
    build:
      context: ../config/erpnext
      dockerfile: Dockerfile
    container_name: erpnext-branch1
    restart: unless-stopped
    environment:
      - POSTGRES_HOST=postgres-branch1
      - POSTGRES_PORT=5432
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres_branch1_password
      - SITE_NAME=branch1.banking.local
      - ADMIN_PASSWORD=admin
      - DB_TYPE=postgres
    volumes:
      - ./data/erpnext:/home/frappe/frappe-bench/sites
    ports:
      - "8001:8000"
      - "9001:9000"
    depends_on:
      - postgres-branch1
    networks:
      - banking-prototype-network

networks:
  banking-prototype-network:
    external: true
EOF
```

#### Branch 2 ERPNext Docker Compose

Create a Docker Compose file for Branch 2 ERPNext instance:

```bash
cat > branch2/docker-compose-erpnext.yml << 'EOF'
version: '3.8'

services:
  erpnext-branch2:
    build:
      context: ../config/erpnext
      dockerfile: Dockerfile
    container_name: erpnext-branch2
    restart: unless-stopped
    environment:
      - POSTGRES_HOST=postgres-branch2
      - POSTGRES_PORT=5432
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres_branch2_password
      - SITE_NAME=branch2.banking.local
      - ADMIN_PASSWORD=admin
      - DB_TYPE=postgres
    volumes:
      - ./data/erpnext:/home/frappe/frappe-bench/sites
    ports:
      - "8002:8000"
      - "9002:9000"
    depends_on:
      - postgres-branch2
    networks:
      - banking-prototype-network

networks:
  banking-prototype-network:
    external: true
EOF
```

### 4. Create Custom Banking App for ERPNext

Create a custom banking app for ERPNext:

```bash
mkdir -p shared/banking_app
cat > shared/banking_app/setup.py << 'EOF'
from setuptools import setup, find_packages

setup(
    name="banking_app",
    version="0.0.1",
    description="Custom Banking App for ERPNext",
    author="Banking Team",
    author_email="banking@example.com",
    packages=find_packages(),
    zip_safe=False,
    include_package_data=True,
    install_requires=["frappe"],
)
EOF
```

Create the app structure:

```bash
mkdir -p shared/banking_app/banking_app
cat > shared/banking_app/banking_app/__init__.py << 'EOF'
__version__ = '0.0.1'
EOF

cat > shared/banking_app/banking_app/hooks.py << 'EOF'
app_name = "banking_app"
app_title = "Banking App"
app_publisher = "Banking Team"
app_description = "Custom Banking App for ERPNext"
app_icon = "octicon octicon-file-directory"
app_color = "grey"
app_email = "banking@example.com"
app_license = "MIT"

# Document Events
doc_events = {
    "Teller Invoice": {
        "after_insert": "banking_app.banking_app.docevents.teller_invoice.after_insert",
        "on_update": "banking_app.banking_app.docevents.teller_invoice.on_update",
        "on_trash": "banking_app.banking_app.docevents.teller_invoice.on_trash",
    },
    "Currency Exchange": {
        "after_insert": "banking_app.banking_app.docevents.currency_exchange.after_insert",
        "on_update": "banking_app.banking_app.docevents.currency_exchange.on_update",
        "on_trash": "banking_app.banking_app.docevents.currency_exchange.on_trash",
    },
}
EOF

mkdir -p shared/banking_app/banking_app/banking_app/docevents
cat > shared/banking_app/banking_app/banking_app/docevents/__init__.py << 'EOF'
# Document Events
EOF

mkdir -p shared/banking_app/banking_app/banking_app/docevents/teller_invoice
cat > shared/banking_app/banking_app/banking_app/docevents/teller_invoice/__init__.py << 'EOF'
import frappe
import json
import requests

def after_insert(doc, method):
    """Handle after insert event for Teller Invoice"""
    update_sync_status(doc, "INSERT")

def on_update(doc, method):
    """Handle on update event for Teller Invoice"""
    update_sync_status(doc, "UPDATE")

def on_trash(doc, method):
    """Handle on trash event for Teller Invoice"""
    update_sync_status(doc, "DELETE")

def update_sync_status(doc, operation):
    """Update sync status for the document"""
    # Get branch code from site configuration
    branch_code = frappe.local.conf.get("branch_code", "HQ")
    
    # Prepare data for sync service
    data = {
        "table_name": "teller_invoice",
        "record_id": doc.name,
        "operation": operation,
        "data": doc.as_dict(),
        "branch_code": branch_code
    }
    
    # Call sync service API
    try:
        sync_url = frappe.local.conf.get("sync_service_url", "http://localhost:3000/sync")
        requests.post(sync_url, json=data, timeout=5)
    except Exception as e:
        frappe.log_error(f"Sync error for Teller Invoice {doc.name}: {str(e)}", "Sync Error")
EOF

mkdir -p shared/banking_app/banking_app/banking_app/docevents/currency_exchange
cat > shared/banking_app/banking_app/banking_app/docevents/currency_exchange/__init__.py << 'EOF'
import frappe
import json
import requests

def after_insert(doc, method):
    """Handle after insert event for Currency Exchange"""
    update_sync_status(doc, "INSERT")

def on_update(doc, method):
    """Handle on update event for Currency Exchange"""
    update_sync_status(doc, "UPDATE")

def on_trash(doc, method):
    """Handle on trash event for Currency Exchange"""
    update_sync_status(doc, "DELETE")

def update_sync_status(doc, operation):
    """Update sync status for the document"""
    # Get branch code from site configuration
    branch_code = frappe.local.conf.get("branch_code", "HQ")
    
    # Prepare data for sync service
    data = {
        "table_name": "currency_exchange",
        "record_id": doc.name,
        "operation": operation,
        "data": doc.as_dict(),
        "branch_code": branch_code
    }
    
    # Call sync service API
    try:
        sync_url = frappe.local.conf.get("sync_service_url", "http://localhost:3000/sync")
        requests.post(sync_url, json=data, timeout=5)
    except Exception as e:
        frappe.log_error(f"Sync error for Currency Exchange {doc.name}: {str(e)}", "Sync Error")
EOF
```

### 4. Using the Teller App

Instead of creating a custom banking app, we'll use the existing Teller app for our multi-branch banking system:

```bash
# The Teller app should be located in your project directory
# If you don't have it already, you can clone it from your repository
# Example: git clone https://github.com/yourusername/teller.git shared/teller
```

The Teller app includes all the necessary doctypes for our multi-branch banking system, including:
- Teller Invoice
- Booking Interbank
- Branch Interbank Request
- Update Currency Exchange
- And other required doctypes

### 5. Start ERPNext Containers

Start the ERPNext containers for HQ and branches:

```bash
# Build and start HQ ERPNext
cd banking-prototype/hq
docker-compose -f docker-compose-erpnext.yml up -d

# Build and start Branch 1 ERPNext
cd ../branch1
docker-compose -f docker-compose-erpnext.yml up -d

# Build and start Branch 2 ERPNext
cd ../branch2
docker-compose -f docker-compose-erpnext.yml up -d

# Return to the main directory
cd ..
```

### 6. Initialize ERPNext Sites

Initialize the ERPNext sites for HQ and branches:

```bash
# Initialize HQ ERPNext site
docker exec -it erpnext-hq bench new-site hq.banking.local \
  --db-type postgres \
  --db-host postgres-hq \
  --db-port 5432 \
  --db-name erpnext_hq_site \
  --db-user postgres \
  --db-password postgres_hq_password \
  --admin-password admin

# Initialize Branch 1 ERPNext site
docker exec -it erpnext-branch1 bench new-site branch1.banking.local \
  --db-type postgres \
  --db-host postgres-branch1 \
  --db-port 5432 \
  --db-name erpnext_branch1_site \
  --db-user postgres \
  --db-password postgres_branch1_password \
  --admin-password admin

# Initialize Branch 2 ERPNext site
docker exec -it erpnext-branch2 bench new-site branch2.banking.local \
  --db-type postgres \
  --db-host postgres-branch2 \
  --db-port 5432 \
  --db-name erpnext_branch2_site \
  --db-user postgres \
  --db-password postgres_branch2_password \
  --admin-password admin
```

### 7. Install ERPNext App

Install the ERPNext app on all sites:

```bash
# Install ERPNext on HQ site
docker exec -it erpnext-hq bench --site hq.banking.local install-app erpnext

# Install ERPNext on Branch 1 site
docker exec -it erpnext-branch1 bench --site branch1.banking.local install-app erpnext

# Install ERPNext on Branch 2 site
docker exec -it erpnext-branch2 bench --site branch2.banking.local install-app erpnext
```

### 8. Install Teller App

Install the Teller app on all sites:

```bash
# Copy Teller app to HQ container
docker cp shared/teller erpnext-hq:/home/frappe/frappe-bench/apps/

# Install Teller app on HQ
docker exec -it erpnext-hq bash -c "cd /home/frappe/frappe-bench/apps/teller && pip install -e ."
docker exec -it erpnext-hq bench --site hq.banking.local install-app teller

# Copy Teller app to Branch 1 container
docker cp shared/teller erpnext-branch1:/home/frappe/frappe-bench/apps/

# Install Teller app on Branch 1
docker exec -it erpnext-branch1 bash -c "cd /home/frappe/frappe-bench/apps/teller && pip install -e ."
docker exec -it erpnext-branch1 bench --site branch1.banking.local install-app teller

# Copy Teller app to Branch 2 container
docker cp shared/teller erpnext-branch2:/home/frappe/frappe-bench/apps/

# Install Teller app on Branch 2
docker exec -it erpnext-branch2 bash -c "cd /home/frappe/frappe-bench/apps/teller && pip install -e ."
docker exec -it erpnext-branch2 bench --site branch2.banking.local install-app teller
```

### 9. Currency Exchange Integration

The Teller app includes a specific doctype called `Update Currency Exchange` that is crucial for synchronizing currency exchange rates between branches and headquarters. This functionality ensures that all branches have the most up-to-date exchange rates.

#### How Currency Exchange Works

1. **Update at HQ**: Currency exchange rates are typically updated at the headquarters first.
2. **Synchronization**: The updated rates are then synchronized to all branches through the PostgreSQL logical replication we configured in Part 2.
3. **Local Access**: Each branch will have access to the same currency exchange rates, ensuring consistency across the banking system.

#### Important Update Currency Exchange Features

- **Real-time Updates**: When exchange rates are updated at HQ, they are immediately available to all branches.
- **Historical Tracking**: The system keeps track of exchange rate changes over time.
- **Automatic Synchronization**: No manual intervention is required to update rates across branches.

To ensure this functionality works properly, we've included the `update_currency_exchange` table in our replication setup in Part 2:

```sql
CREATE PUBLICATION branch_to_hq_pub FOR TABLE 
    currency_exchange, 
    update_currency_exchange;
```

And we've made sure the branches subscribe to this publication:

```sql
CREATE SUBSCRIPTION hq_to_branch1_sub 
CONNECTION 'host=postgres-hq port=5432 user=postgres password=postgres_hq_password dbname=erpnext_hq' 
PUBLICATION branch_to_hq_pub;
```

This ensures that all currency exchange updates made at HQ will propagate to all branches.

## Next Steps

After setting up ERPNext with PostgreSQL, proceed to [Part 5: Testing and Monitoring](setup_guide_part5_testing.md) to test the multi-branch banking system and set up monitoring.

## Linking Branches Across Different Machines

This section explains how to set up the multi-branch banking system across different physical machines or networks.

### 1. Network Configuration Options

There are two main approaches to linking branches:

#### Option 1: Local Network Setup

For branches on the same local network (e.g., different PCs in the same office):

1. **Network Requirements**:
   - All machines must be on the same network
   - Each machine needs a static IP address
   - Required ports must be open on each machine:
     - PostgreSQL: 5432
     - ERPNext: 8000, 9000
     - RabbitMQ: 5672, 15672
     - Sync Service: 3000

2. **Machine Configuration**:
   ```bash
   # On each machine, edit /etc/hosts to add branch entries
   sudo nano /etc/hosts
   
   # Add entries for all branches
   192.168.1.100 hq.banking.local
   192.168.1.101 branch1.banking.local
   192.168.1.102 branch2.banking.local
   ```

3. **Docker Network Configuration**:
   ```bash
   # On HQ machine
   docker network create banking-prototype-network
   
   # On Branch 1 machine
   docker network create banking-prototype-network
   
   # On Branch 2 machine
   docker network create banking-prototype-network
   ```

4. **Update Docker Compose Files**:
   Modify the database connection strings in each branch's docker-compose files to use the actual IP addresses:

   ```yaml
   # Branch 1 docker-compose.yml
   services:
     postgres-branch1:
       environment:
         POSTGRES_HOST_AUTH_METHOD: trust  # For testing only
         POSTGRES_PASSWORD: postgres_branch1_password
       ports:
         - "5433:5432"  # Different port for each branch
   
   # Branch 2 docker-compose.yml
   services:
     postgres-branch2:
       environment:
         POSTGRES_HOST_AUTH_METHOD: trust  # For testing only
         POSTGRES_PASSWORD: postgres_branch2_password
       ports:
         - "5434:5432"  # Different port for each branch
   ```

#### Option 2: Public Network Setup (with Static IPs)

For branches across different locations with public IPs:

1. **Network Requirements**:
   - Each location needs a static public IP
   - Firewall rules to allow required ports
   - SSL/TLS certificates for secure communication

2. **Firewall Configuration**:
   ```bash
   # On each machine, configure firewall rules
   sudo ufw allow 5432/tcp  # PostgreSQL
   sudo ufw allow 8000/tcp  # ERPNext
   sudo ufw allow 9000/tcp  # ERPNext
   sudo ufw allow 5672/tcp  # RabbitMQ
   sudo ufw allow 15672/tcp # RabbitMQ Management
   sudo ufw allow 3000/tcp  # Sync Service
   ```

3. **SSL/TLS Setup**:
   ```bash
   # Generate SSL certificates for each branch
   mkdir -p ssl
   openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
     -keyout ssl/private.key -out ssl/certificate.crt
   ```

4. **Update Docker Compose Files for SSL**:
   ```yaml
   # HQ docker-compose.yml
   services:
     postgres-hq:
       environment:
         POSTGRES_SSL: on
         POSTGRES_SSL_CERT_FILE: /etc/ssl/certs/certificate.crt
         POSTGRES_SSL_KEY_FILE: /etc/ssl/private/private.key
       volumes:
         - ./ssl:/etc/ssl/certs
   
   # Branch docker-compose.yml
   services:
     postgres-branch:
       environment:
         POSTGRES_SSL: on
         POSTGRES_SSL_CERT_FILE: /etc/ssl/certs/certificate.crt
         POSTGRES_SSL_KEY_FILE: /etc/ssl/private/private.key
       volumes:
         - ./ssl:/etc/ssl/certs
   ```

### 2. Cross-Network Communication Setup

1. **Update Database Connection Strings**:
   ```bash
   # On Branch 1
   docker exec -it erpnext-branch1 bench --site branch1.banking.local set-config db_host "hq-public-ip"
   docker exec -it erpnext-branch1 bench --site branch1.banking.local set-config db_port "5432"
   
   # On Branch 2
   docker exec -it erpnext-branch2 bench --site branch2.banking.local set-config db_host "hq-public-ip"
   docker exec -it erpnext-branch2 bench --site branch2.banking.local set-config db_port "5432"
   ```

2. **Configure RabbitMQ for Remote Connections**:
   ```bash
   # On HQ RabbitMQ
   docker exec rabbitmq-hq rabbitmqctl set_user_permissions admin ".*" ".*" ".*"
   docker exec rabbitmq-hq rabbitmqctl set_permissions -p / admin ".*" ".*" ".*"
   
   # Update RabbitMQ connection strings in sync service
   # Branch 1 sync service
   docker exec sync-service-branch1 set-config RABBITMQ_HOST "hq-public-ip"
   
   # Branch 2 sync service
   docker exec sync-service-branch2 set-config RABBITMQ_HOST "hq-public-ip"
   ```

### 3. Testing Cross-Network Connectivity

1. **Test Database Connectivity**:
   ```bash
   # From Branch 1
   docker exec -it postgres-branch1 psql -h hq-public-ip -U postgres -d erpnext_hq -c "SELECT 1;"
   
   # From Branch 2
   docker exec -it postgres-branch2 psql -h hq-public-ip -U postgres -d erpnext_hq -c "SELECT 1;"
   ```

2. **Test RabbitMQ Connectivity**:
   ```bash
   # From Branch 1
   docker exec -it rabbitmq-branch1 rabbitmqctl -n rabbit@rabbitmq-branch1 ping
   
   # From Branch 2
   docker exec -it rabbitmq-branch2 rabbitmqctl -n rabbit@rabbitmq-branch2 ping
   ```

3. **Test Sync Service**:
   ```bash
   # From Branch 1
   curl http://branch1-public-ip:3001/health
   
   # From Branch 2
   curl http://branch2-public-ip:3002/health
   ```

### 4. Security Considerations

1. **Use VPN for Private Network**:
   ```bash
   # Set up OpenVPN server on HQ
   docker run -d --name openvpn \
     -p 1194:1194/udp \
     -v /etc/openvpn:/etc/openvpn \
     kylemanna/openvpn
   
   # Generate client certificates for each branch
   docker exec -it openvpn ovpn_getclient branch1 > branch1.ovpn
   docker exec -it openvpn ovpn_getclient branch2 > branch2.ovpn
   ```

2. **Encrypt Sensitive Data**:
   ```bash
   # Generate encryption keys
   openssl genrsa -out private.pem 2048
   openssl rsa -in private.pem -pubout -out public.pem
   
   # Update sync service configuration
   docker exec sync-service-hq set-config ENCRYPTION_KEY_FILE "/etc/ssl/private/private.pem"
   ```

3. **Regular Security Audits**:
   ```bash
   # Check for open ports
   nmap -sS hq-public-ip
   
   # Check SSL certificate validity
   openssl s_client -connect hq-public-ip:5432 -starttls postgres
   ```

### 5. Monitoring Cross-Network Health

1. **Network Latency Monitoring**:
   ```bash
   # Add to monitoring configuration
   cat > monitoring/prometheus/prometheus.yml << 'EOF'
   scrape_configs:
     - job_name: 'network-latency'
       static_configs:
         - targets: ['hq-public-ip:9100', 'branch1-public-ip:9100', 'branch2-public-ip:9100']
   EOF
   ```

2. **Connection Status Dashboard**:
   ```bash
   # Create Grafana dashboard for network monitoring
   cat > monitoring/grafana/dashboards/network-health.json << 'EOF'
   {
     "dashboard": {
       "title": "Network Health",
       "panels": [
         {
           "title": "Database Latency",
           "type": "graph",
           "targets": [
             {
               "expr": "rate(pg_stat_activity_max_tx_duration{datname=~\"erpnext.*\"}[5m])"
             }
           ]
         },
         {
           "title": "RabbitMQ Connections",
           "type": "graph",
           "targets": [
             {
               "expr": "rabbitmq_connections"
             }
           ]
         }
       ]
     }
   }
   EOF
   ```

Remember to replace placeholder IPs and hostnames with your actual network configuration values. Also, ensure that all security measures are properly implemented before exposing services to the public network. 