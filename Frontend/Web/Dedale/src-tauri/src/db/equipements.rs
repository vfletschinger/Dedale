use crate::db::get_db_pool;
use crate::types::*;
use sqlx::Row;
use tauri::AppHandle;
use uuid::Uuid;

// ============================================
// TYPES D'ÉQUIPEMENTS
// ============================================

#[tauri::command]
pub async fn fetch_equipment_types(app: AppHandle) -> Result<Vec<Type>, String> {
    let pool = get_db_pool(&app).await?;

    let rows = sqlx::query("SELECT id, name, description FROM type")
        .fetch_all(&pool)
        .await
        .map_err(|e| e.to_string())?;

    let types: Vec<Type> = rows
        .into_iter()
        .map(|row| Type {
            id: row.get("id"),
            name: row.get("name"),
            description: row.get("description"),
            width: None,
            length: None,
            height: None,
        })
        .collect();

    println!("[DB] 📦 {} type(s) d'équipement récupéré(s)", types.len());
    Ok(types)
}

#[tauri::command]
pub async fn create_equipment_type(
    app: AppHandle,
    name: String,
    description: Option<String>,
) -> Result<Type, String> {
    let pool = get_db_pool(&app).await?;
    let uuid = Uuid::new_v4().to_string();

    sqlx::query("INSERT INTO type (id, name, description) VALUES (?, ?, ?)")
        .bind(&uuid)
        .bind(&name)
        .bind(&description)
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;

    println!("[DB] ✅ Type d'équipement '{}' créé", name);

    Ok(Type {
        id: uuid,
        name: Some(name),
        description,
        width: None,
        length: None,
        height: None,
    })
}

#[tauri::command]
pub async fn seed_default_equipment_types(app: AppHandle) -> Result<(), String> {
    let pool = get_db_pool(&app).await?;

    // Vérifier si les types par défaut existent déjà
    let (count,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM type")
        .fetch_one(&pool)
        .await
        .map_err(|e| e.to_string())?;

    if count == 0 {
        // Créer les types par défaut
        let default_types = vec![
            ("Barrière", "Barrière de sécurité standard"),
            ("Bloc de béton", "Bloc de béton pour sécurisation"),
            ("Véhicule", "Véhicule de blocage ou de sécurisation"),
        ];

        for (name, description) in default_types {
            let uuid = Uuid::new_v4().to_string();
            sqlx::query("INSERT INTO type (id, name, description) VALUES (?, ?, ?)")
                .bind(&uuid)
                .bind(name)
                .bind(description)
                .execute(&pool)
                .await
                .map_err(|e| e.to_string())?;
        }

        println!("[DB] 🌱 Types d'équipement par défaut créés");
    }

    Ok(())
}

// ============================================
// ÉQUIPEMENTS
// ============================================

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn create_equipement(
    app: AppHandle,
    event_id: String,
    type_id: String,
    quantity: i32,
    length_per_unit: i32,
    description: Option<String>,
    date_pose: String,
    date_depose: String,
    coordinates: Vec<(f64, f64)>, // Liste de (x, y) représentant la ligne
) -> Result<EquipementComplet, String> {
    let pool = get_db_pool(&app).await?;
    let equipement_id = Uuid::new_v4().to_string();

    // 1. Créer l'équipement
    sqlx::query(
        "INSERT INTO equipement (id, event_id, type_id, quantity, length_per_unit, description, date_pose, date_depose) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(&equipement_id)
    .bind(&event_id)
    .bind(&type_id)
    .bind(quantity)
    .bind(length_per_unit)
    .bind(&description)
    .bind(&date_pose)
    .bind(&date_depose)
    .execute(&pool)
    .await
    .map_err(|e| e.to_string())?;

    // 2. Créer les coordonnées
    let mut coords: Vec<EquipementCoordinate> = Vec::new();
    for (index, (x, y)) in coordinates.iter().enumerate() {
        let coord_id = Uuid::new_v4().to_string();
        sqlx::query(
            "INSERT INTO equipement_coordinate (id, equipement_id, x, y, order_index) VALUES (?, ?, ?, ?, ?)"
        )
        .bind(&coord_id)
        .bind(&equipement_id)
        .bind(x)
        .bind(y)
        .bind(index as i64)
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;

        coords.push(EquipementCoordinate {
            id: coord_id,
            equipement_id: equipement_id.clone(),
            x: *x,
            y: *y,
            order_index: Some(index as i64),
        });
    }

    // 3. Récupérer le nom du type
    let type_row = sqlx::query("SELECT name, description FROM type WHERE id = ?")
        .bind(&type_id)
        .fetch_optional(&pool)
        .await
        .map_err(|e| e.to_string())?;

    let (type_name, type_description) = match type_row {
        Some(row) => (row.get("name"), row.get("description")),
        None => (None, None),
    };

    println!("[DB] ✅ Équipement créé avec {} coordonnées", coords.len());

    Ok(EquipementComplet {
        id: equipement_id,
        type_id: Some(type_id),
        type_name,
        type_description,
        length: Some(length_per_unit),
        description,
        date_pose: Some(date_pose.clone()),
        hour_pose: None,
        date_depose: Some(date_depose.clone()),
        hour_depose: None,
        coordinates: coords,
    })
}

#[tauri::command]
pub async fn fetch_equipements_for_event(
    app: AppHandle,
    event_id: String,
) -> Result<Vec<EquipementComplet>, String> {
    let pool = get_db_pool(&app).await?;

    // Récupérer tous les équipements de l'événement avec le nom du type
    let rows = sqlx::query(
        "SELECT e.id, e.type_id, e.quantity, e.length_per_unit, e.description, e.date_pose, e.date_depose,
                t.name as type_name, t.description as type_description
         FROM equipement e
         LEFT JOIN type t ON e.type_id = t.id
         WHERE e.event_id = ?",
    )
    .bind(&event_id)
    .fetch_all(&pool)
    .await
    .map_err(|e| e.to_string())?;

    let mut equipements: Vec<EquipementComplet> = Vec::new();

    for row in rows {
        let equipement_id: String = row.get("id");

        // Récupérer les coordonnées de cet équipement
        let coord_rows = sqlx::query(
            "SELECT id, equipement_id, x, y, order_index 
             FROM equipement_coordinate 
             WHERE equipement_id = ? 
             ORDER BY order_index",
        )
        .bind(&equipement_id)
        .fetch_all(&pool)
        .await
        .map_err(|e| e.to_string())?;

        let coordinates: Vec<EquipementCoordinate> = coord_rows
            .into_iter()
            .map(|coord_row| EquipementCoordinate {
                id: coord_row.get("id"),
                equipement_id: coord_row.get("equipement_id"),
                x: coord_row.get("x"),
                y: coord_row.get("y"),
                order_index: coord_row.get("order_index"),
            })
            .collect();

        equipements.push(EquipementComplet {
            id: equipement_id,
            type_id: row.get("type_id"),
            type_name: row.get("type_name"),
            type_description: row.get("type_description"),
            length: row.get("length_per_unit"),
            description: row.get("description"),
            date_pose: row.get("date_pose"),
            hour_pose: None,
            date_depose: row.get("date_depose"),
            hour_depose: None,
            coordinates,
        });
    }

    println!(
        "[DB] 📦 {} équipement(s) récupéré(s) pour l'événement {}",
        equipements.len(),
        event_id
    );

    Ok(equipements)
}

#[tauri::command]
pub async fn delete_equipement(app: AppHandle, equipement_id: String) -> Result<(), String> {
    let pool = get_db_pool(&app).await?;

    // Les coordonnées sont supprimées automatiquement grâce à ON DELETE CASCADE
    sqlx::query("DELETE FROM equipement WHERE id = ?")
        .bind(&equipement_id)
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;

    println!("[DB] 🗑️ Équipement {} supprimé", equipement_id);
    Ok(())
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn update_equipement(
    app: AppHandle,
    equipement_id: String,
    type_id: String,
    quantity: i32,
    length_per_unit: i32,
    description: Option<String>,
    date_pose: String,
    date_depose: String,
) -> Result<(), String> {
    let pool = get_db_pool(&app).await?;

    sqlx::query(
        "UPDATE equipement SET type_id = ?, quantity = ?, length_per_unit = ?, description = ?, date_pose = ?, date_depose = ? WHERE id = ?"
    )
    .bind(&type_id)
    .bind(quantity)
    .bind(length_per_unit)
    .bind(&description)
    .bind(&date_pose)
    .bind(&date_depose)
    .bind(&equipement_id)
    .execute(&pool)
    .await
    .map_err(|e| e.to_string())?;

    println!("[DB] ✅ Équipement {} mis à jour", equipement_id);
    Ok(())
}

#[tauri::command]
pub async fn fetch_actions(app: AppHandle, event_id: String) -> Result<Vec<Action>, String> {
    let pool = get_db_pool(&app).await?;

    let rows = sqlx::query(
        "SELECT a.id, a.team_id, a.equipement_id, a.type, a.scheduled_time, a.is_done
         FROM action a
         JOIN equipement e ON a.equipement_id = e.id
         WHERE e.event_id = ?
         ORDER BY a.scheduled_time DESC",
    )
    .bind(&event_id)
    .fetch_all(&pool)
    .await
    .map_err(|e| e.to_string())?;

    let actions: Vec<Action> = rows
        .into_iter()
        .map(|row| Action {
            id: row.get("id"),
            team_id: row.get("team_id"),
            equipement_id: row.get("equipement_id"),
            r#type: row.get("type"),
            scheduled_time: row.get("scheduled_time"),
            is_done: row.get("is_done"),
        })
        .collect();

    println!(
        "[DB] 📋 {} action(s) récupérée(s) pour l'événement {}",
        actions.len(),
        event_id
    );
    Ok(actions)
}

#[tauri::command]
pub async fn add_action(
    app: AppHandle,
    team_id: String,
    equipement_id: String,
    action_type: String,
) -> Result<String, String> {
    let pool = get_db_pool(&app).await?;

    // Vérifier si une action existe déjà pour cet équipement et ce type
    let existing_action: Option<(String,)> =
        sqlx::query_as("SELECT id FROM action WHERE equipement_id = ? AND type = ?")
            .bind(&equipement_id)
            .bind(&action_type)
            .fetch_optional(&pool)
            .await
            .map_err(|e| e.to_string())?;

    let action_id = existing_action
        .map(|(id,)| id)
        .unwrap_or_else(|| Uuid::new_v4().to_string());

    // Récupérer les dates de l'équipement
    let (date_pose, date_depose): (String, String) =
        sqlx::query_as("SELECT date_pose, date_depose FROM equipement WHERE id = ?")
            .bind(&equipement_id)
            .fetch_one(&pool)
            .await
            .map_err(|e| e.to_string())?;

    // Déterminer la scheduled_time en fonction du type d'action
    let scheduled_time = match action_type.as_str() {
        "pose" => date_pose,
        "depose" => date_depose,
        _ => date_depose, // date_depose par défaut
    };

    // Utiliser INSERT OR REPLACE pour mettre à jour si l'action existe déjà
    sqlx::query(
        "INSERT OR REPLACE INTO action (id, team_id, equipement_id, type, scheduled_time, is_done) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(&action_id)
    .bind(&team_id)
    .bind(&equipement_id)
    .bind(&action_type)
    .bind(&scheduled_time)
    .bind(false)
    .execute(&pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(action_id)
}

#[tauri::command]
pub async fn delete_action(app: AppHandle, action_id: String) -> Result<(), String> {
    let pool = get_db_pool(&app).await?;

    sqlx::query("DELETE FROM action WHERE id = ?")
        .bind(&action_id)
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;

    println!("[DB] 🗑️ Action {} supprimée", action_id);
    Ok(())
}

#[tauri::command]
pub async fn send_equipements_to_mobile(
    event_id: String,
    app: AppHandle,
) -> Result<Vec<TransferEquipement>, String> {
    let pool = get_db_pool(&app).await?;

    // Récupérer tous les équipements de l'événement
    let equipements = sqlx::query_as::<
        _,
        (
            String,
            String,
            String,
            Option<i32>,
            Option<i32>,
            Option<String>,
            Option<String>,
        ),
    >(
        "SELECT id, event_id, type_id, quantity, length_per_unit, date_pose, date_depose 
         FROM equipement 
         WHERE event_id = ?",
    )
    .bind(&event_id)
    .fetch_all(&pool)
    .await
    .map_err(|e| format!("Erreur récupération équipements: {}", e))?;

    // Pour chaque équipement, récupérer ses coordonnées
    let mut equipements_with_coords: Vec<TransferEquipement> = Vec::new();

    for (id, event_id, type_id, quantity, length_per_unit, date_pose, date_depose) in equipements {
        let coordinates = sqlx::query_as::<_, (String, f64, f64, Option<i32>)>(
            "SELECT id, x, y, order_index 
             FROM equipement_coordinate 
             WHERE equipement_id = ? 
             ORDER BY order_index ASC",
        )
        .bind(&id)
        .fetch_all(&pool)
        .await
        .map_err(|e| format!("Erreur récupération coordonnées: {}", e))?
        .into_iter()
        .map(
            |(coord_id, x, y, order_index)| TransferEquipementCoordinate {
                id: coord_id,
                equipement_id: id.clone(),
                x,
                y,
                order_index,
            },
        )
        .collect::<Vec<_>>();

        equipements_with_coords.push(TransferEquipement {
            id,
            event_id,
            type_id,
            quantity: quantity.unwrap_or(0),
            length_per_unit: length_per_unit.unwrap_or(0) as f64,
            date_pose,
            date_depose,
            coordinates,
        });
    }

    Ok(equipements_with_coords)
}

#[tauri::command]
pub async fn send_planning(team_id: String, app: AppHandle) -> Result<Planning, String> {
    let pool = get_db_pool(&app).await?;

    println!("[DB] 📤 send_planning appelé avec team_id: {}", team_id);

    // Récupérer les informations de l'équipe
    let team_info = sqlx::query_as::<_, (String, String, String)>(
        "SELECT id, name, event_id FROM team WHERE id = ?",
    )
    .bind(&team_id)
    .fetch_optional(&pool)
    .await
    .map_err(|e| format!("Erreur team: {}", e))?;

    let (team_id_db, team_name, event_id) = match team_info {
        Some(info) => info,
        None => return Err(format!("Équipe avec id {} non trouvée", team_id)),
    };

    let team = TransferTeamInfo {
        id: team_id_db.clone(),
        name: team_name.clone(),
        event_id: event_id.clone(),
    };

    println!(
        "[DB] 👥 Équipe trouvée: {} (event: {})",
        team_name, event_id
    );

    let actions = sqlx::query_as::<_, Action>(
        r#"
        SELECT id, team_id, equipement_id, type as type, scheduled_time, is_done 
        FROM action 
        WHERE team_id = ?
        "#,
    )
    .bind(&team_id)
    .fetch_all(&pool)
    .await
    .map_err(|e| format!("Erreur actions: {}", e))?;

    println!("[DB] 🔍 Actions trouvées: {}", actions.len());
    for action in &actions {
        println!(
            "   - Action: {} (equipement: {}, type: {:?})",
            action.id, action.equipement_id, action.r#type
        );
    }

    if actions.is_empty() {
        println!("[DB] ⚠️ Aucune action trouvée pour team_id: {}", team_id);
        return Ok(Planning {
            team,
            actions: vec![],
            equipements: vec![],
            coordonees: vec![],
        });
    }

    let equipement_ids: Vec<String> = actions.iter().map(|a| a.equipement_id.clone()).collect();

    let equip_params = vec!["?"; equipement_ids.len()].join(",");
    let sql_equip = format!("SELECT id, event_id, type_id, quantity, length_per_unit, date_pose, date_depose FROM equipement WHERE id IN ({})", equip_params);

    let mut query_equip = sqlx::query_as::<_, TransferEquipementWithoutCoords>(&sql_equip);
    for id in &equipement_ids {
        query_equip = query_equip.bind(id);
    }

    let raw_equipements = query_equip
        .fetch_all(&pool)
        .await
        .map_err(|e| format!("Erreur equipements: {}", e))?;

    // 3. Récupérer les COORDONNÉES pour ces équipements
    let sql_coords = format!("SELECT id, equipement_id, x, y, order_index FROM equipement_coordinate WHERE equipement_id IN ({})", equip_params);
    let mut query_coords = sqlx::query_as::<_, TransferEquipementCoordinate>(&sql_coords);
    for id in &equipement_ids {
        query_coords = query_coords.bind(id);
    }

    let coords = query_coords
        .fetch_all(&pool)
        .await
        .map_err(|e| format!("Erreur coords: {}", e))?;

    let final_equipements: Vec<TransferEquipement> = raw_equipements
        .into_iter()
        .map(|eq| {
            let my_coords: Vec<TransferEquipementCoordinate> = coords
                .iter()
                .filter(|c| c.equipement_id == eq.id)
                .cloned()
                .collect();

            TransferEquipement {
                id: eq.id,
                event_id: eq.event_id,
                type_id: eq.type_id,
                quantity: eq.quantity.unwrap_or(0),
                length_per_unit: eq.length_per_unit.unwrap_or(0) as f64,
                date_pose: eq.date_pose,
                date_depose: eq.date_depose,
                coordinates: my_coords,
            }
        })
        .collect();

    println!("[DB] 🚚 Équipements trouvés: {}", final_equipements.len());
    println!("[DB] 📍 Coordonnées totales: {}", coords.len());

    let result = Planning {
        team,
        actions,
        equipements: final_equipements,
        coordonees: coords,
    };

    println!(
        "[DB] ✅ Planning final: équipe '{}', {} actions, {} équipements, {} coordonnées",
        result.team.name,
        result.actions.len(),
        result.equipements.len(),
        result.coordonees.len()
    );

    Ok(result)
}
