import { openDatabaseSync, SQLiteDatabase } from 'expo-sqlite';
import { runMigrations } from './migrationRunner';

let db: SQLiteDatabase | null = null;

export function getDatabase(): SQLiteDatabase {
  if (!db) {
    db = openDatabaseSync('myapp.db');
    runMigrations(db);
  }
  return db;
}

export default getDatabase;
