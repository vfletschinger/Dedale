use crate::db::{self, Point};
use crate::utils;
use rust_xlsxwriter::{Color, Format, Workbook};
use sqlx::Row;
use tauri::AppHandle;

#[tauri::command]
pub async fn export_points_excel(app: AppHandle, event_id: Option<i64>) -> Result<(), String> {
    let points: Vec<Point> = db::retrieve_data_by_event(&app, event_id).await?;
    println!("📊 Export Excel : {} points récupérés", points.len());

    let event_name = if let Some(eid) = event_id {
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
    let worksheet = workbook.add_worksheet();

    let header_format = Format::new()
        .set_bold()
        .set_background_color(Color::RGB(0xE0E0E0))
        .set_border(rust_xlsxwriter::FormatBorder::Thin);

    let headers = [
        "Point ID",
        "X",
        "Y",
        "Obstacle Nom",
        "Obstacle Description",
        "Nombre",
        "Largeur",
        "Longueur",
        "Événement",
    ];

    for (col, header) in headers.iter().enumerate() {
        worksheet
            .write_string_with_format(0, col as u16, *header, &header_format)
            .map_err(|e| e.to_string())?;
        worksheet
            .set_column_width(col as u16, 15)
            .map_err(|e| e.to_string())?;
    }

    let mut current_row: u32 = 1;

    for p in points {
        let row_event_name = if event_id.is_some() {
            event_name.clone()
        } else {
            if !p.event_ids.is_empty() { "Lié" } else { "" }.to_string()
        };

        if !p.obstacles.is_empty() {
            for obstacle in &p.obstacles {
                worksheet
                    .write_number(current_row, 0, p.id as f64)
                    .map_err(|e| e.to_string())?;
                worksheet
                    .write_number(current_row, 1, p.x)
                    .map_err(|e| e.to_string())?;
                worksheet
                    .write_number(current_row, 2, p.y)
                    .map_err(|e| e.to_string())?;

                let name = obstacle.name.as_deref().unwrap_or("");
                let description = obstacle.description.as_deref().unwrap_or("");
                let number = obstacle.number.unwrap_or(0) as f64;
                let width = obstacle.width.unwrap_or(0.0);
                let length = obstacle.length.unwrap_or(0.0);

                worksheet
                    .write_string(current_row, 3, name)
                    .map_err(|e| e.to_string())?;
                worksheet
                    .write_string(current_row, 4, description)
                    .map_err(|e| e.to_string())?;
                worksheet
                    .write_number(current_row, 5, number)
                    .map_err(|e| e.to_string())?;
                worksheet
                    .write_number(current_row, 6, width)
                    .map_err(|e| e.to_string())?;
                worksheet
                    .write_number(current_row, 7, length)
                    .map_err(|e| e.to_string())?;

                worksheet
                    .write_string(current_row, 8, &row_event_name)
                    .map_err(|e| e.to_string())?;

                current_row += 1;
            }
        } else {
            worksheet
                .write_number(current_row, 0, p.id as f64)
                .map_err(|e| e.to_string())?;
            worksheet
                .write_number(current_row, 1, p.x)
                .map_err(|e| e.to_string())?;
            worksheet
                .write_number(current_row, 2, p.y)
                .map_err(|e| e.to_string())?;

            worksheet
                .write_string(current_row, 3, "")
                .map_err(|e| e.to_string())?;
            worksheet
                .write_string(current_row, 4, "")
                .map_err(|e| e.to_string())?;
            worksheet
                .write_number(current_row, 5, 0.0)
                .map_err(|e| e.to_string())?;
            worksheet
                .write_number(current_row, 6, 0.0)
                .map_err(|e| e.to_string())?;
            worksheet
                .write_number(current_row, 7, 0.0)
                .map_err(|e| e.to_string())?;
            worksheet
                .write_string(current_row, 8, &row_event_name)
                .map_err(|e| e.to_string())?;

            current_row += 1;
        }
    }

    let (dir_path, file_name) = utils::create_file_name("xlsx".to_string());

    if let Some(file_path) = utils::show_save_dialog(&file_name, &dir_path, "xlsx".to_string()) {
        println!("💾 Saving workbook... {}", file_path.display());
        workbook.save(file_path).map_err(|e| e.to_string())?;
        println!("✅ Excel saved successfully!");
    } else {
        println!("Save cancelled by user");
    }

    Ok(())
}
