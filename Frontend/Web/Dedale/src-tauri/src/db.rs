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
                    path TEXT,
                    FOREIGN KEY (point_id) REFERENCES point (id)
                );

                CREATE TABLE obstacles (
                    id INTEGER PRIMARY KEY,
                    point_id INTEGER,
                    type_id INTEGER,
                    nombre INTEGER,
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

#[derive(Debug)]
pub struct Point {
    pub id: i64,
    pub x: f64,
    pub y: f64,
    pub obstacle_nom: Option<String>,
    pub obstacle_description: Option<String>,
    pub nombre: Option<i32>,
    pub obstacle_largeur: Option<f64>,
    pub obstacle_longueur: Option<f64>,
}
#[derive(Debug,Serialize, Deserialize)]
pub struct PointSimple {
    pub id: i32,     // Identifiant unique du point
    pub x: f64,      // Coordonnée X (ou latitude)
    pub y: f64,      // Coordonnée Y (ou longitude)
    // Vous pouvez ajouter d'autres champs de point ici (ex: name, description)
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
#[derive(Debug,Serialize, Deserialize)]
pub struct Obstacle {
    pub id: i32,          // Identifiant unique de l'obstacle
    pub point_id: i32,    // Lien vers le point auquel cet obstacle est attaché
    pub type_id: i32,     // Le type d'obstacle (ex: 1 pour "pente", 2 pour "escalier")
    pub number: i32,      // Un champ numérique lié à l'obstacle (ex: nombre de marches)
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


// Récupère tous les points avec leurs obstacles
pub async fn retrieve_data(app: &AppHandle) -> Result<Vec<Point>, String> {
    let pool = get_db_pool(app).await?;
    let query = r#"
        SELECT
        p.id AS point_id,
        p.x,
        p.y,
        ot.name AS obstacle_nom,
        ot.description AS obstacle_description,
        o.nombre,
        ot.width AS obstacle_largeur,
        ot.length AS obstacle_longueur
    FROM point p
    LEFT JOIN obstacles o ON o.point_id = p.id
    LEFT JOIN obstacle_type ot ON o.type_id = ot.id
    ORDER BY p.id
    "#;

    let rows = sqlx::query(query)
        .fetch_all(&pool)
        .await
        .map_err(|e| e.to_string())?;

    let points = rows.into_iter().map(|row| Point {
        id: row.get("point_id"),
        x: row.get("x"),
        y: row.get("y"),
        obstacle_nom: row.try_get("obstacle_nom").ok(),
        obstacle_description: row.try_get("obstacle_description").ok(),
        nombre: row.try_get("nombre").ok(),
        obstacle_largeur: row.try_get("obstacle_largeur").ok(),
        obstacle_longueur: row.try_get("obstacle_longueur").ok(),
    }).collect();

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

    println!("[DB] 🚧 Insertion des obstacles...");
    for detail in &details {
        for obstacle in &detail.obstacle {
            println!("[DB]   → Obstacle ID: {}, point_id: {}, type_id: {}, nombre: {}", 
                obstacle.id, obstacle.point_id, obstacle.type_id, obstacle.number);
            
            // Vérifier si le type_id existe dans obstacle_type
            let type_exists: Option<i32> = sqlx::query_scalar(
                r#"SELECT id FROM obstacle_type WHERE id = ?"#
            )
            .bind(obstacle.type_id)
            .fetch_optional(&mut *tx)
            .await
            .map_err(|e| format!("Erreur vérification type_id {} : {}", obstacle.type_id, e))?;
            
            if type_exists.is_none() {
                eprintln!("[DB] ⚠️  WARNING: type_id {} n'existe pas dans obstacle_type, obstacle ID {} ignoré", 
                    obstacle.type_id, obstacle.id);
                continue; // Ignore cet obstacle si le type n'existe pas
            }
            
            sqlx::query(
                r#"INSERT OR REPLACE INTO obstacles (id, point_id, type_id, nombre) VALUES (?, ?, ?, ?)"#
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
    println!("[DB] ✓ Tous les obstacles insérés");

    println!("[DB] 💾 Validation de la transaction...");
    tx.commit()
        .await
        .map_err(|e| format!("Erreur à la validation (commit) de la transaction : {}", e))?;

    println!("[DB] ✅ Transaction validée avec succès !");

    Ok(())
}
