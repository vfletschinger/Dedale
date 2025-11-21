// On importe les dépendances nécessaires
use sqlx::{SqlitePool, Row};
use sqlx::sqlite::{SqlitePoolOptions, SqliteConnectOptions};
use tauri_plugin_sql::{Builder, Migration, MigrationKind};
use tauri::{AppHandle, Manager};
use std::fs;
use std::str::FromStr;
use sqlx::Transaction;
use sqlx::Sqlite;
use serde::Deserialize;
use serde::Serialize;

// Elle renvoie le plugin SQL entièrement configuré
pub fn init_db() -> impl tauri::plugin::Plugin<tauri::Wry> {
    let migrations = vec![
        Migration {
            version: 1,
            description: "enable_foreign_keys",
            sql: "PRAGMA foreign_keys = ON;",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "create_all_tables",
            sql: "
                CREATE TABLE point (
                    id INTEGER PRIMARY KEY ,
                    x REAL,
                    y REAL
                );
                
                CREATE TABLE obstacle_type (
                    id INTEGER PRIMARY KEY,
                    name TEXT,
                    description TEXT,
                    width REAL,
                    length REAL
                );

                CREATE TABLE comment (
                    id INTEGER PRIMARY KEY,
                    point_id INTEGER,
                    value TEXT,
                    FOREIGN KEY (point_id) REFERENCES point (id)
                );

                CREATE TABLE picture (
                    id INTEGER PRIMARY KEY,
                    point_id INTEGER,
                    image TEXT,
                    FOREIGN KEY (point_id) REFERENCES point (id)
                );

                CREATE TABLE obstacle (
                    id INTEGER PRIMARY KEY,
                    point_id INTEGER,
                    type_id INTEGER,
                    number INTEGER,
                    FOREIGN KEY (point_id) REFERENCES point (id),
                    FOREIGN KEY (type_id) REFERENCES obstacle_type (id)
                );
            ",
            kind: MigrationKind::Up,
        },
    ];

    
    // On construit et renvoie le plugin
    Builder::default()
        .add_migrations("sqlite:mydatabase.db", migrations)
        .build()
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Point {
    pub id: i64,
    pub x: f64,
    pub y: f64,
    pub obstacles: Vec<Obstacle>,
    pub comments: Vec<Comment>,
    pub pictures: Vec<Picture>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ObstacleType {
    pub id: i64,
    pub name: String,
    pub description: String, 
    pub width: f64,
    pub length: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Obstacle {
    pub id: i32,
    pub point_id: i32,
    pub type_id: i32,
    pub number: i32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>, 
    #[serde(skip_serializing_if = "Option::is_none")]
    pub width: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub length: Option<f64>,
}

#[derive(Debug,Serialize, Deserialize)]
pub struct PointSimple {
    pub id: i32,     // Identifiant unique du point
    pub x: f64,      // Coordonnée X (ou latitude)
    pub y: f64,      // Coordonnée Y (ou longitude)
}

#[derive(Debug,Serialize, Deserialize)]
pub struct Comment {
    pub id: i32,          // Identifiant unique du commentaire
    pub point_id: i32,    // Lien vers le point auquel ce commentaire est attaché
    pub value: String,    // Le texte du commentaire
}

#[derive(Debug, Serialize)]
pub struct Obstacle_type {
    pub id: i64,
    pub name: String,
    pub description: String,
    pub width: f64,
    pub length: f64
}

#[derive(Debug, Deserialize)]
pub struct ObstacleInput {
    pub typeId: i64,
    pub number: i32,
    pub obstacleId: Option<i64>,
}

#[derive(Debug,Serialize, Deserialize)]
pub struct Picture {
    pub id: i32,          // Identifiant unique de l'image
    pub point_id: i32,    // Lien vers le point auquel cette image est attachée
    pub image: String,    // Le chemin ou le contenu encodé de l'image (ex: base64, URL)
}


#[derive(Debug, Serialize, Deserialize)]
pub struct PointDetail {
    pub point: PointSimple,  // Changed from Vec<PointSimple> to PointSimple
    #[serde(rename = "comments")]
    pub comment: Vec<Comment>,
    #[serde(rename = "pictures")]
    pub picture: Vec<Picture>, 
    #[serde(rename = "obstacles")]
    pub obstacle: Vec<Obstacle>,
}
pub async fn get_db_pool(app: &AppHandle) -> Result<SqlitePool, String> {
    let app_data_dir = app.path()
        .app_data_dir()
        .map_err(|e| format!("Failed to find app data directory: {}", e))?;

    fs::create_dir_all(&app_data_dir)
        .map_err(|e| format!("Failed to create app data directory: {}", e))?;

    let db_path = app_data_dir.join("mydatabase.db");

    let db_url = format!("sqlite:{}", db_path.to_str()
        .ok_or_else(|| "Failed to convert DB path to string.".to_string())?);

    let connect_options = SqliteConnectOptions::from_str(&db_url)
        .map_err(|e| format!("Failed to parse DB URL: {}", e))?
        .create_if_missing(true);

    SqlitePoolOptions::new()
        .connect_with(connect_options)
        .await
        .map_err(|e| format!("Failed to connect to database: {}", e))
}

async fn fetch_comments(pool: &SqlitePool, point_id: i64) -> Result<Vec<Comment>, String> {
    let rows = sqlx::query("SELECT id, point_id, value FROM comment WHERE point_id = ?")
        .bind(point_id)
        .fetch_all(pool)
        .await
        .map_err(|e| e.to_string())?;

    let comments = rows.into_iter().map(|row| Comment {
        id: row.get("id"),
        point_id: row.get("point_id"),
        value: row.get("value")
    }).collect();

    Ok(comments)
}

async fn fetch_pictures(pool: &SqlitePool, point_id: i64) -> Result<Vec<Picture>, String> {
    let rows = sqlx::query("SELECT id, image, point_id FROM picture WHERE point_id = ?")
        .bind(point_id)
        .fetch_all(pool)
        .await
        .map_err(|e| e.to_string())?;

    let pictures = rows.into_iter().map(|row| Picture {
        id: row.get("id"),
        image: row.get("image"),
        point_id: row.get("point_id")
    }).collect();

    Ok(pictures)
}

async fn fetch_obstacles(pool: &SqlitePool, point_id: i64) -> Result<Vec<Obstacle>, String> {
    let query = r#"
        SELECT 
            o.id, 
            o.point_id,
            o.type_id,
            o.number, 
            ot.name,
            ot.description,
            ot.width,
            ot.length
        FROM obstacle o
        JOIN obstacle_type ot ON o.type_id = ot.id
        WHERE o.point_id = ?
    "#;

    let rows = sqlx::query(query)
        .bind(point_id)
        .fetch_all(pool)
        .await
        .map_err(|e| e.to_string())?;

    let obstacles = rows.into_iter().map(|row| Obstacle {
        id: row.get("id"),
        point_id: row.get("point_id"),
        type_id: row.get("type_id"),
        number: row.get("number"),
        name: row.get("name"),
        description: row.get("description"),
        width: row.get("width"),
        length: row.get("length"),
    }).collect();

    Ok(obstacles)
}

#[tauri::command]
pub async fn fetch_obstacle_types(app: AppHandle) -> Result<Vec<Obstacle_type>, String> {
    let pool = get_db_pool(&app).await?;
    
    let rows = sqlx::query("SELECT id, name, description, width, length FROM obstacle_type")
        .fetch_all(&pool)
        .await
        .map_err(|e| e.to_string())?;

    let obstacles = rows.into_iter().map(|row| Obstacle_type {
        id: row.get("id"),
        name: row.get("name"),
        description: row.get("description"),
        width: row.get("width"),
        length: row.get("length"),
    }).collect();

    Ok(obstacles)
}

#[tauri::command]
pub async fn insert_obstacles(
    app: AppHandle,
    point_id: i64,
    obstacles: Vec<ObstacleInput>,
) -> Result<(), String> {
    let pool = get_db_pool(&app).await?;

    for obstacle in obstacles {
        if let Some(id) = obstacle.obstacleId {
            if obstacle.number == 0 {
                // Supprimer l'obstacle si le nombre est 0
                sqlx::query("DELETE FROM obstacle WHERE id = ?")
                    .bind(id)
                    .execute(&pool)
                    .await
                    .map_err(|e| format!("Failed to delete obstacle: {}", e))?;
            } else {
                // Mettre à jour le nombre
                sqlx::query("UPDATE obstacle SET number = ? WHERE id = ?")
                    .bind(obstacle.number)
                    .bind(id)
                    .execute(&pool)
                    .await
                    .map_err(|e| format!("Failed to update obstacle: {}", e))?;
            }
        } else if obstacle.number > 0 {
            // Insérer seulement si le nombre est > 0
            sqlx::query(
                "INSERT INTO obstacle (point_id, type_id, number) VALUES (?, ?, ?)"
            )
            .bind(point_id)
            .bind(obstacle.typeId)
            .bind(obstacle.number)
            .execute(&pool)
            .await
            .map_err(|e| format!("Failed to insert obstacle: {}", e))?;
        }
    }

    println!("✅ Successfully inserted/updated obstacles for point {}", point_id);
    Ok(())
}

// Récupère tous les points avec leurs obstacles
pub async fn retrieve_data(app: &AppHandle) -> Result<Vec<Point>, String> {
    let pool = get_db_pool(app).await?;
    let query = r#"
        SELECT
        p.id,
        p.x,
        p.y
    FROM point p
    ORDER BY p.id
    "#;

    let base_rows = sqlx::query(query)
        .fetch_all(&pool)
        .await
        .map_err(|e| e.to_string())?;

    let mut points: Vec<Point> = Vec::new();
    
    for row in base_rows {
        let id: i64 = row.get("id");
        
        let comments = fetch_comments(&pool, id).await?;
        let pictures = fetch_pictures(&pool, id).await?;
        let obstacles = fetch_obstacles(&pool, id).await?;

        points.push(Point {
            id: id,
            x: row.get("x"),
            y: row.get("y"),
            obstacles,
            comments,
            pictures,
        });
    }

    Ok(points)
}

#[tauri::command]
pub async fn insert_point_details(
    app: &AppHandle,
    details: Vec<PointDetail>,
) -> Result<(), String> {

    println!("[DB] 🚀 Début de l'insertion de {} PointDetail(s)", details.len());

    let pool = get_db_pool(app).await?;
    let mut tx: Transaction<Sqlite> = pool
        .begin()
        .await
        .map_err(|e| format!("Erreur au démarrage de la transaction : {}", e))?;

    println!("[DB] ✓ Transaction démarrée");

    // ÉTAPE 1: Insérer tous les points d'abord
    println!("[DB] 📍 Insertion des points...");
    for detail in &details {
        println!("[DB]   → Point ID: {}, x: {}, y: {}", detail.point.id, detail.point.x, detail.point.y);
        sqlx::query(
            r#"INSERT OR REPLACE INTO point (id, x, y) VALUES (?, ?, ?)"#
        )
        .bind(detail.point.id)
        .bind(detail.point.x)
        .bind(detail.point.y)
        .execute(&mut *tx)
        .await
        .map_err(|e| format!("Erreur INSERT/REPLACE point ID {} : {}", detail.point.id, e))?;
    }
    println!("[DB] ✓ Tous les points insérés");

    // ÉTAPE 2: Insérer les données liées
    println!("[DB] 💬 Insertion des commentaires...");
    for detail in &details {
        for comment in &detail.comment {
            println!("[DB]   → Comment ID: {}, point_id: {}, value: {:?}", comment.id, comment.point_id, &comment.value[..comment.value.len().min(30)]);
            sqlx::query(
                r#"INSERT OR REPLACE INTO comment (id, point_id, value) VALUES (?, ?, ?)"#
            )
            .bind(comment.id)
            .bind(comment.point_id)
            .bind(&comment.value)
            .execute(&mut *tx)
            .await
            .map_err(|e| format!("Erreur INSERT/REPLACE comment ID {} : {}", comment.id, e))?;
        }
    }
    println!("[DB] ✓ Tous les commentaires insérés");

    println!("[DB] 📸 Insertion des images...");
    for detail in &details {
        for picture in &detail.picture {
            println!("[DB]   → Picture ID: {}, point_id: {}, taille: {} bytes", picture.id, picture.point_id, picture.image.len());
            sqlx::query(
                r#"INSERT OR REPLACE INTO picture (id, point_id, path) VALUES (?, ?, ?)"#
            )
            .bind(picture.id)
            .bind(picture.point_id)
            .bind(&picture.image)
            .execute(&mut *tx)
            .await
            .map_err(|e| format!("Erreur INSERT/REPLACE picture ID {} : {}", picture.id, e))?;
        }
    }
    println!("[DB] ✓ Toutes les images insérées");

    println!("[DB] 🚧 Insertion des obstacle_types et obstacles...");
    for detail in &details {
        for obstacle in &detail.obstacle {
            println!("[DB]   → Obstacle ID: {}, point_id: {}, type_id: {}, nombre: {}", 
                obstacle.id, obstacle.point_id, obstacle.type_id, obstacle.number);
            
            // Si l'obstacle a des données de type (name, description, width, length), 
            // on l'insère dans obstacle_type
            if obstacle.name.is_some() || obstacle.description.is_some() || 
               obstacle.width.is_some() || obstacle.length.is_some() {
                println!("[DB]     → Insertion/vérification obstacle_type ID: {}", obstacle.type_id);
                sqlx::query(
                    r#"INSERT OR IGNORE INTO obstacle_type (id, name, description, width, length) 
                       VALUES (?, ?, ?, ?, ?)"#
                )
                .bind(obstacle.type_id)
                .bind(obstacle.name.as_ref().unwrap_or(&"Unknown".to_string()))
                .bind(obstacle.description.as_ref().unwrap_or(&"".to_string()))
                .bind(obstacle.width.unwrap_or(0.0))
                .bind(obstacle.length.unwrap_or(0.0))
                .execute(&mut *tx)
                .await
                .map_err(|e| format!("Erreur INSERT obstacle_type ID {} : {}", obstacle.type_id, e))?;
            }
            
            // Insérer l'obstacle lui-même
            sqlx::query(
                r#"INSERT OR REPLACE INTO obstacle (id, point_id, type_id, number) VALUES (?, ?, ?, ?)"#
            )
            .bind(obstacle.id)
            .bind(obstacle.point_id)
            .bind(obstacle.type_id)
            .bind(obstacle.number)
            .execute(&mut *tx)
            .await
            .map_err(|e| format!("Erreur INSERT/REPLACE obstacle ID {} (point_id: {}, type_id: {}) : {}", 
                obstacle.id, obstacle.point_id, obstacle.type_id, e))?;
        }
    }
    println!("[DB] ✓ Tous les obstacles et types insérés");

    println!("[DB] 💾 Validation de la transaction...");
    tx.commit()
        .await
        .map_err(|e| format!("Erreur à la validation (commit) de la transaction : {}", e))?;

    println!("[DB] ✅ Transaction validée avec succès !");

    Ok(())
}
pub async fn insert_test_data(app: &AppHandle) -> Result<(), String> {
    let pool = get_db_pool(app).await?;

    // --- 0. (Optional but recommended) Cleanup old data ---
    // (Ensure you run this if you haven't adopted the cleanup method)
    // DELETE FROM obstacle;
    // DELETE FROM comment;
    // DELETE FROM picture;
    // DELETE FROM point;
    // DELETE FROM obstacle_type;

    // --- 1. Insert obstacle_type data and get their starting ID ---
    let obstacle_types_query = r#"
        INSERT INTO obstacle_type (name, description, width, length) VALUES
        ('Rock', 'A large, immovable stone.', 1.5, 1.0),
        ('Tree Stump', 'A remnant of a cut-down tree.', 0.5, 0.5),
        ('Water Puddle', 'A collection of standing water.', 2.0, 3.0);
    "#;
    sqlx::query(obstacle_types_query)
        .execute(&pool)
        .await
        .map_err(|e| format!("Failed to insert obstacle_type test data: {}", e))?;
    
    // Get the ID of the first inserted obstacle_type (assuming sequential insertion)
    let type_start_id: i64 = sqlx::query("SELECT id FROM obstacle_type ORDER BY id LIMIT 1")
        .fetch_one(&pool)
        .await
        .map_err(|e| format!("Failed to get obstacle_type start ID: {}", e))?
        .get("id");

    // --- 2. Insert Point data and get their starting ID ---
    let points_query = r#"
        INSERT INTO point (x, y) VALUES
        (10.5, 20.1),
        (55.0, 80.0),
        (1.2, 5.8);
    "#;
    sqlx::query(points_query)
        .execute(&pool)
        .await
        .map_err(|e| format!("Failed to insert point test data: {}", e))?;

    // Get the ID of the first inserted point
    let point_start_id: i64 = sqlx::query("SELECT id FROM point ORDER BY id LIMIT 1")
        .fetch_one(&pool)
        .await
        .map_err(|e| format!("Failed to get point start ID: {}", e))?
        .get("id");
    
    // Calculate IDs based on the starting IDs:
    // P1 = point_start_id, P2 = point_start_id + 1, P3 = point_start_id + 2
    // T1 = type_start_id, T2 = type_start_id + 1, T3 = type_start_id + 2
    
    // --- 3. Insert Comment and Picture data (linking logic omitted for brevity, but needed) ---
    // If you need to link comments/pictures, you'll need a similar process to get the IDs.
    // However, the error is specifically on the obstacle table, so we focus there.

    // --- 4. Insert Obstacle data (linked dynamically) ---
    let obstacles_query = format!(
        r#"
            INSERT INTO obstacle (point_id, type_id, number) VALUES
            ({}, {}, 3), 
            ({}, {}, 1), 
            ({}, {}, 1), 
            ({}, {}, 1); 
        "#,
        // Point 1 (P1): point_start_id, Type 1 (T1): type_start_id
        point_start_id, type_start_id,
        // Point 2 (P2): point_start_id + 1, Type 2 (T2): type_start_id + 1
        point_start_id + 1, type_start_id + 1,
        // Point 2 (P2): point_start_id + 1, Type 3 (T3): type_start_id + 2
        point_start_id + 1, type_start_id + 2,
        // Point 3 (P3): point_start_id + 2, Type 1 (T1): type_start_id
        point_start_id + 2, type_start_id
    );

    sqlx::query(&obstacles_query)
        .execute(&pool)
        .await
        .map_err(|e| format!("Failed to insert obstacle test data: {}", e))?;

    println!("✅ Successfully inserted test data into the database.");
    
    Ok(())
}
