use crate::db::get_db_pool;
use crate::types::*;
use sqlx::{Row, SqlitePool};
use sqlx::{Sqlite, Transaction};
use tauri::AppHandle;
use tauri::State;
use uuid::Uuid;

#[allow(dead_code)]
#[tauri::command]
pub async fn fetch_points(
    app: AppHandle,
    event_id: Option<String>,
) -> Result<Vec<PointWithDetails>, String> {
    let pool = get_db_pool(&app).await?;

    let rows = if let Some(eid) = event_id {
        println!("[DB] Récupération des points pour event_id: {}", eid);
        sqlx::query(
            "SELECT id, x, y, name, event_id, comment, status, type FROM point WHERE event_id = ?",
        )
        .bind(eid)
        .fetch_all(&pool)
        .await
        .map_err(|e| e.to_string())?
    } else {
        println!("[DB] Récupération de tous les points");
        sqlx::query("SELECT id, x, y, name, event_id, comment, status, type FROM point")
            .fetch_all(&pool)
            .await
            .map_err(|e| e.to_string())?
    };

    let mut points_with_details: Vec<PointWithDetails> = Vec::new();

    for row in rows {
        let point_id: String = row.get("id");

        // Récupérer les photos pour ce point
        let pictures =
            sqlx::query(r#"SELECT id, point_id, image_data FROM picture WHERE point_id = ?"#)
                .bind(&point_id)
                .fetch_all(&pool)
                .await
                .map_err(|e| e.to_string())?
                .into_iter()
                .map(|pic_row| Picture {
                    id: pic_row.get("id"),
                    point_id: pic_row.get("point_id"),
                    image: pic_row.get("image_data"),
                })
                .collect();

        points_with_details.push(PointWithDetails {
            id: point_id,
            x: row.get("x"),
            y: row.get("y"),
            name: row.get("name"),
            event_id: row.get("event_id"),
            status: row.get("status"),
            comment: row.get("comment"),
            r#type: row.get("type"),
            pictures,
        });
    }

    println!("[DB]  {} point(s) récupéré(s)", points_with_details.len());

    Ok(points_with_details)
}

#[tauri::command]
pub async fn update_point(app: AppHandle, point: Point) -> Result<Point, String> {
    let pool = get_db_pool(&app).await?;
    sqlx::query("UPDATE point SET x = ?, y = ?, name = ?, comment = ?, type = ?, status = ?, event_id = ? WHERE id = ?")
        .bind(point.x)
        .bind(point.y)
        .bind(&point.name)
        .bind(&point.comment)
        .bind(&point.r#type)
        .bind(point.status)
        .bind(&point.event_id)
        .bind(&point.id)
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(point)
}
#[tauri::command]
#[allow(dead_code)]
pub async fn fetch_pictures(app: AppHandle, point_id: String) -> Result<Vec<Picture>, String> {
    let rows = sqlx::query("SELECT id, image_data, point_id FROM picture WHERE point_id = ?")
        .bind(point_id)
        .fetch_all(&get_db_pool(&app).await?)
        .await
        .map_err(|e| e.to_string())?;

    let pictures = rows
        .into_iter()
        .map(|row| Picture {
            id: row.get("id"),
            image: row.get("image_data"),
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

#[allow(dead_code)]
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
            e.description,
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
                description: row.get("description"),
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

#[allow(dead_code)]
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
) -> Result<Vec<PointWithDetails>, String> {
    let pool = get_db_pool(app).await?;
    let base_rows = if let Some(eid) = event_id {
        println!("[DB] Récupération des points pour l'event_id: {}", eid);
        sqlx::query(
            r#"
            SELECT DISTINCT p.id, p.x, p.y, p.name, p.comment, p.type, p.status, p.event_id
            FROM point p
            WHERE p.event_id = ?
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
            SELECT p.id, p.x, p.y, p.name, p.comment, p.type, p.status, p.event_id
            FROM point p
            ORDER BY p.id
        "#,
        )
        .fetch_all(&pool)
        .await
        .map_err(|e| e.to_string())?
    };

    let mut points: Vec<PointWithDetails> = Vec::new();

    for row in base_rows {
        let id: String = row.get("id");

        // Récupérer les photos pour ce point
        let pictures =
            sqlx::query(r#"SELECT id, point_id, image_data FROM picture WHERE point_id = ?"#)
                .bind(&id)
                .fetch_all(&pool)
                .await
                .map_err(|e| e.to_string())?
                .into_iter()
                .map(|pic_row| Picture {
                    id: pic_row.get("id"),
                    point_id: pic_row.get("point_id"),
                    image: pic_row.get("image_data"),
                })
                .collect();

        points.push(PointWithDetails {
            id,
            x: row.get("x"),
            y: row.get("y"),
            name: row.get("name"),
            comment: row.get("comment"),
            status: row.get("status"),
            event_id: row.get("event_id"),
            r#type: row.get("type"),
            pictures,
        });
    }

    println!("[DB]  {} point(s) récupéré(s)", points.len());
    Ok(points)
}

#[tauri::command]
pub async fn insert_point(app: AppHandle, point: PointWithDetails) -> Result<Vec<String>, String> {
    let pool = get_db_pool(&app).await?;

    let id = Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT OR IGNORE INTO point (id, event_id, x, y, name, comment, type, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(point.event_id.clone())
    .bind(point.x)
    .bind(point.y)
    .bind(point.name.clone())
    .bind(point.comment.clone())
    .bind(point.r#type.clone())
    .bind(point.status)
    .execute(&pool)
    .await
    .map_err(|e| format!("Failed to insert point: {}", e))?;
    Ok(vec![id])
}

#[tauri::command]
pub async fn update_point_dates(
    app: AppHandle,
    point_id: String,
    comment: Option<String>,
) -> Result<(), String> {
    let pool = get_db_pool(&app).await?;
    sqlx::query("UPDATE point SET comment = ? WHERE id = ?")
        .bind(&comment)
        .bind(&point_id)
        .execute(&pool)
        .await
        .map_err(|e| format!("Failed to update point comment: {}", e))?;

    println!(
        "[DB] ✅ Point {} mis à jour: comment={:?}",
        point_id, comment
    );
    Ok(())
}

#[tauri::command]
pub async fn delete_point(app: AppHandle, point_id: String) -> Result<(), String> {
    // Start a transaction and remove dependent rows first to keep DB consistent
    let pool = get_db_pool(&app).await?;
    let mut tx: Transaction<Sqlite> = pool
        .begin()
        .await
        .map_err(|e| format!("Failed to start transaction: {}", e))?;

    sqlx::query("DELETE FROM picture WHERE point_id = ?")
        .bind(&point_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| format!("Failed to delete pictures: {}", e))?;

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

#[tauri::command]
pub async fn create_interest_point(
    app: AppHandle,
    x: f64,
    y: f64,
    description: &str,
    event_id: &str,
) -> Result<String, String> {
    let pool = get_db_pool(&app).await?;

    let point_id = Uuid::new_v4().to_string();

    sqlx::query(
        r#"INSERT INTO interest (id, x, y, description, event_id) 
           VALUES (?, ?, ?, ?, ?)"#,
    )
    .bind(&point_id)
    .bind(x)
    .bind(y)
    .bind(description)
    .bind(event_id)
    .execute(&pool)
    .await
    .map_err(|e| format!("Erreur lors de la création du point d'intérêt : {}", e))?;

    println!(
        "[DB] ✅ Point d'intérêt créé avec ID {}, coordonnées ({}, {})",
        point_id, x, y
    );

    Ok(point_id)
}
#[tauri::command]
pub async fn delete_interest_point(app: AppHandle, point_id: &str) -> Result<(), String> {
    let pool = get_db_pool(&app).await?;

    sqlx::query("DELETE FROM interest WHERE id = ?")
        .bind(point_id)
        .execute(&pool)
        .await
        .map_err(|e| format!("Erreur lors de la suppression du point d'intérêt : {}", e))?;

    println!("[DB] ✅ Point d'intérêt {} supprimé", point_id);
    Ok(())
}

#[tauri::command]
pub async fn update_interest_point(
    app: AppHandle,
    point_id: &str,
    x: f64,
    y: f64,
    description: &str,
) -> Result<(), String> {
    let pool = get_db_pool(&app).await?;

    sqlx::query(
        r#"UPDATE interest 
           SET x = ?, y = ?, description = ? 
           WHERE id = ?"#,
    )
    .bind(x)
    .bind(y)
    .bind(description)
    .bind(point_id)
    .execute(&pool)
    .await
    .map_err(|e| format!("Erreur lors de la mise à jour du point d'intérêt : {}", e))?;

    println!(
        "[DB] ✅ Point d'intérêt {} mis à jour avec coordonnées ({}, {})",
        point_id, x, y
    );

    Ok(())
}

#[tauri::command]
pub async fn fetch_interest_points(
    app: AppHandle,
    event_id: Option<String>,
) -> Result<Vec<Interest>, String> {
    let pool = get_db_pool(&app).await?;

    let rows = if let Some(eid) = event_id {
        println!(
            "[DB] Récupération des points d'intérêt pour event_id: {}",
            eid
        );
        sqlx::query("SELECT id, x, y, description, event_id FROM interest WHERE event_id = ?")
            .bind(eid)
            .fetch_all(&pool)
            .await
            .map_err(|e| e.to_string())?
    } else {
        println!("[DB] Récupération de tous les points d'intérêt");
        sqlx::query("SELECT id, x, y, description, event_id FROM interest")
            .fetch_all(&pool)
            .await
            .map_err(|e| e.to_string())?
    };

    let interests: Vec<Interest> = rows
        .into_iter()
        .map(|row| Interest {
            id: row.get("id"),
            x: row.get("x"),
            y: row.get("y"),
            description: row.get("description"),
            event_id: row.get("event_id"),
        })
        .collect();

    println!("[DB]  {} point(s) d'intérêt récupéré(s)", interests.len());

    Ok(interests)
}
