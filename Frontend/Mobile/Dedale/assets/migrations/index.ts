import { openDatabaseSync, SQLiteDatabase } from 'expo-sqlite';
import { runMigrations } from './migrationRunner';
import { seedDatabase } from './seeders';

let db: SQLiteDatabase | null = null;

export function getDatabase(options?: { seed?: boolean }): SQLiteDatabase {
  if (!db) {
    db = openDatabaseSync('database.sqlite');
    runMigrations(db);
    
    // Seed si demandé
    if (options?.seed) {
      seedDatabase(db);
    }
  }
  return db;
}

export default getDatabase;
