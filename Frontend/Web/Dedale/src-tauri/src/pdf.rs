use crate::db;
use crate::seed;
use crate::utils;
use base64::{engine::general_purpose, Engine as _};
use genpdf::elements;
use tauri::AppHandle;

#[tauri::command]
pub async fn create_pdf(app: AppHandle) -> Result<(), String> {
    seed::seed_database(app.clone()).await?;
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
            p.obstacles
                .iter()
                .map(|o| {
                    let name = o.name.as_deref().unwrap_or("N/A");
                    let number = o.number.unwrap_or(0);
                    format!("{} (x{})", name, number)
                })
                .collect::<Vec<String>>()
                .join(", ")
        };
        point_text.push_str(&format!(" Equipements: {}.", obs_str));

        let com_str = if p.comments.is_empty() {
            "None".to_string()
        } else {
            p.comments
                .iter()
                .map(|c| format!("{}", c.value))
                .collect::<Vec<String>>()
                .join(", ")
        };
        point_text.push_str(&format!(" Commentaires: {}.", com_str));

        doc.push(elements::Paragraph::new(point_text));

        if !p.pictures.is_empty() {
            doc.push(elements::Paragraph::new("Images:"));
            doc.push(elements::Break::new(1.0));

            let column_weights = vec![1, 1, 1];
            let mut table = elements::TableLayout::new(column_weights);

            let mut current_row = table.row();
            let mut images_in_current_row = 0;

            for pic in &p.pictures {
                let raw_base64 = if let Some(index) = pic.image.find(',') {
                    &pic.image[index + 1..]
                } else {
                    &pic.image
                };

                // Keep only valid base64 characters (A-Z a-z 0-9 + / = - _). This helps
                // with inputs that may still contain stray characters or partial data URIs.
                let mut valid_base64: String = raw_base64
                    .chars()
                    .filter(|c| c.is_ascii_alphanumeric() || *c == '+' || *c == '/' || *c == '=' || *c == '-' || *c == '_')
                    .collect();

                // Ensure padding to multiple of 4.
                while valid_base64.len() % 4 != 0 {
                    valid_base64.push('=');
                }

                // Try standard base64 first, then URL-safe. If both fail, log and skip this image
                // instead of aborting the whole PDF generation.
                let image_bytes = match general_purpose::STANDARD.decode(&valid_base64) {
                    Ok(b) => Some(b),
                    Err(e_std) => match general_purpose::URL_SAFE.decode(&valid_base64) {
                        Ok(b2) => Some(b2),
                        Err(e_url) => {
                            eprintln!("Failed to decode base64 for point {} image: standard error: {}, url-safe error: {}", p.id, e_std, e_url);
                            None
                        }
                    },
                };

                let image_bytes = if let Some(b) = image_bytes { b } else { continue; };

                let img_dynamic = image::load_from_memory(&image_bytes)
                    .map_err(|e| format!("Failed to load image from memory: {}", e))?;

                let pdf_image = elements::Image::from_dynamic_image(img_dynamic)
                    .expect("Failed to load test image");

                if images_in_current_row == 3 {
                    current_row.push().expect("Failed to push row");
                    current_row = table.row();
                    images_in_current_row = 0;
                }

                current_row.push_element(elements::PaddedElement::new(
                    pdf_image,
                    genpdf::Margins::trbl(0, 2, 2, 0),
                ));

                images_in_current_row += 1;
            }
            if images_in_current_row > 0 {
                while images_in_current_row < 3 {
                    current_row.push_element(elements::Paragraph::new(""));
                    images_in_current_row += 1;
                }
                current_row.push().expect("Failed to push final row");
            }
            doc.push(table);
            doc.push(elements::Break::new(1.0));
        }

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
