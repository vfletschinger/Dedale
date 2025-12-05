use crate::db;
use crate::map_static;
use crate::utils;
use base64::{engine::general_purpose, Engine as _};
use sqlx::Row;
use std::fmt::Write;
use std::fs;
use std::path::Path;
use tauri::AppHandle;
use typst_as_lib::TypstEngine;
use typst_pdf::PdfOptions;

#[tauri::command]
pub async fn create_pdf(app: AppHandle, event_id: Option<i64>) -> Result<(), String> {
    let data = db::retrieve_data_by_event(&app, event_id).await?;

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

    if let Some(eid) = event_id {
        let pool = db::get_db_pool(&app).await?;

        let row = sqlx::query(
            "SELECT name, description, date_debut, date_fin, statut FROM event WHERE id = ?",
        )
        .bind(eid)
        .fetch_optional(&pool)
        .await
        .map_err(|e| e.to_string())?;

        if let Some(r) = row {
            let name: String = r.get("name");
            let description: String = r.get("description");
            let start: String = r.get("date_debut");
            let end: String = r.get("date_fin");
            let status: String = r.get("statut");

            typst_src.push_str(&format!(
                r#"
                #block(fill: luma(240), inset: 8pt, radius: 4pt, width: 100%)[
                  #text(14pt, weight: "bold")[{}] \
                  #v(0.3em)
                  *Statut :* {} \
                  *Dates :* {} au {} \
                  *Description :* {}
                ]
                #v(0.5cm)
                "#,
                name, status, start, end, description
            ));
        }
    }

    let map_res = map_static::generate_cropped_map(&temp_dir, &data);

    if let Ok(map) = map_res {
        typst_src.push_str("== Vue Carte\n#v(0.5em)\n");

        let width_geo = map.bounds.max_x - map.bounds.min_x;
        let height_geo = map.bounds.max_y - map.bounds.min_y;

        typst_src.push_str(&format!(
            r#"
            #block(width: 100%, height: auto, clip: true, stroke: 1pt + gray)[
              #image("{}", width: 100%)
            "#,
            map.image_path
        ));

        for p in &data {
            let pct_x = (p.x - map.bounds.min_x) / width_geo;
            let pct_y = (map.bounds.max_y - p.y) / height_geo;

            if pct_x >= 0.0 && pct_x <= 1.0 && pct_y >= 0.0 && pct_y <= 1.0 {
                let dx_pct = (pct_x * 100.0) as i32;
                let dy_pct = (pct_y * 100.0) as i32;
                typst_src.push_str(&format!(
                    r#"
                    #place(top + left, dx: {}%, dy: {}%)[
                      #place(center + horizon)[
                        #circle(radius: 4pt, fill: red, stroke: white)
                        #rect(fill: white.transparentize(30%), inset: 1pt, radius: 2pt)[
                           #text(size: 6pt, weight: "bold")[{}]
                        ]
                      ]
                    ]
                    "#,
                    dx_pct,
                    dy_pct,
                    p.id
                ));
            }
        }
        typst_src.push_str("]\n#v(1cm)\n");
    } else if let Err(e) = map_res {
        eprintln!("Erreur génération map statique : {}", e);
    }

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
