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

#[derive(Debug)]
pub struct Point {
    pub id: i64,
    pub x: f64,
    pub y: f64,
    pub obstacles: Vec<Obstacle>,
    pub comments: Vec<Comment>,
    pub pictures: Vec<Picture>,
}

#[derive(Debug)]
pub struct Obstacle {
    pub id: i64,
    pub name: Option<String>,
    pub number: Option<i32>,
}

#[derive(Debug)]
pub struct Picture {
    pub id: i64,
    pub image: String,
}

#[derive(Debug)]
pub struct Comment {
    pub id: i64,
    pub value: String,
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
    let rows = sqlx::query("SELECT id, value FROM comment WHERE point_id = ?")
        .bind(point_id)
        .fetch_all(pool)
        .await
        .map_err(|e| e.to_string())?;

    let comments = rows.into_iter().map(|row| Comment {
        id: row.get("id"),
        value: row.get("value"),
    }).collect();

    Ok(comments)
}

async fn fetch_pictures(pool: &SqlitePool, point_id: i64) -> Result<Vec<Picture>, String> {
    let rows = sqlx::query("SELECT id, image FROM picture WHERE point_id = ?")
        .bind(point_id)
        .fetch_all(pool)
        .await
        .map_err(|e| e.to_string())?;

    let pictures = rows.into_iter().map(|row| Picture {
        id: row.get("id"),
        image: row.get("image"),
    }).collect();

    Ok(pictures)
}

async fn fetch_obstacles(pool: &SqlitePool, point_id: i64) -> Result<Vec<Obstacle>, String> {
    let rows = sqlx::query("SELECT id, name, number FROM obstacle WHERE point_id = ?")
        .bind(point_id)
        .fetch_all(pool)
        .await
        .map_err(|e| e.to_string())?;

    let obstacles = rows.into_iter().map(|row| Obstacle {
        id: row.get("id"),
        name: row.get("name"),
        number: row.get("number"),
    }).collect();

    Ok(obstacles)
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
    
    // Iterate and process each row to fetch related data
    for row in base_rows {
        let point_id: i64 = row.get("point_id");
        
        let comments = fetch_comments(&pool, point_id).await?;
        let pictures = fetch_pictures(&pool, point_id).await?;
        let obstacles = fetch_obstacles(&pool, point_id).await?;

        points.push(Point {
            id: point_id,
            x: row.get("x"),
            y: row.get("y"),
            obstacles,
            comments,
            pictures,
        });
    }

    Ok(points)
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