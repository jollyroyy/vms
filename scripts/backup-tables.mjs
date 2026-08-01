import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

// Load environment variables
config({ path: '.env' });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Error: VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not found in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const tables = ['visits', 'audit_logs', 'notifications', 'gate_passes', 'gate_pass_items', 'visitors'];
const backupDir = String.raw`C:\Users\ASUS\AppData\Local\Temp\claude\C--Users-ASUS-Desktop-VMS\f1a118dd-df2f-4811-8cdf-62f1485dff9a\scratchpad`;

// Ensure backup directory exists
mkdirSync(backupDir, { recursive: true });

async function backupTable(tableName) {
  try {
    // Query the entire table with range to bypass the 1000-row default cap
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .range(0, 99999);

    if (error) {
      console.error(`Error backing up ${tableName}: ${error.message}`);
      process.exit(1);
    }

    // Write to JSON file
    const backupFile = join(backupDir, `backup-${tableName}.json`);
    const jsonContent = JSON.stringify(data, null, 2);
    writeFileSync(backupFile, jsonContent, 'utf-8');

    const rowCount = data ? data.length : 0;
    const byteCount = Buffer.byteLength(jsonContent, 'utf-8');

    console.log(`${tableName}: ${rowCount} rows, ${byteCount} bytes written`);
  } catch (err) {
    console.error(`Error backing up ${tableName}: ${err.message}`);
    process.exit(1);
  }
}

// Run backups sequentially
async function main() {
  for (const table of tables) {
    await backupTable(table);
  }
}

main().catch((err) => {
  console.error('Backup failed:', err.message);
  process.exit(1);
});
