use crate::db::get_db_pool;
use crate::db::ObstacleType;
use tauri::AppHandle;
use sqlx::SqlitePool;
use sqlx::Row;

// --- Helper Structs for Seeding Data ---
struct PointSeed {
    x: f64,
    y: f64,
}
struct CommentSeed {
    point_idx: usize,
    value: &'static str,
}
struct PictureSeed {
    point_idx: usize,
    image: &'static str,
}
struct ObstacleSeed {
    point_idx: usize,
    type_idx: usize,
    number: i32,
    description: Option<String>,
}

struct EventSeed {
    name: &'static str,
    description: &'static str,
    date_debut: &'static str,
    date_fin: &'static str,
    statut: &'static str,
    geometry: &'static str,
}

// Liaison point-event (many-to-many)
struct PointEventSeed {
    point_idx: usize,
    event_idx: usize,
}

#[tauri::command]
pub async fn seed_database(app: &AppHandle) -> Result<(), String> {
    println!("🌱 Début du seeding...");

    let pool: SqlitePool = get_db_pool(&app).await?;
    let query = r#"
        SELECT COUNT(*) as count
        FROM point
    "#;

    let row = sqlx::query(query)
        .fetch_one(&pool)
        .await
        .map_err(|e| e.to_string())?;
    
    let existing_points: i64 = row.get("count");

    if existing_points > 0 {
        println!("⚠️ Des données existent déjà, seeding annulé.");
        return Ok(());
    }

    // --- Data Definitions ---
    let obstacle_types = [
        ObstacleType { id: 1, name: "Glissière 2m".to_string(), description: "Glissière béton armé (GBA) 2m".to_string(), width: 0.6, length: 2.0 },
        ObstacleType { id: 2, name: "Glissière 1m".to_string(), description: "Glissière béton armé (GBA) 1m".to_string(), width: 0.6, length: 1.0 },
        ObstacleType { id: 3, name: "Bloc 2.5m".to_string(), description: "Bloc de béton 2.5m".to_string(), width: 0.6, length: 2.5 },
        ObstacleType { id: 4, name: "Bloc 1m".to_string(), description: "Bloc de béton 1m".to_string(), width: 0.6, length: 1.0 },
        ObstacleType { id: 5, name: "Barrière Vauban".to_string(), description: "Barrière de 2 mètres".to_string(), width: 0.4, length: 2.0 },
        ObstacleType { id: 6, name: "Barrière Héras".to_string(), description: "Barrière Héras (délimitation de surface d'accueil de personnes)".to_string(), width: 0.1, length: 3.5 },
        ObstacleType { id: 7, name: "Barrière Héras avec voile d'occultation".to_string(), description: "Barrière Héras avec voile d'occultation".to_string(), width: 0.1, length: 3.5 },
        ObstacleType { id: 8, name: "Obstacle".to_string(), description: "Obstacle pour voitures".to_string(), width: 0.95, length: 1.05 },
        ObstacleType { id: 9, name: "Engins de blocage 8m".to_string(), description: "Engins routiers pour bloquer les rues".to_string(), width: 2.0, length: 8.0 },
        ObstacleType { id: 10, name: "Engins de blocage 9.35m".to_string(), description: "Engins routiers pour bloquer les rues".to_string(), width: 2.0, length: 9.35 },
        ObstacleType { id: 11, name: "Engins de blocage 9.5m".to_string(), description: "Engins routiers pour bloquer les rues".to_string(), width: 2.0, length: 9.5 },
        ObstacleType { id: 12, name: "Engins de blocage 11m".to_string(), description: "Engins routiers pour bloquer les rues".to_string(), width: 2.0, length: 11.0 },
        ObstacleType { id: 13, name: "Engins de blocage 16m".to_string(), description: "Engins routiers pour bloquer les rues".to_string(), width: 2.0, length: 16.0 },
    ];

    let points = [
        // Centre-ville - Place Kléber
        PointSeed { x: 7.7455, y: 48.5839 },
        // Cathédrale Notre-Dame
        PointSeed { x: 7.7509, y: 48.5818 },
        // Petite France
        PointSeed { x: 7.7398, y: 48.5801 },
        // Place de la République
        PointSeed { x: 7.7568, y: 48.5871 },
        // Parc de l'Orangerie
        PointSeed { x: 7.7815, y: 48.5907 },
        // Gare de Strasbourg
        PointSeed { x: 7.7339, y: 48.5850 },
        // Place Broglie
        PointSeed { x: 7.7489, y: 48.5855 },
        // Palais Rohan
        PointSeed { x: 7.7519, y: 48.5807 },
    ];

    let comments_data = [
        CommentSeed { point_idx: 0, value: "Place Kléber - Coeur de Strasbourg, très fréquentée" },
        CommentSeed { point_idx: 0, value: "Point de rassemblement principal" },
        CommentSeed { point_idx: 1, value: "Cathédrale Notre-Dame - Monument emblématique" },
        CommentSeed { point_idx: 2, value: "Petite France - Quartier historique pittoresque" },
        CommentSeed { point_idx: 3, value: "Place de la République - Accès tramway" },
        CommentSeed { point_idx: 4, value: "Parc de l'Orangerie - Espace vert, idéal pour événements" },
        CommentSeed { point_idx: 5, value: "Gare centrale - Hub de transport" },
        CommentSeed { point_idx: 6, value: "Place Broglie - Marché de Noël traditionnel" },
        CommentSeed { point_idx: 7, value: "Palais Rohan - Site culturel majeur" },
    ];

    let pictures_data = [
        PictureSeed { point_idx: 0, image: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQYV2NkYGD4DwABBAEAgr5ZhgAAAABJRU5ErkJggg==" },
        PictureSeed { point_idx: 1, image: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQYV2NkYGD4DwABBAEAgr5ZhgAAAABJRU5ErkJggg==" },
        PictureSeed { point_idx: 2, image: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQYV2NkYGD4DwABBAEAgr5ZhgAAAABJRU5ErkJggg==" },
        PictureSeed { point_idx: 4, image: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQYV2NkYGD4DwABBAEAgr5ZhgAAAABJRU5ErkJggg==" },
        PictureSeed { point_idx: 6, image: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQYV2NkYGD4DwABBAEAgr5ZhgAAAABJRU5ErkJggg==" },
    ];

    let obstacles_data = [
        ObstacleSeed { point_idx: 0, type_idx: 0, number: 4, description: Some("Glissières autour de la place".to_string()) },
        ObstacleSeed { point_idx: 0, type_idx: 4, number: 8, description: Some("Barrières Vauban périmètre".to_string()) },
        ObstacleSeed { point_idx: 1, type_idx: 5, number: 6, description: Some("Barrières Héras cathédrale".to_string()) },
        ObstacleSeed { point_idx: 2, type_idx: 2, number: 3, description: Some("Blocs béton Petite France".to_string()) },
        ObstacleSeed { point_idx: 3, type_idx: 4, number: 4, description: Some("Barrières Vauban République".to_string()) },
        ObstacleSeed { point_idx: 4, type_idx: 5, number: 10, description: Some("Barrières Héras parc".to_string()) },
        ObstacleSeed { point_idx: 5, type_idx: 8, number: 2, description: Some("Engins blocage gare".to_string()) },
        ObstacleSeed { point_idx: 6, type_idx: 0, number: 6, description: Some("Glissières Place Broglie".to_string()) },
        ObstacleSeed { point_idx: 7, type_idx: 3, number: 2, description: Some("Blocs 1m Palais Rohan".to_string()) },
    ];
    
    let event_data = [
        EventSeed { 
            name: "Festival de Strasbourg", 
            description: "Un festival annuel de musique et d'arts à Strasbourg.", 
            date_debut: "2024-07-15", 
            date_fin: "2024-07-20", 
            statut: "Prévu", 
            geometry: r#"{"type":"Polygon","coordinates":[[[7.74,48.58],[7.75,48.58],[7.75,48.59],[7.74,48.59],[7.74,48.58]]]}"# 
        },
        EventSeed { 
            name: "Marché de Noël", 
            description: "Le célèbre marché de Noël de Strasbourg.", 
            date_debut: "2024-12-01", 
            date_fin: "2024-12-26", 
            statut: "Actif", 
            geometry: r#"{"type":"Polygon","coordinates":[[[7.745,48.575],[7.755,48.575],[7.755,48.585],[7.745,48.585],[7.745,48.575]]]}"# 
        },
        EventSeed { 
            name: "Marathon de la ville", 
            description: "Course annuelle à travers la ville.", 
            date_debut: "2024-09-10", 
            date_fin: "2024-09-10", 
            statut: "Terminé", 
            geometry: r#"{"type":"LineString","coordinates":[[7.73,48.57],[7.75,48.58],[7.76,48.59]]}"# 
        },
        EventSeed { 
            name: "Concert en plein air", 
            description: "Concert gratuit au parc de la Citadelle.", 
            date_debut: "2024-08-20", 
            date_fin: "2024-08-20", 
            statut: "Prévu", 
            geometry: r#"{"type":"Point","coordinates":[7.758,48.579]}"# 
        },
    ];

    // Liaisons point-event (un point peut appartenir à plusieurs events)
    let point_event_data = [
        // Marché de Noël - plusieurs points du centre
        PointEventSeed { point_idx: 0, event_idx: 1 }, // Place Kléber → Marché de Noël
        PointEventSeed { point_idx: 1, event_idx: 1 }, // Cathédrale → Marché de Noël
        PointEventSeed { point_idx: 6, event_idx: 1 }, // Place Broglie → Marché de Noël
        
        // Festival de Strasbourg - zones culturelles
        PointEventSeed { point_idx: 0, event_idx: 0 }, // Place Kléber → Festival (multi-event!)
        PointEventSeed { point_idx: 2, event_idx: 0 }, // Petite France → Festival
        PointEventSeed { point_idx: 7, event_idx: 0 }, // Palais Rohan → Festival
        
        // Marathon - parcours
        PointEventSeed { point_idx: 3, event_idx: 2 }, // Place République → Marathon
        PointEventSeed { point_idx: 4, event_idx: 2 }, // Parc Orangerie → Marathon
        PointEventSeed { point_idx: 5, event_idx: 2 }, // Gare → Marathon
        
        // Concert - Parc de l'Orangerie
        PointEventSeed { point_idx: 4, event_idx: 3 }, // Parc Orangerie → Concert (multi-event!)
    ];

    let mut point_ids: Vec<i64> = Vec::new();
    let mut type_ids: Vec<i64> = Vec::new();
    let mut event_ids: Vec<i64> = Vec::new();

    // 1. Seed obstacle_type
    println!("📦 Insertion des types d'obstacles...");
    for t in obstacle_types.iter() {
        let result = sqlx::query(
            "INSERT INTO obstacle_type (name, description, width, length) VALUES (?, ?, ?, ?)",
        )
        .bind(t.name.clone())
        .bind(t.description.clone())
        .bind(t.width)
        .bind(t.length)
        .execute(&pool)
        .await
        .map_err(|e| format!("Failed to insert obstacle type: {}", e))?;
        type_ids.push(result.last_insert_rowid());
    }

    // 2. Seed point
    println!("📍 Insertion des points d'intérêt...");
    for p in points.iter() {
        let result = sqlx::query("INSERT INTO point (x, y) VALUES (?, ?)")
            .bind(p.x)
            .bind(p.y)
            .execute(&pool)
            .await
            .map_err(|e| format!("Failed to insert point: {}", e))?;
        point_ids.push(result.last_insert_rowid());
    }

    // 3. Seed comment
    println!("💬 Insertion des commentaires...");
    for c in comments_data.iter() {
        let point_id = *point_ids
            .get(c.point_idx)
            .ok_or("Invalid point index for comment")?;
        sqlx::query("INSERT INTO comment (point_id, value) VALUES (?, ?)")
            .bind(point_id)
            .bind(c.value)
            .execute(&pool)
            .await
            .map_err(|e| format!("Failed to insert comment: {}", e))?;
    }

    // 4. Seed picture
    println!("📸 Insertion des photos...");
    for i in pictures_data.iter() {
        let point_id = *point_ids
            .get(i.point_idx)
            .ok_or("Invalid point index for picture")?;
        sqlx::query("INSERT INTO picture (point_id, image) VALUES (?, ?)")
            .bind(point_id)
            .bind(i.image)
            .execute(&pool)
            .await
            .map_err(|e| format!("Failed to insert picture: {}", e))?;
    }

    // 5. Seed obstacle
    println!("🚧 Insertion des obstacles...");
    for o in obstacles_data.iter() {
        let point_id = *point_ids
            .get(o.point_idx)
            .ok_or("Invalid point index for obstacle")?;
        let type_id = *type_ids
            .get(o.type_idx)
            .ok_or("Invalid type index for obstacle")?;

        sqlx::query(
            "INSERT INTO obstacle (point_id, type_id, number, description) VALUES (?, ?, ?, ?)",
        )
        .bind(point_id)
        .bind(type_id)
        .bind(o.number)
        .bind(o.description.clone())
        .execute(&pool)
        .await
        .map_err(|e| format!("Failed to insert obstacle: {}", e))?;
    }

    // 6. Seed event
    println!("🎉 Insertion des événements...");
    for e in event_data.iter() {
        let result = sqlx::query(
            "INSERT INTO event (name, description, date_debut, date_fin, statut, geometry) VALUES (?, ?, ?, ?, ?, ?)"
        )
        .bind(e.name)
        .bind(e.description)
        .bind(e.date_debut)
        .bind(e.date_fin)
        .bind(e.statut)
        .bind(e.geometry)
        .execute(&pool)
        .await
        .map_err(|e| format!("Failed to insert event: {}", e))?;
        event_ids.push(result.last_insert_rowid());
    }

    // 7. Seed point_event (liaisons many-to-many)
    println!("🔗 Insertion des liaisons point-événement...");
    for pe in point_event_data.iter() {
        let point_id = *point_ids
            .get(pe.point_idx)
            .ok_or("Invalid point index for point_event")?;
        let event_id = *event_ids
            .get(pe.event_idx)
            .ok_or("Invalid event index for point_event")?;
        
        sqlx::query("INSERT INTO point_event (point_id, event_id) VALUES (?, ?)")
            .bind(point_id)
            .bind(event_id)
            .execute(&pool)
            .await
            .map_err(|e| format!("Failed to insert point_event: {}", e))?;
    }

    println!("✅ Seeding terminé avec succès !");
    println!("   - {} types d'obstacles", obstacle_types.len());
    println!("   - {} points d'intérêt", points.len());
    println!("   - {} commentaires", comments_data.len());
    println!("   - {} photos", pictures_data.len());
    println!("   - {} obstacles", obstacles_data.len());
    println!("   - {} événements", event_data.len());
    println!("   - {} liaisons point-événement", point_event_data.len());

    Ok(())
}
