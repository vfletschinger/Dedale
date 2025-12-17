use crate::db::Point;
use crate::utils;
use rust_xlsxwriter::Workbook;
use tauri::AppHandle;

// ==================== Constantes et fonctions helper publiques ====================

/// Headers pour le fichier Excel
pub const EXCEL_HEADERS: [&str; 8] = [
    "Point ID",
    "X",
    "Y",
    "Obstacle Nom",
    "Obstacle Description",
    "Nombre",
    "Largeur",
    "Longueur",
];

/// Retourne le nombre de colonnes
pub fn get_column_count() -> usize {
    EXCEL_HEADERS.len()
}

/// Retourne l'index d'une colonne par son nom
pub fn get_column_index(name: &str) -> Option<usize> {
    EXCEL_HEADERS.iter().position(|&h| h == name)
}

/// Retourne le nom d'une colonne par son index
pub fn get_column_name(index: usize) -> Option<&'static str> {
    EXCEL_HEADERS.get(index).copied()
}

/// Calcule le nombre total de lignes nécessaires pour les points
pub fn calculate_total_rows(points: &[Point]) -> usize {
    points
        .iter()
        .map(|p| {
            if p.obstacles.is_empty() {
                1
            } else {
                p.obstacles.len()
            }
        })
        .sum()
}

/// Vérifie si un nom d'obstacle est valide (non vide après trim)
pub fn is_valid_obstacle_name(name: Option<&str>) -> bool {
    name.map(|n| !n.trim().is_empty()).unwrap_or(false)
}

/// Formate une chaîne optionnelle pour l'export
pub fn format_optional_string(value: Option<&str>) -> String {
    value.unwrap_or("").to_string()
}

/// Formate un nombre optionnel pour l'export
pub fn format_optional_number(value: Option<i32>) -> i32 {
    value.unwrap_or(0)
}

/// Formate un flottant optionnel pour l'export
pub fn format_optional_float(value: Option<f64>) -> f64 {
    value.unwrap_or(0.0)
}

/// Génère une ligne vide pour un point sans obstacles
pub fn generate_empty_obstacle_row() -> (String, String, i32, f64, f64) {
    (String::new(), String::new(), 0, 0.0, 0.0)
}

/// Génère une ligne pour un obstacle
pub fn generate_obstacle_row(
    name: Option<&str>,
    description: Option<&str>,
    number: Option<i32>,
    width: Option<f64>,
    length: Option<f64>,
) -> (String, String, i32, f64, f64) {
    (
        format_optional_string(name),
        format_optional_string(description),
        format_optional_number(number),
        format_optional_float(width),
        format_optional_float(length),
    )
}

/// Vérifie si une dimension est valide (positive ou nulle)
pub fn is_valid_dimension(value: Option<f64>) -> bool {
    value.map(|v| v >= 0.0).unwrap_or(true)
}

/// Vérifie si un nombre d'obstacles est valide (positif ou nul)
pub fn is_valid_obstacle_count(value: Option<i32>) -> bool {
    value.map(|v| v >= 0).unwrap_or(true)
}

/// Structure pour les statistiques d'obstacles
#[derive(Debug, Clone, PartialEq)]
pub struct ObstacleStats {
    pub total_points: usize,
    pub points_with_obstacles: usize,
    pub points_without_obstacles: usize,
    pub total_obstacles: usize,
    pub avg_width: f64,
    pub avg_length: f64,
}

/// Calcule des statistiques sur les obstacles
pub fn calculate_obstacle_stats(points: &[Point]) -> ObstacleStats {
    let total_points = points.len();
    let points_with_obstacles = points.iter().filter(|p| !p.obstacles.is_empty()).count();
    let points_without_obstacles = total_points - points_with_obstacles;

    let all_obstacles: Vec<_> = points.iter().flat_map(|p| &p.obstacles).collect();
    let total_obstacles = all_obstacles.len();

    let (sum_width, count_width): (f64, usize) = all_obstacles
        .iter()
        .filter_map(|o| o.width)
        .fold((0.0, 0), |(sum, count), w| (sum + w, count + 1));

    let (sum_length, count_length): (f64, usize) = all_obstacles
        .iter()
        .filter_map(|o| o.length)
        .fold((0.0, 0), |(sum, count), l| (sum + l, count + 1));

    ObstacleStats {
        total_points,
        points_with_obstacles,
        points_without_obstacles,
        total_obstacles,
        avg_width: if count_width > 0 {
            sum_width / count_width as f64
        } else {
            0.0
        },
        avg_length: if count_length > 0 {
            sum_length / count_length as f64
        } else {
            0.0
        },
    }
}

/// Convertit un index de colonne en lettre Excel (0 -> A, 1 -> B, 26 -> AA, etc.)
pub fn column_index_to_letter(index: usize) -> String {
    let mut result = String::new();
    let mut idx = index;

    loop {
        result.insert(0, (b'A' + (idx % 26) as u8) as char);
        if idx < 26 {
            break;
        }
        idx = idx / 26 - 1;
    }

    result
}

/// Convertit une lettre de colonne Excel en index (A -> 0, B -> 1, AA -> 26, etc.)
pub fn column_letter_to_index(letter: &str) -> Option<usize> {
    if letter.is_empty() || !letter.chars().all(|c| c.is_ascii_uppercase()) {
        return None;
    }

    let mut result = 0;
    for c in letter.chars() {
        result = result * 26 + (c as usize - 'A' as usize + 1);
    }

    Some(result - 1)
}

/// Génère une référence de cellule Excel (ex: "A1", "B2")
pub fn cell_reference(col: usize, row: u32) -> String {
    format!("{}{}", column_index_to_letter(col), row + 1)
}

/// Parse une référence de cellule Excel
pub fn parse_cell_reference(reference: &str) -> Option<(usize, u32)> {
    let col_end = reference
        .chars()
        .take_while(|c| c.is_ascii_uppercase())
        .count();
    if col_end == 0 {
        return None;
    }

    let col_str = &reference[..col_end];
    let row_str = &reference[col_end..];

    let col = column_letter_to_index(col_str)?;
    let row: u32 = row_str.parse().ok()?;

    if row == 0 {
        return None;
    }

    Some((col, row - 1))
}

/// Calcule une plage Excel (ex: "A1:H10")
pub fn calculate_range(start_col: usize, start_row: u32, end_col: usize, end_row: u32) -> String {
    format!(
        "{}:{}",
        cell_reference(start_col, start_row),
        cell_reference(end_col, end_row)
    )
}

/// Vérifie si une plage Excel est valide
pub fn is_valid_excel_range(col: usize, row: u32) -> bool {
    col < 16384 && row < 1048576 // Limites Excel
}

/// Estime la taille d'un fichier Excel en bytes
pub fn estimate_file_size(rows: usize, cols: usize) -> usize {
    // Estimation grossière: ~100 bytes par cellule + overhead
    let cells = rows * cols;
    let base_size = 5000; // Overhead de base
    base_size + cells * 100
}

/// Formate une taille de fichier en format lisible
pub fn format_file_size(bytes: usize) -> String {
    if bytes < 1024 {
        format!("{} B", bytes)
    } else if bytes < 1024 * 1024 {
        format!("{:.2} KB", bytes as f64 / 1024.0)
    } else {
        format!("{:.2} MB", bytes as f64 / (1024.0 * 1024.0))
    }
}

// ==================== Commandes Tauri ====================

#[tauri::command]
pub async fn export_points_excel(app: AppHandle) -> Result<(), String> {
    let points: Vec<Point> = crate::db::retrieve_data(&app).await?;
    println!("📊 Retrieved {} points", points.len());

    let mut workbook = Workbook::new();
    let worksheet = workbook.add_worksheet();

    let headers = [
        "Point ID",
        "X",
        "Y",
        "Obstacle Nom",
        "Obstacle Description",
        "Nombre",
        "Largeur",
        "Longueur",
    ];
    for (col, header) in headers.iter().enumerate() {
        worksheet
            .write_string(0, col as u16, *header)
            .map_err(|e| e.to_string())?;
    }

    let mut current_row: u32 = 1;

    for p in points {
        if !p.obstacles.is_empty() {
            for obstacle in &p.obstacles {
                worksheet
                    .write_string(current_row, 0, &p.id)
                    .map_err(|e| e.to_string())?;
                worksheet
                    .write_number(current_row, 1, p.x)
                    .map_err(|e| e.to_string())?;
                worksheet
                    .write_number(current_row, 2, p.y)
                    .map_err(|e| e.to_string())?;

                let name = obstacle.name.as_deref().unwrap_or("");
                let description = obstacle.description.as_deref().unwrap_or("");
                let number = obstacle.number.unwrap_or(0) as f64;
                let width = obstacle.width.unwrap_or(0.0);
                let length = obstacle.length.unwrap_or(0.0);

                worksheet
                    .write_string(current_row, 3, name)
                    .map_err(|e| e.to_string())?;
                worksheet
                    .write_string(current_row, 4, description)
                    .map_err(|e| e.to_string())?;
                worksheet
                    .write_number(current_row, 5, number)
                    .map_err(|e| e.to_string())?;
                worksheet
                    .write_number(current_row, 6, width)
                    .map_err(|e| e.to_string())?;
                worksheet
                    .write_number(current_row, 7, length)
                    .map_err(|e| e.to_string())?;

                current_row += 1;
            }
        } else {
            worksheet
                .write_string(current_row, 0, &p.id)
                .map_err(|e| e.to_string())?;
            worksheet
                .write_number(current_row, 1, p.x)
                .map_err(|e| e.to_string())?;
            worksheet
                .write_number(current_row, 2, p.y)
                .map_err(|e| e.to_string())?;

            worksheet
                .write_string(current_row, 3, "")
                .map_err(|e| e.to_string())?; // Nom
            worksheet
                .write_string(current_row, 4, "")
                .map_err(|e| e.to_string())?; // Desc
            worksheet
                .write_number(current_row, 5, 0.0)
                .map_err(|e| e.to_string())?; // Nombre
            worksheet
                .write_number(current_row, 6, 0.0)
                .map_err(|e| e.to_string())?; // Largeur
            worksheet
                .write_number(current_row, 7, 0.0)
                .map_err(|e| e.to_string())?; // Longueur

            current_row += 1;
        }
    }

    let (dir_path, file_name) = utils::create_file_name("xlsx".to_string());
    if let Some(file_path) = utils::show_save_dialog(&file_name, &dir_path, "xlsx".to_string()) {
        println!("💾 Saving workbook... {}", file_path.display());
        workbook.save(file_path).map_err(|e| e.to_string())?;
        println!("✅ Excel saved successfully!");
    } else {
        println!("Save cancelled by user");
    }

    Ok(())
}
