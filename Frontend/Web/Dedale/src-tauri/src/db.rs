// On importe les dépendances nécessaires
use sqlx::{SqlitePool, Row};
use sqlx::sqlite::{SqlitePoolOptions, SqliteConnectOptions};
use tauri_plugin_sql::{Builder, Migration, MigrationKind};
use tauri::{AppHandle, Manager};
use std::fs;
use std::str::FromStr;


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
                    id INTEGER PRIMARY KEY,
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