// Скрипт для активации всех пользователей в базе данных
require('dotenv').config();
const { Pool } = require('pg');

async function activateAllUsers() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: false // Для Railway proxy не нужен SSL
    });
    
    try {
        console.log('🔄 Activating all users in database...\n');
        
        // Активируем всех пользователей
        const updateQuery = `UPDATE users SET is_active = true WHERE is_active = false OR is_active IS NULL`;
        const result = await pool.query(updateQuery);
        console.log(`✅ Activated ${result.rowCount} users\n`);
        
        // Проверяем результат
        const checkQuery = `SELECT telegram_id, name, position, is_active FROM users ORDER BY name`;
        const users = await pool.query(checkQuery);
        
        console.log('📋 Current users status:');
        users.rows.forEach((user, i) => {
            console.log(`${i + 1}. ${user.name} (${user.telegram_id})`);
            console.log(`   Position: ${user.position}`);
            console.log(`   Active: ${user.is_active ? '✅' : '❌'}`);
        });
        
        console.log('\n✅ All users are now active!');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await pool.end();
    }
}

activateAllUsers();