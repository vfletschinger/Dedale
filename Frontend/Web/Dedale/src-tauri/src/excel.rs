use crate::db::{self};
use crate::types::{EquipementComplet, PointWithDetails};
use crate::utils;
use rust_xlsxwriter::{Color, Format, Workbook};
use sqlx::Row;
use tauri::AppHandle;

#[tauri::command]
pub async fn export_points_excel(app: AppHandle, event_id: Option<String>) -> Result<String, String> {
    let points: Vec<PointWithDetails> = db::retrieve_data_by_event(&app, &event_id).await?;
    println!("📊 Export Excel : {} points récupérés", points.len());

    // Récupérer les équipements si un event_id est fourni
    let equipements: Vec<EquipementComplet> = if let Some(eid) = &event_id {
        db::fetch_equipements_for_event(app.clone(), eid.clone()).await?
    } else {
        vec![]
    };
    println!(
        "📊 Export Excel : {} équipements récupérés",
        equipements.len()
    );

    let event_name = if let Some(eid) = &event_id {
        let pool = db::get_db_pool(&app).await?;
        let row = sqlx::query("SELECT name FROM event WHERE id = ?")
            .bind(eid)
            .fetch_optional(&pool)
            .await
            .map_err(|e| e.to_string())?;

        row.map(|r| r.get::<String, _>("name"))
            .unwrap_or("Inconnu".to_string())
    } else {
        "Tous les événements".to_string()
    };

    let mut workbook = Workbook::new();

    // ============================
    // FEUILLE 1 : POINTS
    // ============================
    let ws_points = workbook.add_worksheet();
    ws_points
        .set_name("Points")
        .map_err(|e| e.to_string())?;

    let header_format = Format::new()
        .set_bold()
        .set_background_color(Color::RGB(0xE0E0E0))
        .set_border(rust_xlsxwriter::FormatBorder::Thin);

    let point_headers = [
        "Point ID",
        "Nom",
        "X (Longitude)",
        "Y (Latitude)",
        "Commentaire",
        "Type",
        "Statut",
        "Événement",
    ];

    for (col, header) in point_headers.iter().enumerate() {
        ws_points
            .write_string_with_format(0, col as u16, *header, &header_format)
            .map_err(|e| e.to_string())?;
        ws_points
            .set_column_width(col as u16, 18)
            .map_err(|e| e.to_string())?;
    }

    let mut current_row: u32 = 1;

    for p in &points {
        let row_event_name = if event_id.is_some() {
            event_name.clone()
        } else {
            if p.event_id.is_some() {
                "Lié"
            } else {
                ""
            }
            .to_string()
        };

        let point_name = p.name.as_deref().unwrap_or("");
        let point_comment = p.comment.as_deref().unwrap_or("");
        let point_type = p.r#type.as_deref().unwrap_or("");
        let point_status = match p.status {
            Some(true) => "Validé",
            Some(false) => "Non validé",
            None => "",
        };

        ws_points
            .write_string(current_row, 0, &p.id)
            .map_err(|e| e.to_string())?;
        ws_points
            .write_string(current_row, 1, point_name)
            .map_err(|e| e.to_string())?;
        ws_points
            .write_number(current_row, 2, p.x)
            .map_err(|e| e.to_string())?;
        ws_points
            .write_number(current_row, 3, p.y)
            .map_err(|e| e.to_string())?;
        ws_points
            .write_string(current_row, 4, point_comment)
            .map_err(|e| e.to_string())?;
        ws_points
            .write_string(current_row, 5, point_type)
            .map_err(|e| e.to_string())?;
        ws_points
            .write_string(current_row, 6, point_status)
            .map_err(|e| e.to_string())?;
        ws_points
            .write_string(current_row, 7, &row_event_name)
            .map_err(|e| e.to_string())?;

        current_row += 1;
    }

    // ============================
    // FEUILLE 2 : ÉQUIPEMENTS / OBSTACLES
    // ============================
    let ws_equip = workbook.add_worksheet();
    ws_equip
        .set_name("Équipements")
        .map_err(|e| e.to_string())?;

    let equip_headers = [
        "Équipement ID",
        "Type",
        "Description Type",
        "Description",
        "Quantité",
        "Longueur/unité (m)",
        "Date Pose",
        "Date Dépose",
        "Nb Coordonnées",
        "Coordonnées (lon,lat)",
        "Événement",
    ];

    for (col, header) in equip_headers.iter().enumerate() {
        ws_equip
            .write_string_with_format(0, col as u16, *header, &header_format)
            .map_err(|e| e.to_string())?;
        ws_equip
            .set_column_width(col as u16, 20)
            .map_err(|e| e.to_string())?;
    }

    let mut eq_row: u32 = 1;

    for eq in &equipements {
        let type_name = eq.type_name.as_deref().unwrap_or("");
        let type_desc = eq.type_description.as_deref().unwrap_or("");
        let description = eq.description.as_deref().unwrap_or("");
        let date_pose = eq.date_pose.as_deref().unwrap_or("");
        let date_depose = eq.date_depose.as_deref().unwrap_or("");
        let length = eq.length.unwrap_or(0) as f64;

        // Formater les coordonnées en une chaîne lisible
        let coords_str: String = eq
            .coordinates
            .iter()
            .map(|c| format!("({:.6}, {:.6})", c.x, c.y))
            .collect::<Vec<_>>()
            .join(" → ");

        ws_equip
            .write_string(eq_row, 0, &eq.id)
            .map_err(|e| e.to_string())?;
        ws_equip
            .write_string(eq_row, 1, type_name)
            .map_err(|e| e.to_string())?;
        ws_equip
            .write_string(eq_row, 2, type_desc)
            .map_err(|e| e.to_string())?;
        ws_equip
            .write_string(eq_row, 3, description)
            .map_err(|e| e.to_string())?;

        // Quantité
        let quantity = eq.quantity.unwrap_or(0) as f64;
        ws_equip
            .write_number(eq_row, 4, quantity)
            .map_err(|e| e.to_string())?;
        ws_equip
            .write_number(eq_row, 5, length)
            .map_err(|e| e.to_string())?;
        ws_equip
            .write_string(eq_row, 6, date_pose)
            .map_err(|e| e.to_string())?;
        ws_equip
            .write_string(eq_row, 7, date_depose)
            .map_err(|e| e.to_string())?;
        ws_equip
            .write_number(eq_row, 8, eq.coordinates.len() as f64)
            .map_err(|e| e.to_string())?;
        ws_equip
            .write_string(eq_row, 9, &coords_str)
            .map_err(|e| e.to_string())?;
        ws_equip
            .write_string(eq_row, 10, &event_name)
            .map_err(|e| e.to_string())?;

        eq_row += 1;
    }

    // ============================
    // SAUVEGARDE
    // ============================
    let (dir_path, file_name) = utils::create_file_name("recap".to_string(), "xlsx".to_string());

    if let Some(file_path) = utils::show_save_dialog(&file_name, &dir_path, "xlsx".to_string()) {
        println!("💾 Saving workbook... {}", file_path.display());
        workbook.save(&file_path).map_err(|e| e.to_string())?;
        println!("✅ Excel saved successfully!");
        Ok(file_path.display().to_string())
    } else {
        println!("Save cancelled by user");
        Err("Export annulé par l'utilisateur".to_string())
    }
}
