import Database from "@tauri-apps/plugin-sql";

let db: Database | null = null;

export async function initDatabase(): Promise<Database> {
  if (db) return db;
  
  console.log("[DB] 🔧 Chargement de la base de données...");
  try {
    db = await Database.load("sqlite:mydatabase.db");
    console.log("[DB] ✅ Base de données chargée !");
    
    const tables = await db.select<{ name: string }[]>(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"
    );
    console.log("[DB] 📋 Tables existantes:", tables.map(t => t.name).join(", ") || "Aucune");
    
    return db;
  } catch (error) {
    console.error("[DB] ❌ Erreur lors du chargement:", error);
    throw error;
  }
}

export async function getDatabase(): Promise<Database> {
  if (!db) {
    return initDatabase();
  }
  return db;
}

export { db };
