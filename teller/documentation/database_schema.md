# Multi-Branch Banking System Database Schema

## Data Classification

| Category | Description | Examples |
|----------|-------------|----------|
| **Local-Only Data** | Data that remains at the branch level and is not synchronized | - User sessions<br>- Temporary calculations<br>- Local audit logs<br>- Branch-specific settings |
| **Branch-to-HQ Data** | Data that originates at branches and flows to headquarters | - Teller transactions<br>- Currency exchanges<br>- Customer interactions<br>- Daily branch reports |
| **HQ-to-Branch Data** | Data that originates at headquarters and flows to branches | - Exchange rates<br>- Product configurations<br>- System policies<br>- User permissions |
| **Global Data** | Reference data that is consistent across all locations | - Customer master data<br>- Account information<br>- Product catalog<br>- Global configurations |

## PostgreSQL Replication Configuration

### Headquarters Setup

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Primary DB     │────▶│  Standby DB     │────▶│  Reporting DB   │
│  (Write Access) │     │  (Failover)     │     │  (Analytics)    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │
        │
        ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Publication/Subscription                    │
│                                                                 │
│  CREATE PUBLICATION hq_to_branch_pub FOR TABLE                  │
│    exchange_rates, system_config, user_permissions;             │
│                                                                 │
│  -- At each branch                                              │
│  CREATE SUBSCRIPTION branch_sub CONNECTION                      │
│    'host=hq_server port=5432 dbname=erp_central'               │
│    PUBLICATION hq_to_branch_pub;                                │
└─────────────────────────────────────────────────────────────────┘
```

### Branch Setup

```
┌─────────────────┐                      ┌─────────────────┐
│  Branch DB      │◀────Subscription────▶│  HQ Central DB  │
│  (Local + Sync) │                      │                 │
└─────────────────┘                      └─────────────────┘
        │
        │
        ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Publication/Subscription                    │
│                                                                 │
│  CREATE PUBLICATION branch_to_hq_pub FOR TABLE                  │
│    teller_invoice, currency_exchange, teller_treasury;          │
│                                                                 │
│  -- At headquarters                                             │
│  CREATE SUBSCRIPTION hq_branch_sub_[branch_id] CONNECTION       │
│    'host=[branch_server] port=5432 dbname=erp_branch'          │
│    PUBLICATION branch_to_hq_pub;                                │
└─────────────────────────────────────────────────────────────────┘
```

## Core Database Tables

### Transaction Tables

#### teller_invoice
```sql
CREATE TABLE teller_invoice (
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
    global_transaction_id UUID NOT NULL,
    CONSTRAINT fk_branch FOREIGN KEY (branch_id) REFERENCES branch_registry(id)
);
```

#### teller_invoice_details
```sql
CREATE TABLE teller_invoice_details (
    id SERIAL PRIMARY KEY,
    invoice_id INTEGER NOT NULL,
    item_code VARCHAR(50) NOT NULL,
    description TEXT,
    quantity INTEGER NOT NULL,
    rate DECIMAL(15,2) NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    CONSTRAINT fk_invoice FOREIGN KEY (invoice_id) REFERENCES teller_invoice(id)
);
```

#### currency_exchange
```sql
CREATE TABLE currency_exchange (
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
    sync_status VARCHAR(20) DEFAULT 'pending',
    CONSTRAINT fk_branch FOREIGN KEY (branch_id) REFERENCES branch_registry(id)
);
```

#### teller_treasury
```sql
CREATE TABLE teller_treasury (
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
    sync_status VARCHAR(20) DEFAULT 'pending',
    CONSTRAINT fk_branch FOREIGN KEY (branch_id) REFERENCES branch_registry(id)
);
```

### Master Data Tables

#### branch_registry
```sql
CREATE TABLE branch_registry (
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
```

#### exchange_rates
```sql
CREATE TABLE exchange_rates (
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
```

## Synchronization Tables

#### sync_outbox
```sql
CREATE TABLE sync_outbox (
    id SERIAL PRIMARY KEY,
    table_name VARCHAR(100) NOT NULL,
    record_id INTEGER NOT NULL,
    operation VARCHAR(10) NOT NULL, -- INSERT, UPDATE, DELETE
    payload JSONB NOT NULL,
    created_at TIMESTAMP NOT NULL,
    processed_at TIMESTAMP,
    status VARCHAR(20) DEFAULT 'pending',
    retry_count INTEGER DEFAULT 0,
    error_message TEXT,
    UNIQUE (table_name, record_id, operation, status)
);
```

#### sync_status
```sql
CREATE TABLE sync_status (
    id SERIAL PRIMARY KEY,
    branch_id VARCHAR(20) NOT NULL,
    last_successful_sync TIMESTAMP,
    sync_direction VARCHAR(20) NOT NULL, -- BRANCH_TO_HQ, HQ_TO_BRANCH
    records_processed INTEGER DEFAULT 0,
    status VARCHAR(20) NOT NULL,
    started_at TIMESTAMP NOT NULL,
    completed_at TIMESTAMP,
    CONSTRAINT fk_branch FOREIGN KEY (branch_id) REFERENCES branch_registry(id)
);
```

#### sync_conflicts
```sql
CREATE TABLE sync_conflicts (
    id SERIAL PRIMARY KEY,
    table_name VARCHAR(100) NOT NULL,
    record_id INTEGER NOT NULL,
    branch_id VARCHAR(20) NOT NULL,
    local_data JSONB NOT NULL,
    remote_data JSONB NOT NULL,
    conflict_type VARCHAR(50) NOT NULL,
    resolution_status VARCHAR(20) DEFAULT 'pending',
    resolved_at TIMESTAMP,
    resolved_by VARCHAR(50),
    created_at TIMESTAMP NOT NULL,
    CONSTRAINT fk_branch FOREIGN KEY (branch_id) REFERENCES branch_registry(id)
);
```

## Database Triggers for Synchronization

### Capture Changes for Synchronization

```sql
CREATE OR REPLACE FUNCTION capture_changes_for_sync()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        INSERT INTO sync_outbox (table_name, record_id, operation, payload, created_at)
        VALUES (TG_TABLE_NAME, NEW.id, TG_OP, row_to_json(NEW), NOW());
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO sync_outbox (table_name, record_id, operation, payload, created_at)
        VALUES (TG_TABLE_NAME, OLD.id, TG_OP, row_to_json(OLD), NOW());
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Example trigger for teller_invoice table
CREATE TRIGGER teller_invoice_sync_trigger
AFTER INSERT OR UPDATE OR DELETE ON teller_invoice
FOR EACH ROW EXECUTE FUNCTION capture_changes_for_sync();

-- Example trigger for currency_exchange table
CREATE TRIGGER currency_exchange_sync_trigger
AFTER INSERT OR UPDATE OR DELETE ON currency_exchange
FOR EACH ROW EXECUTE FUNCTION capture_changes_for_sync();
```

### Conflict Detection Trigger

```sql
CREATE OR REPLACE FUNCTION detect_sync_conflicts()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if there's a pending outbox entry for this record
    IF EXISTS (
        SELECT 1 FROM sync_outbox 
        WHERE table_name = TG_TABLE_NAME 
        AND record_id = NEW.id 
        AND status = 'pending'
    ) THEN
        -- Record the conflict
        INSERT INTO sync_conflicts (
            table_name, record_id, branch_id, local_data, remote_data,
            conflict_type, created_at
        )
        VALUES (
            TG_TABLE_NAME, NEW.id, 
            CASE WHEN TG_TABLE_NAME = 'teller_invoice' THEN NEW.branch_id
                 WHEN TG_TABLE_NAME = 'currency_exchange' THEN NEW.branch_id
                 ELSE 'HQ' END,
            (SELECT payload FROM sync_outbox 
             WHERE table_name = TG_TABLE_NAME AND record_id = NEW.id 
             AND status = 'pending' LIMIT 1),
            row_to_json(NEW),
            'concurrent_modification',
            NOW()
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply conflict detection to synchronized tables
CREATE TRIGGER teller_invoice_conflict_trigger
BEFORE UPDATE ON teller_invoice
FOR EACH ROW EXECUTE FUNCTION detect_sync_conflicts();
``` 