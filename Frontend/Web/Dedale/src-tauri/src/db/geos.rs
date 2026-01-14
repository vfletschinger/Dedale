use crate::db::get_db_pool;
use crate::types::*;
use sqlx::Row;
use tauri::AppHandle;
use uuid::Uuid;

/// Récupère toutes les géométries (points, lignes/parcours, polygones/zones) pour un événement
/// et les retourne dans un format unifié
#[tauri::command]
pub async fn fetch_geometries_for_event(
    app: AppHandle,
    event_id: String,
) -> Result<Vec<Geometry>, String> {
    let pool = get_db_pool(&app).await?;
    let mut geometries: Vec<Geometry> = Vec::new();

    // 1. Récupérer les points (géométrie POINT)
    let point_rows = sqlx::query("SELECT id, event_id, x, y, name FROM point WHERE event_id = ?")
        .bind(&event_id)
        .fetch_all(&pool)
        .await
        .map_err(|e| e.to_string())?;
    let point_count = point_rows.len();

    for row in point_rows {
        let x: f64 = row.get("x");
        let y: f64 = row.get("y");
        let wkt = format!("POINT({} {})", x, y);
        geometries.push(Geometry {
            id: row.get("id"),
            event_id: row.get("event_id"),
            geom: wkt,
            geom_type: "point".to_string(),
            name: row.get("name"),
        });
    }

    // 2. Récupérer les parcours (géométrie LINESTRING)
    let parcours_rows =
        sqlx::query("SELECT id, event_id, name, geometry_json FROM parcours WHERE event_id = ?")
            .bind(&event_id)
            .fetch_all(&pool)
            .await
            .map_err(|e| e.to_string())?;
    let parcours_count = parcours_rows.len();

    for row in parcours_rows {
        let geom_json: Option<String> = row.get("geometry_json");
        if let Some(geom) = geom_json {
            geometries.push(Geometry {
                id: row.get("id"),
                event_id: row.get("event_id"),
                geom,
                geom_type: "parcours".to_string(),
                name: row.get("name"),
            });
        }
    }

    // 3. Récupérer les zones (géométrie POLYGON)
    let zone_rows =
        sqlx::query("SELECT id, event_id, name, geometry_json FROM zone WHERE event_id = ?")
            .bind(&event_id)
            .fetch_all(&pool)
            .await
            .map_err(|e| e.to_string())?;
    let zone_count = zone_rows.len();

    for row in zone_rows {
        let geom_json: Option<String> = row.get("geometry_json");
        if let Some(geom) = geom_json {
            geometries.push(Geometry {
                id: row.get("id"),
                event_id: row.get("event_id"),
                geom,
                geom_type: "zone".to_string(),
                name: row.get("name"),
            });
        }
    }

    println!(
        "[DB] 📐 {} géométrie(s) récupérée(s) pour l'événement {} (points: {}, parcours: {}, zones: {})",
        geometries.len(),
        event_id,
        point_count,
        parcours_count,
        zone_count
    );
    Ok(geometries)
}

#[allow(dead_code)]
#[tauri::command]
pub async fn fetch_zones_for_event(app: AppHandle, event_id: String) -> Result<Vec<Zone>, String> {
    let pool = get_db_pool(&app).await?;
    let rows = sqlx::query(
        "SELECT id, event_id, name, color, description, geometry_json FROM zone WHERE event_id = ?",
    )
    .bind(&event_id)
    .fetch_all(&pool)
    .await
    .map_err(|e| e.to_string())?;

    let geometries: Vec<Zone> = rows
        .into_iter()
        .map(|row| Zone {
            id: row.get("id"),
            event_id: row.get("event_id"),
            name: row.get("name"),
            color: row.get("color"),
            description: row.get("description"),
            geometry_json: row.get("geometry_json"),
        })
        .collect();

    println!(
        "[DB] 📐 {} géométrie(s) récupérée(s) pour l'événement {}",
        geometries.len(),
        event_id
    );
    Ok(geometries)
}

#[allow(dead_code)]
#[tauri::command]
pub async fn fetch_parcours_for_event(
    app: AppHandle,
    event_id: String,
) -> Result<Vec<Parcours>, String> {
    let pool = get_db_pool(&app).await?;
    let rows = sqlx::query("SELECT id, event_id, name, color, start_time, speed_low, speed_high, geometry_json FROM parcours WHERE event_id = ?")
        .bind(&event_id)
        .fetch_all(&pool)
        .await
        .map_err(|e| e.to_string())?;

    let geometries: Vec<Parcours> = rows
        .into_iter()
        .map(|row| Parcours {
            id: row.get("id"),
            event_id: row.get("event_id"),
            name: row.get("name"),
            color: row.get("color"),
            start_time: row.get("start_time"),
            speed_low: row.get("speed_low"),
            speed_high: row.get("speed_high"),
            geometry_json: row.get("geometry_json"),
        })
        .collect();

    println!(
        "[DB] 📐 {} géométrie(s) récupérée(s) pour l'événement {}",
        geometries.len(),
        event_id
    );
    Ok(geometries)
}

#[tauri::command]
pub async fn create_zone(
    app: AppHandle,
    event_id: String,
    geom: String,
    name: String,
    color: String,
    description: Option<String>,
) -> Result<Zone, String> {
    let pool = get_db_pool(&app).await?;
    let uuid = Uuid::new_v4().to_string();
    let _result = sqlx::query(
        "INSERT INTO zone (id, event_id, geometry_json, name, color, description) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(&uuid)
    .bind(&event_id)
    .bind(&geom)
    .bind(&name)
    .bind(&color)
    .bind(&description)
    .execute(&pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(Zone {
        id: uuid,
        event_id,
        name: Some(name),
        color: Some(color),
        description,
        geometry_json: Some(geom),
    })
}
#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn create_parcours(
    app: AppHandle,
    event_id: String,
    geom: String,
    name: String,
    color: String,
    start_time: Option<i64>,
    speed_low: Option<f64>,
    speed_high: Option<f64>,
) -> Result<Parcours, String> {
    let pool = get_db_pool(&app).await?;
    let uuid = Uuid::new_v4().to_string();

    sqlx::query("INSERT INTO parcours (id, event_id, geometry_json, name, color, start_time, speed_low, speed_high) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(&uuid)
        .bind(&event_id)
        .bind(&geom)
        .bind(&name)
        .bind(&color)
        .bind(start_time)
        .bind(speed_low)
        .bind(speed_high)
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;

    println!("[DB] ✅ Parcours {} créé avec succès", name);

    Ok(Parcours {
        id: uuid,
        event_id,
        name: Some(name),
        color: Some(color),
        start_time,
        speed_low,
        speed_high,
        geometry_json: Some(geom),
    })
}

#[tauri::command]
pub async fn delete_zone(app: AppHandle, geometry_id: String) -> Result<(), String> {
    let pool = get_db_pool(&app).await?;

    sqlx::query("DELETE FROM zone WHERE id = ?")
        .bind(&geometry_id)
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;

    println!("[DB] 🗑️ Géométrie {} supprimée", geometry_id);
    Ok(())
}

#[tauri::command]
pub async fn delete_parcours(app: AppHandle, geometry_id: String) -> Result<(), String> {
    let pool = get_db_pool(&app).await?;

    sqlx::query("DELETE FROM parcours WHERE id = ?")
        .bind(&geometry_id)
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;
    println!("[DB] 🗑️ Parcours {} supprimé", geometry_id);
    Ok(())
}

/// Supprime une géométrie en cherchant dans toutes les tables (point, parcours, zone)
#[tauri::command]
pub async fn delete_geometry(app: AppHandle, geometry_id: String) -> Result<(), String> {
    let pool = get_db_pool(&app).await?;

    // Essayer de supprimer dans chaque table
    let point_result = sqlx::query("DELETE FROM point WHERE id = ?")
        .bind(&geometry_id)
        .execute(&pool)
        .await;

    let parcours_result = sqlx::query("DELETE FROM parcours WHERE id = ?")
        .bind(&geometry_id)
        .execute(&pool)
        .await;

    let zone_result = sqlx::query("DELETE FROM zone WHERE id = ?")
        .bind(&geometry_id)
        .execute(&pool)
        .await;

    // Vérifier si au moins une suppression a réussi
    let deleted = point_result.map(|r| r.rows_affected()).unwrap_or(0)
        + parcours_result.map(|r| r.rows_affected()).unwrap_or(0)
        + zone_result.map(|r| r.rows_affected()).unwrap_or(0);

    if deleted > 0 {
        println!("[DB] 🗑️ Géométrie {} supprimée", geometry_id);
        Ok(())
    } else {
        Err(format!("Géométrie {} non trouvée", geometry_id))
    }
}

/// Met à jour une géométrie en cherchant dans toutes les tables (point, parcours, zone)
#[tauri::command]
pub async fn update_geometry(
    app: AppHandle,
    geometry_id: String,
    geom: String,
) -> Result<Geometry, String> {
    let pool = get_db_pool(&app).await?;
    let geom_upper = geom.to_uppercase();

    // Vérifier dans quelle table se trouve la géométrie
    // 1. Chercher dans point
    let point_row = sqlx::query("SELECT event_id FROM point WHERE id = ?")
        .bind(&geometry_id)
        .fetch_optional(&pool)
        .await
        .map_err(|e| e.to_string())?;

    if let Some(row) = point_row {
        let event_id: String = row.get("event_id");

        // Parser les coordonnées du nouveau POINT WKT
        if geom_upper.starts_with("POINT") {
            let coords_str = geom
                .trim_start_matches(|c: char| !c.is_numeric() && c != '-')
                .trim_end_matches(')');
            let parts: Vec<&str> = coords_str.split_whitespace().collect();

            if parts.len() >= 2 {
                let x: f64 = parts[0].parse().map_err(|_| "Coordonnée X invalide")?;
                let y: f64 = parts[1].parse().map_err(|_| "Coordonnée Y invalide")?;

                sqlx::query("UPDATE point SET x = ?, y = ? WHERE id = ?")
                    .bind(x)
                    .bind(y)
                    .bind(&geometry_id)
                    .execute(&pool)
                    .await
                    .map_err(|e| e.to_string())?;
            }
        }

        println!("[DB] ✏️ Point {} mis à jour", geometry_id);
        return Ok(Geometry {
            id: geometry_id,
            event_id,
            geom,
            geom_type: "point".to_string(),
            name: None,
        });
    }

    // 2. Chercher dans parcours
    let parcours_row = sqlx::query("SELECT event_id FROM parcours WHERE id = ?")
        .bind(&geometry_id)
        .fetch_optional(&pool)
        .await
        .map_err(|e| e.to_string())?;

    if let Some(row) = parcours_row {
        let event_id: String = row.get("event_id");

        sqlx::query("UPDATE parcours SET geometry_json = ? WHERE id = ?")
            .bind(&geom)
            .bind(&geometry_id)
            .execute(&pool)
            .await
            .map_err(|e| e.to_string())?;

        println!("[DB] ✏️ Parcours {} mis à jour", geometry_id);
        return Ok(Geometry {
            id: geometry_id,
            event_id,
            geom,
            geom_type: "parcours".to_string(),
            name: None,
        });
    }

    // 3. Chercher dans zone
    let zone_row = sqlx::query("SELECT event_id FROM zone WHERE id = ?")
        .bind(&geometry_id)
        .fetch_optional(&pool)
        .await
        .map_err(|e| e.to_string())?;

    if let Some(row) = zone_row {
        let event_id: String = row.get("event_id");

        sqlx::query("UPDATE zone SET geometry_json = ? WHERE id = ?")
            .bind(&geom)
            .bind(&geometry_id)
            .execute(&pool)
            .await
            .map_err(|e| e.to_string())?;

        println!("[DB] ✏️ Zone {} mise à jour", geometry_id);
        return Ok(Geometry {
            id: geometry_id,
            event_id,
            geom,
            geom_type: "zone".to_string(),
            name: None,
        });
    }

    Err(format!("Géométrie {} non trouvée", geometry_id))
}

#[tauri::command]
pub async fn update_zone(
    app: AppHandle,
    geometry_id: String,
    geom: String,
    name: String,
    color: String,
    description: Option<String>,
) -> Result<Zone, String> {
    let pool = get_db_pool(&app).await?;

    let row = sqlx::query("SELECT event_id FROM zone WHERE id = ?")
        .bind(&geometry_id)
        .fetch_one(&pool)
        .await
        .map_err(|e| format!("Géométrie non trouvée: {}", e))?;

    let event_id: String = row.get("event_id");

    sqlx::query(
        "UPDATE zone SET geometry_json = ?, name = ?, color = ?, description = ? WHERE id = ?",
    )
    .bind(&geom)
    .bind(&name)
    .bind(&color)
    .bind(&description)
    .bind(&geometry_id)
    .execute(&pool)
    .await
    .map_err(|e| e.to_string())?;

    println!("[DB] Géométrie {} mise à jour", geometry_id);

    Ok(Zone {
        id: geometry_id,
        event_id,
        name: Some(name),
        color: Some(color),
        description,
        geometry_json: Some(geom),
    })
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn update_parcours(
    app: AppHandle,
    geometry_id: String,
    geom: String,
    name: String,
    color: String,
    start_time: Option<i64>,
    speed_low: Option<f64>,
    speed_high: Option<f64>,
) -> Result<Parcours, String> {
    let pool = get_db_pool(&app).await?;

    let row = sqlx::query("SELECT event_id FROM parcours WHERE id = ?")
        .bind(&geometry_id)
        .fetch_one(&pool)
        .await
        .map_err(|e| format!("Parcours non trouvé: {}", e))?;

    let event_id: String = row.get("event_id");

    sqlx::query(
        "UPDATE parcours SET geometry_json = ?, name = ?, color = ?, start_time = ?, speed_low = ?, speed_high = ? WHERE id = ?"
    )
        .bind(&geom)
        .bind(&name)
        .bind(&color)
        .bind(start_time)
        .bind(speed_low)
        .bind(speed_high)
        .bind(&geometry_id)
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;

    println!("[DB] Parcours {} mis à jour", geometry_id);

    Ok(Parcours {
        id: geometry_id,
        event_id,
        name: Some(name),
        color: Some(color),
        start_time,
        speed_low,
        speed_high,
        geometry_json: Some(geom),
    })
}

/// Met à jour le nom d'une géométrie (zone ou parcours)
#[tauri::command]
#[allow(dead_code)]
pub async fn update_geometry_name(
    app: AppHandle,
    geometry_id: String,
    name: String,
) -> Result<(), String> {
    let pool = get_db_pool(&app).await?;

    // Essayer de mettre à jour dans parcours
    let parcours_result = sqlx::query("UPDATE parcours SET name = ? WHERE id = ?")
        .bind(&name)
        .bind(&geometry_id)
        .execute(&pool)
        .await;

    if let Ok(result) = parcours_result {
        if result.rows_affected() > 0 {
            println!(
                "[DB] ✏️ Nom du parcours {} mis à jour: {}",
                geometry_id, name
            );
            return Ok(());
        }
    }

    // Essayer de mettre à jour dans zone
    let zone_result = sqlx::query("UPDATE zone SET name = ? WHERE id = ?")
        .bind(&name)
        .bind(&geometry_id)
        .execute(&pool)
        .await;

    if let Ok(result) = zone_result {
        if result.rows_affected() > 0 {
            println!(
                "[DB] ✏️ Nom de la zone {} mis à jour: {}",
                geometry_id, name
            );
            return Ok(());
        }
    }

    Err(format!("Géométrie {} non trouvée", geometry_id))
}
