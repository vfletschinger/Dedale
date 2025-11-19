use crate::db::Point;
use rust_xlsxwriter::Workbook;
use tauri::AppHandle;
use std::path::PathBuf;
use dirs::data_dir;

#[tauri::command]
pub async fn export_points_excel(app: AppHandle) -> Result<(), String> { 
    /*let mut path: PathBuf = data_dir().expect("Impossible de récupérer data_dir");

    path.push("dedale");
    path.push("recap.xlsx");

    let excel_path = path.to_str().ok_or("Chemin Excel invalide")?;
    println!("📂 Excel path: {:?}", excel_path);

    let points: Vec<Point> = crate::db::retrieve_data(&app).await?;
    println!("📊 Retrieved {} points", points.len());

    let mut workbook = Workbook::new();
    let worksheet = workbook.add_worksheet();

    let headers = [
        "Point ID", "X", "Y", "Obstacle Nom", 
        "Obstacle Description", "Nombre", "Largeur", "Longueur"
    ];
    for (col, header) in headers.iter().enumerate() {
        worksheet.write_string(0, col as u16, *header)
            .map_err(|e| e.to_string())?;
    }

    for (row_idx, p) in points.iter().enumerate() {
        let row_num = row_idx + 1;
        worksheet.write_number(row_num as u32, 0, p.id as f64).map_err(|e| e.to_string())?;
        worksheet.write_number(row_num as u32, 1, p.x).map_err(|e| e.to_string())?;
        worksheet.write_number(row_num as u32, 2, p.y).map_err(|e| e.to_string())?;
        worksheet.write_string(row_num as u32, 3, p.obstacle_nom.as_deref().unwrap_or("")).map_err(|e| e.to_string())?;
        worksheet.write_string(row_num as u32, 4, p.obstacle_description.as_deref().unwrap_or("")).map_err(|e| e.to_string())?;
        worksheet.write_number(row_num as u32, 5, p.nombre.unwrap_or(0) as f64).map_err(|e| e.to_string())?;
        worksheet.write_number(row_num as u32, 6, p.obstacle_largeur.unwrap_or(0.0)).map_err(|e| e.to_string())?;
        worksheet.write_number(row_num as u32, 7, p.obstacle_longueur.unwrap_or(0.0)).map_err(|e| e.to_string())?;
    }


    println!("💾 Saving workbook...");
    workbook.save(excel_path)
        .map_err(|e| e.to_string())?;

    println!("✅ Excel saved successfully!");*/

    Ok(())
}
