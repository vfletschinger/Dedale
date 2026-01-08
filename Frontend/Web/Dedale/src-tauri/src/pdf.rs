use crate::db;
use crate::map_static;
use crate::utils;
use sqlx::Row;
use std::fmt::Write;
use std::fs;
use std::path::Path;
use tauri::AppHandle;
use typst_as_lib::TypstEngine;
use typst_pdf::PdfOptions;

#[tauri::command]
pub async fn create_pdf(app: AppHandle, event_id: Option<String>) -> Result<(), String> {
    let data = db::retrieve_data_by_event(&app, &event_id).await?;

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

            if (0.0..=1.0).contains(&pct_x) && (0.0..=1.0).contains(&pct_y) {
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
                    dx_pct, dy_pct, p.id
                ));
            }
        }
        typst_src.push_str("]\n#v(1cm)\n");
    } else if let Err(e) = map_res {
        eprintln!("Erreur génération map statique : {}", e);
    }

    for (_point_index, p) in data.iter().enumerate() {
        let heading = format!("== Point {} (X: {}, Y: {})", p.id, p.x, p.y);
        writeln!(typst_src, "{}", heading).unwrap();
        typst_src.push_str("#v(0.5em)\n");

        // Point n'a plus de champ obstacles
        let obs_str = "N/A".to_string();
        writeln!(typst_src, "*Equipements:* {}.", obs_str).unwrap();

        // Point a un champ comment (Option<String>) au lieu de comments (Vec)
        let com_str = p.comment.as_deref().unwrap_or("None");
        writeln!(typst_src, "*Commentaires:* {}.", com_str).unwrap();

        // Point n'a plus de champ pictures - code supprimé

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
