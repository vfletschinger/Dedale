use sqlx::{Row, SqlitePool};
use sqlx::{Sqlite, Transaction};
use tauri::State;
use tauri::{AppHandle};
use uuid::Uuid;
use crate::types::*;
use crate::db::get_db_pool;

#[tauri::command]
pub async fn fetch_pictures(
    pool: State<'_, SqlitePool>,
    point_id: String, 
) -> Result<Vec<Picture>, String> {
    let rows = sqlx::query("SELECT id, image, point_id FROM picture WHERE point_id = ?")
        .bind(point_id)
        .fetch_all(pool.inner()) 
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


pub async fn fetch_equipement_coordinates(
    pool: &SqlitePool,
    equipement_id: &str,
) -> Result<Vec<EquipementCoordinate>, String> {
    sqlx::query_as::<_, EquipementCoordinate>(
        "SELECT id, equipement_id, x, y, order_index FROM equipement_coordinate WHERE equipement_id = ? ORDER BY order_index ASC"
    )
    .bind(equipement_id)
    .fetch_all(pool)
    .await
    .map_err(|e| format!("Erreur coordonnées: {}", e))
}

#[tauri::command]
pub async fn fetch_equipement_details(
    pool: State<'_, SqlitePool>, // Utilisation de State au lieu de AppHandle
    equipement_id: String,       // String au lieu de &str
) -> Result<Option<EquipementComplet>, String> {
    let query = r#"
        SELECT
            e.id,
            e.type_id,
            e.length,
            e.date_pose,
            e.hour_pose,
            e.date_depose,
            e.hour_depose,
            t.name AS type_name,
            t.description AS type_description
        FROM equipement e
        LEFT JOIN type t ON e.type_id = t.id
        WHERE e.id = ?
    "#;

    // On récupère une ligne optionnelle (fetch_optional)
    let row_opt = sqlx::query(query)
        .bind(&equipement_id)
        .fetch_optional(pool.inner())
        .await
        .map_err(|e| e.to_string())?;

    match row_opt {
        Some(row) => {
            // Si l'équipement existe, on récupère ses coordonnées
            // Note: On passe pool.inner() qui est &SqlitePool
            let coordinates = fetch_equipement_coordinates(pool.inner(), &equipement_id).await?;

            let equipement = EquipementComplet {
                id: row.get("id"),
                type_id: row.get("type_id"),
                type_name: row.get("type_name"),
                type_description: row.get("type_description"),
                length: row.get("length"),
                // Attention aux types de dates:
                // Si stocké en TEXT (ISO 8601), .get::<String, _> fonctionne.
                // Si vous utilisez chrono, utilisez .get::<NaiveDate, _>
                date_pose: row.get("date_pose"),
                hour_pose: row.get("hour_pose"),
                date_depose: row.get("date_depose"),
                hour_depose: row.get("hour_depose"),
                coordinates,
            };

            Ok(Some(equipement))
        }
        None => Ok(None), // L'ID n'existe pas
    }
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
pub async fn insert_equipements(
    app: AppHandle,
    equipements: Vec<Equipement>,
) -> Result<(), String> {
    let pool = get_db_pool(&app).await?;

    for equipement in equipements {
        // Vérifier si l'équipement existe déjà
        let existing = sqlx::query("SELECT id FROM equipement WHERE id = ?")
            .bind(&equipement.id)
            .fetch_optional(&pool)
            .await
            .map_err(|e| format!("Failed to check existing equipement: {}", e))?;

        if existing.is_some() {
            // Mettre à jour l'équipement existant
            sqlx::query(
                "UPDATE equipement SET type_id = ?, length = ?, date_pose = ?, hour_pose = ?, date_depose = ?, hour_depose = ? WHERE id = ?",
            )
            .bind(&equipement.type_id)
            .bind(equipement.length)
            .bind(&equipement.date_pose)
            .bind(&equipement.hour_pose)
            .bind(&equipement.date_depose)
            .bind(&equipement.hour_depose)
            .bind(&equipement.id)
            .execute(&pool)
            .await
            .map_err(|e| format!("Failed to update equipement: {}", e))?;
        } else {
            // Insérer un nouvel équipement
            sqlx::query(
                "INSERT INTO equipement (id, type_id, length, date_pose, hour_pose, date_depose, hour_depose) VALUES (?, ?, ?, ?, ?, ?, ?)",
            )
            .bind(&equipement.id)
            .bind(&equipement.type_id)
            .bind(equipement.length)
            .bind(&equipement.date_pose)
            .bind(&equipement.hour_pose)
            .bind(&equipement.date_depose)
            .bind(&equipement.hour_depose)
            .execute(&pool)
            .await
            .map_err(|e| format!("Failed to insert equipement: {}", e))?;
        }
    }
    Ok(())
}

pub async fn retrieve_data_by_event(
    app: &AppHandle,
    event_id: &Option<String>,
) -> Result<Vec<Point>, String> {
    let pool = get_db_pool(app).await?;
    let base_rows = if let Some(eid) = event_id {
        println!("[DB] Récupération des points pour l'event_id: {}", eid);
        sqlx::query(
            r#"
            SELECT DISTINCT p.id, p.x, p.y, p.comment, p.type, p.status, pe.event_id
            FROM point p
            INNER JOIN point_event pe ON p.id = pe.point_id
            WHERE pe.event_id = ?
            ORDER BY p.id
        "#,
        )
        .bind(eid)
        .fetch_all(&pool)
        .await
        .map_err(|e| e.to_string())?
    } else {
        println!("[DB]  Récupération de tous les points");
        sqlx::query(
            r#"
            SELECT p.id, p.x, p.y, p.comment, p.type, p.status, pe.event_id
            FROM point p
            LEFT JOIN point_event pe ON p.id = pe.point_id
            ORDER BY p.id
        "#,
        )
        .fetch_all(&pool)
        .await
        .map_err(|e| e.to_string())?
    };

    let mut points: Vec<Point> = Vec::new();

    for row in base_rows {
        let id: String = row.get("id");

        points.push(Point {
            id,
            x: row.get("x"),
            y: row.get("y"),
            comment: row.get("comment"),
            r#type: row.get("type"),
            status: row.get("status"),
            event_id: row.get("event_id"),
        });
    }

    println!("[DB]  {} point(s) récupéré(s)", points.len());
    Ok(points)
}

#[tauri::command]
pub async fn insert_point_details(
    app: &AppHandle,
    details: Vec<PointDetail>,
) -> Result<Vec<String>, String> {
    let pool = get_db_pool(app).await?;
    let mut tx: Transaction<Sqlite> = pool
        .begin()
        .await
        .map_err(|e| format!("Erreur au démarrage de la transaction : {}", e))?;

    // ÉTAPE 1: Insérer tous les points d'abord
    // We need to keep track of assigned IDs when frontend sends id=="" or "0" for new points
    let mut assigned_ids: Vec<String> = Vec::with_capacity(details.len());
    for detail in &details {
        let point_id = if detail.point.id.is_empty() || detail.point.id == "0" {
            // Générer un nouvel UUID pour ce point
            Uuid::new_v4().to_string()
        } else {
            // Utiliser l'ID fourni
            detail.point.id.clone()
        };

        // Insérer le point
        sqlx::query(
            r#"INSERT OR REPLACE INTO point (id, x, y, comment, type, status) VALUES (?, ?, ?, ?, ?, ?)"#,
        )
        .bind(&point_id)
        .bind(detail.point.x)
        .bind(detail.point.y)
        .bind(&detail.point.comment)
        .bind(&detail.point.r#type)
        .bind(&detail.point.status)
        .execute(&mut *tx)
        .await
        .map_err(|e| format!("Erreur INSERT/REPLACE point ID {} : {}", point_id, e))?;

        assigned_ids.push(point_id);
    }
    // ÉTAPE 2: Insérer les données liées (commentaires)
    for (idx, detail) in details.iter().enumerate() {
        let assigned_point_id: &String = &assigned_ids[idx];
        for comment in &detail.comment {
            let comment_id = if comment.id.is_empty() || comment.id == "0" {
                Uuid::new_v4().to_string()
            } else {
                comment.id.clone()
            };
            let point_id_to_use = if comment.point_id.is_empty() || comment.point_id == "0" {
                assigned_point_id.clone()
            } else {
                comment.point_id.clone()
            };
            sqlx::query(r#"INSERT OR REPLACE INTO comment (id, point_id, value) VALUES (?, ?, ?)"#)
                .bind(&comment_id)
                .bind(&point_id_to_use)
                .bind(&comment.value)
                .execute(&mut *tx)
                .await
                .map_err(|e| format!("Erreur INSERT/REPLACE comment ID {} : {}", comment.id, e))?;
        }
    }
    // images
    for (idx, detail) in details.iter().enumerate() {
        let assigned_point_id: &String = &assigned_ids[idx];
        for picture in &detail.picture {
            let picture_id = if picture.id.is_empty() || picture.id == "0" {
                Uuid::new_v4().to_string()
            } else {
                picture.id.clone()
            };
            let point_id_to_use = if picture.point_id.is_empty() || picture.point_id == "0" {
                assigned_point_id.clone()
            } else {
                picture.point_id.clone()
            };
            sqlx::query(r#"INSERT OR REPLACE INTO picture (id, point_id, image) VALUES (?, ?, ?)"#)
                .bind(&picture_id)
                .bind(&point_id_to_use)
                .bind(&picture.image)
                .execute(&mut *tx)
                .await
                .map_err(|e| format!("Erreur INSERT/REPLACE picture ID {} : {}", picture_id, e))?;
        }
    }
    // obstacles and types
    for (idx, detail) in details.iter().enumerate() {
        let assigned_point_id: &String = &assigned_ids[idx];
        for obstacle in &detail.obstacle {
            let obstacle_id = if obstacle.id.is_empty() || obstacle.id == "0" {
                Uuid::new_v4().to_string()
            } else {
                obstacle.id.clone()
            };
            let point_id_to_use = if obstacle.point_id.is_empty() || obstacle.point_id == "0" {
                assigned_point_id.clone()
            } else {
                obstacle.point_id.clone()
            };

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
            sqlx::query(r#"INSERT OR REPLACE INTO obstacle (id, point_id, type_id, number) VALUES (?, ?, ?, ?)"#)
                .bind(&obstacle_id)
                .bind(&point_id_to_use)
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
pub async fn insert_point(
    app: tauri::AppHandle,
    details: Vec<PointDetail>,
    event_id: Option<String>,
) -> Result<Vec<String>, String> {
    println!(
        "[DB] 📍 insert_point appelé avec {} point(s), event_id: {:?}",
        details.len(),
        event_id
    );
    for (i, d) in details.iter().enumerate() {
        println!(
            "[DB]   Point {}: id={}, x={}, y={}",
            i, d.point.id, d.point.x, d.point.y
        );
        println!(
            "[DB]   - {} commentaire(s), {} photo(s), {} obstacle(s)",
            d.comment.len(),
            d.picture.len(),
            d.obstacle.len()
        );
    }
    let result = insert_point_details(&app, details).await;
    match &result {
        Ok(ids) => {
            println!("[DB] ✅ Point(s) inséré(s) avec succès, IDs: {:?}", ids);
                let pool = get_db_pool(&app).await?;
                for point_id in ids {
                    sqlx::query(
                        "INSERT OR IGNORE INTO point_event (point_id, event_id) VALUES (?, ?)",
                    )
                    .bind(point_id)
                    .execute(&pool)
                    .await
                    .map_err(|e| format!("Failed to link point to event: {}", e))?;
            }
        }
        Err(e) => println!("[DB]  Erreur insertion: {}", e),
    }
    result
}

#[tauri::command]
pub async fn update_point_dates(
    app: AppHandle,
    point_id: String,
    pose: Option<String>,
    depose: Option<String>,
) -> Result<(), String> {
    let pool = get_db_pool(&app).await?;

    sqlx::query("UPDATE point SET pose = ?, depose = ? WHERE id = ?")
        .bind(&pose)
        .bind(&depose)
        .bind(&point_id)
        .execute(&pool)
        .await
        .map_err(|e| format!("Failed to update point dates: {}", e))?;

    println!(
        "[DB] ✅ Dates du point {} mises à jour: pose={:?}, depose={:?}",
        point_id, pose, depose
    );
    Ok(())
}

#[tauri::command]
pub async fn delete_point(app: AppHandle, point_id: String) -> Result<(), String> {
    let pool = get_db_pool(&app).await?;

    // Start a transaction and remove dependent rows first to keep DB consistent
    let mut tx: Transaction<Sqlite> = pool
        .begin()
        .await
        .map_err(|e| format!("Failed to start transaction: {}", e))?;

    sqlx::query("DELETE FROM comment WHERE point_id = ?")
        .bind(&point_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| format!("Failed to delete comments: {}", e))?;

    sqlx::query("DELETE FROM picture WHERE point_id = ?")
        .bind(&point_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| format!("Failed to delete pictures: {}", e))?;

    sqlx::query("DELETE FROM obstacle WHERE point_id = ?")
        .bind(&point_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| format!("Failed to delete obstacles: {}", e))?;

    sqlx::query("DELETE FROM point WHERE id = ?")
        .bind(&point_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| format!("Failed to delete point: {}", e))?;

    tx.commit()
        .await
        .map_err(|e| format!("Failed to commit transaction: {}", e))?;

    println!("✅ Successfully deleted point {}", point_id);
    Ok(())
}