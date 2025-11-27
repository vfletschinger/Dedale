// On importe les dépendances nécessaires
use bcrypt::{hash, verify, DEFAULT_COST};
use serde::Deserialize;
use serde::Serialize;
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
use sqlx::Sqlite;
use sqlx::Transaction;
use sqlx::{Row, SqlitePool};
use std::fs;
use std::str::FromStr;
use tauri::{AppHandle, Manager};
use tauri_plugin_sql::{Builder, Migration, MigrationKind};

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

                CREATE TABLE user (
                    id INTEGER PRIMARY KEY,
                    username TEXT,
                    password_hash TEXT,
                    role TEXT
                );
            ",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "create_point_event_table",
            sql: "
                CREATE TABLE point_event (
                    id INTEGER PRIMARY KEY,
                    point_id INTEGER NOT NULL,
                    event_id INTEGER NOT NULL,
                    FOREIGN KEY (point_id) REFERENCES point(id) ON DELETE CASCADE,
                    FOREIGN KEY (event_id) REFERENCES event(id) ON DELETE CASCADE,
                    UNIQUE(point_id, event_id)
                );
            ",
            kind: MigrationKind::Up,
        }
    ];

    println!("[DB] 🔧 Initialisation du plugin SQL...");
    println!("[DB] 📋 {} migration(s) définies", migrations.len());
    for m in &migrations {
        println!("[DB]   → Migration v{}: {}", m.version, m.description);
    }

    // On construit et renvoie le plugin
    // Note: Le chemin "sqlite:mydatabase.db" est relatif au app_data_dir de Tauri
    println!("[DB] 📂 Chemin de la base: sqlite:mydatabase.db");
    
    let plugin = Builder::default()
        .add_migrations("sqlite:mydatabase.db", migrations)
        .build();
    
    println!("[DB] ✅ Plugin SQL construit (les migrations s'exécuteront au premier accès JS)");
    
    plugin
}

#[derive(sqlx::FromRow, Debug, Serialize, Deserialize)]
pub struct User {
    pub id: i64,
    pub username: String,
    pub password_hash: String,
    pub role: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Point {
    pub id: i64,
    pub x: f64,
    pub y: f64,
    #[serde(default)]
    pub event_ids: Vec<i64>,
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

#[derive(Debug, Serialize, Deserialize)]
pub struct PointSimple {
    pub id: i32, 
    pub x: f64,  // Coordonnée X (ou latitude)
    pub y: f64,  // Coordonnée Y (ou longitude)
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Comment {
    pub id: i32,       // Identifiant unique du commentaire
    pub point_id: i32, // Lien vers le point auquel ce commentaire est attaché
    pub value: String, // Le texte du commentaire
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Picture {
    pub id: i32,       // Identifiant unique de l'image
    pub point_id: i32, // Lien vers le point auquel cette image est attachée
    pub image: String, // Le chemin ou le contenu encodé de l'image (ex: base64, URL)
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PointDetail {
    pub point: PointSimple, // Changed from Vec<PointSimple> to PointSimple
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

#[derive(Debug, Serialize, Deserialize)]
pub struct Event {
    #[serde(default)]
    pub id: i64,
    pub name: String,
    pub description: String,
    #[serde(rename = "dateDebut", alias = "dateDebut")]
    pub date_debut: String,
    #[serde(rename = "dateFin", alias = "dateFin")]
    pub date_fin: String,
    pub statut: String,
    pub geometry: String,
}



pub async fn get_db_pool(app: &AppHandle) -> Result<SqlitePool, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to find app data directory: {}", e))?;

    fs::create_dir_all(&app_data_dir)
        .map_err(|e| format!("Failed to create app data directory: {}", e))?;

    let db_path = app_data_dir.join("mydatabase.db");
    let db_path_str = db_path
        .to_str()
        .ok_or_else(|| "Failed to convert DB path to string.".to_string())?
        .to_string();

    let db_url = format!("sqlite:{}", db_path_str);

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

    let comments = rows
        .into_iter()
        .map(|row| Comment {
            id: row.get("id"),
            point_id: row.get("point_id"),
            value: row.get("value"),
        })
        .collect();

    Ok(comments)
}

async fn fetch_pictures(pool: &SqlitePool, point_id: i64) -> Result<Vec<Picture>, String> {
    let rows = sqlx::query("SELECT id, image, point_id FROM picture WHERE point_id = ?")
        .bind(point_id)
        .fetch_all(pool)
        .await
        .map_err(|e| e.to_string())?;

    let pictures = rows
        .into_iter()
        .map(|row| Picture {
            id: row.get("id"),
            image: row.get("image"),
            point_id: row.get("point_id"),
        })
        .collect();

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

    let obstacles = rows
        .into_iter()
        .map(|row| Obstacle {
            id: row.get("id"),
            point_id: row.get("point_id"),
            type_id: row.get("type_id"),
            number: row.get("number"),
            name: row.get("name"),
            description: row.get("description"),
            width: row.get("width"),
            length: row.get("length"),
        })
        .collect();

    Ok(obstacles)
}

async fn fetch_event_ids(pool: &SqlitePool, point_id: i64) -> Result<Vec<i64>, String> {
    let rows = sqlx::query("SELECT event_id FROM point_event WHERE point_id = ?")
        .bind(point_id)
        .fetch_all(pool)
        .await
        .map_err(|e| e.to_string())?;

    let event_ids = rows
        .into_iter()
        .map(|row| row.get("event_id"))
        .collect();

    Ok(event_ids)
}

#[tauri::command]
pub async fn fetch_obstacle_types(app: AppHandle) -> Result<Vec<ObstacleType>, String> {
    let pool = get_db_pool(&app).await?;

    let rows = sqlx::query("SELECT id, name, description, width, length FROM obstacle_type")
        .fetch_all(&pool)
        .await
        .map_err(|e| e.to_string())?;

    let obstacles = rows
        .into_iter()
        .map(|row| ObstacleType {
            id: row.get("id"),
            name: row.get("name"),
            description: row.get("description"),
            width: row.get("width"),
            length: row.get("length"),
        })
        .collect();

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
            sqlx::query("INSERT INTO obstacle (point_id, type_id, number) VALUES (?, ?, ?)")
                .bind(point_id)
                .bind(obstacle.type_id)
                .bind(obstacle.number)
                .execute(&pool)
                .await
                .map_err(|e| format!("Failed to insert obstacle: {}", e))?;
        }
    }
    Ok(())
}

// Récupère tous les points avec leurs obstacles
pub async fn retrieve_data(app: &AppHandle) -> Result<Vec<Point>, String> {
    retrieve_data_by_event(app, None).await
}

// Récupère les points filtrés par event_id (None = tous les points)
pub async fn retrieve_data_by_event(app: &AppHandle, event_id: Option<i64>) -> Result<Vec<Point>, String> {
    let pool = get_db_pool(app).await?;
    
    let base_rows = if let Some(eid) = event_id {
        println!("[DB] 🔍 Récupération des points pour l'event_id: {}", eid);
        sqlx::query(r#"
            SELECT DISTINCT p.id, p.x, p.y
            FROM point p
            INNER JOIN point_event pe ON p.id = pe.point_id
            WHERE pe.event_id = ?
            ORDER BY p.id
        "#)
        .bind(eid)
        .fetch_all(&pool)
        .await
        .map_err(|e| e.to_string())?
    } else {
        println!("[DB] 🔍 Récupération de tous les points");
        sqlx::query(r#"
            SELECT p.id, p.x, p.y
            FROM point p
            ORDER BY p.id
        "#)
        .fetch_all(&pool)
        .await
        .map_err(|e| e.to_string())?
    };

    let mut points: Vec<Point> = Vec::new();

    for row in base_rows {
        let id: i64 = row.get("id");

        let comments = fetch_comments(&pool, id).await?;
        let pictures = fetch_pictures(&pool, id).await?;
        let obstacles = fetch_obstacles(&pool, id).await?;
        let event_ids = fetch_event_ids(&pool, id).await?;

        points.push(Point {
            id: id,
            x: row.get("x"),
            y: row.get("y"),
            event_ids,
            obstacles,
            comments,
            pictures,
        });
    }

    println!("[DB] ✅ {} point(s) récupéré(s)", points.len());
    Ok(points)
}

#[tauri::command]
pub async fn insert_point_details(
    app: &AppHandle,
    details: Vec<PointDetail>,
) -> Result<Vec<i64>, String> {
    let pool = get_db_pool(app).await?;
    let mut tx: Transaction<Sqlite> = pool
        .begin()
        .await
        .map_err(|e| format!("Erreur au démarrage de la transaction : {}", e))?;

    // ÉTAPE 1: Insérer tous les points d'abord
    // We need to keep track of assigned IDs when frontend sends id==0 for new points
    let mut assigned_ids: Vec<i64> = Vec::with_capacity(details.len());
    for detail in &details {
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
        } else {
            // Respect provided id
            sqlx::query(r#"INSERT OR REPLACE INTO point (id, x, y) VALUES (?, ?, ?)"#)
                .bind(detail.point.id)
                .bind(detail.point.x)
                .bind(detail.point.y)
                .execute(&mut *tx)
                .await
                .map_err(|e| {
                    format!("Erreur INSERT/REPLACE point ID {} : {}", detail.point.id, e)
                })?;
            assigned_ids.push(detail.point.id as i64);
        }
    }
    // ÉTAPE 2: Insérer les données liées (commentaires)
    for (idx, detail) in details.iter().enumerate() {
        let assigned_point_id = assigned_ids[idx];
        for comment in &detail.comment {
            let point_id_to_use = if comment.point_id == 0 {
                assigned_point_id as i32
            } else {
                comment.point_id
            };
            sqlx::query(r#"INSERT OR REPLACE INTO comment (id, point_id, value) VALUES (?, ?, ?)"#)
                .bind(comment.id)
                .bind(point_id_to_use)
                .bind(&comment.value)
                .execute(&mut *tx)
                .await
                .map_err(|e| format!("Erreur INSERT/REPLACE comment ID {} : {}", comment.id, e))?;
        }
    }
    // images
    for (idx, detail) in details.iter().enumerate() {
        let assigned_point_id = assigned_ids[idx] as i32;
        for picture in &detail.picture {
            let point_id_to_use = if picture.point_id == 0 {
                assigned_point_id
            } else {
                picture.point_id
            };
            sqlx::query(r#"INSERT OR REPLACE INTO picture (id, point_id, image) VALUES (?, ?, ?)"#)
                .bind(picture.id)
                .bind(point_id_to_use)
                .bind(&picture.image)
                .execute(&mut *tx)
                .await
                .map_err(|e| format!("Erreur INSERT/REPLACE picture ID {} : {}", picture.id, e))?;
        }
    }
    // obstacles and types
    for (idx, detail) in details.iter().enumerate() {
        let assigned_point_id = assigned_ids[idx] as i64;
        for obstacle in &detail.obstacle {
            let point_id_to_use = if obstacle.point_id == 0 {
                assigned_point_id
            } else {
                obstacle.point_id
            };

            // Si l'obstacle a des données de type (name, description, width, length),
            // on l'insère dans obstacle_type
            if obstacle.name.is_some()
                || obstacle.description.is_some()
                || obstacle.width.is_some()
                || obstacle.length.is_some()
            {
                sqlx::query(
                    r#"INSERT OR IGNORE INTO obstacle_type (id, name, description, width, length) 
                       VALUES (?, ?, ?, ?, ?)"#,
                )
                .bind(obstacle.type_id)
                .bind(obstacle.name.as_ref().unwrap_or(&"Unknown".to_string()))
                .bind(obstacle.description.as_ref().unwrap_or(&"".to_string()))
                .bind(obstacle.width.unwrap_or(0.0))
                .bind(obstacle.length.unwrap_or(0.0))
                .execute(&mut *tx)
                .await
                .map_err(|e| {
                    format!(
                        "Erreur INSERT obstacle_type ID {} : {}",
                        obstacle.type_id, e
                    )
                })?;
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

    // Commit
    tx.commit()
        .await
        .map_err(|e| format!("Erreur à la validation (commit) de la transaction : {}", e))?;

    // transaction committed

    Ok(assigned_ids)
}

#[tauri::command]
pub async fn insert_point(app: tauri::AppHandle, details: Vec<PointDetail>, event_id: Option<i64>) -> Result<Vec<i64>, String> {
    println!("[DB] 📍 insert_point appelé avec {} point(s), event_id: {:?}", details.len(), event_id);
    for (i, d) in details.iter().enumerate() {
        println!("[DB]   Point {}: id={}, x={}, y={}", i, d.point.id, d.point.x, d.point.y);
        println!("[DB]   - {} commentaire(s), {} photo(s), {} obstacle(s)", 
            d.comment.len(), d.picture.len(), d.obstacle.len());
    }
    let result = insert_point_details(&app, details).await;
    match &result {
        Ok(ids) => {
            println!("[DB] ✅ Point(s) inséré(s) avec succès, IDs: {:?}", ids);
            // Lier les points à l'événement si event_id est fourni
            if let Some(eid) = event_id {
                let pool = get_db_pool(&app).await?;
                for point_id in ids {
                    println!("[DB] 🔗 Liaison automatique point {} → event {}", point_id, eid);
                    sqlx::query("INSERT OR IGNORE INTO point_event (point_id, event_id) VALUES (?, ?)")
                        .bind(*point_id)
                        .bind(eid)
                        .execute(&pool)
                        .await
                        .map_err(|e| format!("Failed to link point to event: {}", e))?;
                }
                println!("[DB] ✅ {} point(s) lié(s) à l'événement {}", ids.len(), eid);
            }
        },
        Err(e) => println!("[DB] ❌ Erreur insertion: {}", e),
    }
    result
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


#[tauri::command]
pub async fn fetch_events(app: AppHandle) -> Result<Vec<Event>, String> {
    println!("[DB] 🚀 Début de la récupération des événements depuis la base de données.");
    let pool = get_db_pool(&app).await?;
    
    // Vérifier si la table existe
    let table_check = sqlx::query("SELECT name FROM sqlite_master WHERE type='table' AND name='event';")
        .fetch_optional(&pool)
        .await
        .map_err(|e| format!("Erreur lors de la vérification de table: {}", e))?;
        
    if table_check.is_none() {
        return Err("La table 'event' n'existe pas. Veuillez redémarrer l'application pour exécuter les migrations.".to_string());
    }
    
    println!("[DB] ✅ Table 'event' existe.");
    
    let query = r#"
        SELECT 
            id,
            name,
            description,
            date_debut,
            date_fin,
            statut,
            geometry
        FROM event
    "#;

    let rows = sqlx::query(query)
        .fetch_all(&pool)
        .await
        .map_err(|e| {
            println!("[DB] ❌ Erreur lors de la requête SQL: {}", e);
            e.to_string()
        })?;

    println!("[DB] 📊 Récupéré {} événements de la base de données.", rows.len());

    let mut events: Vec<Event> = Vec::new();
    
    for row in rows {
        let event_id: i64 = row.get("id");
        println!("[DB]   → Traitement de l'événement ID: {}", event_id);
        
        // Récupérer les géométries pour cet événement

        events.push(Event {
            id: event_id,
            name: row.get("name"),
            description: row.get("description"),
            date_debut: row.get("date_debut"),
            date_fin: row.get("date_fin"),
            statut: row.get("statut"),
            geometry: row.get("geometry")
        });
    }

    println!("[DB] ✅ Récupération terminée avec succès. {} événements traités.", events.len());
    Ok(events)
}


#[tauri::command]
pub async fn insert_event(event: Event, app: AppHandle) -> Result<(), String> {
    println!("[DB] 🎉 Insertion d'un événement: {:?}", event);
    
    let pool = get_db_pool(&app).await?;

    sqlx::query(
            "INSERT INTO event (name, description, date_debut, date_fin, statut, geometry) VALUES (?, ?, ?, ?, ?, ?)"
        )
        .bind(&event.name)
        .bind(&event.description)
        .bind(&event.date_debut)
        .bind(&event.date_fin)
        .bind(&event.statut)
        .bind(&event.geometry)
        .execute(&pool)
        .await
        .map_err(|e| format!("Failed to insert event: {}", e))?;
    
    println!("[DB] ✅ Événement '{}' créé avec succès !", event.name);
    
    Ok(())
}

#[tauri::command]
pub async fn link_point_to_event(app: AppHandle, point_id: i64, event_id: i64) -> Result<(), String> {
    println!("[DB] 🔗 Liaison point {} → event {}", point_id, event_id);
    let pool = get_db_pool(&app).await?;

    sqlx::query("INSERT OR IGNORE INTO point_event (point_id, event_id) VALUES (?, ?)")
        .bind(point_id)
        .bind(event_id)
        .execute(&pool)
        .await
        .map_err(|e| format!("Failed to link point to event: {}", e))?;

    println!("[DB] ✅ Point {} lié à l'événement {}", point_id, event_id);
    Ok(())
}

#[tauri::command]
pub async fn unlink_point_from_event(app: AppHandle, point_id: i64, event_id: i64) -> Result<(), String> {
    println!("[DB] 🔓 Déliaison point {} ← event {}", point_id, event_id);
    let pool = get_db_pool(&app).await?;

    sqlx::query("DELETE FROM point_event WHERE point_id = ? AND event_id = ?")
        .bind(point_id)
        .bind(event_id)
        .execute(&pool)
        .await
        .map_err(|e| format!("Failed to unlink point from event: {}", e))?;

    println!("[DB] ✅ Point {} délié de l'événement {}", point_id, event_id);
    Ok(())
}

#[tauri::command]
pub async fn get_points_for_event(app: AppHandle, event_id: i64) -> Result<Vec<i64>, String> {
    let pool = get_db_pool(&app).await?;

    let rows = sqlx::query("SELECT point_id FROM point_event WHERE event_id = ?")
        .bind(event_id)
        .fetch_all(&pool)
        .await
        .map_err(|e| e.to_string())?;

    let point_ids: Vec<i64> = rows.into_iter().map(|row| row.get("point_id")).collect();
    Ok(point_ids)
}

#[tauri::command]
pub async fn delete_event(app: AppHandle, event_id: i64) -> Result<(), String> {
    let pool = get_db_pool(&app).await?;

    // Les liaisons point_event seront supprimées automatiquement grâce à ON DELETE CASCADE
    sqlx::query("DELETE FROM event WHERE id = ?")
        .bind(event_id)
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;

    println!("[DB] ✅ Événement {} supprimé", event_id);
    Ok(())
}

pub async fn is_first_launch(pool: &SqlitePool) -> sqlx::Result<bool> {
    let (count,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM user")
        .fetch_one(pool)
        .await?;
    Ok(count == 0)
}

pub async fn create_initial_admin(
    pool: &SqlitePool,
    username: &str,
    password: &str,
) -> sqlx::Result<()> {
    let password_hash = hash(password, DEFAULT_COST).expect("Erreur hash mot de passe");

    sqlx::query(
        "
        INSERT INTO user (username, password_hash, role)
        VALUES (?, ?, ?)
    ",
    )
    .bind(username)
    .bind(password_hash)
    .bind("admin")
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn get_user_by_username(pool: &SqlitePool, username: &str) -> sqlx::Result<Option<User>> {
    let user = sqlx::query_as::<_, User>("SELECT * FROM user WHERE username = ?")
        .bind(username)
        .fetch_optional(pool)
        .await?;

    Ok(user)
}

/// Ensure the core database schema exists (idempotent).
pub async fn ensure_schema(pool: &SqlitePool) -> Result<(), String> {
    // CREATE TABLE IF NOT EXISTS for all required tables
    let stmts = vec![
        r#"CREATE TABLE IF NOT EXISTS point (
            id INTEGER PRIMARY KEY,
            x REAL,
            y REAL
        );"#,
        r#"CREATE TABLE IF NOT EXISTS obstacle_type (
            id INTEGER PRIMARY KEY,
            name TEXT,
            description TEXT,
            width REAL,
            length REAL
        );"#,
        r#"CREATE TABLE IF NOT EXISTS comment (
            id INTEGER PRIMARY KEY,
            point_id INTEGER,
            value TEXT,
            FOREIGN KEY (point_id) REFERENCES point (id)
        );"#,
        r#"CREATE TABLE IF NOT EXISTS picture (
            id INTEGER PRIMARY KEY,
            point_id INTEGER,
            image TEXT,
            FOREIGN KEY (point_id) REFERENCES point (id)
        );"#,
        r#"CREATE TABLE IF NOT EXISTS obstacle (
            id INTEGER PRIMARY KEY,
            point_id INTEGER,
            type_id INTEGER,
            number INTEGER,
            description TEXT,
            FOREIGN KEY (point_id) REFERENCES point (id),
            FOREIGN KEY (type_id) REFERENCES obstacle_type (id)
        );"#,
        r#"CREATE TABLE IF NOT EXISTS user (
            id INTEGER PRIMARY KEY,
            username TEXT,
            password_hash TEXT,
            role TEXT
        );"#,
    ];

    for s in stmts {
        sqlx::query(s)
            .execute(pool)
            .await
            .map_err(|e| format!("Failed to ensure schema: {}", e))?;
    }

    Ok(())
}

// --- Tauri command wrappers for frontend ---
#[tauri::command]
pub async fn is_first_launch_cmd(app: AppHandle) -> Result<bool, String> {
    let pool = get_db_pool(&app).await?;
    is_first_launch(&pool).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_initial_admin_cmd(
    app: AppHandle,
    username: String,
    password: String,
) -> Result<(), String> {
    let pool = get_db_pool(&app).await?;
    create_initial_admin(&pool, &username, &password)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn verify_credentials_cmd(
    app: AppHandle,
    username: String,
    password: String,
) -> Result<bool, String> {
    let pool = get_db_pool(&app).await?;
    match get_user_by_username(&pool, &username)
        .await
        .map_err(|e| e.to_string())?
    {
        Some(user) => Ok(verify(&password, &user.password_hash).unwrap_or(false)),
        None => Ok(false),
    }
}
