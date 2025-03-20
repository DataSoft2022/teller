#!/bin/bash

# Setup script for Multi-Branch Banking System Prototype
# This script creates the directory structure and files needed for the prototype

echo "Setting up Multi-Branch Banking System Prototype..."

# Create base directory
mkdir -p banking-prototype/{hq,branch1,branch2,shared}
cd banking-prototype

# Create shared sync service directory
mkdir -p shared/sync-service

# Create Dockerfile for sync service
cat > shared/sync-service/Dockerfile << 'EOF'
FROM node:16-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

CMD ["npm", "start"]
EOF

# Create package.json for sync service
cat > shared/sync-service/package.json << 'EOF'
{
  "name": "sync-service",
  "version": "1.0.0",
  "description": "Synchronization service for multi-branch banking system",
  "main": "index.js",
  "scripts": {
    "start": "node index.js"
  },
  "dependencies": {
    "amqplib": "^0.8.0",
    "pg": "^8.7.3",
    "express": "^4.18.1",
    "node-cron": "^3.0.0",
    "uuid": "^8.3.2"
  }
}
EOF

# Create index.js for sync service (shortened version - full version in documentation)
cat > shared/sync-service/index.js << 'EOF'
const amqp = require('amqplib');
const { Client } = require('pg');
const cron = require('node-cron');
const express = require('express');
const { v4: uuidv4 } = require('uuid');

// Configuration from environment variables
const config = {
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'erpnext',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres'
  },
  rabbitmq: {
    host: process.env.RABBITMQ_HOST || 'localhost',
    port: process.env.RABBITMQ_PORT || 5672,
    user: process.env.RABBITMQ_USER || 'guest',
    pass: process.env.RABBITMQ_PASS || 'guest'
  },
  location: process.env.LOCATION || 'UNKNOWN'
};

// Create Express app for health checks and monitoring
const app = express();
const port = 3000;

// Database client
const dbClient = new Client(config.db);

// Main function
async function main() {
  try {
    // Connect to database
    await dbClient.connect();
    console.log('Connected to database');
    
    // Set up API endpoints
    app.get('/health', (req, res) => {
      res.status(200).json({ status: 'UP', location: config.location });
    });
    
    // Start server
    app.listen(port, () => {
      console.log(`Sync service listening at http://localhost:${port}`);
    });
    
    console.log(`Sync service started for location: ${config.location}`);
    
  } catch (err) {
    console.error('Error in main function:', err);
    process.exit(1);
  }
}

// Start the application
main();
EOF

# Create init-scripts directories
mkdir -p hq/init-scripts
mkdir -p branch1/init-scripts
mkdir -p branch2/init-scripts

# Create init tables SQL for HQ
cat > hq/init-scripts/01-init-tables.sql << 'EOF'
-- Create tables for banking system

-- Teller Invoice
CREATE TABLE IF NOT EXISTS teller_invoice (
    id SERIAL PRIMARY KEY,
    invoice_no VARCHAR(50) UNIQUE NOT NULL,
    branch_id VARCHAR(20) NOT NULL,
    customer_id VARCHAR(50),
    transaction_date TIMESTAMP NOT NULL,
    total_amount DECIMAL(15,2) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    status VARCHAR(20) NOT NULL,
    created_by VARCHAR(50) NOT NULL,
    created_at TIMESTAMP NOT NULL,
    modified_at TIMESTAMP,
    sync_status VARCHAR(20) DEFAULT 'pending',
    global_transaction_id UUID NOT NULL
);

-- Currency Exchange
CREATE TABLE IF NOT EXISTS currency_exchange (
    id SERIAL PRIMARY KEY,
    transaction_no VARCHAR(50) UNIQUE NOT NULL,
    branch_id VARCHAR(20) NOT NULL,
    customer_id VARCHAR(50),
    from_currency VARCHAR(3) NOT NULL,
    to_currency VARCHAR(3) NOT NULL,
    exchange_rate DECIMAL(15,6) NOT NULL,
    from_amount DECIMAL(15,2) NOT NULL,
    to_amount DECIMAL(15,2) NOT NULL,
    transaction_date TIMESTAMP NOT NULL,
    teller_id VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL,
    global_transaction_id UUID NOT NULL,
    sync_status VARCHAR(20) DEFAULT 'pending'
);

-- Teller Treasury
CREATE TABLE IF NOT EXISTS teller_treasury (
    id SERIAL PRIMARY KEY,
    branch_id VARCHAR(20) NOT NULL,
    teller_id VARCHAR(50) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    opening_balance DECIMAL(15,2) NOT NULL,
    closing_balance DECIMAL(15,2),
    shift_date DATE NOT NULL,
    shift_status VARCHAR(20) NOT NULL,
    created_at TIMESTAMP NOT NULL,
    closed_at TIMESTAMP,
    sync_status VARCHAR(20) DEFAULT 'pending'
);

-- Exchange Rates
CREATE TABLE IF NOT EXISTS exchange_rates (
    id SERIAL PRIMARY KEY,
    from_currency VARCHAR(3) NOT NULL,
    to_currency VARCHAR(3) NOT NULL,
    rate DECIMAL(15,6) NOT NULL,
    effective_date DATE NOT NULL,
    expiry_date DATE,
    is_active BOOLEAN DEFAULT TRUE,
    created_by VARCHAR(50) NOT NULL,
    created_at TIMESTAMP NOT NULL,
    modified_at TIMESTAMP,
    UNIQUE (from_currency, to_currency, effective_date)
);

-- Branch Registry
CREATE TABLE IF NOT EXISTS branch_registry (
    id VARCHAR(20) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    address TEXT,
    region VARCHAR(50),
    contact_number VARCHAR(20),
    manager_id VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL,
    last_sync_at TIMESTAMP
);

-- Insert sample branch data
INSERT INTO branch_registry (id, name, address, region, is_active, created_at)
VALUES 
  ('HQ', 'Headquarters', 'Main Street 123, Capital City', 'Central', true, NOW()),
  ('BR001', 'Branch 1', 'North Avenue 45, Northern City', 'North', true, NOW()),
  ('BR002', 'Branch 2', 'South Boulevard 67, Southern City', 'South', true, NOW());
EOF

# Create replication setup SQL for HQ
cat > hq/init-scripts/02-setup-replication.sql << 'EOF'
-- Create publications for tables that need to be replicated
CREATE PUBLICATION hq_to_branch_pub FOR TABLE exchange_rates;

-- Create a replication slot for each branch
SELECT pg_create_logical_replication_slot('branch1_slot', 'pgoutput');
SELECT pg_create_logical_replication_slot('branch2_slot', 'pgoutput');
EOF

# Copy init tables SQL to branches
cp hq/init-scripts/01-init-tables.sql branch1/init-scripts/
cp hq/init-scripts/01-init-tables.sql branch2/init-scripts/

# Create replication setup SQL for branches
cat > branch1/init-scripts/02-setup-replication.sql << 'EOF'
-- Create publications for tables that need to be replicated to HQ
CREATE PUBLICATION branch_to_hq_pub FOR TABLE teller_invoice, currency_exchange, teller_treasury;

-- Create a subscription to HQ
CREATE SUBSCRIPTION branch_from_hq_sub
  CONNECTION 'host=postgres-hq port=5432 user=postgres password=postgres dbname=erpnext_hq'
  PUBLICATION hq_to_branch_pub;
EOF

# Copy branch1 replication setup to branch2 with modifications
cat > branch2/init-scripts/02-setup-replication.sql << 'EOF'
-- Create publications for tables that need to be replicated to HQ
CREATE PUBLICATION branch_to_hq_pub FOR TABLE teller_invoice, currency_exchange, teller_treasury;

-- Create a subscription to HQ
CREATE SUBSCRIPTION branch_from_hq_sub
  CONNECTION 'host=postgres-hq port=5432 user=postgres password=postgres dbname=erpnext_hq'
  PUBLICATION hq_to_branch_pub;
EOF

# Create docker-compose.yml for HQ
cat > hq/docker-compose.yml << 'EOF'
version: '3.8'

services:
  # ERPNext instance for HQ
  erpnext-hq:
    image: frappe/erpnext:v14
    container_name: erpnext-hq
    restart: unless-stopped
    ports:
      - "8000:8000"
    environment:
      - ADMIN_PASSWORD=admin
      - DB_HOST=postgres-hq
      - DB_PORT=5432
      - DB_NAME=erpnext_hq
      - DB_PASSWORD=postgres
      - DB_ROOT_PASSWORD=postgres
    volumes:
      - erpnext-hq-sites:/home/frappe/frappe-bench/sites
    depends_on:
      - postgres-hq
    networks:
      - hq-network

  # PostgreSQL for HQ (primary)
  postgres-hq:
    image: postgres:14
    container_name: postgres-hq
    restart: unless-stopped
    ports:
      - "5432:5432"
    environment:
      - POSTGRES_PASSWORD=postgres
      - POSTGRES_USER=postgres
      - POSTGRES_DB=erpnext_hq
    volumes:
      - postgres-hq-data:/var/lib/postgresql/data
      - ./init-scripts:/docker-entrypoint-initdb.d
    command: 
      - "postgres"
      - "-c"
      - "wal_level=logical"
      - "-c"
      - "max_wal_senders=10"
      - "-c"
      - "max_replication_slots=10"
    networks:
      - hq-network
      - replication-network

  # RabbitMQ for message queuing
  rabbitmq:
    image: rabbitmq:3-management
    container_name: rabbitmq
    restart: unless-stopped
    ports:
      - "5672:5672"
      - "15672:15672"
    environment:
      - RABBITMQ_DEFAULT_USER=admin
      - RABBITMQ_DEFAULT_PASS=admin
    volumes:
      - rabbitmq-data:/var/lib/rabbitmq
    networks:
      - hq-network
      - replication-network

  # Sync service for HQ
  sync-service-hq:
    build:
      context: ../shared/sync-service
      dockerfile: Dockerfile
    container_name: sync-service-hq
    restart: unless-stopped
    environment:
      - DB_HOST=postgres-hq
      - DB_PORT=5432
      - DB_NAME=erpnext_hq
      - DB_USER=postgres
      - DB_PASSWORD=postgres
      - RABBITMQ_HOST=rabbitmq
      - RABBITMQ_PORT=5672
      - RABBITMQ_USER=admin
      - RABBITMQ_PASS=admin
      - NODE_ENV=development
      - LOCATION=HQ
    volumes:
      - ../shared/sync-service:/app
    depends_on:
      - postgres-hq
      - rabbitmq
    networks:
      - hq-network
      - replication-network

volumes:
  erpnext-hq-sites:
  postgres-hq-data:
  rabbitmq-data:

networks:
  hq-network:
    driver: bridge
  replication-network:
    driver: bridge
EOF

# Create docker-compose.yml for branch1
cat > branch1/docker-compose.yml << 'EOF'
version: '3.8'

services:
  # ERPNext instance for Branch
  erpnext-branch:
    image: frappe/erpnext:v14
    container_name: erpnext-branch1
    restart: unless-stopped
    ports:
      - "8001:8000"
    environment:
      - ADMIN_PASSWORD=admin
      - DB_HOST=postgres-branch
      - DB_PORT=5432
      - DB_NAME=erpnext_branch1
      - DB_PASSWORD=postgres
      - DB_ROOT_PASSWORD=postgres
    volumes:
      - erpnext-branch-sites:/home/frappe/frappe-bench/sites
    depends_on:
      - postgres-branch
    networks:
      - branch-network

  # PostgreSQL for Branch (replica)
  postgres-branch:
    image: postgres:14
    container_name: postgres-branch1
    restart: unless-stopped
    ports:
      - "5433:5432"
    environment:
      - POSTGRES_PASSWORD=postgres
      - POSTGRES_USER=postgres
      - POSTGRES_DB=erpnext_branch1
    volumes:
      - postgres-branch-data:/var/lib/postgresql/data
      - ./init-scripts:/docker-entrypoint-initdb.d
    command: 
      - "postgres"
      - "-c"
      - "wal_level=logical"
      - "-c"
      - "max_wal_senders=10"
      - "-c"
      - "max_replication_slots=10"
    networks:
      - branch-network
      - replication-network

  # Sync service for Branch
  sync-service-branch:
    build:
      context: ../shared/sync-service
      dockerfile: Dockerfile
    container_name: sync-service-branch1
    restart: unless-stopped
    environment:
      - DB_HOST=postgres-branch
      - DB_PORT=5432
      - DB_NAME=erpnext_branch1
      - DB_USER=postgres
      - DB_PASSWORD=postgres
      - RABBITMQ_HOST=rabbitmq
      - RABBITMQ_PORT=5672
      - RABBITMQ_USER=admin
      - RABBITMQ_PASS=admin
      - NODE_ENV=development
      - LOCATION=BRANCH1
    volumes:
      - ../shared/sync-service:/app
    depends_on:
      - postgres-branch
    networks:
      - branch-network
      - replication-network

volumes:
  erpnext-branch-sites:
  postgres-branch-data:

networks:
  branch-network:
    driver: bridge
  replication-network:
    external: true
EOF

# Create docker-compose.yml for branch2 (with different ports)
cat > branch2/docker-compose.yml << 'EOF'
version: '3.8'

services:
  # ERPNext instance for Branch
  erpnext-branch:
    image: frappe/erpnext:v14
    container_name: erpnext-branch2
    restart: unless-stopped
    ports:
      - "8002:8000"
    environment:
      - ADMIN_PASSWORD=admin
      - DB_HOST=postgres-branch
      - DB_PORT=5432
      - DB_NAME=erpnext_branch2
      - DB_PASSWORD=postgres
      - DB_ROOT_PASSWORD=postgres
    volumes:
      - erpnext-branch-sites:/home/frappe/frappe-bench/sites
    depends_on:
      - postgres-branch
    networks:
      - branch-network

  # PostgreSQL for Branch (replica)
  postgres-branch:
    image: postgres:14
    container_name: postgres-branch2
    restart: unless-stopped
    ports:
      - "5434:5432"
    environment:
      - POSTGRES_PASSWORD=postgres
      - POSTGRES_USER=postgres
      - POSTGRES_DB=erpnext_branch2
    volumes:
      - postgres-branch-data:/var/lib/postgresql/data
      - ./init-scripts:/docker-entrypoint-initdb.d
    command: 
      - "postgres"
      - "-c"
      - "wal_level=logical"
      - "-c"
      - "max_wal_senders=10"
      - "-c"
      - "max_replication_slots=10"
    networks:
      - branch-network
      - replication-network

  # Sync service for Branch
  sync-service-branch:
    build:
      context: ../shared/sync-service
      dockerfile: Dockerfile
    container_name: sync-service-branch2
    restart: unless-stopped
    environment:
      - DB_HOST=postgres-branch
      - DB_PORT=5432
      - DB_NAME=erpnext_branch2
      - DB_USER=postgres
      - DB_PASSWORD=postgres
      - RABBITMQ_HOST=rabbitmq
      - RABBITMQ_PORT=5672
      - RABBITMQ_USER=admin
      - RABBITMQ_PASS=admin
      - NODE_ENV=development
      - LOCATION=BRANCH2
    volumes:
      - ../shared/sync-service:/app
    depends_on:
      - postgres-branch
    networks:
      - branch-network
      - replication-network

volumes:
  erpnext-branch-sites:
  postgres-branch-data:

networks:
  branch-network:
    driver: bridge
  replication-network:
    external: true
EOF

# Create shared app directory (use Teller app instead of banking_app)
echo "Note: Use your existing Teller app instead of creating a new banking app"
echo "If you don't have the Teller app, clone it from your repository"
echo "Example: git clone https://github.com/yourusername/teller.git shared/teller"

# Install Teller app on ERPNext instances
echo "Installing Teller app on ERPNext instances..."
echo "# Copy Teller app to HQ container"
echo "docker cp shared/teller erpnext-hq:/home/frappe/frappe-bench/apps/"
echo "# Install Teller app on HQ"
echo "docker exec -it erpnext-hq bash -c \"cd /home/frappe/frappe-bench/apps/teller && pip install -e .\""
echo "docker exec -it erpnext-hq bench --site hq.banking.local install-app teller"
echo ""
echo "# Copy Teller app to Branch 1 container"
echo "docker cp shared/teller erpnext-branch1:/home/frappe/frappe-bench/apps/"
echo "# Install Teller app on Branch 1"
echo "docker exec -it erpnext-branch1 bash -c \"cd /home/frappe/frappe-bench/apps/teller && pip install -e .\""
echo "docker exec -it erpnext-branch1 bench --site branch1.banking.local install-app teller"
echo ""
echo "# Copy Teller app to Branch 2 container"
echo "docker cp shared/teller erpnext-branch2:/home/frappe/frappe-bench/apps/"
echo "# Install Teller app on Branch 2"
echo "docker exec -it erpnext-branch2 bash -c \"cd /home/frappe/frappe-bench/apps/teller && pip install -e .\""
echo "docker exec -it erpnext-branch2 bench --site branch2.banking.local install-app teller"

# Create startup script
cat > start-prototype.sh << 'EOF'
#!/bin/bash

echo "Starting Multi-Branch Banking System Prototype..."

# Create the replication network first
docker network create replication-network

# Start HQ services
echo "Starting HQ services..."
cd hq
docker-compose up -d
cd ..

# Wait for HQ to be ready
echo "Waiting for HQ services to be ready..."
sleep 30

# Start Branch 1 services
echo "Starting Branch 1 services..."
cd branch1
docker-compose up -d
cd ..

# Start Branch 2 services
echo "Starting Branch 2 services..."
cd branch2
docker-compose up -d
cd ..

echo "All services started!"
echo ""
echo "Access the services at:"
echo "- ERPNext HQ: http://localhost:8000"
echo "- ERPNext Branch 1: http://localhost:8001"
echo "- ERPNext Branch 2: http://localhost:8002"
echo "- RabbitMQ Management: http://localhost:15672 (username: admin, password: admin)"
EOF

# Make startup script executable
chmod +x start-prototype.sh

# Create shutdown script
cat > stop-prototype.sh << 'EOF'
#!/bin/bash

echo "Stopping Multi-Branch Banking System Prototype..."

# Stop Branch 2 services
echo "Stopping Branch 2 services..."
cd branch2
docker-compose down
cd ..

# Stop Branch 1 services
echo "Stopping Branch 1 services..."
cd branch1
docker-compose down
cd ..

# Stop HQ services
echo "Stopping HQ services..."
cd hq
docker-compose down
cd ..

# Remove the replication network
docker network rm replication-network

echo "All services stopped!"
EOF

# Make shutdown script executable
chmod +x stop-prototype.sh

echo "Setup complete! To start the prototype, run:"
echo "cd banking-prototype"
echo "./start-prototype.sh" 