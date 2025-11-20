use sqlx::{SqlitePool, Row};
use tauri::AppHandle;
use crate::db::get_db_pool;
use crate::seed;
// Assuming this function is accessible (defined in db.rs or similar)
// pub async fn get_db_pool(app: &AppHandle) -> Result<SqlitePool, String> { ... }


// --- Helper Structs for Seeding Data ---
struct ObstacleTypeSeed { name: &'static str, description: &'static str, width: f64, length: f64 }
struct PointSeed { x: f64, y: f64 }
struct CommentSeed { point_idx: usize, value: &'static str }
struct PictureSeed { point_idx: usize, image: &'static str }
struct ObstacleSeed { point_idx: usize, type_idx: usize, number: i32 }


/// Seeds the database with sample data if it's currently empty.
#[tauri::command]
pub async fn seed_database(app: &AppHandle) -> Result<(), String> {
    
    println!("🌱 Début du seeding...");

    let pool = get_db_pool(&app).await?;
    let query = r#"
        SELECT
        count(*)
        FROM point
    "#;

    let (existing_points,): (i64,) = sqlx::query_as(query)
        .fetch_one(&pool)
        .await
        .map_err(|e| e.to_string())?;

    if existing_points > 0 {
        println!("⚠️ Des données existent déjà, seeding annulé.");
        return Ok(());
    }

    // --- Data Definitions ---
    let obstacle_types = [
        ObstacleTypeSeed { name: "Arbre", description: "Arbre sur le parcours", width: 0.5, length: 0.5 },
        ObstacleTypeSeed { name: "Rocher", description: "Rocher bloquant", width: 1.0, length: 1.0 },
        ObstacleTypeSeed { name: "Barrière", description: "Barrière métallique", width: 2.0, length: 0.1 },
        ObstacleTypeSeed { name: "Panneau", description: "Panneau de signalisation", width: 0.8, length: 0.05 },
        ObstacleTypeSeed { name: "Poubelle", description: "Conteneur à déchets", width: 0.6, length: 0.6 },
    ];
    let points = [
        PointSeed { y: 7.7521, x: 48.5734 },
        PointSeed { y: 7.7350, x: 48.5850 },
        PointSeed { y: 7.7580, x: 48.5920 },
        PointSeed { y: 7.7420, x: 48.5680 },
        PointSeed { y: 7.7650, x: 48.5790 },
    ];
    let comments_data = [
        CommentSeed { point_idx: 0, value: "Zone très fréquentée, attention aux piétons" },
        CommentSeed { point_idx: 0, value: "Passage étroit, ralentir" },
        CommentSeed { point_idx: 1, value: "Belle vue sur la cathédrale" },
        CommentSeed { point_idx: 2, value: "Travaux en cours, détour possible" },
        CommentSeed { point_idx: 3, value: "Point de repos avec bancs" },
        CommentSeed { point_idx: 4, value: "Attention au verglas en hiver" },
    ];
    let pictures_data = [
        PictureSeed { point_idx: 0, image: "/images/point1_photo1.jpg" },
        PictureSeed { point_idx: 0, image: "/images/point1_photo2.jpg" },
        PictureSeed { point_idx: 1, image: "/images/point2_photo1.jpg" },
        PictureSeed { point_idx: 2, image: "/images/point3_photo1.jpg" },
        PictureSeed { point_idx: 4, image: "/images/point5_photo1.jpg" },
    ];
    let obstacles_data = [
        ObstacleSeed { point_idx: 0, type_idx: 0, number: 2 }, // Point 1: 2 Arbre
        ObstacleSeed { point_idx: 0, type_idx: 4, number: 1 }, // Point 1: 1 Poubelle
        ObstacleSeed { point_idx: 1, type_idx: 2, number: 1 }, // Point 2: 1 Barrière
        ObstacleSeed { point_idx: 2, type_idx: 1, number: 3 }, // Point 3: 3 Rocher
        ObstacleSeed { point_idx: 3, type_idx: 3, number: 2 }, // Point 4: 2 Panneau
        ObstacleSeed { point_idx: 4, type_idx: 0, number: 5 }, // Point 5: 5 Arbre
    ];

    let mut point_ids: Vec<i64> = Vec::new();
    let mut type_ids: Vec<i64> = Vec::new();

    // 2. Seed obstacle_type
    println!("📦 Insertion des types d'obstacles...");
    for t in obstacle_types.iter() {
        let result = sqlx::query(
            "INSERT INTO obstacle_type (name, description, width, length) VALUES (?, ?, ?, ?)"
        )
        .bind(t.name)
        .bind(t.description)
        .bind(t.width)
        .bind(t.length)
        .execute(&pool)
        .await
        .map_err(|e| format!("Failed to insert obstacle type: {}", e))?;
        type_ids.push(result.last_insert_rowid());
    }

    // 3. Seed point
    println!("📍 Insertion des points d'intérêt...");
    for p in points.iter() {
        let result = sqlx::query(
            "INSERT INTO point (x, y) VALUES (?, ?)"
        )
        .bind(p.x)
        .bind(p.y)
        .execute(&pool)
        .await
        .map_err(|e| format!("Failed to insert point: {}", e))?;
        point_ids.push(result.last_insert_rowid());
    }

    // 4. Seed comment
    println!("💬 Insertion des commentaires...");
    for c in comments_data.iter() {
        let point_id = *point_ids.get(c.point_idx).ok_or("Invalid point index for comment")?;
        sqlx::query(
            "INSERT INTO comment (point_id, value) VALUES (?, ?)"
        )
        .bind(point_id)
        .bind(c.value)
        .execute(&pool)
        .await
        .map_err(|e| format!("Failed to insert comment: {}", e))?;
    }

    // 5. Seed picture
    println!("📸 Insertion des photos...");
    for i in pictures_data.iter() {
        let point_id = *point_ids.get(i.point_idx).ok_or("Invalid point index for picture")?;
        sqlx::query(
            "INSERT INTO picture (point_id, image) VALUES (?, ?)"
        )
        .bind(point_id)
        .bind(i.image)
        .execute(&pool)
        .await
        .map_err(|e| format!("Failed to insert picture: {}", e))?;
    }

    // 6. Seed obstacle
    println!("🚧 Insertion des obstacles...");
    for o in obstacles_data.iter() {
        let point_id = *point_ids.get(o.point_idx).ok_or("Invalid point index for obstacle (point)")?;
        let type_id = *type_ids.get(o.type_idx).ok_or("Invalid type index for obstacle (type)")?;
        
        // Note: The column is assumed to be 'number' based on previous context.
        sqlx::query(
            "INSERT INTO obstacle (point_id, type_id, number) VALUES (?, ?, ?)"
        )
        .bind(point_id)
        .bind(type_id)
        .bind(o.number)
        .execute(&pool)
        .await
        .map_err(|e| format!("Failed to insert obstacle: {}", e))?;
    }

    println!("✅ Seeding terminé avec succès !");
    println!("   - {} types d'obstacles", obstacle_types.len());
    println!("   - {} points d'intérêt", points.len());
    println!("   - {} commentaires", comments_data.len());
    println!("   - {} photos", pictures_data.len());
    println!("   - {} obstacles", obstacles_data.len());

    Ok(())
}