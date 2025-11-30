import { SQLiteDatabase } from "expo-sqlite";
import { version } from "react";

export interface Migration {
  version: number;
  name: string;
  up: (db: SQLiteDatabase) => void;
}

export const migrations: Migration[] = [
  {
    version: 1,
    name: "Initial schema",
    up: (db: SQLiteDatabase) => {
      db.execSync(`
        CREATE TABLE IF NOT EXISTS obstacle_types (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name VARCHAR(25) NOT NULL,
          description TEXT,
          width REAL,
          length REAL
        );
      `);

      db.execSync(`
        CREATE TABLE IF NOT EXISTS interest_points (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          x REAL NOT NULL,
          y REAL NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          modified_at DATETIME DEFAULT CURRENT_TIMESTAMP

        );
      `);

      db.execSync(`
        CREATE TABLE IF NOT EXISTS comments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          point_id INTEGER NOT NULL,
          value TEXT,
          FOREIGN KEY (point_id) REFERENCES interest_points (id) ON DELETE CASCADE
        );
      `);

      db.execSync(`
        CREATE TABLE IF NOT EXISTS pictures (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          point_id INTEGER NOT NULL,
          image TEXT NOT NULL,
          FOREIGN KEY (point_id) REFERENCES interest_points (id) ON DELETE CASCADE
        );
      `);

      db.execSync(`
        CREATE TABLE IF NOT EXISTS obstacles (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          point_id INTEGER NOT NULL,
          type_id INTEGER NOT NULL,
          nombre INTEGER DEFAULT 1,
          FOREIGN KEY (point_id) REFERENCES interest_points (id) ON DELETE CASCADE,
          FOREIGN KEY (type_id) REFERENCES obstacle_types (id)
        );
      `);
    },
  },
  {
    version: 2,
    name: "change column name",
    up: (db: SQLiteDatabase) => {
      const tables = db.getAllSync<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='table'"
      );

      const tableNames = tables.map((t) => t.name);

      // Renommages sécurisés : ne renommer que si la table source existe
      // et que la table cible n'existe pas encore.
      if (tableNames.includes("interest_points") && !tableNames.includes("point")) {
        db.execSync(`ALTER TABLE interest_points RENAME TO point;`);
      }
      if (tableNames.includes("obstacles") && !tableNames.includes("obstacle")) {
        db.execSync(`ALTER TABLE obstacles RENAME TO obstacle;`);
      }
      if (tableNames.includes("pictures") && !tableNames.includes("picture")) {
        db.execSync(`ALTER TABLE pictures RENAME TO picture;`);
      }
      if (tableNames.includes("comments") && !tableNames.includes("comment")) {
        db.execSync(`ALTER TABLE comments RENAME TO comment;`);
      }
      if (tableNames.includes("obstacle_types") && !tableNames.includes("obstacle_type")) {
        db.execSync(`ALTER TABLE obstacle_types RENAME TO obstacle_type;`);
      }

      // Recalculer les colonnes pour les vérifications suivantes
      const getTableColumns = (tableName: string) => {
        try {
          const cols = db.getAllSync<{ name: string }>(`PRAGMA table_info(${tableName})`);
          return cols.map(c => c.name);
        } catch (e) {
          return [] as string[];
        }
      };

      // Renommer la colonne 'nombre' en 'number' dans la table 'obstacle'
      // seulement si la table existe et que la colonne source existe
      const obstacleCols = getTableColumns('obstacle');
      if (obstacleCols.length > 0 && obstacleCols.includes('nombre') && !obstacleCols.includes('number')) {
        try {
          db.execSync(`ALTER TABLE obstacle RENAME COLUMN nombre TO number;`);
        } catch (e) {
          // En cas d'erreur, logguer mais ne pas interrompre le processus
          console.warn('Impossible de renommer la colonne nombre -> number:', e);
        }
      }
    },
  },
  {
    version: 3,
    name: "add time stam",
    up: (db: SQLiteDatabase) => {
      db.execSync(`
        CREATE TABLE IF NOT EXISTS session (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          date DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);
    },
  },
];
