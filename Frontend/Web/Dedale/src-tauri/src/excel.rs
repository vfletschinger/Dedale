use crate::db::Point;
use crate::utils;
use rust_xlsxwriter::Workbook;
use tauri::AppHandle;

#[tauri::command]
pub async fn export_points_excel(app: AppHandle) -> Result<(), String> {
    let points: Vec<Point> = crate::db::retrieve_data(&app).await?;
    println!("📊 Retrieved {} points", points.len());

    let mut workbook = Workbook::new();
    let worksheet = workbook.add_worksheet();

    let headers = [
        "Point ID",
        "X",
        "Y",
        "Obstacle Nom",
        "Obstacle Description",
        "Nombre",
        "Largeur",
        "Longueur",
    ];
    for (col, header) in headers.iter().enumerate() {
        worksheet
            .write_string(0, col as u16, *header)
            .map_err(|e| e.to_string())?;
    }

    let mut current_row: u32 = 1;

    for p in points {
        if !p.obstacles.is_empty() {
            for obstacle in &p.obstacles {
                worksheet
                    .write_string(current_row, 0, &p.id)
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

                current_row += 1;
            }
        } else {
            worksheet
                .write_string(current_row, 0, &p.id)
                .map_err(|e| e.to_string())?;
            worksheet
                .write_number(current_row, 1, p.x)
                .map_err(|e| e.to_string())?;
            worksheet
                .write_number(current_row, 2, p.y)
                .map_err(|e| e.to_string())?;

            worksheet
                .write_string(current_row, 3, "")
                .map_err(|e| e.to_string())?; // Nom
            worksheet
                .write_string(current_row, 4, "")
                .map_err(|e| e.to_string())?; // Desc
            worksheet
                .write_number(current_row, 5, 0.0)
                .map_err(|e| e.to_string())?; // Nombre
            worksheet
                .write_number(current_row, 6, 0.0)
                .map_err(|e| e.to_string())?; // Largeur
            worksheet
                .write_number(current_row, 7, 0.0)
                .map_err(|e| e.to_string())?; // Longueur

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
