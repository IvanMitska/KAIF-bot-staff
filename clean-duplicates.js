require('dotenv').config();
const databasePool = require('./src/services/databasePool');

async function cleanDuplicates() {
  try {
    console.log('Connecting to database...');
    
    // First, check for duplicates
    const checkQuery = `
      SELECT telegram_id, date, COUNT(*) as count
      FROM reports
      GROUP BY telegram_id, date
      HAVING COUNT(*) > 1
    `;
    
    const duplicates = await databasePool.query(checkQuery);
    console.log(`Found ${duplicates.rows.length} duplicate groups`);
    
    if (duplicates.rows.length > 0) {
      console.log('Sample duplicates:', duplicates.rows.slice(0, 5));
      
      // Delete duplicates, keeping only the most recent one
      const deleteQuery = `
        DELETE FROM reports
        WHERE id IN (
          SELECT id FROM (
            SELECT id,
                   ROW_NUMBER() OVER (
                     PARTITION BY telegram_id, date 
                     ORDER BY timestamp DESC, id DESC
                   ) as rn
            FROM reports
          ) t
          WHERE rn > 1
        )
      `;
      
      const result = await databasePool.query(deleteQuery);
      console.log(`Deleted ${result.rowCount} duplicate reports`);
    }
    
    // Try to create the unique index
    try {
      await databasePool.query('DROP INDEX IF EXISTS idx_reports_unique');
      await databasePool.query('CREATE UNIQUE INDEX idx_reports_unique ON reports(telegram_id, date)');
      console.log('Successfully created unique index');
    } catch (indexError) {
      console.error('Error creating index:', indexError.message);
    }
    
    // Show final stats
    const stats = await databasePool.query('SELECT COUNT(*) FROM reports');
    console.log(`Total reports after cleanup: ${stats.rows[0].count}`);
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

cleanDuplicates();