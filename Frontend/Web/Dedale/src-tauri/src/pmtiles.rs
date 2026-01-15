// Module pour obtenir le chemin vers le fichier PMTiles
// Ce chemin est nécessaire pour que le frontend puisse accéder aux tuiles de carte

use serde::Serialize;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize)]
pub struct PmtilesPath {
    pub path: String,
    pub url: String,
}

/// Obtient le chemin vers le fichier PMTiles
fn get_pmtiles_path() -> Result<PathBuf, String> {
    let exe_path = std::env::current_exe()
        .map_err(|e| format!("Impossible d'obtenir le chemin de l'exécutable: {}", e))?;

    let exe_dir = exe_path
        .parent()
        .ok_or_else(|| "Impossible d'obtenir le dossier parent".to_string())?;

    // Liste des chemins possibles à tester
    let possible_paths = vec![
        // Mode dev - chemin relatif depuis target/debug vers resources/
        exe_dir
            .join("..")
            .join("..")
            .join("..")
            .join("resources")
            .join("eurometropole_strasbourg.pmtiles"),
        // Mode prod - ressources à côté de l'exécutable
        exe_dir
            .join("resources")
            .join("eurometropole_strasbourg.pmtiles"),
        // Mode prod - directement à côté de l'exécutable
        exe_dir.join("eurometropole_strasbourg.pmtiles"),
        // Chemin absolu de fallback pour le dev
        PathBuf::from("src-tauri/resources/eurometropole_strasbourg.pmtiles"),
    ];

    for path in &possible_paths {
        if path.exists() {
            let canonical = path.canonicalize().unwrap_or_else(|_| path.clone());
            return Ok(canonical);
        }
    }

    let paths_str: Vec<String> = possible_paths
        .iter()
        .map(|p| format!("  - {:?}", p))
        .collect();

    Err(format!(
        "Fichier PMTiles non trouvé.\nChemins testés:\n{}",
        paths_str.join("\n")
    ))
}

/// Commande Tauri pour obtenir le chemin absolu du fichier PMTiles
#[tauri::command]
pub fn get_pmtiles_file_path() -> Result<PmtilesPath, String> {
    let path = get_pmtiles_path()?;
    let mut path_str = path.to_string_lossy().to_string();

    // Sur Windows, supprimer le préfixe \\?\ qui est ajouté par canonicalize()
    if path_str.starts_with(r"\\?\") {
        path_str = path_str[4..].to_string();
    }

    // Créer une URL de type file:// pour le protocole PMTiles
    #[cfg(target_os = "windows")]
    let file_url = format!("file:///{}", path_str.replace("\\", "/"));

    #[cfg(not(target_os = "windows"))]
    let file_url = format!("file://{}", path_str);

    Ok(PmtilesPath {
        path: path_str,
        url: file_url,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_pmtiles_path_serialization() {
        let result = PmtilesPath {
            path: "/path/to/file.pmtiles".to_string(),
            url: "file:///path/to/file.pmtiles".to_string(),
        };

        let json = serde_json::to_string(&result).unwrap();
        assert!(json.contains("pmtiles"));
    }
}
