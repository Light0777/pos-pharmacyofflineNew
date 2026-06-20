import db from '../connection';

export function runMigrations(): void {
  console.log('Running migrations...');

  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      user_uuid TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      pharmacist_registration_number TEXT,
      role TEXT NOT NULL DEFAULT 'cashier',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shop_name TEXT NOT NULL,
      mobile TEXT,
      address TEXT,
      gstin TEXT,
      invoice_prefix TEXT NOT NULL DEFAULT 'INV',
      drug_license_number TEXT,
      drug_license_valid_upto TEXT,
      pharmacist_name TEXT,
      pharmacist_registration_number TEXT,
      auto_print INTEGER DEFAULT 0,
      printer_type TEXT DEFAULT 'network',
      printer_host TEXT DEFAULT 'localhost',
      printer_port INTEGER DEFAULT 9104,
      printer_name TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS products (

      product_uuid TEXT PRIMARY KEY,

      name TEXT NOT NULL,

      category_uuid TEXT,
      subcategory TEXT,

      barcode TEXT,
      sku TEXT,

      product_type TEXT DEFAULT 'medicine',

      manufacturer TEXT,
      composition TEXT,

      schedule_type TEXT DEFAULT 'NONE',

      prescription_required INTEGER DEFAULT 0,

      medicine_type TEXT,

      rack_location TEXT,

      unit TEXT DEFAULT 'piece',

      price REAL NOT NULL,

      purchase_price REAL DEFAULT 0,

      gst_percent REAL NOT NULL DEFAULT 0.00,

      stock REAL NOT NULL DEFAULT 0,

      hsn_code TEXT,

      image TEXT,

      is_deleted INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

      FOREIGN KEY (category_uuid) REFERENCES categories(category_uuid)
    );

    CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
    CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
    CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
    CREATE INDEX IF NOT EXISTS idx_products_composition ON products(composition);
    CREATE INDEX IF NOT EXISTS idx_products_manufacturer ON products(manufacturer);

    CREATE TABLE IF NOT EXISTS product_batches (

      batch_uuid TEXT PRIMARY KEY,

      product_uuid TEXT NOT NULL,

      batch_number TEXT NOT NULL,

      expiry_date TEXT NOT NULL,

      manufacture_date TEXT,

      mrp REAL NOT NULL,

      ptr REAL DEFAULT 0,

      rate REAL DEFAULT 0,

      purchase_price REAL DEFAULT 0,

      selling_price REAL DEFAULT 0,

      gst_percent REAL DEFAULT 0,

      quantity REAL NOT NULL DEFAULT 0,

      sold_quantity REAL DEFAULT 0,

      free_quantity REAL DEFAULT 0,

      is_quarantined INTEGER DEFAULT 0,

      supplier_uuid TEXT,

      purchase_uuid TEXT,

      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

      FOREIGN KEY (product_uuid)
      REFERENCES products(product_uuid),

      FOREIGN KEY (supplier_uuid)
      REFERENCES suppliers(supplier_uuid),

      FOREIGN KEY (purchase_uuid)
      REFERENCES purchases(purchase_uuid)
    );

    CREATE INDEX IF NOT EXISTS idx_batches_product ON product_batches(product_uuid);
    CREATE INDEX IF NOT EXISTS idx_batches_expiry ON product_batches(expiry_date);
    CREATE INDEX IF NOT EXISTS idx_batches_batch_number ON product_batches(batch_number);

    CREATE TABLE IF NOT EXISTS customers (
      customer_uuid TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      mobile TEXT,
      address TEXT,
      gstin TEXT,
      credit_balance REAL NOT NULL DEFAULT 0.00,
      credit_limit REAL NOT NULL DEFAULT 0.00,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_customers_mobile ON customers(mobile);

    CREATE TABLE IF NOT EXISTS sales (
      sale_uuid TEXT PRIMARY KEY,
      invoice_number TEXT,
      customer_uuid TEXT,
      total REAL NOT NULL,
      tax REAL NOT NULL,
      grand_total REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'completed',
      is_locked INTEGER DEFAULT 0,
      voided_at TIMESTAMP,
      voided_by TEXT,
      void_reason TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_uuid) REFERENCES customers(customer_uuid)
    );

    CREATE INDEX IF NOT EXISTS idx_sales_invoice ON sales(invoice_number);
    CREATE INDEX IF NOT EXISTS idx_sales_created ON sales(created_at);
    CREATE INDEX IF NOT EXISTS idx_sales_customer ON sales(customer_uuid);

    CREATE TABLE IF NOT EXISTS sale_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_uuid TEXT NOT NULL,
      product_uuid TEXT NOT NULL,
      batch_uuid TEXT,
      quantity REAL NOT NULL,
      price REAL NOT NULL,
      total REAL NOT NULL,
      gst_percent REAL DEFAULT 0,
      gst_amount REAL DEFAULT 0,
      prescription_required INTEGER DEFAULT 0,
      prescription_number TEXT,
      doctor_name TEXT,
      doctor_license TEXT,
      patient_name TEXT,
      patient_age INTEGER,
      patient_gender TEXT,
      schedule_type TEXT DEFAULT 'NONE',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (sale_uuid)
      REFERENCES sales(sale_uuid),
      FOREIGN KEY (product_uuid)
      REFERENCES products(product_uuid),
      FOREIGN KEY (batch_uuid)
      REFERENCES product_batches(batch_uuid)
    );

    CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_uuid);

    CREATE TABLE IF NOT EXISTS purchases (
      purchase_uuid TEXT PRIMARY KEY,
      total REAL NOT NULL DEFAULT 0.00,
      supplier_uuid TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (supplier_uuid) REFERENCES suppliers(supplier_uuid)
    );

    CREATE TABLE IF NOT EXISTS purchase_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      purchase_uuid TEXT NOT NULL,
      product_uuid TEXT NOT NULL,
      batch_number TEXT NOT NULL,
      expiry_date TEXT NOT NULL,
      manufacture_date TEXT,
      quantity REAL NOT NULL,
      free_quantity REAL DEFAULT 0,
      mrp REAL NOT NULL,
      ptr REAL DEFAULT 0,
      rate REAL DEFAULT 0,
      cost_price REAL NOT NULL,
      selling_price REAL DEFAULT 0,
      gst_percent REAL DEFAULT 0,
      unit_uuid TEXT,
      normalized_quantity REAL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (purchase_uuid) REFERENCES purchases(purchase_uuid),
      FOREIGN KEY (product_uuid) REFERENCES products(product_uuid)
    );

    CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase ON purchase_items(purchase_uuid);

    CREATE TABLE IF NOT EXISTS suppliers (
      supplier_uuid TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      address TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_uuid TEXT NOT NULL,
      method TEXT NOT NULL,
      amount REAL NOT NULL,
      reference TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (sale_uuid) REFERENCES sales(sale_uuid)
    );

    CREATE INDEX IF NOT EXISTS idx_payments_sale ON payments(sale_uuid);

    CREATE TABLE IF NOT EXISTS stock_ledgers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_uuid TEXT NOT NULL,
      quantity REAL NOT NULL,
      type TEXT NOT NULL,
      reference_uuid TEXT,
      note TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_uuid) REFERENCES products(product_uuid)
    );

    CREATE INDEX IF NOT EXISTS idx_stock_ledgers_product ON stock_ledgers(product_uuid);

    CREATE TABLE IF NOT EXISTS customer_ledgers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_uuid TEXT NOT NULL,
      type TEXT NOT NULL,
      amount REAL NOT NULL,
      reference_uuid TEXT,
      note TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_uuid) REFERENCES customers(customer_uuid)
    );

    CREATE INDEX IF NOT EXISTS idx_customer_ledgers_customer ON customer_ledgers(customer_uuid);

    CREATE TABLE IF NOT EXISTS carts (
      cart_uuid TEXT PRIMARY KEY,
      status TEXT NOT NULL DEFAULT 'active',
      discount REAL NOT NULL DEFAULT 0.00,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_carts_status ON carts(status);

    CREATE TABLE IF NOT EXISTS cart_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cart_uuid TEXT NOT NULL,
      product_uuid TEXT NOT NULL,
      quantity REAL NOT NULL,
      price REAL NOT NULL,
      discount REAL NOT NULL DEFAULT 0.00,
      tax_percent REAL NOT NULL DEFAULT 0.00,
      unit_uuid TEXT,
      batch_uuid TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (cart_uuid) REFERENCES carts(cart_uuid),
      FOREIGN KEY (product_uuid) REFERENCES products(product_uuid)
    );

    CREATE INDEX IF NOT EXISTS idx_cart_items_cart ON cart_items(cart_uuid);

    CREATE TABLE IF NOT EXISTS categories (
      category_uuid TEXT PRIMARY KEY,

      name TEXT NOT NULL,
      parent_uuid TEXT,
      description TEXT,

      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

      FOREIGN KEY (parent_uuid) REFERENCES categories(category_uuid)
    );

    CREATE TABLE IF NOT EXISTS attributes (
      attribute_uuid TEXT PRIMARY KEY,

      name TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,

      data_type TEXT NOT NULL,

      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS product_attributes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,

      product_uuid TEXT NOT NULL,
      attribute_uuid TEXT NOT NULL,

      value TEXT,

      FOREIGN KEY (product_uuid) REFERENCES products(product_uuid),
      FOREIGN KEY (attribute_uuid) REFERENCES attributes(attribute_uuid)
    );

    CREATE TABLE IF NOT EXISTS category_attributes (

      id INTEGER PRIMARY KEY AUTOINCREMENT,

      category_uuid TEXT NOT NULL,

      attribute_uuid TEXT NOT NULL,

      is_required INTEGER DEFAULT 0,

      sort_order INTEGER DEFAULT 0,

      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

      FOREIGN KEY (category_uuid)
      REFERENCES categories(category_uuid),

      FOREIGN KEY (attribute_uuid)
      REFERENCES attributes(attribute_uuid)
    );

        CREATE TABLE IF NOT EXISTS product_units (

      unit_uuid TEXT PRIMARY KEY,

      product_uuid TEXT NOT NULL,

      unit_name TEXT NOT NULL,

      conversion_factor REAL NOT NULL,

      barcode TEXT,

      price REAL,

      purchase_price REAL,

      is_base_unit INTEGER DEFAULT 0,

      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

      FOREIGN KEY (product_uuid)
      REFERENCES products(product_uuid)
    );

    CREATE TABLE IF NOT EXISTS stock_adjustments (

      adjustment_uuid TEXT PRIMARY KEY,

      product_uuid TEXT NOT NULL,

      batch_uuid TEXT NOT NULL,

      adjustment_type TEXT NOT NULL,

      quantity REAL NOT NULL,

      note TEXT,

      performed_by TEXT,

      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

      FOREIGN KEY (product_uuid)
        REFERENCES products(product_uuid),

      FOREIGN KEY (batch_uuid)
        REFERENCES product_batches(batch_uuid),

      FOREIGN KEY (performed_by)
        REFERENCES users(user_uuid)
    );

  CREATE INDEX IF NOT EXISTS idx_adjustments_product
  ON stock_adjustments(product_uuid);

  CREATE INDEX IF NOT EXISTS idx_adjustments_batch
  ON stock_adjustments(batch_uuid);

  CREATE INDEX IF NOT EXISTS idx_adjustments_type
  ON stock_adjustments(adjustment_type);

  CREATE TABLE IF NOT EXISTS medicine_returns (

    return_uuid TEXT PRIMARY KEY,

    sale_uuid TEXT,

    product_uuid TEXT NOT NULL,

    batch_uuid TEXT NOT NULL,

    return_type TEXT NOT NULL,

    quantity REAL NOT NULL,

    refund_amount REAL DEFAULT 0,

    reason TEXT,

    performed_by TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_returns_sale
  ON medicine_returns(sale_uuid);

  CREATE INDEX IF NOT EXISTS idx_returns_product
  ON medicine_returns(product_uuid);

  CREATE INDEX IF NOT EXISTS idx_returns_batch
  ON medicine_returns(batch_uuid);

  CREATE INDEX IF NOT EXISTS idx_returns_type
  ON medicine_returns(return_type);

  CREATE TABLE IF NOT EXISTS h1_register (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    register_uuid TEXT NOT NULL UNIQUE,

    sale_uuid TEXT NOT NULL,

    sale_item_id INTEGER NOT NULL,

    product_uuid TEXT NOT NULL,

    batch_uuid TEXT,

    prescription_number TEXT NOT NULL,

    doctor_name TEXT NOT NULL,

    doctor_license TEXT,

    patient_name TEXT NOT NULL,

    patient_age INTEGER,

    patient_gender TEXT,

    quantity REAL NOT NULL,

    pharmacist_name TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS audit_logs (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    audit_uuid TEXT NOT NULL UNIQUE,

    action_type TEXT NOT NULL,

    entity_type TEXT NOT NULL,

    entity_uuid TEXT,

    reference_uuid TEXT,

    user_uuid TEXT,

    details TEXT,

    ip_address TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

    CREATE TABLE IF NOT EXISTS license (
      id INTEGER PRIMARY KEY,
      license_key TEXT NOT NULL,
      machine_id TEXT NOT NULL,
      activated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS product_templates (
      template_uuid TEXT PRIMARY KEY,

      name TEXT NOT NULL,

      description TEXT,

      category_uuid TEXT,

      icon TEXT,

      defaults_json TEXT,

      packaging_json TEXT,

      is_active INTEGER DEFAULT 1,

      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // ── Migration fixes for existing databases ──
  const fixColumns = [
    { table: 'categories', column: 'description', def: 'TEXT' },
    { table: 'products', column: 'description', def: 'TEXT' },
    { table: 'products', column: 'discount', def: 'REAL DEFAULT 0' },
    { table: 'purchase_items', column: 'discount', def: 'REAL DEFAULT 0' },
    { table: 'h1_register', column: 'schedule_type', def: "TEXT NOT NULL DEFAULT 'H1'" },
    { table: 'purchases', column: 'invoice_number', def: 'TEXT' },
    { table: 'purchases', column: 'invoice_date', def: 'TEXT' },
    { table: 'cart_items', column: 'batch_uuid', def: 'TEXT' },
    { table: 'products', column: 'boxes', def: 'INTEGER DEFAULT 0' },
    { table: 'products', column: 'strips_per_box', def: 'INTEGER DEFAULT 0' },
    { table: 'products', column: 'tablets_per_strip', def: 'INTEGER DEFAULT 0' },
    { table: 'products', column: 'extra_tablets', def: 'INTEGER DEFAULT 0' },
    { table: 'products', column: 'price_per_box', def: 'REAL DEFAULT 0' },
    { table: 'products', column: 'price_per_strip', def: 'REAL DEFAULT 0' },
    { table: 'products', column: 'price_per_tablet', def: 'REAL DEFAULT 0' },
    { table: 'product_batches', column: 'strips', def: 'REAL DEFAULT 0' },
  ];
  for (const fix of fixColumns) {
    try {
      db.exec(`ALTER TABLE ${fix.table} ADD COLUMN ${fix.column} ${fix.def}`);
      console.log(`  ✓ Added column ${fix.table}.${fix.column}`);
    } catch {
      // column already exists — ignore
    }
  }

  // ── Seed product_units for products missing a base unit ──
  const missingUnits = db.prepare(`
    SELECT p.product_uuid, COALESCE(p.unit, 'Tablet') AS unit_name
    FROM products p
    WHERE NOT EXISTS (
      SELECT 1 FROM product_units pu WHERE pu.product_uuid = p.product_uuid
    )
  `).all() as { product_uuid: string; unit_name: string }[];
  const insertUnit = db.prepare(`
    INSERT OR IGNORE INTO product_units (unit_uuid, product_uuid, unit_name, conversion_factor, is_base_unit)
    VALUES (?, ?, ?, 1, 1)
  `);
  for (const row of missingUnits) {
    insertUnit.run(`unit-${row.product_uuid}`, row.product_uuid, row.unit_name);
  }
  if (missingUnits.length > 0) {
    console.log(`  ✓ Seeded ${missingUnits.length} product_units`);
  }

  // ── Seed default categories ──
  const seedCategories = [
    { uuid: 'cat-drug',      name: 'Drug',        description: 'Prescription medicines' },
    { uuid: 'cat-generic',   name: 'Generic',     description: 'Generic medicines' },
    { uuid: 'cat-otc',       name: 'OTC',         description: 'Over-the-counter medicines' },
    { uuid: 'cat-nutra',     name: 'Nutraceutical', description: 'Nutritional supplements' },
    { uuid: 'cat-ayurvedic', name: 'Ayurvedic',   description: 'Herbal/Ayurvedic products' },
    { uuid: 'cat-surgical',  name: 'Surgical',    description: 'Surgical items' },
    { uuid: 'cat-fmcg',      name: 'FMCG',        description: 'Fast-moving consumer goods' },
    { uuid: 'cat-cosmetic',  name: 'Cosmetic',    description: 'Cosmetic products' },
  ];
  const insertCat = db.prepare(`
    INSERT OR IGNORE INTO categories (category_uuid, name, description)
    VALUES (?, ?, ?)
  `);
  for (const cat of seedCategories) {
    insertCat.run(cat.uuid, cat.name, cat.description);
  }
  console.log('  ✓ Seeded 8 default categories');

  console.log('Migrations completed successfully!');
}

if (process.argv[1] && process.argv[1].includes('001_initial')) {
  runMigrations();
  console.log('Migrations completed. Exiting...');
  process.exit(0);
}

