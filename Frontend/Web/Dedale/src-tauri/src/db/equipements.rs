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
