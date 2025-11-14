import { SQLiteDatabase } from 'expo-sqlite';

export function seedDatabase(db: SQLiteDatabase): void {
  console.log('🌱 Début du seeding...');

  try {
    // Vérifier si des données existent déjà
    const existingPoints = db.getFirstSync<{ count: number }>(
      'SELECT COUNT(*) as count FROM interest_points'
    );

    if (existingPoints && existingPoints.count > 0) {
      console.log('⚠️ Des données existent déjà, seeding annulé');
      return;
    }

    // 1. Seed obstacle_types
    console.log('📦 Insertion des types d\'obstacles...');
    const obstacleTypes = [
      { name: 'Arbre', description: 'Arbre sur le parcours', width: 0.5, length: 0.5 },
      { name: 'Rocher', description: 'Rocher bloquant', width: 1.0, length: 1.0 },
      { name: 'Barrière', description: 'Barrière métallique', width: 2.0, length: 0.1 },
      { name: 'Panneau', description: 'Panneau de signalisation', width: 0.8, length: 0.05 },
      { name: 'Poubelle', description: 'Conteneur à déchets', width: 0.6, length: 0.6 },
    ];

    const typeIds: number[] = [];
    obstacleTypes.forEach(type => {
      const result = db.runSync(
        'INSERT INTO obstacle_types (name, description, width, length) VALUES (?, ?, ?, ?)',
        [type.name, type.description, type.width, type.length]
      );
      typeIds.push(result.lastInsertRowId);
    });

    // 2. Seed interest_points
    console.log('📍 Insertion des points d\'intérêt...');
    const points = [
      { x: 48.5734, y: 7.7521 }, // Strasbourg
      { x: 48.5850, y: 7.7350 },
      { x: 48.5920, y: 7.7580 },
      { x: 48.5680, y: 7.7420 },
      { x: 48.5790, y: 7.7650 },
    ];

    const pointIds: number[] = [];
    points.forEach(point => {
      const result = db.runSync(
        'INSERT INTO interest_points (x, y) VALUES (?, ?)',
        [point.x, point.y]
      );
      pointIds.push(result.lastInsertRowId);
    });

    // 3. Seed comments
    console.log('💬 Insertion des commentaires...');
    const comments = [
      { point_id: pointIds[0], value: 'Zone très fréquentée, attention aux piétons' },
      { point_id: pointIds[0], value: 'Passage étroit, ralentir' },
      { point_id: pointIds[1], value: 'Belle vue sur la cathédrale' },
      { point_id: pointIds[2], value: 'Travaux en cours, détour possible' },
      { point_id: pointIds[3], value: 'Point de repos avec bancs' },
      { point_id: pointIds[4], value: 'Attention au verglas en hiver' },
    ];

    comments.forEach(comment => {
      db.runSync(
        'INSERT INTO comments (point_id, value) VALUES (?, ?)',
        [comment.point_id, comment.value]
      );
    });

    // 4. Seed pictures
    console.log('📸 Insertion des photos...');
    const pictures = [
      { point_id: pointIds[0], path: '/images/point1_photo1.jpg' },
      { point_id: pointIds[0], path: '/images/point1_photo2.jpg' },
      { point_id: pointIds[1], path: '/images/point2_photo1.jpg' },
      { point_id: pointIds[2], path: '/images/point3_photo1.jpg' },
      { point_id: pointIds[4], path: '/images/point5_photo1.jpg' },
    ];

    pictures.forEach(picture => {
      db.runSync(
        'INSERT INTO pictures (point_id, path) VALUES (?, ?)',
        [picture.point_id, picture.path]
      );
    });

    // 5. Seed obstacles
    console.log('🚧 Insertion des obstacles...');
    const obstacles = [
      { point_id: pointIds[0], type_id: typeIds[0], nombre: 2 }, // 2 arbres
      { point_id: pointIds[0], type_id: typeIds[4], nombre: 1 }, // 1 poubelle
      { point_id: pointIds[1], type_id: typeIds[2], nombre: 1 }, // 1 barrière
      { point_id: pointIds[2], type_id: typeIds[1], nombre: 3 }, // 3 rochers
      { point_id: pointIds[3], type_id: typeIds[3], nombre: 2 }, // 2 panneaux
      { point_id: pointIds[4], type_id: typeIds[0], nombre: 5 }, // 5 arbres
    ];

    obstacles.forEach(obstacle => {
      db.runSync(
        'INSERT INTO obstacles (point_id, type_id, nombre) VALUES (?, ?, ?)',
        [obstacle.point_id, obstacle.type_id, obstacle.nombre]
      );
    });

    console.log('✅ Seeding terminé avec succès !');
    console.log(`   - ${obstacleTypes.length} types d'obstacles`);
    console.log(`   - ${points.length} points d'intérêt`);
    console.log(`   - ${comments.length} commentaires`);
    console.log(`   - ${pictures.length} photos`);
    console.log(`   - ${obstacles.length} obstacles`);

  } catch (error) {
    console.error('❌ Erreur lors du seeding:', error);
    throw error;
  }
}

// Fonction pour nettoyer toutes les données
export function clearDatabase(db: SQLiteDatabase): void {
  console.log('🗑️ Suppression de toutes les données...');
  
  try {
    db.execSync('DELETE FROM obstacles');
    db.execSync('DELETE FROM pictures');
    db.execSync('DELETE FROM comments');
    db.execSync('DELETE FROM interest_points');
    db.execSync('DELETE FROM obstacle_types');
    
    console.log('✅ Base de données nettoyée');
  } catch (error) {
    console.error('❌ Erreur lors du nettoyage:', error);
    throw error;
  }
}

// Fonction pour réinitialiser et reseed
export function resetAndSeed(db: SQLiteDatabase): void {
  clearDatabase(db);
  seedDatabase(db);
}
