#![allow(dead_code)]

use crate::db;
use crate::utils;
use base64::{engine::general_purpose, Engine as _};
use std::fmt::Write;
use std::fs;
use std::path::Path;
use tauri::AppHandle;
use typst_as_lib::TypstEngine;
use typst_pdf::PdfOptions;

// ==================== Fonctions helper publiques et testables ====================

/// Formate un obstacle pour l'affichage (ex: "Barrière (x5)")
pub fn format_obstacle(name: Option<&str>, number: Option<i32>) -> String {
    let name_str = name.unwrap_or("N/A");
    let num = number.unwrap_or(0);
    format!("{} (x{})", name_str, num)
}

/// Formate une liste d'obstacles pour l'affichage
pub fn format_obstacles_list(obstacles: &[(Option<String>, Option<i32>)]) -> String {
    if obstacles.is_empty() {
        return "None".to_string();
    }

    obstacles
        .iter()
        .map(|(name, number)| format_obstacle(name.as_deref(), *number))
        .collect::<Vec<String>>()
        .join(", ")
}

/// Formate une liste de commentaires pour l'affichage
pub fn format_comments_list(comments: &[String]) -> String {
    if comments.is_empty() {
        return "None".to_string();
    }
    comments.join(", ")
}

/// Génère le heading d'un point pour Typst
pub fn generate_point_heading(id: &str, x: f64, y: f64) -> String {
    format!("== Point {} (X: {}, Y: {})", id, x, y)
}

/// Nettoie une chaîne base64 en supprimant le préfixe data URI si présent
pub fn clean_base64_string(base64_str: &str) -> &str {
    if let Some(index) = base64_str.find(',') {
        &base64_str[index + 1..]
    } else {
        base64_str
    }
}

/// Extrait le type MIME d'une chaîne base64 avec préfixe data URI
pub fn extract_base64_content(base64_str: &str) -> (Option<&str>, &str) {
    if let Some(index) = base64_str.find(',') {
        let prefix = &base64_str[..index];
        let content = &base64_str[index + 1..];

        // Extraire le type MIME du préfixe (ex: "data:image/png;base64")
        let mime_type = if let Some(type_part) = prefix.strip_prefix("data:") {
            type_part.split(';').next()
        } else {
            None
        };

        (mime_type, content)
    } else {
        (None, base64_str)
    }
}

/// Décode une chaîne base64 en bytes
pub fn decode_base64(base64_str: &str) -> Result<Vec<u8>, String> {
    let clean = base64_str.replace(['\n', '\r', ' '], "");

    general_purpose::STANDARD
        .decode(&clean)
        .or_else(|_| general_purpose::STANDARD_NO_PAD.decode(&clean))
        .map_err(|e| format!("Failed to decode base64: {}", e))
}

/// Génère un nom de fichier pour une image
pub fn generate_image_filename(point_index: usize, img_index: usize) -> String {
    format!("img_{}_{}.png", point_index, img_index)
}

/// Vérifie si une extension de fichier est valide pour une police
pub fn is_valid_font_extension(extension: &str) -> bool {
    matches!(
        extension.to_lowercase().as_str(),
        "ttf" | "otf" | "woff" | "woff2"
    )
}

/// Génère le header Typst pour le document PDF
pub fn generate_typst_header() -> String {
    r#"
        #set page(paper: "a4", margin: 1cm)
        #set text(font: "Liberation Sans", size: 11pt)

        // Title
        #align(center, text(17pt, weight: "bold")[Recap])
        #v(1cm)
        "#
    .to_string()
}

/// Génère un séparateur Typst
pub fn generate_typst_separator() -> String {
    "#v(1cm)\n#line(length: 100%, stroke: gray)\n#v(1cm)\n".to_string()
}

/// Génère le début d'une grille d'images Typst
pub fn generate_typst_image_grid_start() -> String {
    "#v(0.5em)\n#grid(\n  columns: (1fr, 1fr, 1fr),\n  gutter: 5pt,\n".to_string()
}

/// Génère une entrée d'image pour la grille Typst
pub fn generate_typst_image_entry(filename: &str) -> String {
    format!("  image(\"{}\", width: 100%),", filename)
}

/// Charge les polices depuis un répertoire (version publique)
pub fn load_fonts_from_directory(fonts_dir: &Path) -> Result<Vec<Vec<u8>>, String> {
    let mut fonts = Vec::new();

    if !fonts_dir.exists() {
        return Err(format!("Fonts directory not found: {:?}", fonts_dir));
    }

    let entries = std::fs::read_dir(fonts_dir)
        .map_err(|e| format!("Failed to read fonts directory: {}", e))?;

    for entry in entries {
        let entry = entry.map_err(|e| format!("Error reading directory entry: {}", e))?;
        let path = entry.path();

        if let Some(ext) = path.extension() {
            if let Some(ext_str) = ext.to_str() {
                if is_valid_font_extension(ext_str) {
                    match std::fs::read(&path) {
                        Ok(font_data) => {
                            println!("✅ Loaded font: {}", path.display());
                            fonts.push(font_data);
                        }
                        Err(e) => {
                            eprintln!("⚠️  Failed to load font {}: {}", path.display(), e);
                        }
                    }
                }
            }
        }
    }

    if fonts.is_empty() {
        return Err("No valid font files found in fonts directory".to_string());
    }

    Ok(fonts)
}

// ==================== Commandes Tauri ====================

#[tauri::command]
pub async fn create_pdf(app: AppHandle) -> Result<(), String> {
    let data = db::retrieve_data(&app).await?;

    let temp_dir = std::env::temp_dir().join("my_app_pdf_gen");
    if temp_dir.exists() {
        fs::remove_dir_all(&temp_dir).map_err(|e| e.to_string())?;
    }
    fs::create_dir_all(&temp_dir).map_err(|e| e.to_string())?;

    let font_bytes = load_fonts_from_directory(Path::new("./fonts"))?;
    let mut typst_src = String::new();

    typst_src.push_str(
        r#"
        #set page(paper: "a4", margin: 1cm)
        #set text(font: "Liberation Sans", size: 11pt)

        // Title
        #align(center, text(17pt, weight: "bold")[Recap])
        #v(1cm)
        "#,
    );

    for (point_index, p) in data.iter().enumerate() {
        let heading = format!("== Point {} (X: {}, Y: {})", p.id, p.x, p.y);
        writeln!(typst_src, "{}", heading).unwrap();
        typst_src.push_str("#v(0.5em)\n");

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
        writeln!(typst_src, "*Equipements:* {}.", obs_str).unwrap();

        let com_str = if p.comments.is_empty() {
            "None".to_string()
        } else {
            p.comments
                .iter()
                .map(|c| c.value.to_string())
                .collect::<Vec<String>>()
                .join(", ")
        };
        writeln!(typst_src, "*Commentaires:* {}.", com_str).unwrap();

        if !p.pictures.is_empty() {
            writeln!(typst_src, "\n*Images:*").unwrap();

            typst_src.push_str("#v(0.5em)\n#grid(\n  columns: (1fr, 1fr, 1fr),\n  gutter: 5pt,\n");

            for (img_index, pic) in p.pictures.iter().enumerate() {
                let raw_base64 = if let Some(index) = pic.image.find(',') {
                    &pic.image[index + 1..]
                } else {
                    &pic.image
                };

                let clean_base64 = raw_base64.replace(['\n', '\r', ' '], "");

                let image_bytes = match general_purpose::STANDARD.decode(&clean_base64) {
                    Ok(b) => Some(b),
                    Err(_) => match general_purpose::STANDARD_NO_PAD.decode(&clean_base64) {
                        Ok(b) => Some(b),
                        Err(e) => {
                            eprintln!(
                                "❌ Failed to decode Base64 for img {}_{}: {}",
                                point_index, img_index, e
                            );
                            None
                        }
                    },
                };

                if let Some(bytes) = image_bytes {
                    match image::load_from_memory(&bytes) {
                        Ok(dynamic_image) => {
                            let img_filename = format!("img_{}_{}.png", point_index, img_index);
                            let img_path = temp_dir.join(&img_filename);

                            if let Err(e) =
                                dynamic_image.save_with_format(&img_path, image::ImageFormat::Png)
                            {
                                eprintln!("❌ Failed to save image to disk: {}", e);
                            } else {
                                writeln!(typst_src, "  image(\"{}\", width: 100%),", img_filename)
                                    .unwrap();
                            }
                        }
                        Err(e) => {
                            eprintln!(
                                "❌ Image crate failed to load bytes (corrupt image?): {}",
                                e
                            );
                        }
                    }
                }
            }
            typst_src.push_str(")\n");
        }

        typst_src.push_str("#v(1cm)\n#line(length: 100%, stroke: gray)\n#v(1cm)\n");
    }

    let template = TypstEngine::builder()
        .main_file(typst_src)
        .fonts(font_bytes)
        .with_file_system_resolver(temp_dir.clone())
        .build();

    let doc = template
        .compile()
        .output
        .map_err(|e| format!("Typst compilation failed: {:?}", e))?;

    let options = PdfOptions::default();
    let pdf_bytes =
        typst_pdf::pdf(&doc, &options).map_err(|e| format!("Failed to export PDF: {:#?}", e))?;

    let (dir_path, file_name) = utils::create_file_name("pdf".to_string());
    if let Some(save_path) = utils::show_save_dialog(&file_name, &dir_path, "pdf".to_string()) {
        fs::write(save_path, pdf_bytes)
            .map_err(|e| format!("Failed to write final PDF file: {}", e))?;
        println!("PDF successfully saved.");
    }

    let _ = fs::remove_dir_all(&temp_dir);

    Ok(())
}
