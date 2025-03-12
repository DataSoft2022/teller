# Comprehensive Setup Guide - Part 5: Testing and Monitoring

## Testing the Multi-Branch Banking System

In this section, we'll test the multi-branch banking system to ensure that data synchronization works correctly between headquarters and branches.

### 1. Create Test Data

Let's create some test data to verify the synchronization:

```bash
# Create a test script for HQ
cat > hq/create_test_data.sql << 'EOF'
-- Insert test data for HQ
INSERT INTO teller_invoice (
    invoice_number, customer_name, amount, currency, branch_code, 
    status, created_by, modified_by
)
VALUES 
('HQ-INV-001', 'John Doe', 1000.00, 'USD', 'HQ', 'completed', 'admin', 'admin'),
('HQ-INV-002', 'Jane Smith', 1500.00, 'EUR', 'HQ', 'pending', 'admin', 'admin');

INSERT INTO currency_exchange (
    from_currency, to_currency, exchange_rate, branch_code, 
    created_by, modified_by
)
VALUES 
('USD', 'EUR', 0.85, 'HQ', 'admin', 'admin'),
('EUR', 'USD', 1.18, 'HQ', 'admin', 'admin');

INSERT INTO teller_treasury (
    treasury_code, currency, opening_balance, current_balance, 
    branch_code, status, created_by, modified_by
)
VALUES 
('HQ-TREAS-USD', 'USD', 10000.00, 9000.00, 'HQ', 'active', 'admin', 'admin'),
('HQ-TREAS-EUR', 'EUR', 8000.00, 7500.00, 'HQ', 'active', 'admin', 'admin');
EOF

# Create a test script for Branch 1
cat > branch1/create_test_data.sql << 'EOF'
-- Insert test data for Branch 1
INSERT INTO teller_invoice (
    invoice_number, customer_name, amount, currency, branch_code, 
    status, created_by, modified_by
)
VALUES 
('BR1-INV-001', 'Alice Johnson', 800.00, 'USD', 'BR001', 'completed', 'admin', 'admin'),
('BR1-INV-002', 'Bob Williams', 1200.00, 'EUR', 'BR001', 'pending', 'admin', 'admin');

INSERT INTO currency_exchange (
    from_currency, to_currency, exchange_rate, branch_code, 
    created_by, modified_by
)
VALUES 
('USD', 'GBP', 0.75, 'BR001', 'admin', 'admin'),
('GBP', 'USD', 1.33, 'BR001', 'admin', 'admin');

INSERT INTO teller_treasury (
    treasury_code, currency, opening_balance, current_balance, 
    branch_code, status, created_by, modified_by
)
VALUES 
('BR1-TREAS-USD', 'USD', 5000.00, 4200.00, 'BR001', 'active', 'admin', 'admin'),
('BR1-TREAS-EUR', 'EUR', 4000.00, 3800.00, 'BR001', 'active', 'admin', 'admin');
EOF

# Create a test script for Branch 2
cat > branch2/create_test_data.sql << 'EOF'
-- Insert test data for Branch 2
INSERT INTO teller_invoice (
    invoice_number, customer_name, amount, currency, branch_code, 
    status, created_by, modified_by
)
VALUES 
('BR2-INV-001', 'Charlie Brown', 600.00, 'USD', 'BR002', 'completed', 'admin', 'admin'),
('BR2-INV-002', 'Diana Prince', 900.00, 'EUR', 'BR002', 'pending', 'admin', 'admin');

INSERT INTO currency_exchange (
    from_currency, to_currency, exchange_rate, branch_code, 
    created_by, modified_by
)
VALUES 
('EUR', 'JPY', 130.25, 'BR002', 'admin', 'admin'),
('JPY', 'EUR', 0.0077, 'BR002', 'admin', 'admin');

INSERT INTO teller_treasury (
    treasury_code, currency, opening_balance, current_balance, 
    branch_code, status, created_by, modified_by
)
VALUES 
('BR2-TREAS-USD', 'USD', 3000.00, 2400.00, 'BR002', 'active', 'admin', 'admin'),
('BR2-TREAS-EUR', 'EUR', 2500.00, 2200.00, 'BR002', 'active', 'admin', 'admin');
EOF
```

### 2. Execute Test Data Scripts

Execute the test data scripts on each database:

```bash
# Execute test data script for HQ
docker exec -i postgres-hq psql -U postgres -d erpnext_hq < hq/create_test_data.sql

# Execute test data script for Branch 1
docker exec -i postgres-branch1 psql -U postgres -d erpnext_branch1 < branch1/create_test_data.sql

# Execute test data script for Branch 2
docker exec -i postgres-branch2 psql -U postgres -d erpnext_branch2 < branch2/create_test_data.sql
```

### 3. Verify Synchronization

Verify that the data has been synchronized correctly:

```bash
# Create a verification script
cat > verify_sync.sh << 'EOF'
#!/bin/bash

echo "Verifying data synchronization..."

echo "HQ Data:"
docker exec -i postgres-hq psql -U postgres -d erpnext_hq -c "SELECT invoice_number, customer_name, branch_code FROM teller_invoice ORDER BY branch_code, invoice_number;"
docker exec -i postgres-hq psql -U postgres -d erpnext_hq -c "SELECT from_currency, to_currency, exchange_rate, branch_code FROM currency_exchange ORDER BY branch_code, from_currency;"
docker exec -i postgres-hq psql -U postgres -d erpnext_hq -c "SELECT treasury_code, currency, current_balance, branch_code FROM teller_treasury ORDER BY branch_code, treasury_code;"

echo "Branch 1 Data:"
docker exec -i postgres-branch1 psql -U postgres -d erpnext_branch1 -c "SELECT invoice_number, customer_name, branch_code FROM teller_invoice WHERE branch_code = 'HQ' ORDER BY invoice_number;"
docker exec -i postgres-branch1 psql -U postgres -d erpnext_branch1 -c "SELECT from_currency, to_currency, exchange_rate, branch_code FROM currency_exchange WHERE branch_code = 'HQ' ORDER BY from_currency;"
docker exec -i postgres-branch1 psql -U postgres -d erpnext_branch1 -c "SELECT treasury_code, currency, current_balance, branch_code FROM teller_treasury WHERE branch_code = 'HQ' ORDER BY treasury_code;"

echo "Branch 2 Data:"
docker exec -i postgres-branch2 psql -U postgres -d erpnext_branch2 -c "SELECT invoice_number, customer_name, branch_code FROM teller_invoice WHERE branch_code = 'HQ' ORDER BY invoice_number;"
docker exec -i postgres-branch2 psql -U postgres -d erpnext_branch2 -c "SELECT from_currency, to_currency, exchange_rate, branch_code FROM currency_exchange WHERE branch_code = 'HQ' ORDER BY from_currency;"
docker exec -i postgres-branch2 psql -U postgres -d erpnext_branch2 -c "SELECT treasury_code, currency, current_balance, branch_code FROM teller_treasury WHERE branch_code = 'HQ' ORDER BY treasury_code;"

echo "Sync Outbox Status:"
docker exec -i postgres-hq psql -U postgres -d erpnext_hq -c "SELECT table_name, operation, status, count(*) FROM sync_outbox GROUP BY table_name, operation, status;"
docker exec -i postgres-branch1 psql -U postgres -d erpnext_branch1 -c "SELECT table_name, operation, status, count(*) FROM sync_outbox GROUP BY table_name, operation, status;"
docker exec -i postgres-branch2 psql -U postgres -d erpnext_branch2 -c "SELECT table_name, operation, status, count(*) FROM sync_outbox GROUP BY table_name, operation, status;"

echo "Sync Status:"
docker exec -i postgres-hq psql -U postgres -d erpnext_hq -c "SELECT source, destination, status, record_count FROM sync_status ORDER BY source, destination;"
docker exec -i postgres-branch1 psql -U postgres -d erpnext_branch1 -c "SELECT source, destination, status, record_count FROM sync_status ORDER BY source, destination;"
docker exec -i postgres-branch2 psql -U postgres -d erpnext_branch2 -c "SELECT source, destination, status, record_count FROM sync_status ORDER BY source, destination;"
EOF

# Make the verification script executable
chmod +x verify_sync.sh

# Run the verification script
./verify_sync.sh
```

### 4. Test Inter-Branch Transaction

Let's test an inter-branch transaction:

```bash
# Create an inter-branch transaction script
cat > inter_branch_transaction.sql << 'EOF'
-- Create a transaction from Branch 1 to Branch 2
BEGIN;

-- Insert a transaction in Branch 1
INSERT INTO teller_invoice (
    invoice_number, customer_name, amount, currency, branch_code, 
    status, created_by, modified_by
)
VALUES 
('BR1-TO-BR2-001', 'Inter-Branch Transfer', 2000.00, 'USD', 'BR001', 'completed', 'admin', 'admin');

-- Update Branch 1 treasury
UPDATE teller_treasury 
SET current_balance = current_balance - 2000.00 
WHERE treasury_code = 'BR1-TREAS-USD' AND branch_code = 'BR001';

-- Insert a transaction in Branch 2
INSERT INTO teller_invoice (
    invoice_number, customer_name, amount, currency, branch_code, 
    status, created_by, modified_by
)
VALUES 
('BR2-FROM-BR1-001', 'Inter-Branch Transfer', 2000.00, 'USD', 'BR002', 'completed', 'admin', 'admin');

-- Update Branch 2 treasury
UPDATE teller_treasury 
SET current_balance = current_balance + 2000.00 
WHERE treasury_code = 'BR2-TREAS-USD' AND branch_code = 'BR002';

COMMIT;
EOF

# Execute the inter-branch transaction script on HQ
docker exec -i postgres-hq psql -U postgres -d erpnext_hq < inter_branch_transaction.sql

# Verify the inter-branch transaction
./verify_sync.sh
```

## Setting Up Monitoring

In this section, we'll set up monitoring for the multi-branch banking system.

### 1. Create Monitoring Docker Compose File

Create a Docker Compose file for monitoring:

```bash
mkdir -p monitoring
cat > monitoring/docker-compose.yml << 'EOF'
version: '3.8'

services:
  prometheus:
    image: prom/prometheus:v2.37.0
    container_name: prometheus
    restart: unless-stopped
    volumes:
      - ./prometheus:/etc/prometheus
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.console.libraries=/etc/prometheus/console_libraries'
      - '--web.console.templates=/etc/prometheus/consoles'
      - '--web.enable-lifecycle'
    ports:
      - "9090:9090"
    networks:
      - banking-prototype-network

  grafana:
    image: grafana/grafana:9.0.0
    container_name: grafana
    restart: unless-stopped
    volumes:
      - ./grafana/provisioning:/etc/grafana/provisioning
      - grafana_data:/var/lib/grafana
    environment:
      - GF_SECURITY_ADMIN_USER=admin
      - GF_SECURITY_ADMIN_PASSWORD=admin
      - GF_USERS_ALLOW_SIGN_UP=false
    ports:
      - "3000:3000"
    networks:
      - banking-prototype-network

  node-exporter:
    image: prom/node-exporter:v1.3.1
    container_name: node-exporter
    restart: unless-stopped
    volumes:
      - /proc:/host/proc:ro
      - /sys:/host/sys:ro
      - /:/rootfs:ro
    command:
      - '--path.procfs=/host/proc'
      - '--path.rootfs=/rootfs'
      - '--path.sysfs=/host/sys'
      - '--collector.filesystem.mount-points-exclude=^/(sys|proc|dev|host|etc)($$|/)'
    ports:
      - "9100:9100"
    networks:
      - banking-prototype-network

  cadvisor:
    image: gcr.io/cadvisor/cadvisor:v0.45.0
    container_name: cadvisor
    restart: unless-stopped
    volumes:
      - /:/rootfs:ro
      - /var/run:/var/run:ro
      - /sys:/sys:ro
      - /var/lib/docker/:/var/lib/docker:ro
      - /dev/disk/:/dev/disk:ro
    ports:
      - "8080:8080"
    networks:
      - banking-prototype-network

volumes:
  prometheus_data:
  grafana_data:

networks:
  banking-prototype-network:
    external: true
EOF
```

### 2. Create Prometheus Configuration

Create a Prometheus configuration file:

```bash
mkdir -p monitoring/prometheus
cat > monitoring/prometheus/prometheus.yml << 'EOF'
global:
  scrape_interval: 15s
  evaluation_interval: 15s

alerting:
  alertmanagers:
    - static_configs:
        - targets:
          # - alertmanager:9093

rule_files:
  # - "first_rules.yml"
  # - "second_rules.yml"

scrape_configs:
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']

  - job_name: 'node-exporter'
    static_configs:
      - targets: ['node-exporter:9100']

  - job_name: 'cadvisor'
    static_configs:
      - targets: ['cadvisor:8080']

  - job_name: 'postgres-hq'
    static_configs:
      - targets: ['postgres-hq:5432']
    metrics_path: /metrics

  - job_name: 'postgres-branch1'
    static_configs:
      - targets: ['postgres-branch1:5432']
    metrics_path: /metrics

  - job_name: 'postgres-branch2'
    static_configs:
      - targets: ['postgres-branch2:5432']
    metrics_path: /metrics

  - job_name: 'sync-service-hq'
    static_configs:
      - targets: ['sync-service-hq:3000']
    metrics_path: /metrics

  - job_name: 'sync-service-branch1'
    static_configs:
      - targets: ['sync-service-branch1:3000']
    metrics_path: /metrics

  - job_name: 'sync-service-branch2'
    static_configs:
      - targets: ['sync-service-branch2:3000']
    metrics_path: /metrics
EOF
```

### 3. Create Grafana Dashboards

Create Grafana dashboard provisioning:

```bash
mkdir -p monitoring/grafana/provisioning/datasources
cat > monitoring/grafana/provisioning/datasources/datasource.yml << 'EOF'
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
EOF

mkdir -p monitoring/grafana/provisioning/dashboards
cat > monitoring/grafana/provisioning/dashboards/dashboard.yml << 'EOF'
apiVersion: 1

providers:
  - name: 'Banking System'
    orgId: 1
    folder: ''
    type: file
    disableDeletion: false
    editable: true
    options:
      path: /etc/grafana/provisioning/dashboards
EOF

cat > monitoring/grafana/provisioning/dashboards/banking-system.json << 'EOF'
{
  "annotations": {
    "list": [
      {
        "builtIn": 1,
        "datasource": "-- Grafana --",
        "enable": true,
        "hide": true,
        "iconColor": "rgba(0, 211, 255, 1)",
        "name": "Annotations & Alerts",
        "type": "dashboard"
      }
    ]
  },
  "editable": true,
  "gnetId": null,
  "graphTooltip": 0,
  "id": 1,
  "links": [],
  "panels": [
    {
      "aliasColors": {},
      "bars": false,
      "dashLength": 10,
      "dashes": false,
      "datasource": "Prometheus",
      "fieldConfig": {
        "defaults": {
          "custom": {}
        },
        "overrides": []
      },
      "fill": 1,
      "fillGradient": 0,
      "gridPos": {
        "h": 8,
        "w": 12,
        "x": 0,
        "y": 0
      },
      "hiddenSeries": false,
      "id": 2,
      "legend": {
        "avg": false,
        "current": false,
        "max": false,
        "min": false,
        "show": true,
        "total": false,
        "values": false
      },
      "lines": true,
      "linewidth": 1,
      "nullPointMode": "null",
      "options": {
        "alertThreshold": true
      },
      "percentage": false,
      "pluginVersion": "7.3.7",
      "pointradius": 2,
      "points": false,
      "renderer": "flot",
      "seriesOverrides": [],
      "spaceLength": 10,
      "stack": false,
      "steppedLine": false,
      "targets": [
        {
          "expr": "node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes * 100",
          "interval": "",
          "legendFormat": "Memory Available",
          "refId": "A"
        }
      ],
      "thresholds": [],
      "timeFrom": null,
      "timeRegions": [],
      "timeShift": null,
      "title": "Memory Usage",
      "tooltip": {
        "shared": true,
        "sort": 0,
        "value_type": "individual"
      },
      "type": "graph",
      "xaxis": {
        "buckets": null,
        "mode": "time",
        "name": null,
        "show": true,
        "values": []
      },
      "yaxes": [
        {
          "format": "percent",
          "label": null,
          "logBase": 1,
          "max": null,
          "min": null,
          "show": true
        },
        {
          "format": "short",
          "label": null,
          "logBase": 1,
          "max": null,
          "min": null,
          "show": true
        }
      ],
      "yaxis": {
        "align": false,
        "alignLevel": null
      }
    },
    {
      "aliasColors": {},
      "bars": false,
      "dashLength": 10,
      "dashes": false,
      "datasource": "Prometheus",
      "fieldConfig": {
        "defaults": {
          "custom": {}
        },
        "overrides": []
      },
      "fill": 1,
      "fillGradient": 0,
      "gridPos": {
        "h": 8,
        "w": 12,
        "x": 12,
        "y": 0
      },
      "hiddenSeries": false,
      "id": 4,
      "legend": {
        "avg": false,
        "current": false,
        "max": false,
        "min": false,
        "show": true,
        "total": false,
        "values": false
      },
      "lines": true,
      "linewidth": 1,
      "nullPointMode": "null",
      "options": {
        "alertThreshold": true
      },
      "percentage": false,
      "pluginVersion": "7.3.7",
      "pointradius": 2,
      "points": false,
      "renderer": "flot",
      "seriesOverrides": [],
      "spaceLength": 10,
      "stack": false,
      "steppedLine": false,
      "targets": [
        {
          "expr": "100 - (avg by (instance) (irate(node_cpu_seconds_total{mode=\"idle\"}[5m])) * 100)",
          "interval": "",
          "legendFormat": "CPU Usage",
          "refId": "A"
        }
      ],
      "thresholds": [],
      "timeFrom": null,
      "timeRegions": [],
      "timeShift": null,
      "title": "CPU Usage",
      "tooltip": {
        "shared": true,
        "sort": 0,
        "value_type": "individual"
      },
      "type": "graph",
      "xaxis": {
        "buckets": null,
        "mode": "time",
        "name": null,
        "show": true,
        "values": []
      },
      "yaxes": [
        {
          "format": "percent",
          "label": null,
          "logBase": 1,
          "max": null,
          "min": null,
          "show": true
        },
        {
          "format": "short",
          "label": null,
          "logBase": 1,
          "max": null,
          "min": null,
          "show": true
        }
      ],
      "yaxis": {
        "align": false,
        "alignLevel": null
      }
    },
    {
      "aliasColors": {},
      "bars": false,
      "dashLength": 10,
      "dashes": false,
      "datasource": "Prometheus",
      "fieldConfig": {
        "defaults": {
          "custom": {}
        },
        "overrides": []
      },
      "fill": 1,
      "fillGradient": 0,
      "gridPos": {
        "h": 8,
        "w": 12,
        "x": 0,
        "y": 8
      },
      "hiddenSeries": false,
      "id": 6,
      "legend": {
        "avg": false,
        "current": false,
        "max": false,
        "min": false,
        "show": true,
        "total": false,
        "values": false
      },
      "lines": true,
      "linewidth": 1,
      "nullPointMode": "null",
      "options": {
        "alertThreshold": true
      },
      "percentage": false,
      "pluginVersion": "7.3.7",
      "pointradius": 2,
      "points": false,
      "renderer": "flot",
      "seriesOverrides": [],
      "spaceLength": 10,
      "stack": false,
      "steppedLine": false,
      "targets": [
        {
          "expr": "node_filesystem_avail_bytes{mountpoint=\"/\"} / node_filesystem_size_bytes{mountpoint=\"/\"} * 100",
          "interval": "",
          "legendFormat": "Disk Space Available",
          "refId": "A"
        }
      ],
      "thresholds": [],
      "timeFrom": null,
      "timeRegions": [],
      "timeShift": null,
      "title": "Disk Usage",
      "tooltip": {
        "shared": true,
        "sort": 0,
        "value_type": "individual"
      },
      "type": "graph",
      "xaxis": {
        "buckets": null,
        "mode": "time",
        "name": null,
        "show": true,
        "values": []
      },
      "yaxes": [
        {
          "format": "percent",
          "label": null,
          "logBase": 1,
          "max": null,
          "min": null,
          "show": true
        },
        {
          "format": "short",
          "label": null,
          "logBase": 1,
          "max": null,
          "min": null,
          "show": true
        }
      ],
      "yaxis": {
        "align": false,
        "alignLevel": null
      }
    },
    {
      "aliasColors": {},
      "bars": false,
      "dashLength": 10,
      "dashes": false,
      "datasource": "Prometheus",
      "fieldConfig": {
        "defaults": {
          "custom": {}
        },
        "overrides": []
      },
      "fill": 1,
      "fillGradient": 0,
      "gridPos": {
        "h": 8,
        "w": 12,
        "x": 12,
        "y": 8
      },
      "hiddenSeries": false,
      "id": 8,
      "legend": {
        "avg": false,
        "current": false,
        "max": false,
        "min": false,
        "show": true,
        "total": false,
        "values": false
      },
      "lines": true,
      "linewidth": 1,
      "nullPointMode": "null",
      "options": {
        "alertThreshold": true
      },
      "percentage": false,
      "pluginVersion": "7.3.7",
      "pointradius": 2,
      "points": false,
      "renderer": "flot",
      "seriesOverrides": [],
      "spaceLength": 10,
      "stack": false,
      "steppedLine": false,
      "targets": [
        {
          "expr": "rate(node_network_receive_bytes_total[5m])",
          "interval": "",
          "legendFormat": "Network Receive",
          "refId": "A"
        },
        {
          "expr": "rate(node_network_transmit_bytes_total[5m])",
          "interval": "",
          "legendFormat": "Network Transmit",
          "refId": "B"
        }
      ],
      "thresholds": [],
      "timeFrom": null,
      "timeRegions": [],
      "timeShift": null,
      "title": "Network Traffic",
      "tooltip": {
        "shared": true,
        "sort": 0,
        "value_type": "individual"
      },
      "type": "graph",
      "xaxis": {
        "buckets": null,
        "mode": "time",
        "name": null,
        "show": true,
        "values": []
      },
      "yaxes": [
        {
          "format": "bytes",
          "label": null,
          "logBase": 1,
          "max": null,
          "min": null,
          "show": true
        },
        {
          "format": "short",
          "label": null,
          "logBase": 1,
          "max": null,
          "min": null,
          "show": true
        }
      ],
      "yaxis": {
        "align": false,
        "alignLevel": null
      }
    }
  ],
  "refresh": "5s",
  "schemaVersion": 26,
  "style": "dark",
  "tags": [],
  "templating": {
    "list": []
  },
  "time": {
    "from": "now-6h",
    "to": "now"
  },
  "timepicker": {},
  "timezone": "",
  "title": "Banking System Dashboard",
  "uid": "banking-system",
  "version": 1
}
EOF
```

### 4. Start Monitoring Services

Start the monitoring services:

```bash
cd monitoring
docker-compose up -d
cd ..
```

### 5. Access Monitoring Dashboards

Access the monitoring dashboards:

- Prometheus: http://localhost:9090
- Grafana: http://localhost:3000 (username: admin, password: admin)

## Next Steps

After testing and setting up monitoring for the multi-branch banking system, proceed to [Part 6: Backup and Recovery](setup_guide_part6_backup.md) to set up backup and recovery procedures. 