// On importe les dépendances nécessaires
use sqlx::{SqlitePool, Row};
use sqlx::sqlite::{SqlitePoolOptions, SqliteConnectOptions};
use tauri_plugin_sql::{Builder, Migration, MigrationKind};
use tauri::{AppHandle, Manager};
use std::fs;
use std::str::FromStr;
use sqlx::Transaction;
use sqlx::Sqlite;
use serde::Serialize;
use serde::Deserialize;

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
                    description TEXT,
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
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    pub number: Option<i32>,
    pub point_id: i64,
    pub type_id: i64,
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

#[derive(Debug, Deserialize)]
pub struct ObstacleInput {
    pub type_id: i64,
    pub number: i32,
    pub obstacle_id: Option<i64>,
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
    let rows = sqlx::query("SELECT id, value, point_id FROM comment WHERE point_id = ?")
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
            ot.name AS name,
            ot.description AS description,
            ot.width AS width,
            ot.length AS length
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
pub async fn fetch_obstacle_types(app: AppHandle) -> Result<Vec<ObstacleType>, String> {
    let pool = get_db_pool(&app).await?;
    
    let rows = sqlx::query("SELECT id, name, description, width, length FROM obstacle_type")
        .fetch_all(&pool)
        .await
        .map_err(|e| e.to_string())?;

    let obstacles = rows.into_iter().map(|row| ObstacleType {
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
        if let Some(id) = obstacle.obstacle_id {
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
            .bind(obstacle.type_id)
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
    // We need to keep track of assigned IDs when frontend sends id==0 for new points
    let mut assigned_ids: Vec<i64> = Vec::with_capacity(details.len());
    for detail in &details {
        println!("[DB]   → Point ID: {}, x: {}, y: {}", detail.point.id, detail.point.x, detail.point.y);
        if detail.point.id == 0 {
            // Insert without specifying id so SQLite assigns a rowid
            sqlx::query(r#"INSERT INTO point (x, y) VALUES (?, ?)"#)
                .bind(detail.point.x)
                .bind(detail.point.y)
                .execute(&mut *tx)
                .await
                .map_err(|e| format!("Erreur INSERT point (auto-id) : {}", e))?;

            // retrieve last inserted id for this transaction
            let row = sqlx::query("SELECT last_insert_rowid() as id")
                .fetch_one(&mut *tx)
                .await
                .map_err(|e| format!("Erreur récupération last_insert_rowid: {}", e))?;
            let new_id: i64 = row.get("id");
            assigned_ids.push(new_id);
            println!("[DB]     → Nouveau point id assigné: {}", new_id);
        } else {
            // Respect provided id
            sqlx::query(r#"INSERT OR REPLACE INTO point (id, x, y) VALUES (?, ?, ?)"#)
                .bind(detail.point.id)
                .bind(detail.point.x)
                .bind(detail.point.y)
                .execute(&mut *tx)
                .await
                .map_err(|e| format!("Erreur INSERT/REPLACE point ID {} : {}", detail.point.id, e))?;
            assigned_ids.push(detail.point.id as i64);
        }
    }
    println!("[DB] ✓ Tous les points insérés");

    // ÉTAPE 2: Insérer les données liées
    println!("[DB] 💬 Insertion des commentaires...");
    for (idx, detail) in details.iter().enumerate() {
        let assigned_point_id = assigned_ids[idx];
        for comment in &detail.comment {
            let point_id_to_use = if comment.point_id == 0 { assigned_point_id as i32 } else { comment.point_id };
            println!("[DB]   → Comment ID: {}, point_id: {}, value: {:?}", comment.id, point_id_to_use, &comment.value[..comment.value.len().min(30)]);
            sqlx::query(r#"INSERT OR REPLACE INTO comment (id, point_id, value) VALUES (?, ?, ?)"#)
                .bind(comment.id)
                .bind(point_id_to_use)
                .bind(&comment.value)
                .execute(&mut *tx)
                .await
                .map_err(|e| format!("Erreur INSERT/REPLACE comment ID {} : {}", comment.id, e))?;
        }
    }
    println!("[DB] ✓ Tous les commentaires insérés");

    println!("[DB] 📸 Insertion des images...");
    for (idx, detail) in details.iter().enumerate() {
        let assigned_point_id = assigned_ids[idx] as i32;
        for picture in &detail.picture {
            let point_id_to_use = if picture.point_id == 0 { assigned_point_id } else { picture.point_id };
            println!("[DB]   → Picture ID: {}, point_id: {}, taille: {} bytes", picture.id, point_id_to_use, picture.image.len());
            sqlx::query(r#"INSERT OR REPLACE INTO picture (id, point_id, image) VALUES (?, ?, ?)"#)
                .bind(picture.id)
                .bind(point_id_to_use)
                .bind(&picture.image)
                .execute(&mut *tx)
                .await
                .map_err(|e| format!("Erreur INSERT/REPLACE picture ID {} : {}", picture.id, e))?;
        }
    }
    println!("[DB] ✓ Toutes les images insérées");

    println!("[DB] 🚧 Insertion des obstacle_types et obstacles...");
    for (idx, detail) in details.iter().enumerate() {
        let assigned_point_id = assigned_ids[idx] as i64;
        for obstacle in &detail.obstacle {
            let point_id_to_use = if obstacle.point_id == 0 { assigned_point_id } else { obstacle.point_id };
            println!("[DB]   → Obstacle ID: {}, point_id: {}, type_id: {}, nombre: {}", 
                obstacle.id, point_id_to_use, obstacle.type_id, obstacle.number.unwrap_or(0));
            
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
            sqlx::query(r#"INSERT OR REPLACE INTO obstacle (id, point_id, type_id, number) VALUES (?, ?, ?, ?)"#)
                .bind(obstacle.id)
                .bind(point_id_to_use)
                .bind(obstacle.type_id)
                .bind(obstacle.number)
                .execute(&mut *tx)
                .await
                .map_err(|e| format!("Erreur INSERT/REPLACE obstacle ID {} (point_id: {}, type_id: {}) : {}", 
                    obstacle.id, point_id_to_use, obstacle.type_id, e))?;
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

#[tauri::command]
pub async fn insert_point(
    app: tauri::AppHandle,
    details: Vec<PointDetail>,
) -> Result<(), String> {

    // Réutilisation de la version WebSocket existante
    insert_point_details(&app, details).await
}


#[tauri::command]
pub async fn delete_point(app: AppHandle, point_id: i64) -> Result<(), String> {
    let pool = get_db_pool(&app).await?;

    // Start a transaction and remove dependent rows first to keep DB consistent
    let mut tx: Transaction<Sqlite> = pool
        .begin()
        .await
        .map_err(|e| format!("Failed to start transaction: {}", e))?;

    sqlx::query("DELETE FROM comment WHERE point_id = ?")
        .bind(point_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| format!("Failed to delete comments: {}", e))?;

    sqlx::query("DELETE FROM picture WHERE point_id = ?")
        .bind(point_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| format!("Failed to delete pictures: {}", e))?;

    sqlx::query("DELETE FROM obstacle WHERE point_id = ?")
        .bind(point_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| format!("Failed to delete obstacles: {}", e))?;

    sqlx::query("DELETE FROM point WHERE id = ?")
        .bind(point_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| format!("Failed to delete point: {}", e))?;

    tx.commit()
        .await
        .map_err(|e| format!("Failed to commit transaction: {}", e))?;

    println!("✅ Successfully deleted point {}", point_id);
    Ok(())
}