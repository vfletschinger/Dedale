use crate::db::get_db_pool;
use crate::types::*;
use sqlx::{Row, SqlitePool};
use tauri::AppHandle;
use uuid::Uuid;

#[allow(dead_code)]
pub async fn fetch_event_ids(app: AppHandle, point_id: &str) -> Result<Vec<String>, String> {
    let pool = get_db_pool(&app).await?;

    let rows = sqlx::query("SELECT event_id FROM point WHERE id = ? AND event_id IS NOT NULL")
        .bind(point_id)
        .fetch_all(&pool)
        .await
        .map_err(|e| e.to_string())?;

    let event_ids = rows.into_iter().map(|row| row.get("event_id")).collect();

    Ok(event_ids)
}

#[tauri::command]
pub async fn fetch_events(app: AppHandle) -> Result<Vec<Event>, String> {
    println!("[DB] 🚀 Début de la récupération des événements...");
    let pool = get_db_pool(&app).await?;

    // 1. La requête ne sélectionne QUE ce qui existe dans la table 'event'
    let query = r#"
        SELECT
            id,
            name,
            start_date,
            end_date
        FROM event
    "#;

    let rows = sqlx::query(query).fetch_all(&pool).await.map_err(|e| {
        println!("[DB] ❌ Erreur SQL: {}", e);
        e.to_string()
    })?;

    let mut events: Vec<Event> = Vec::new();

    for row in rows {
        let event_id: String = row.get("id");

        events.push(Event {
            id: event_id,
            name: row.get("name"),
            start_date: row.get("start_date"),
            end_date: row.get("end_date"),
            zone: None,
            parcours: None,
        });
    }

    println!(
        "[DB] ✅ Récupération terminée. {} événements.",
        events.len()
    );
    Ok(events)
}

#[tauri::command]
pub async fn insert_event(event: Event, app: AppHandle) -> Result<(), String> {
    println!("Insertion d'un événement: {:?}", event);

    let pool = get_db_pool(&app).await?;

    // Générer un UUID pour l'id de l'événement
    let event_id = Uuid::new_v4().to_string();

    sqlx::query("INSERT INTO event (id, name, start_date, end_date) VALUES (?, ?, ?, ?)")
        .bind(&event_id)
        .bind(&event.name)
        .bind(&event.start_date)
        .bind(&event.end_date)
        .execute(&pool)
        .await
        .map_err(|e| format!("Failed to insert event: {}", e))?;

    println!(
        "[DB] ✅ Événement '{:?}' créé avec succès (id: {})!",
        event.name, event_id
    );

    // Émettre un événement pour notifier le frontend
    //let _ = app.emit("events-updated", ());

    Ok(())
}

#[tauri::command]
pub async fn link_point_to_event(
    app: AppHandle,
    point_id: String,
    event_id: String,
) -> Result<(), String> {
    println!("[DB] 🔗 Liaison point {} → event {}", point_id, event_id);
    let pool = get_db_pool(&app).await?;

    sqlx::query("UPDATE point SET event_id = ? WHERE id = ?")
        .bind(&event_id)
        .bind(&point_id)
        .execute(&pool)
        .await
        .map_err(|e| format!("Failed to link point to event: {}", e))?;

    println!("[DB] ✅ Point {} lié à l'événement {}", point_id, event_id);
    Ok(())
}

#[tauri::command]
pub async fn unlink_point_from_event(
    app: AppHandle,
    point_id: String,
    _event_id: String,
) -> Result<(), String> {
    println!("[DB]  Déliaison point {}", point_id);
    let pool = get_db_pool(&app).await?;

    sqlx::query("UPDATE point SET event_id = NULL WHERE id = ?")
        .bind(&point_id)
        .execute(&pool)
        .await
        .map_err(|e| format!("Failed to unlink point from event: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn get_points_for_event(app: AppHandle, event_id: String) -> Result<Vec<String>, String> {
    let pool = get_db_pool(&app).await?;

    let rows = sqlx::query("SELECT id FROM point WHERE event_id = ?")
        .bind(event_id)
        .fetch_all(&pool)
        .await
        .map_err(|e| e.to_string())?;

    let point_ids: Vec<String> = rows.into_iter().map(|row| row.get("id")).collect();
    Ok(point_ids)
}

#[tauri::command]
pub async fn delete_event(app: AppHandle, event_id: String) -> Result<(), String> {
    let pool = get_db_pool(&app).await?;

    // Les liaisons point_event seront supprimées automatiquement grâce à ON DELETE CASCADE
    sqlx::query("DELETE FROM event WHERE id = ?")
        .bind(&event_id)
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;

    println!("[DB]  Événement {} supprimé", event_id);

    // Émettre un événement pour notifier le frontend
    // let _ = app.emit("events-updated", ());

    Ok(())
}

#[tauri::command]
pub async fn update_event(
    app: AppHandle,
    event_id: String,
    name: String,
    start_date: String,
    end_date: String,
) -> Result<(), String> {
    let pool = get_db_pool(&app).await?;

    sqlx::query("UPDATE event SET name = ?, start_date = ?, end_date = ? WHERE id = ?")
        .bind(&name)
        .bind(&start_date)
        .bind(&end_date)
        .bind(&event_id)
        .execute(&pool)
        .await
        .map_err(|e| format!("Failed to update event: {}", e))?;

    println!("[DB] ✅ Événement {} mis à jour", event_id);
    Ok(())
}

#[tauri::command]
pub async fn duplicate_event(
    app: AppHandle,
    source_event_id: String,
    new_name: String,
    start_date: String,
    end_date: String,
) -> Result<String, String> {
    let pool = get_db_pool(&app).await?;

    // 1. Créer le nouvel événement
    let new_event_id = Uuid::new_v4().to_string();

    sqlx::query("INSERT INTO event (id, name, start_date, end_date) VALUES (?, ?, ?, ?)")
        .bind(&new_event_id)
        .bind(&new_name)
        .bind(&start_date)
        .bind(&end_date)
        .execute(&pool)
        .await
        .map_err(|e| format!("Failed to create duplicated event: {}", e))?;

    println!("[DB] ✅ Nouvel événement créé: {}", new_event_id);

    // 2. Dupliquer les zones
    let zones = sqlx::query(
        "SELECT id, name, color, description, geometry_json FROM zone WHERE event_id = ?",
    )
    .bind(&source_event_id)
    .fetch_all(&pool)
    .await
    .map_err(|e| format!("Failed to fetch zones: {}", e))?;

    for zone in zones {
        let new_zone_id = Uuid::new_v4().to_string();
        let name: Option<String> = zone.get("name");
        let color: Option<String> = zone.get("color");
        let description: Option<String> = zone.get("description");
        let geometry_json: Option<String> = zone.get("geometry_json");

        sqlx::query("INSERT INTO zone (id, event_id, name, color, description, geometry_json) VALUES (?, ?, ?, ?, ?, ?)")
            .bind(&new_zone_id)
            .bind(&new_event_id)
            .bind(&name)
            .bind(&color)
            .bind(&description)
            .bind(&geometry_json)
            .execute(&pool)
            .await
            .map_err(|e| format!("Failed to duplicate zone: {}", e))?;
    }
    println!("[DB] ✅ Zones dupliquées");

    // 3. Dupliquer les parcours
    let parcours = sqlx::query("SELECT id, name, color, start_time, speed_low, speed_high, geometry_json FROM parcours WHERE event_id = ?")
        .bind(&source_event_id)
        .fetch_all(&pool)
        .await
        .map_err(|e| format!("Failed to fetch parcours: {}", e))?;

    for p in parcours {
        let new_parcours_id = Uuid::new_v4().to_string();
        let name: Option<String> = p.get("name");
        let color: Option<String> = p.get("color");
        let start_time: Option<i64> = p.get("start_time");
        let speed_low: Option<f64> = p.get("speed_low");
        let speed_high: Option<f64> = p.get("speed_high");
        let geometry_json: Option<String> = p.get("geometry_json");

        sqlx::query("INSERT INTO parcours (id, event_id, name, color, start_time, speed_low, speed_high, geometry_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
            .bind(&new_parcours_id)
            .bind(&new_event_id)
            .bind(&name)
            .bind(&color)
            .bind(start_time)
            .bind(speed_low)
            .bind(speed_high)
            .bind(&geometry_json)
            .execute(&pool)
            .await
            .map_err(|e| format!("Failed to duplicate parcours: {}", e))?;
    }
    println!("[DB] ✅ Parcours dupliqués");

    // 4. Dupliquer les points et leurs photos
    let points =
        sqlx::query("SELECT id, x, y, name, status, comment, type FROM point WHERE event_id = ?")
            .bind(&source_event_id)
            .fetch_all(&pool)
            .await
            .map_err(|e| format!("Failed to fetch points: {}", e))?;

    for point in points {
        let old_point_id: String = point.get("id");
        let new_point_id = Uuid::new_v4().to_string();
        let x: Option<f64> = point.get("x");
        let y: Option<f64> = point.get("y");
        let name: Option<String> = point.get("name");
        let status: Option<bool> = point.get("status");
        let comment: Option<String> = point.get("comment");
        let point_type: Option<String> = point.get("type");

        sqlx::query("INSERT INTO point (id, event_id, x, y, name, status, comment, type) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
            .bind(&new_point_id)
            .bind(&new_event_id)
            .bind(x)
            .bind(y)
            .bind(&name)
            .bind(status)
            .bind(&comment)
            .bind(&point_type)
            .execute(&pool)
            .await
            .map_err(|e| format!("Failed to duplicate point: {}", e))?;

        // Dupliquer les photos du point (table picture)
        let photos = sqlx::query("SELECT image_data FROM picture WHERE point_id = ?")
            .bind(&old_point_id)
            .fetch_all(&pool)
            .await
            .unwrap_or_default(); // Ignorer si pas de photos

        for photo in photos {
            let image_data: Option<String> = photo.get("image_data");

            let _ = sqlx::query("INSERT INTO picture (point_id, image_data) VALUES (?, ?)")
                .bind(&new_point_id)
                .bind(&image_data)
                .execute(&pool)
                .await; // Ignorer les erreurs
        }
    }
    println!("[DB] ✅ Points et photos dupliqués");

    // 5. Dupliquer les équipes liées à l'événement (team a directement event_id)
    let teams = sqlx::query("SELECT id, name FROM team WHERE event_id = ?")
        .bind(&source_event_id)
        .fetch_all(&pool)
        .await
        .map_err(|e| format!("Failed to fetch teams: {}", e))?;

    for team in teams {
        let old_team_id: String = team.get("id");
        let new_team_id = Uuid::new_v4().to_string();
        let name: Option<String> = team.get("name");

        sqlx::query("INSERT INTO team (id, event_id, name) VALUES (?, ?, ?)")
            .bind(&new_team_id)
            .bind(&new_event_id)
            .bind(&name)
            .execute(&pool)
            .await
            .map_err(|e| format!("Failed to duplicate team: {}", e))?;

        // Dupliquer les membres de l'équipe (table member)
        let members = sqlx::query("SELECT person_id FROM member WHERE team_id = ?")
            .bind(&old_team_id)
            .fetch_all(&pool)
            .await
            .unwrap_or_default(); // Ignorer si pas de membres

        for member in members {
            let person_id: String = member.get("person_id");
            let new_member_id = Uuid::new_v4().to_string();
            let _ = sqlx::query("INSERT INTO member (id, team_id, person_id) VALUES (?, ?, ?)")
                .bind(&new_member_id)
                .bind(&new_team_id)
                .bind(&person_id)
                .execute(&pool)
                .await; // Ignorer les erreurs (doublons possibles)
        }
    }
    println!("[DB] ✅ Équipes dupliquées");

    // 6. Dupliquer les équipements
    let equipements = sqlx::query("SELECT id, type_id, length_per_unit, quantity, description, date_pose, date_depose FROM equipement WHERE event_id = ?")
        .bind(&source_event_id)
        .fetch_all(&pool)
        .await
        .unwrap_or_default(); // Ignorer si pas d'équipements

    for equip in equipements {
        let old_equip_id: String = equip.get("id");
        let new_equip_id = Uuid::new_v4().to_string();
        let type_id: Option<String> = equip.get("type_id");
        let length_per_unit: Option<i32> = equip.get("length_per_unit");
        let quantity: Option<i32> = equip.get("quantity");
        let description: Option<String> = equip.get("description");
        let date_pose: Option<String> = equip.get("date_pose");
        let date_depose: Option<String> = equip.get("date_depose");

        let _ = sqlx::query("INSERT INTO equipement (id, event_id, type_id, length_per_unit, quantity, description, date_pose, date_depose) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
            .bind(&new_equip_id)
            .bind(&new_event_id)
            .bind(&type_id)
            .bind(length_per_unit)
            .bind(quantity)
            .bind(&description)
            .bind(&date_pose)
            .bind(&date_depose)
            .execute(&pool)
            .await; // Ignorer les erreurs

        // Dupliquer les coordonnées de l'équipement
        let coords = sqlx::query(
            "SELECT x, y, order_index FROM equipement_coordinate WHERE equipement_id = ?",
        )
        .bind(&old_equip_id)
        .fetch_all(&pool)
        .await
        .unwrap_or_default();

        for coord in coords {
            let new_coord_id = Uuid::new_v4().to_string();
            let x: Option<f64> = coord.get("x");
            let y: Option<f64> = coord.get("y");
            let order_index: Option<i32> = coord.get("order_index");

            let _ = sqlx::query("INSERT INTO equipement_coordinate (id, equipement_id, x, y, order_index) VALUES (?, ?, ?, ?, ?)")
                .bind(&new_coord_id)
                .bind(&new_equip_id)
                .bind(x)
                .bind(y)
                .bind(order_index)
                .execute(&pool)
                .await; // Ignorer les erreurs
        }
    }
    println!("[DB] ✅ Équipements dupliqués");

    println!(
        "[DB] ✅ Duplication complète de l'événement {} vers {}",
        source_event_id, new_event_id
    );
    Ok(new_event_id)
}

#[allow(dead_code)]
pub async fn is_first_launch(pool: &SqlitePool) -> sqlx::Result<bool> {
    let (count,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM user")
        .fetch_one(pool)
        .await?;
    Ok(count == 0)
}
