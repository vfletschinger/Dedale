import { SQLiteDatabase } from 'expo-sqlite';
import { migrations } from './migrations';

export function runMigrations(db: SQLiteDatabase): void {
  try {
    // Créer la table de versioning
    db.execSync(`
      CREATE TABLE IF NOT EXISTS schema_version (
        version INTEGER PRIMARY KEY,
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Récupérer la version actuelle
    const result = db.getFirstSync<{ version: number }>(
      'SELECT version FROM schema_version ORDER BY version DESC LIMIT 1'
    );
    const currentVersion = result?.version || 0;

    console.log(`Version actuelle du schéma : ${currentVersion}`);

    // Exécuter les migrations manquantes
    let migrationsApplied = 0;
    
    migrations.forEach(migration => {
      if (migration.version > currentVersion) {
        console.log(`Application de la migration v${migration.version} : ${migration.name}`);
        
        migration.up(db);
        
        // Enregistrer la version
        db.runSync(
          'INSERT INTO schema_version (version) VALUES (?)',
          [migration.version]
        );
        
        console.log(`Migration v${migration.version} appliquée`);
        migrationsApplied++;
      }
    });

    if (migrationsApplied === 0) {
      console.log('Base de données à jour');
    } else {
      console.log(`${migrationsApplied} migration(s) appliquée(s)`);
    }
  } catch (error) {
    console.error('Erreur lors des migrations:', error);
    throw error;
  }
}