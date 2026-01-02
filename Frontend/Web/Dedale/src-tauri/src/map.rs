#![allow(dead_code)]

// ==================== Fonctions helper publiques et testables ====================

/// Convertit des coordonnées décimales en degrés, minutes, secondes
pub fn decimal_to_dms(decimal: f64) -> (i32, i32, f64) {
    let abs_decimal = decimal.abs();
    let degrees = abs_decimal.floor() as i32;
    let minutes_decimal = (abs_decimal - degrees as f64) * 60.0;
    let minutes = minutes_decimal.floor() as i32;
    let seconds = (minutes_decimal - minutes as f64) * 60.0;

    let sign = if decimal < 0.0 { -1 } else { 1 };
    (degrees * sign, minutes, seconds)
}

/// Formate des coordonnées en format DMS lisible (ex: "7°44'43.80"E, 48°35'2.04"N")
pub fn format_coordinates(lon: f64, lat: f64) -> String {
    let (lon_deg, lon_min, lon_sec) = decimal_to_dms(lon);
    let (lat_deg, lat_min, lat_sec) = decimal_to_dms(lat);

    let lon_dir = if lon >= 0.0 { "E" } else { "W" };
    let lat_dir = if lat >= 0.0 { "N" } else { "S" };

    format!(
        "{}°{}'{:.2}\"{}  {}°{}'{:.2}\"{}",
        lon_deg.abs(),
        lon_min,
        lon_sec,
        lon_dir,
        lat_deg.abs(),
        lat_min,
        lat_sec,
        lat_dir
    )
}

/// Calcule la distance entre deux points en mètres (formule de Haversine)
pub fn calculate_distance(lat1: f64, lon1: f64, lat2: f64, lon2: f64) -> f64 {
    const EARTH_RADIUS: f64 = 6371000.0; // Rayon de la Terre en mètres

    let lat1_rad = lat1.to_radians();
    let lat2_rad = lat2.to_radians();
    let delta_lat = (lat2 - lat1).to_radians();
    let delta_lon = (lon2 - lon1).to_radians();

    let a = (delta_lat / 2.0).sin().powi(2)
        + lat1_rad.cos() * lat2_rad.cos() * (delta_lon / 2.0).sin().powi(2);
    let c = 2.0 * a.sqrt().asin();

    EARTH_RADIUS * c
}

/// Vérifie si un point est dans une bounding box
pub fn point_in_bbox(x: f64, y: f64, min_x: f64, min_y: f64, max_x: f64, max_y: f64) -> bool {
    x >= min_x && x <= max_x && y >= min_y && y <= max_y
}

/// Calcule le centre d'un ensemble de points
pub fn calculate_center(points: &[(f64, f64)]) -> Option<(f64, f64)> {
    if points.is_empty() {
        return None;
    }

    let sum_x: f64 = points.iter().map(|(x, _)| x).sum();
    let sum_y: f64 = points.iter().map(|(_, y)| y).sum();
    let count = points.len() as f64;

    Some((sum_x / count, sum_y / count))
}

/// Calcule la bounding box d'un ensemble de points
pub fn calculate_bbox(points: &[(f64, f64)]) -> Option<(f64, f64, f64, f64)> {
    if points.is_empty() {
        return None;
    }

    let min_x = points.iter().map(|(x, _)| *x).fold(f64::INFINITY, f64::min);
    let max_x = points
        .iter()
        .map(|(x, _)| *x)
        .fold(f64::NEG_INFINITY, f64::max);
    let min_y = points.iter().map(|(_, y)| *y).fold(f64::INFINITY, f64::min);
    let max_y = points
        .iter()
        .map(|(_, y)| *y)
        .fold(f64::NEG_INFINITY, f64::max);

    Some((min_x, min_y, max_x, max_y))
}

/// Vérifie si des coordonnées sont valides (latitude: -90 à 90, longitude: -180 à 180)
pub fn is_valid_coordinate(lat: f64, lon: f64) -> bool {
    (-90.0..=90.0).contains(&lat) && (-180.0..=180.0).contains(&lon)
}

/// Convertit des mètres en degrés approximatifs (à l'équateur)
pub fn meters_to_degrees(meters: f64) -> f64 {
    meters / 111320.0
}

/// Convertit des degrés en mètres approximatifs (à l'équateur)
pub fn degrees_to_meters(degrees: f64) -> f64 {
    degrees * 111320.0
}

/// Calcule l'aire approximative d'une bounding box en mètres carrés
pub fn calculate_bbox_area(min_x: f64, min_y: f64, max_x: f64, max_y: f64) -> f64 {
    let width = degrees_to_meters(max_x - min_x);
    let height = degrees_to_meters(max_y - min_y);
    width * height
}

/// Normalise une longitude pour qu'elle soit entre -180 et 180
pub fn normalize_longitude(lon: f64) -> f64 {
    let mut normalized = lon % 360.0;
    if normalized > 180.0 {
        normalized -= 360.0;
    } else if normalized < -180.0 {
        normalized += 360.0;
    }
    normalized
}

/// Calcule le cap (bearing) entre deux points en degrés
pub fn calculate_bearing(lat1: f64, lon1: f64, lat2: f64, lon2: f64) -> f64 {
    let lat1_rad = lat1.to_radians();
    let lat2_rad = lat2.to_radians();
    let delta_lon = (lon2 - lon1).to_radians();

    let x = delta_lon.sin() * lat2_rad.cos();
    let y = lat1_rad.cos() * lat2_rad.sin() - lat1_rad.sin() * lat2_rad.cos() * delta_lon.cos();

    let bearing = x.atan2(y).to_degrees();
    (bearing + 360.0) % 360.0
}

/// Convertit un cap en direction cardinale
pub fn bearing_to_cardinal(bearing: f64) -> &'static str {
    let normalized = ((bearing % 360.0) + 360.0) % 360.0;
    match normalized {
        b if !(22.5..337.5).contains(&b) => "N",
        b if b < 67.5 => "NE",
        b if b < 112.5 => "E",
        b if b < 157.5 => "SE",
        b if b < 202.5 => "S",
        b if b < 247.5 => "SW",
        b if b < 292.5 => "W",
        _ => "NW",
    }
}

/// Vérifie si deux bounding boxes s'intersectent
pub fn bbox_intersects(bbox1: (f64, f64, f64, f64), bbox2: (f64, f64, f64, f64)) -> bool {
    let (min_x1, min_y1, max_x1, max_y1) = bbox1;
    let (min_x2, min_y2, max_x2, max_y2) = bbox2;

    min_x1 <= max_x2 && max_x1 >= min_x2 && min_y1 <= max_y2 && max_y1 >= min_y2
}

/// Calcule le point milieu entre deux coordonnées
pub fn midpoint(lat1: f64, lon1: f64, lat2: f64, lon2: f64) -> (f64, f64) {
    ((lat1 + lat2) / 2.0, (lon1 + lon2) / 2.0)
}

/// Arrondit une coordonnée à un nombre de décimales
pub fn round_coordinate(value: f64, decimals: u32) -> f64 {
    let multiplier = 10_f64.powi(decimals as i32);
    (value * multiplier).round() / multiplier
}

// ==================== Commandes Tauri ====================

#[tauri::command]
pub async fn get_points(
    app: tauri::AppHandle,
    event_id: Option<String>,
) -> Result<serde_json::Value, String> {
    println!("[MAP] 📍 get_points appelé avec event_id: {:?}", event_id);
    let pts = crate::db::retrieve_data_by_event(&app, &event_id).await?;
    serde_json::to_value(pts).map_err(|e| e.to_string())
}
