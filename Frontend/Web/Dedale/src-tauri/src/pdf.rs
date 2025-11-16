use crate::db; 
use tauri::AppHandle;

#[tauri::command]
pub async fn create_pdf(app: AppHandle) -> Result<(), String> {
    db::insert_test_data(&app).await?;
    let data = db::retrieve_all_points_data(&app).await?;
    
    let font_family = genpdf::fonts::from_files("./fonts", "LiberationSans", None)
        .map_err(|e| format!("Failed to load font family: {}", e))?;

    let mut doc = genpdf::Document::new(font_family);
    doc.set_title("Demo document");
    let mut decorator = genpdf::SimplePageDecorator::new();
    decorator.set_margins(10);
    doc.set_page_decorator(decorator);

    let formatted_data: String = data.iter()
        .map(|p| format!("Point ID: {}, X: {}, Y: {}", p.id, p.x, p.y))
        .collect::<Vec<String>>()
        .join("\n");

    doc.push(genpdf::elements::Paragraph::new(formatted_data));
    
    doc.render_to_file("output.pdf")
        .map_err(|e| format!("Failed to write PDF file: {}", e))?;

    Ok(())
}