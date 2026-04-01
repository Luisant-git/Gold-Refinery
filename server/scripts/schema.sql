-- Gold Refinery PostgreSQL Schema

CREATE TABLE IF NOT EXISTS users (
  id           SERIAL PRIMARY KEY,
  username     VARCHAR(50) UNIQUE NOT NULL,
  password     VARCHAR(255) NOT NULL,
  display_name VARCHAR(100),
  role         VARCHAR(20) DEFAULT 'user',
  is_active    BOOLEAN DEFAULT TRUE,
  created_at   TIMESTAMP DEFAULT NOW(),
  updated_at   TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS customers (
  id               SERIAL PRIMARY KEY,
  mobile           VARCHAR(15) NOT NULL,
  name             VARCHAR(100) NOT NULL,
  address          TEXT,
  ob_gold          DECIMAL(10,3) DEFAULT 0,
  ob_cash          DECIMAL(12,2) DEFAULT 0,
  ob_exchange_gold DECIMAL(10,3) DEFAULT 0,
  ob_exchange_cash DECIMAL(12,2) DEFAULT 0,
  created_at       TIMESTAMP DEFAULT NOW(),
  updated_at       TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rates (
  id          SERIAL PRIMARY KEY,
  rate_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  rate_24k    DECIMAL(10,2) NOT NULL,
  rate_22k    DECIMAL(10,2),
  rate_18k    DECIMAL(10,2),
  created_at  TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS touch_masters (
  id         SERIAL PRIMARY KEY,
  touch_name VARCHAR(50),
  touch_pct  DECIMAL(5,2),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS voucher_sequences (
  voucher_type VARCHAR(20) PRIMARY KEY,
  prefix       VARCHAR(10),
  current_no   INTEGER DEFAULT 0
);

INSERT INTO voucher_sequences (voucher_type, prefix, current_no)
VALUES ('EXCHANGE','EX26',0),('SALES','SL26',0),('PURCHASE','PR26',0),
       ('CASH_ENTRY','CE26',0),('GOLD_ENTRY','GE26',0),('EXPENSE','EXP26',0)
ON CONFLICT (voucher_type) DO NOTHING;

CREATE TABLE IF NOT EXISTS exchange_vouchers (
  id               SERIAL PRIMARY KEY,
  voucher_no       VARCHAR(20) UNIQUE,
  voucher_date     DATE DEFAULT CURRENT_DATE,
  customer_id      INTEGER REFERENCES customers(id),
  mobile           VARCHAR(15),
  customer_name    VARCHAR(100),
  total_katcha_wt  DECIMAL(10,3) DEFAULT 0,
  total_token_wt   DECIMAL(10,3) DEFAULT 0,
  total_gross_wt   DECIMAL(10,3) DEFAULT 0,
  actual_pure_wt   DECIMAL(10,3) DEFAULT 0,
  total_pure_wt    DECIMAL(10,3) DEFAULT 0,
  pure_wt_given    DECIMAL(10,3) DEFAULT 0,
  cash_given       DECIMAL(12,2) DEFAULT 0,
  balance_pure_wt  DECIMAL(10,3) DEFAULT 0,
  rate_per_gram    DECIMAL(10,2) DEFAULT 0,
  pure_touch       DECIMAL(5,2)  DEFAULT 99.90,
  transaction_type VARCHAR(20)   DEFAULT 'nil',
  diff_gold        DECIMAL(10,3) DEFAULT 0,
  ob_skipped       DECIMAL(10,3) DEFAULT 0,
  remarks          TEXT,
  status           VARCHAR(20)   DEFAULT 'completed',
  created_at       TIMESTAMP DEFAULT NOW(),
  updated_at       TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS exchange_voucher_items (
  id            SERIAL PRIMARY KEY,
  voucher_id    INTEGER REFERENCES exchange_vouchers(id) ON DELETE CASCADE,
  sno           INTEGER,
  token_no      VARCHAR(50),
  katcha_wt     DECIMAL(10,3) DEFAULT 0,
  katcha_touch  DECIMAL(5,2)  DEFAULT 0,
  less_touch    DECIMAL(5,2)  DEFAULT 0,
  balance_touch DECIMAL(5,2)  DEFAULT 0,
  pure_wt       DECIMAL(10,3) DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sales_vouchers (
  id             SERIAL PRIMARY KEY,
  voucher_no     VARCHAR(20) UNIQUE,
  voucher_date   DATE DEFAULT CURRENT_DATE,
  customer_id    INTEGER REFERENCES customers(id),
  mobile         VARCHAR(15),
  customer_name  VARCHAR(100),
  total_gross_wt DECIMAL(10,3) DEFAULT 0,
  total_pure_wt  DECIMAL(10,3) DEFAULT 0,
  gross_amount   DECIMAL(12,2) DEFAULT 0,
  deductions     DECIMAL(12,2) DEFAULT 0,
  net_amount     DECIMAL(12,2) DEFAULT 0,
  amount_paid    DECIMAL(12,2) DEFAULT 0,
  balance_amount DECIMAL(12,2) DEFAULT 0,
  payment_mode   VARCHAR(20)   DEFAULT 'cash',
  rate_per_gram  DECIMAL(10,2) DEFAULT 0,
  remarks        TEXT,
  status         VARCHAR(20)   DEFAULT 'completed',
  created_at     TIMESTAMP DEFAULT NOW(),
  updated_at     TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sales_voucher_items (
  id               SERIAL PRIMARY KEY,
  voucher_id       INTEGER REFERENCES sales_vouchers(id) ON DELETE CASCADE,
  sno              INTEGER,
  item_description VARCHAR(100),
  katcha_wt        DECIMAL(10,3) DEFAULT 0,
  token_wt         DECIMAL(10,3) DEFAULT 0,
  gross_wt         DECIMAL(10,3) DEFAULT 0,
  touch            DECIMAL(5,2)  DEFAULT 0,
  pure_wt          DECIMAL(10,3) DEFAULT 0,
  amount           DECIMAL(12,2) DEFAULT 0
);

CREATE TABLE IF NOT EXISTS purchase_vouchers (
  id             SERIAL PRIMARY KEY,
  voucher_no     VARCHAR(20) UNIQUE,
  voucher_date   DATE DEFAULT CURRENT_DATE,
  customer_id    INTEGER REFERENCES customers(id),
  mobile         VARCHAR(15),
  customer_name  VARCHAR(100),
  total_gross_wt DECIMAL(10,3) DEFAULT 0,
  total_pure_wt  DECIMAL(10,3) DEFAULT 0,
  gross_amount   DECIMAL(12,2) DEFAULT 0,
  deductions     DECIMAL(12,2) DEFAULT 0,
  net_amount     DECIMAL(12,2) DEFAULT 0,
  amount_paid    DECIMAL(12,2) DEFAULT 0,
  balance_amount DECIMAL(12,2) DEFAULT 0,
  payment_mode   VARCHAR(20)   DEFAULT 'cash',
  rate_per_gram  DECIMAL(10,2) DEFAULT 0,
  remarks        TEXT,
  status         VARCHAR(20)   DEFAULT 'completed',
  created_at     TIMESTAMP DEFAULT NOW(),
  updated_at     TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS purchase_voucher_items (
  id               SERIAL PRIMARY KEY,
  voucher_id       INTEGER REFERENCES purchase_vouchers(id) ON DELETE CASCADE,
  sno              INTEGER,
  item_description VARCHAR(100),
  katcha_wt        DECIMAL(10,3) DEFAULT 0,
  token_wt         DECIMAL(10,3) DEFAULT 0,
  gross_wt         DECIMAL(10,3) DEFAULT 0,
  touch            DECIMAL(5,2)  DEFAULT 0,
  pure_wt          DECIMAL(10,3) DEFAULT 0,
  amount           DECIMAL(12,2) DEFAULT 0
);

CREATE TABLE IF NOT EXISTS stock_ledger (
  id               SERIAL PRIMARY KEY,
  entry_date       DATE DEFAULT CURRENT_DATE,
  entry_type       VARCHAR(20),
  ref_type         VARCHAR(20),
  ref_no           VARCHAR(30),
  description      TEXT,
  dr_pure_wt       DECIMAL(10,3) DEFAULT 0,
  cr_pure_wt       DECIMAL(10,3) DEFAULT 0,
  balance_pure_wt  DECIMAL(10,3) DEFAULT 0,
  created_at       TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cash_entries (
  id           SERIAL PRIMARY KEY,
  entry_no     VARCHAR(20),
  entry_date   DATE DEFAULT CURRENT_DATE,
  customer_id  INTEGER REFERENCES customers(id),
  mobile       VARCHAR(15),
  customer_name VARCHAR(100),
  entry_type   VARCHAR(20),
  amount       DECIMAL(12,2) DEFAULT 0,
  remarks      TEXT,
  created_at   TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gold_entries (
  id            SERIAL PRIMARY KEY,
  entry_no      VARCHAR(20),
  entry_date    DATE DEFAULT CURRENT_DATE,
  customer_id   INTEGER REFERENCES customers(id),
  mobile        VARCHAR(15),
  customer_name VARCHAR(100),
  entry_type    VARCHAR(20),
  weight        DECIMAL(10,3) DEFAULT 0,
  touch         DECIMAL(5,2)  DEFAULT 0,
  pure_wt       DECIMAL(10,3) DEFAULT 0,
  remarks       TEXT,
  created_at    TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS expenses (
  id           SERIAL PRIMARY KEY,
  entry_no     VARCHAR(20),
  entry_date   DATE DEFAULT CURRENT_DATE,
  expense_type VARCHAR(30),
  description  TEXT,
  amount       DECIMAL(12,2) DEFAULT 0,
  created_at   TIMESTAMP DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS pure_token_master (
  id            SERIAL PRIMARY KEY,
  token_no      VARCHAR(50) NOT NULL UNIQUE,
  pure_touch    NUMERIC(5,2) NOT NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);