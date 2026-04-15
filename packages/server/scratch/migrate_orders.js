const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('packages/server/zenku.db');

console.log('Starting migration...');

db.exec('PRAGMA foreign_keys = OFF;');
db.exec('BEGIN TRANSACTION;');
try {
  // 1. 備份舊資料
  db.exec("UPDATE orders SET note = COALESCE(note, '') || ' [舊客戶名: ' || customer_name || ']' WHERE customer_name IS NOT NULL;");
  console.log('Backup done.');

  // 2. 建立新表
  db.exec(`
    CREATE TABLE orders_temp (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_number TEXT NOT NULL,
      order_date DATE NOT NULL,
      status TEXT,
      note TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      customer_id INTEGER REFERENCES customers(id)
    );
  `);
  console.log('Temp table created.');

  // 3. 遷移資料
  db.exec(`
    INSERT INTO orders_temp (id, order_number, order_date, status, note, created_at, updated_at, customer_id)
    SELECT id, order_number, order_date, status, note, created_at, updated_at, customer_id FROM orders;
  `);
  console.log('Data migrated.');

  // 4. 切換表格
  db.exec('DROP TABLE orders;');
  db.exec('ALTER TABLE orders_temp RENAME TO orders;');

  db.exec('COMMIT;');
  console.log('SUCCESS');
} catch (e) {
  db.exec('ROLLBACK;');
  console.error('Migration failed:', e);
  process.exit(1);
} finally {
  db.exec('PRAGMA foreign_keys = ON;');
}
