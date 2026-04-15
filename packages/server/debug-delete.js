import Database from 'better-sqlite3';

const db = new Database('zenku.db');

try {
  console.log('嘗試模擬刪除 orders ID 1...');
  // 模擬後端的邏輯
  const table = 'orders';
  const id = '1';

  db.exec('BEGIN');
  // 找出所有外鍵指向該表的
  const allTables = db.prepare(
    `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_zenku_%'`
  ).all().map(r => r.name).filter(t => t !== table);

  for (const childTable of allTables) {
    const fkList = db.prepare(`PRAGMA foreign_key_list("${childTable}")`).all();
    for (const fk of fkList) {
      if (fk.table === table) {
        console.log(`  清理子表: ${childTable} (欄位: ${fk.from})`);
        db.prepare(`DELETE FROM "${childTable}" WHERE "${fk.from}" = ?`).run(id);
      }
    }
  }

  console.log(`  執行最終刪除: ${table}`);
  db.prepare(`DELETE FROM "${table}" WHERE id = ?`).run(id);
  db.exec('COMMIT');
  console.log('✅ 模擬刪除成功');
} catch (err) {
  db.exec('ROLLBACK');
  console.error('❌ 模擬刪除失敗，錯誤原因:', err.message);
}
