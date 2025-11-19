use crate::db;
use tauri::AppHandle;

#[tauri::command]
pub async fn create_pdf(app: AppHandle) -> Result<(), String> {
    db::insert_test_data(&app).await?;
    let data = db::retrieve_data(&app).await?;
    
    let font_family = genpdf::fonts::from_files("./fonts", "LiberationSans", None)
        .map_err(|e| format!("Failed to load font family: {}", e))?;

    let mut doc = genpdf::Document::new(font_family);
    doc.set_title("Demo document");
    let mut decorator = genpdf::SimplePageDecorator::new();
    decorator.set_margins(10);
    doc.set_page_decorator(decorator);

    let formatted_data: String = data.iter()
        .map(|p| {
            // Start with Point details
            let mut point_info = format!("--- Point {} (X: {}, Y: {}) ---\n", p.id, p.x, p.y);

            // Add Obstacles
            if p.obstacles.is_empty() {
                point_info.push_str("  Obstacles: None\n");
            } else {
                point_info.push_str("  Obstacles:\n");
                for o in &p.obstacles {
                    let name = o.name.as_deref().unwrap_or("N/A");
                    let number = o.number.map_or("N/A".to_string(), |n| n.to_string());
                    point_info.push_str(&format!("    - ID: {}, Type: {}, Count: {}\n", o.id, name, number));
                }
            }

            // Add Comments
            if p.comments.is_empty() {
                point_info.push_str("  Comments: None\n");
            } else {
                point_info.push_str("  Comments:\n");
                for c in &p.comments {
                    point_info.push_str(&format!("    - ID: {}, Value: \"{}\"\n", c.id, c.value));
                }
            }

            // Add Pictures
            if p.pictures.is_empty() {
                point_info.push_str("  Pictures: None\n");
            } else {
                point_info.push_str("  Pictures:\n");
                for i in &p.pictures {
                    point_info.push_str(&format!("    - ID: {}, Image: {}\n", i.id, i.image));
                }
            }
            
            point_info
        })
        .collect::<Vec<String>>()
        .join("\n");

    doc.push(genpdf::elements::Paragraph::new(formatted_data));
    
    doc.render_to_file("output.pdf")
        .map_err(|e| format!("Failed to write PDF file: {}", e))?;

    Ok(())
}