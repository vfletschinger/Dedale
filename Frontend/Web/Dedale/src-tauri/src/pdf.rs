use crate::db;
use crate::db::fetch_equipement_coordinates;
use crate::db::EquipementActionComplet;
use crate::db::EquipementComplet;
use crate::map_pdf;
use crate::utils;
use base64::Engine;
use sqlx::Row;
use std::fmt::Write;
use std::fs;
use std::path::Path;
use tauri::AppHandle;
use typst_as_lib::TypstEngine;
use typst_pdf::PdfOptions;

// =============================================================================
// Fonction de formatage des dates
// =============================================================================
fn format_date(date_str: &str) -> String {
    // Format attendu: "YYYY-MM-DD" ou "YYYY-MM-DDTHH:MM:SS"
    let parts: Vec<&str> = date_str.split('T').collect();
    let date_part = parts[0];
    let time_part = parts
        .get(1)
        .map(|t| t.split(':').take(2).collect::<Vec<_>>().join(":"));

    let date_components: Vec<&str> = date_part.split('-').collect();
    if date_components.len() == 3 {
        let day = date_components[2];
        let month = date_components[1];
        let year = date_components[0];

        if let Some(time) = time_part {
            format!("{}/{}/{} à {}", day, month, year, time)
        } else {
            format!("{}/{}/{}", day, month, year)
        }
    } else {
        date_str.to_string()
    }
}

// =============================================================================
// 1. PDF GLOBAL (Vue d'ensemble de l'événement)
// =============================================================================
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
        #align(center, text(17pt, weight: "bold")[Recapitulatif Événement])
        #v(1cm)
        "#,
    );

    if let Some(eid) = &event_id {
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
                name,
                format_date(&start),
                format_date(&end)
            ));
        }
    }

    // --- GÉNÉRATION CARTE GLOBALE ---
    // Récupérer les parcours de l'événement
    let parcours_list = if let Some(eid) = &event_id {
        match db::fetch_parcours_for_event(app.clone(), eid.clone()).await {
            Ok(list) => list,
            Err(e) => {
                eprintln!("⚠️ Erreur lors de la récupération des parcours : {}", e);
                vec![]
            }
        }
    } else {
        vec![]
    };

    // Récupérer les zones de l'événement
    let zones_list = if let Some(eid) = &event_id {
        match db::fetch_zones_for_event(app.clone(), eid.clone()).await {
            Ok(list) => list,
            Err(e) => {
                eprintln!("⚠️ Erreur lors de la récupération des zones : {}", e);
                vec![]
            }
        }
    } else {
        vec![]
    };

    let map_res = map_pdf::generate_cropped_map_with_parcours_and_zones(
        &temp_dir,
        &data,
        &parcours_list,
        &zones_list,
    )
    .await;

    match map_res {
        Ok(map) => {
            println!("✅ Carte Globale générée : {}", map.image_path);
            typst_src.push_str("== Localisation Globale\n#v(0.5em)\n");

            typst_src.push_str(&format!(
                r#"
                #block(width: 100%, height: auto, clip: true, stroke: 1pt + gray)[
                #image("{}", width: 100%)
                "#,
                map.image_path
            ));

            for (index, p) in data.iter().enumerate() {
                // Utilisation de la projection précise Mercator
                let (pct_x, pct_y) = map.get_percent_pos(p.x, p.y);
                let point_number = index + 1; // 1, 2, 3...

                if (0.0..=1.0).contains(&pct_x) && (0.0..=1.0).contains(&pct_y) {
                    // Petit cercle rouge avec numéro à côté avec fond blanc (plus petit)
                    let marker = r#"#circle(radius: 1.5pt, fill: red, stroke: 0.5pt + white)"#;
                    let number_label = format!(
                        r#"#box(fill: white, stroke: 0.3pt + gray, radius: 1pt, inset: 1pt)[#text(size: 5pt, weight: "bold")[{}]]"#,
                        point_number
                    );

                    // Alterner la position des numéros pour éviter les chevauchements
                    // Valeurs réduites pour rapprocher les numéros des points
                    let (dx_offset, dy_offset) = match index % 4 {
                        0 => (4, -4),   // haut à droite
                        1 => (4, 2),    // bas à droite
                        2 => (-10, -4), // haut à gauche
                        _ => (-10, 2),  // bas à gauche
                    };

                    typst_src.push_str(&format!(
                        r#"#place(top + left, dx: {}% - 0.75pt, dy: {}% - 0.75pt)[ {} ]#place(top + left, dx: {}% + {}pt, dy: {}% {}pt)[ {} ]"#,
                        pct_x * 100.0,
                        pct_y * 100.0,
                        marker,
                        pct_x * 100.0,
                        dx_offset,
                        pct_y * 100.0,
                        if dy_offset >= 0 { format!("+ {}", dy_offset) } else { format!("- {}", -dy_offset) },
                        number_label
                    ));
                }
            }
            typst_src.push_str("]\n#v(1cm)\n");
        }
        Err(e) => {
            eprintln!("❌ ERREUR CARTE GLOBALE : {}", e);
            typst_src.push_str(&format!("_Impossible de générer la carte : {}_\n", e));
        }
    };

    for (i, p) in data.iter().enumerate() {
        let point_number = i + 1;
        let heading = format!("== Point {}", point_number);
        writeln!(typst_src, "{}", heading).unwrap();
        typst_src.push_str("#v(0.5em)\n");

        // Afficher le nom du point s'il existe
        if let Some(name) = &p.name {
            writeln!(typst_src, "*Nom:* {}", name).unwrap();
        }

        // Afficher les commentaires s'il y en a
        if let Some(comment) = &p.comment {
            writeln!(typst_src, "*Commentaires:* {}", comment).unwrap();
        }

        // Afficher les photos s'il y en a
        if !p.pictures.is_empty() {
            writeln!(typst_src, "*Photos:*").unwrap();
            typst_src.push_str("#grid(\n");
            typst_src.push_str("  columns: (1fr, 1fr),\n");
            typst_src.push_str("  gutter: 0.5em,\n");

            for (idx, pic) in p.pictures.iter().enumerate() {
                if let Some(image_data) = &pic.image {
                    // Décoder l'image
                    match decode_base64(image_data) {
                        Ok(decoded) => {
                            // Déterminer le format de l'image
                            if let Some(format) = get_image_format(&decoded) {
                                let img_filename =
                                    format!("point_{}_img_{}.{}", point_number, idx, format);
                                let img_path = temp_dir.join(&img_filename);

                                // Sauvegarder l'image
                                if fs::write(&img_path, decoded).is_ok() {
                                    typst_src.push_str(&format!(
                                        "  image(\"{}\", width: 100%),\n",
                                        img_filename
                                    ));
                                }
                            } else {
                                eprintln!(
                                    "⚠️ Unknown image format for point_{}_img_{}",
                                    point_number, idx
                                );
                            }
                        }
                        Err(e) => {
                            eprintln!(
                                "⚠️ Failed to decode image for point_{}_img_{}: {}",
                                point_number, idx, e
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

    let (dir_path, file_name) =
        utils::create_file_name("Global_Recap".to_string(), "pdf".to_string());
    if let Some(save_path) = utils::show_save_dialog(&file_name, &dir_path, "pdf".to_string()) {
        fs::write(save_path, pdf_bytes)
            .map_err(|e| format!("Failed to write final PDF file: {}", e))?;
        println!("PDF successfully saved.");
    }

    let _ = fs::remove_dir_all(&temp_dir);

    Ok(())
}

// =============================================================================
// 2. PDF PAR ÉQUIPE (Planning Opérationnel)
// =============================================================================
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
        WHERE a.team_id = ? AND e.event_id = ?
    "#;

    let rows = sqlx::query(query)
        .bind(&team_id)
        .bind(&event_id)
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

    mission_data.sort_by_key(|m| {
        if m.action_type.as_deref() == Some("pose") {
            m.equipement.date_pose.clone()
        } else {
            m.equipement.date_depose.clone()
        }
    });

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

    // --- PRÉPARATION DES DONNÉES POUR LA CARTE ---
    let mut map_points = Vec::new();
    for m in &mission_data {
        if let Some(coord) = m.equipement.coordinates.first() {
            // Conversion vers PointWithDetails pour le générateur de carte
            map_points.push(crate::db::PointWithDetails {
                id: m.equipement.id.clone(), // ID (String)
                x: coord.x,
                y: coord.y,
                // Champs optionnels mis à None pour la génération de carte
                name: None,
                event_id: None,
                status: None,
                comment: None,
                r#type: None, // Utilisation de r#type pour échapper le mot clé
                pictures: vec![],
            });
        }
    }

    // --- GÉNÉRATION CARTE ÉQUIPE ---
    if !map_points.is_empty() {
        println!(
            "🗺️ Génération de la carte d'équipe avec {} points...",
            map_points.len()
        );

        let map_res = map_pdf::generate_cropped_map(&temp_dir, &map_points).await;

        match map_res {
            Ok(map) => {
                typst_src.push_str("== Zone d'intervention\n#v(0.5em)\n");

                typst_src.push_str(&format!(
                    r#"
                    #block(width: 100%, height: auto, clip: true, stroke: 1pt + gray)[
                      #image("{}", width: 100%)
                    "#,
                    map.image_path
                ));

                // Pour gérer les superpositions, on compte combien de fois une coordonnée (discrétisée) a été utilisée
                let mut coord_counts: std::collections::HashMap<(i64, i64), usize> =
                    std::collections::HashMap::new();

                // Placement des marqueurs NUMÉROTÉS
                for (index, m) in mission_data.iter().enumerate() {
                    let point_number = index + 1;

                    if let Some(coord) = m.equipement.coordinates.first() {
                        let (pct_x, pct_y) = map.get_percent_pos(coord.x, coord.y);

                        if (0.0..=1.0).contains(&pct_x) && (0.0..=1.0).contains(&pct_y) {
                            // Plus de distinction de couleur entre pose et retrait
                            let marker_color = "red";
                            let marker = format!(
                                r#"#circle(radius: 3pt, fill: {}, stroke: 1pt + white)"#,
                                marker_color
                            );
                            let number_label = format!(
                                r#"#box(fill: white, stroke: 0.5pt + gray, radius: 2pt, inset: 2pt)[#text(size: 8pt, weight: "bold")[{}]]"#,
                                point_number
                            );

                            // Discrétisation pour détecter les superpositions (précision ~0.1%)
                            let x_key = (pct_x * 1000.0) as i64;
                            let y_key = (pct_y * 1000.0) as i64;
                            let count = *coord_counts.get(&(x_key, y_key)).unwrap_or(&0);
                            coord_counts.insert((x_key, y_key), count + 1);

                            // Liste d'offsets prédéfinis pour éviter les chevauchements
                            // (dx, dy) en points (pt)
                            let offsets = [
                                (8, -8),    // 0: haut-droite
                                (8, 8),     // 1: bas-droite
                                (-20, -8),  // 2: haut-gauche
                                (-20, 8),   // 3: bas-gauche
                                (8, -20),   // 4: plus haut-droite
                                (8, 20),    // 5: plus bas-droite
                                (-20, -20), // 6: plus haut-gauche
                                (-20, 20),  // 7: plus bas-gauche
                            ];

                            // On utilise le compteur pour choisir l'offset, modulo la taille de la liste
                            let (dx_offset, dy_offset) = offsets[count % offsets.len()];

                            typst_src.push_str(&format!(
                                r#"#place(top + left, dx: {}% - 1.5pt, dy: {}% - 1.5pt)[ {} ]#place(top + left, dx: {}% + {}pt, dy: {}% {}pt)[ {} ]"#,
                                pct_x * 100.0,
                                pct_y * 100.0,
                                marker,
                                pct_x * 100.0,
                                dx_offset,
                                pct_y * 100.0,
                                if dy_offset >= 0 { format!("+ {}", dy_offset) } else { format!("- {}", -dy_offset) },
                                number_label
                            ));
                        }
                    }
                }
                typst_src.push_str("]\n#v(1cm)\n");
            }
            Err(e) => {
                eprintln!("⚠️ Erreur carte équipe : {}", e);
            }
        }
    }

    // --- TABLEAU PLANNING ---
    typst_src.push_str("== Planning des Missions\n#v(0.5em)\n");
    typst_src.push_str(
        r#"#table(
        columns: (auto, auto, auto, 1fr, 40pt),
        inset: 7pt,
        align: (col, row) => if row == 0 { center } else { left },
        fill: (x, y) => if y == 0 { luma(240) },
        [*Numéro*], [*Date/Heure*], [*Action*], [*Équipement*], [*Fait*],
    "#,
    );

    // Tri chronologique
    mission_data.sort_by_key(|m| {
        if m.action_type.as_deref() == Some("pose") {
            m.equipement.date_pose.clone()
        } else {
            m.equipement.date_depose.clone()
        }
    });

    for (index, m) in mission_data.iter().enumerate() {
        let point_number = index + 1; // 1, 2, 3...
        let is_pose = m.action_type.as_deref() == Some("pose");

        let date_opt = if is_pose {
            &m.equipement.date_pose
        } else {
            &m.equipement.date_depose
        };

        let display_date = match date_opt {
            Some(d) => format_date(d),
            None => "Non planifié".to_string(),
        };

        let action_label = if is_pose {
            r#"#text(fill: green, weight: "bold")[POSE]"#
        } else {
            r#"#text(fill: red, weight: "bold")[RETRAIT]"#
        };

        let type_name = m.equipement.type_name.as_deref().unwrap_or("Inconnu");
        let length = m.equipement.length.unwrap_or(0);

        // Affichage Nom/Type d'équipement (avec longueur si pertinente)
        let equip_str = if length > 0 {
            format!("{} ({}m)", type_name, length)
        } else {
            type_name.to_string()
        };

        writeln!(
            typst_src,
            "[{}], [{}], [{}], [{}], [ ],",
            point_number, display_date, action_label, equip_str
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

    let mut event_name: String = "".to_string();
    if !event_id.is_empty() {
        let pool = db::get_db_pool(&app).await?;

        let row = sqlx::query("SELECT name FROM event WHERE id = ?")
            .bind(event_id)
            .fetch_optional(&pool)
            .await
            .map_err(|e| e.to_string())?;

        if let Some(r) = row {
            event_name = r.get("name");
        }
    }

    let (dir_path, file_name) = utils::create_file_name(
        format!("Planning_{}_{}", team_name, event_name),
        "pdf".to_string(),
    );
    if let Some(save_path) = utils::show_save_dialog(&file_name, &dir_path, "pdf".to_string()) {
        fs::write(save_path, pdf_bytes).map_err(|e| e.to_string())?;
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

fn get_image_format(data: &[u8]) -> Option<&'static str> {
    // Vérifier les signatures d'image communes
    if data.len() < 3 {
        return None;
    }

    // PNG: 89 50 4E 47
    if data.len() >= 8 && &data[0..8] == b"\x89PNG\r\n\x1a\n" {
        return Some("png");
    }

    // JPEG: FF D8 FF
    if data[0] == 0xFF && data[1] == 0xD8 && data[2] == 0xFF {
        return Some("jpg");
    }

    // GIF: 47 49 46 38 (GIF8)
    if data.len() >= 6 && &data[0..3] == b"GIF" && data[3] == b'8' {
        return Some("gif");
    }

    // WEBP: 52 49 46 46 ... 57 45 42 50 (RIFF ... WEBP)
    if data.len() >= 12 && &data[0..4] == b"RIFF" && &data[8..12] == b"WEBP" {
        return Some("webp");
    }

    None
}

fn decode_base64(base64_str: &str) -> Result<Vec<u8>, String> {
    // Nettoyer la chaîne base64
    let clean_str = if base64_str.contains(",") {
        // Format data URI: "data:image/png;base64,..." ou "data:image/jpeg;base64,..."
        base64_str.split(',').next_back().unwrap_or(base64_str)
    } else {
        base64_str
    };

    // Nettoyer les espaces, sauts de ligne et autres caractères invisibles
    let clean_str = clean_str
        .chars()
        .filter(|c| !c.is_whitespace())
        .collect::<String>();

    // Utiliser la crate base64 pour décoder
    base64::engine::general_purpose::STANDARD
        .decode(&clean_str)
        .map_err(|e| format!("Failed to decode base64: {}", e))
}
