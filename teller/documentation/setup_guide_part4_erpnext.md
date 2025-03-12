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

### 3. Create Docker Compose Files for ERPNext

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

### 8. Install Custom Banking App

Install the custom banking app on all sites:

```bash
# Copy banking app to HQ container
docker cp shared/banking_app erpnext-hq:/home/frappe/frappe-bench/apps/

# Install banking app on HQ
docker exec -it erpnext-hq bash -c "cd /home/frappe/frappe-bench/apps/banking_app && pip install -e ."
docker exec -it erpnext-hq bench --site hq.banking.local install-app banking_app

# Copy banking app to Branch 1 container
docker cp shared/banking_app erpnext-branch1:/home/frappe/frappe-bench/apps/

# Install banking app on Branch 1
docker exec -it erpnext-branch1 bash -c "cd /home/frappe/frappe-bench/apps/banking_app && pip install -e ."
docker exec -it erpnext-branch1 bench --site branch1.banking.local install-app banking_app

# Copy banking app to Branch 2 container
docker cp shared/banking_app erpnext-branch2:/home/frappe/frappe-bench/apps/

# Install banking app on Branch 2
docker exec -it erpnext-branch2 bash -c "cd /home/frappe/frappe-bench/apps/banking_app && pip install -e ."
docker exec -it erpnext-branch2 bench --site branch2.banking.local install-app banking_app
```

## Next Steps

After setting up ERPNext with PostgreSQL, proceed to [Part 5: Testing and Monitoring](setup_guide_part5_testing.md) to test the multi-branch banking system and set up monitoring. 