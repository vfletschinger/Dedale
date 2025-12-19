use image::{GenericImageView, ImageFormat};
use std::path::Path;

const MAP_BYTES: &[u8] = include_bytes!("../assets/strasbourg_map.png");

const MAP_NORD: f64 = 48.6300;
const MAP_SUD: f64 = 48.5300;
const MAP_OUEST: f64 = 7.6800;
const MAP_EST: f64 = 7.8200;

pub struct CroppedMap {
    pub image_path: String,
    pub bounds: Bounds,
}

#[derive(Clone, Copy)]
pub struct Bounds {
    pub min_x: f64,
    pub max_x: f64,
    pub min_y: f64,
    pub max_y: f64,
}

pub fn generate_cropped_map(
    output_dir: &Path,
    points: &[crate::db::Point],
) -> Result<CroppedMap, String> {
    if points.is_empty() {
        return Err("Aucun point à afficher".to_string());
    }

    println!("🗺️ Chargement de la carte intégrée...");

    let img = image::load_from_memory(MAP_BYTES)
        .map_err(|e| format!("L'image de carte intégrée est invalide ou corrompue: {}", e))?;

    let (full_w, full_h) = img.dimensions();
    println!("✅ Carte chargée: {}x{} px", full_w, full_h);

    let pts_min_lon = points
        .iter()
        .map(|p| p.x)
        .fold(f64::INFINITY, |a, b| a.min(b));
    let pts_max_lon = points
        .iter()
        .map(|p| p.x)
        .fold(f64::NEG_INFINITY, |a, b| a.max(b));
    let pts_min_lat = points
        .iter()
        .map(|p| p.y)
        .fold(f64::INFINITY, |a, b| a.min(b));
    let pts_max_lat = points
        .iter()
        .map(|p| p.y)
        .fold(f64::NEG_INFINITY, |a, b| a.max(b));

    let margin_x = (pts_max_lon - pts_min_lon) * 0.2;
    let margin_y = (pts_max_lat - pts_min_lat) * 0.2;

    let min_zoom_deg = 0.025;

    let target_min_lon = (pts_min_lon - margin_x)
        .min(pts_min_lon - min_zoom_deg / 2.0)
        .max(MAP_OUEST);
    let target_max_lon = (pts_max_lon + margin_x)
        .max(pts_max_lon + min_zoom_deg / 2.0)
        .min(MAP_EST);
    let target_min_lat = (pts_min_lat - margin_y)
        .min(pts_min_lat - min_zoom_deg / 2.0)
        .max(MAP_SUD);
    let target_max_lat = (pts_max_lat + margin_y)
        .max(pts_max_lat + min_zoom_deg / 2.0)
        .min(MAP_NORD);

    let deg_width = MAP_EST - MAP_OUEST;
    let deg_height = MAP_NORD - MAP_SUD;

    if deg_width == 0.0 || deg_height == 0.0 {
        return Err("Erreur de calibration : largeur ou hauteur de carte nulle".to_string());
    }

    let px_x1 = ((target_min_lon - MAP_OUEST) / deg_width * full_w as f64) as u32;
    let px_x2 = ((target_max_lon - MAP_OUEST) / deg_width * full_w as f64) as u32;

    let px_y1 = ((MAP_NORD - target_max_lat) / deg_height * full_h as f64) as u32;
    let px_y2 = ((MAP_NORD - target_min_lat) / deg_height * full_h as f64) as u32;

    let crop_x = px_x1.clamp(0, full_w - 1);
    let crop_y = px_y1.clamp(0, full_h - 1);
    let crop_w = (px_x2 - px_x1).clamp(1, full_w - crop_x);
    let crop_h = (px_y2 - px_y1).clamp(1, full_h - crop_y);

    if crop_w == 0 || crop_h == 0 {
        println!("⚠️ Zone calculée vide ou hors carte. Fallback: toute la carte.");
    }

    println!(
        "✂️ Découpe : x={} y={} w={} h={}",
        crop_x, crop_y, crop_w, crop_h
    );

    let cropped = img.crop_imm(crop_x, crop_y, crop_w, crop_h);

    let filename = "map_crop.jpg";
    let output_path = output_dir.join(filename);

    let mut file = std::fs::File::create(&output_path).map_err(|e| e.to_string())?;
    cropped
        .write_to(&mut file, ImageFormat::Jpeg)
        .map_err(|e| e.to_string())?;

    let final_min_lon = MAP_OUEST + (crop_x as f64 / full_w as f64) * deg_width;
    let final_max_lon = MAP_OUEST + ((crop_x + crop_w) as f64 / full_w as f64) * deg_width;

    let final_max_lat = MAP_NORD - (crop_y as f64 / full_h as f64) * deg_height;
    let final_min_lat = MAP_NORD - ((crop_y + crop_h) as f64 / full_h as f64) * deg_height;

    Ok(CroppedMap {
        image_path: filename.to_string(),
        bounds: Bounds {
            min_x: final_min_lon,
            max_x: final_max_lon,
            min_y: final_min_lat,
            max_y: final_max_lat,
        },
    })
}
