import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

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

const BUCKET_NAME = 'visitor-photos';
const BATCH_SIZE = 100;

/**
 * Recursively list all files in a bucket path.
 * Folders have id === null; files have id !== null.
 * Returns array of full file paths (non-folders only).
 */
async function listFilesRecursive(path = '') {
  const filePaths = [];

  try {
    const { data, error } = await supabase.storage.from(BUCKET_NAME).list(path, {
      limit: 1000,
      sortBy: { column: 'name', order: 'asc' },
    });

    if (error) {
      throw new Error(`Failed to list ${path}: ${error.message}`);
    }

    if (!data) return filePaths;

    for (const item of data) {
      const fullPath = path ? `${path}/${item.name}` : item.name;

      if (item.id === null) {
        // It's a folder; recurse into it
        const subFiles = await listFilesRecursive(fullPath);
        filePaths.push(...subFiles);
      } else {
        // It's a file
        filePaths.push(fullPath);
      }
    }
  } catch (err) {
    console.error(`Error listing bucket path "${path}": ${err.message}`);
    throw err;
  }

  return filePaths;
}

/**
 * Delete files in batches, checking for errors.
 */
async function deleteFilesBatch(filePaths) {
  for (let i = 0; i < filePaths.length; i += BATCH_SIZE) {
    const batch = filePaths.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.storage.from(BUCKET_NAME).remove(batch);

    if (error) {
      console.error(`Error deleting batch [${i}-${i + batch.length}]: ${error.message}`);
      process.exit(1);
    }
  }
}

async function main() {
  try {
    // 1. List all files
    console.log('Listing files in visitor-photos bucket...');
    const filePaths = await listFilesRecursive();
    const fileCount = filePaths.length;
    console.log(`Files found: ${fileCount}`);

    if (fileCount !== 30) {
      console.log(`WARNING: Expected 30 files, found ${fileCount}`);
    }

    if (fileCount === 0) {
      console.log('No files to delete. Bucket is already empty.');
      process.exit(0);
    }

    // 2. Delete files in batches
    console.log(`Deleting files in batches of ${BATCH_SIZE}...`);
    await deleteFilesBatch(filePaths);
    console.log(`Files deleted: ${fileCount}`);

    // 3. Verify deletion
    console.log('Verifying deletion...');
    const remainingFiles = await listFilesRecursive();
    const remainingCount = remainingFiles.length;
    console.log(`Files remaining: ${remainingCount}`);

    if (remainingCount !== 0) {
      console.error(`ERROR: Expected 0 remaining files, found ${remainingCount}`);
      process.exit(1);
    }

    console.log('SUCCESS: All orphaned visitor photos deleted.');
  } catch (err) {
    console.error(`Fatal error: ${err.message}`);
    process.exit(1);
  }
}

main();
