use crate::db;
use crate::db::fetch_equipement_coordinates;
use crate::db::EquipementActionComplet;
use crate::db::EquipementComplet;
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

        let row = sqlx::query("SELECT name, start_date, end_date FROM event WHERE id = ?")
            .bind(eid)
            .fetch_optional(&pool)
            .await
            .map_err(|e| e.to_string())?;

        if let Some(r) = row {
            let name: String = r.get("name");
            let start: String = r.get("start_date");
            let end: String = r.get("end_date");

            typst_src.push_str(&format!(
                r#"
                #block(fill: luma(240), inset: 8pt, radius: 4pt, width: 100%)[
                  #text(14pt, weight: "bold")[{}] \
                  #v(0.3em)
                  *Dates :* {} au {}
                ]
                #v(0.5cm)
                "#,
                name, start, end
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
                typst_src.push_str(&format!(
                    r#"#place(top + left, dx: {}%, dy: {}%)[
  #circle(radius: 3pt, fill: red, stroke: 1pt + white)
]
"#,
                    pct_x * 100.0,
                    pct_y * 100.0
                ));
            }
        }
        typst_src.push_str("]\n#v(1cm)\n");
    } else if let Err(e) = map_res {
        eprintln!("Erreur génération map statique : {}", e);
    }

    for p in data.iter() {
        let heading = format!("== Point {} (X: {}, Y: {})", p.id, p.x, p.y);
        writeln!(typst_src, "{}", heading).unwrap();
        typst_src.push_str("#v(0.5em)\n");

        let com_str = p.comment.as_deref().unwrap_or("None");
        writeln!(typst_src, "*Commentaires:* {}.", com_str).unwrap();

        // Add pictures if available
        /*if !p.pictures.is_empty() {
            typst_src.push_str("#v(0.5em)\n*Images:* \n");
            for pic in &p.pictures {
                if let Some(image_path) = &pic.image {
                    typst_src.push_str(&format!(
                        "#image(\"{}\", width: 80%)\n#v(0.3em)\n",
                        image_path
                    ));
                }
            }
        }*/

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

#[tauri::command]
pub async fn create_team_mission_pdf(
    app: AppHandle,
    team_id: String,
    event_id: String,
) -> Result<(), String> {
    let pool = db::get_db_pool(&app).await?;

    let team_name: String = sqlx::query_scalar("SELECT name FROM team WHERE id = ?")
        .bind(&team_id)
        .fetch_one(&pool)
        .await
        .map_err(|e| e.to_string())?;

    let query = r#"
        SELECT 
            a.id as action_id,
            a.type as action_type,
            e.id as equip_id,
            e.length_per_unit,
            e.date_pose,
            e.date_depose,
            t.name as type_name
        FROM action a
        JOIN equipement e ON a.equipement_id = e.id
        LEFT JOIN type t ON e.type_id = t.id
        WHERE a.team_id = ?
    "#;

    let rows = sqlx::query(query)
        .bind(&team_id)
        .fetch_all(&pool)
        .await
        .map_err(|e| e.to_string())?;

    let mut mission_data = Vec::new();
    for row in rows {
        let equip_id: String = row.get("equip_id");
        let coords = fetch_equipement_coordinates(&pool, &equip_id).await?;

        mission_data.push(EquipementActionComplet {
            equipement: EquipementComplet {
                id: equip_id,
                type_name: row.get("type_name"),
                length: row.get("length_per_unit"),
                date_pose: row.get("date_pose"),
                date_depose: row.get("date_depose"),
                coordinates: coords,
                ..Default::default()
            },
            action_id: Some(row.get("action_id")),
            action_type: Some(row.get("action_type")),
            event_id: Some(event_id.clone()),
        });
    }

    let temp_dir = std::env::temp_dir().join(format!("mission_gen_{}", team_id));
    if temp_dir.exists() {
        fs::remove_dir_all(&temp_dir).ok();
    }
    fs::create_dir_all(&temp_dir).map_err(|e| e.to_string())?;

    let font_bytes = crate::pdf::load_fonts_from_directory(Path::new("./fonts"))?;

    let mut typst_src = String::new();
    typst_src.push_str(
        r#"
        #set page(paper: "a4", margin: 1.5cm)
        #set text(font: "Liberation Sans", size: 11pt)
        #set table(stroke: 0.5pt + gray)

        #align(center)[
            #rect(stroke: 2pt + blue, inset: 10pt)[
                #text(18pt, weight: "bold")[FEUILLE DE ROUTE OPÉRATIONNELLE] \
                #text(14pt, blue)[Équipe : "#,
    );

    typst_src.push_str(&team_name.to_uppercase());

    typst_src.push_str(
        r#"]
            ]
        ]
        #v(1cm)
    "#,
    );

    typst_src.push_str("== Planning des Missions\n#v(0.5em)\n");
    typst_src.push_str(
        r#"#table(
        columns: (auto, auto, 1fr, 40pt),
        inset: 7pt,
        align: (col, row) => if row == 0 { center } else { left },
        fill: (x, y) => if y == 0 { luma(240) },
        [*Date*], [*Action*], [*Équipement / Localisation*], [*Fait*],
    "#,
    );

    mission_data.sort_by_key(|m| {
        if m.action_type.as_deref() == Some("pose") {
            m.equipement.date_pose.clone()
        } else {
            m.equipement.date_depose.clone()
        }
    });

    for m in mission_data {
        let is_pose = m.action_type.as_deref() == Some("pose");

        let date_opt = if is_pose {
            &m.equipement.date_pose
        } else {
            &m.equipement.date_depose
        };

        let display_date = match date_opt {
            Some(d) => d.replace("T", " à "),
            None => "Non planifié".to_string(),
        };

        let action_label = if is_pose { "POSE" } else { "RETRAIT" };

        let type_name = m.equipement.type_name.as_deref().unwrap_or("Inconnu");
        let length = m.equipement.length.unwrap_or(0);

        let coords_str = if let Some(first_coord) = m.equipement.coordinates.first() {
            format!(
                "{} ({}m) - {:.4}, {:.4}",
                type_name, length, first_coord.x, first_coord.y
            )
        } else {
            format!("{} ({}m)", type_name, length)
        };

        writeln!(
            typst_src,
            "[{}], [{}], [{}], [ ],",
            display_date, action_label, coords_str
        )
        .unwrap();
    }
    typst_src.push_str(")\n");

    typst_src.push_str(
        r#"
        #v(2cm)
        #line(length: 100%, stroke: 0.5pt + gray)
        #text(8pt, gray)[Document généré le #datetime.today().display()]
    "#,
    );

    let template = TypstEngine::builder()
        .main_file(typst_src)
        .fonts(font_bytes)
        .with_file_system_resolver(temp_dir.clone())
        .build();

    let doc = template
        .compile()
        .output
        .map_err(|e| format!("Typst failed: {:?}", e))?;

    let pdf_bytes = typst_pdf::pdf(&doc, &PdfOptions::default())
        .map_err(|e| format!("PDF export failed: {:?}", e))?;

    let (dir_path, file_name) =
        utils::create_file_name(format!("Planning_{}_{}.pdf", team_name, event_id));
    if let Some(save_path) = utils::show_save_dialog(&file_name, &dir_path, "pdf".to_string()) {
        fs::write(save_path, pdf_bytes).map_err(|e| e.to_string())?;
    }

    let _ = fs::remove_dir_all(&temp_dir);
    Ok(())
}
