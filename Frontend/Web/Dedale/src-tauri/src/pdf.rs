use crate::db;
use crate::utils;
use base64::{engine::general_purpose, Engine as _};
use std::fmt::Write;
use std::fs;
use std::path::Path;
use tauri::AppHandle;
use typst_as_lib::conversions::IntoFonts;
use typst_as_lib::TypstEngine;
use typst_pdf::PdfOptions;

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
                .map(|c| format!("{}", c.value))
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

                let mut valid_base64: String = raw_base64
                    .chars()
                    .filter(|c| {
                        c.is_ascii_alphanumeric()
                            || *c == '+'
                            || *c == '/'
                            || *c == '='
                            || *c == '-'
                            || *c == '_'
                    })
                    .collect();

                while valid_base64.len() % 4 != 0 {
                    valid_base64.push('=');
                }

                let image_bytes = match general_purpose::STANDARD.decode(&valid_base64) {
                    Ok(b) => Some(b),
                    Err(_) => general_purpose::URL_SAFE.decode(&valid_base64).ok(),
                };

                if let Some(bytes) = image_bytes {
                    let ext = if bytes.starts_with(&[0xFF, 0xD8, 0xFF]) {
                        "jpg"
                    } else if bytes.starts_with(&[0x89, 0x50, 0x4E, 0x47]) {
                        "png"
                    } else if bytes.starts_with(b"RIFF") {
                        "webp"
                    } else if bytes.starts_with(b"GIF8") {
                        "gif"
                    } else {
                        "jpg"
                    };

                    let img_filename = format!("img_{}_{}.{}", point_index, img_index, ext);
                    let img_path = temp_dir.join(&img_filename);

                    if let Ok(_) = fs::write(&img_path, bytes) {
                        writeln!(typst_src, "  image(\"{}\", width: 100%),", img_filename).unwrap();
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

fn load_fonts_from_directory(fonts_dir: &Path) -> Result<Vec<Vec<u8>>, String> {
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
            if matches!(ext.to_str(), Some("ttf" | "otf" | "woff" | "woff2")) {
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

    if fonts.is_empty() {
        return Err("No valid font files found in fonts directory".to_string());
    }

    Ok(fonts)
}
