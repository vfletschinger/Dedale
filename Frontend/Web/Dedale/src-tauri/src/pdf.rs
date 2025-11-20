use crate::db;
use tauri::AppHandle;
use genpdf::elements;
use crate::seed;
use crate::utils;
use std::path::PathBuf;

#[tauri::command]
pub async fn create_pdf(app: AppHandle) -> Result<(), String> {
    seed::seed_database(&app).await?;
    let data = db::retrieve_data(&app).await?;
    
    let font_family = genpdf::fonts::from_files("./fonts", "LiberationSans", None)
        .map_err(|e| format!("Failed to load font family: {}", e))?;

    let mut doc = genpdf::Document::new(font_family);
    doc.set_title("recap");
    let mut decorator = genpdf::SimplePageDecorator::new();
    decorator.set_margins(10);
    doc.set_page_decorator(decorator);

    for p in data {
        let mut point_text = String::new();

        point_text.push_str(&format!("--- Point {} (X: {}, Y: {}) ---", p.id, p.x, p.y));

        let obs_str = if p.obstacles.is_empty() {
            "None".to_string()
        } else {
            p.obstacles.iter().map(|o| {
                let name = o.name.as_deref().unwrap_or("N/A");
                let number = o.number.unwrap_or(0);
                format!("{} (x{})", name, number)
            }).collect::<Vec<String>>().join(", ")
        };
        point_text.push_str(&format!(" Obstacles: {}.", obs_str));

        let com_str = if p.comments.is_empty() {
            "None".to_string()
        } else {
            p.comments.iter().map(|c| {
                format!("\"{}\"", c.value)
            }).collect::<Vec<String>>().join(", ")
        };
        point_text.push_str(&format!(" Comments: {}.", com_str));

        let pic_str = if p.pictures.is_empty() {
            "None".to_string()
        } else {
            p.pictures.iter().map(|i| {
                format!("{}", i.image) 
            }).collect::<Vec<String>>().join(", ")
        };
        point_text.push_str(&format!(" Pictures: {}.", pic_str));

        doc.push(elements::Paragraph::new(point_text));
        doc.push(elements::Break::new(1.5));
    }

    
    let (dir_path, file_name) = utils::create_file_name("pdf".to_string());
    if let Some(file_path) = utils::show_save_dialog(&file_name, &dir_path, "pdf".to_string()) {
        doc.render_to_file(file_path)
            .map_err(|e| format!("Failed to write PDF file: {}", e))?;
            
        println!("PDF successfully saved.");
    } else {
        println!("Save cancelled by user");
    }

    Ok(())
}