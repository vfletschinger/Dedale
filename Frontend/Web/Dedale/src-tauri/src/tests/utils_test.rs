#[cfg(test)]
mod tests {
    use crate::utils::create_file_name;

    /// Test que create_file_name retourne un nom de fichier avec l'extension correcte
    #[test]
    fn test_create_file_name_returns_correct_extension_pdf() {
        let (_, file_name) = create_file_name("recap".to_string(), "pdf".to_string());
        assert!(
            file_name.ends_with(".pdf"),
            "Le nom de fichier devrait se terminer par .pdf"
        );
    }

    #[test]
    fn test_create_file_name_returns_correct_extension_xlsx() {
        let (_, file_name) = create_file_name("recap".to_string(), "xlsx".to_string());
        assert!(
            file_name.ends_with(".xlsx"),
            "Le nom de fichier devrait se terminer par .xlsx"
        );
    }

    /// Test que create_file_name retourne un chemin de fichier non vide
    #[test]
    fn test_create_file_name_returns_non_empty_path() {
        let (file_path, _) = create_file_name("recap".to_string(), "pdf".to_string());
        assert!(
            !file_path.is_empty(),
            "Le chemin de fichier ne devrait pas être vide"
        );
    }

    /// Test que le nom de fichier contient "recap"
    #[test]
    fn test_create_file_name_contains_recap() {
        let (_, file_name) = create_file_name("recap".to_string(), "pdf".to_string());
        assert!(
            file_name.contains("recap"),
            "Le nom de fichier devrait contenir 'recap'"
        );
    }

    /// Test que le chemin contient "dedale"
    #[test]
    fn test_create_file_name_path_contains_dedale() {
        let (file_path, _) = create_file_name("recap".to_string(), "pdf".to_string());
        assert!(
            file_path.contains("dedale"),
            "Le chemin devrait contenir 'dedale'"
        );
    }

    /// Test avec différentes extensions
    #[test]
    fn test_create_file_name_various_extensions() {
        let extensions = vec!["txt", "json", "csv", "doc"];

        for ext in extensions {
            let (_, file_name) = create_file_name("recap".to_string(), ext.to_string());
            assert!(
                file_name.ends_with(&format!(".{}", ext)),
                "Le nom de fichier devrait se terminer par .{}",
                ext
            );
        }
    }

    /// Test que le format du nom de fichier est correct (recap.extension ou recap(n).extension)
    #[test]
    fn test_create_file_name_format() {
        let (_, file_name) = create_file_name("recap".to_string(), "pdf".to_string());

        // Le nom devrait commencer par "recap"
        assert!(
            file_name.starts_with("recap"),
            "Le nom de fichier devrait commencer par 'recap', obtenu: {}",
            file_name
        );
    }

    /// Test que le chemin de fichier est un chemin absolu valide
    #[test]
    fn test_create_file_name_returns_valid_path() {
        let (file_path, _) = create_file_name("recap".to_string(), "pdf".to_string());

        // Vérifie que le chemin ressemble à un chemin absolu
        #[cfg(windows)]
        {
            // Sur Windows, le chemin devrait contenir un lecteur (C:, D:, etc.)
            assert!(
                file_path.contains(':') || file_path.starts_with("\\\\"),
                "Le chemin devrait être absolu sur Windows"
            );
        }

        #[cfg(not(windows))]
        {
            // Sur Unix, le chemin devrait commencer par /
            assert!(
                file_path.starts_with('/'),
                "Le chemin devrait commencer par / sur Unix"
            );
        }
    }
}
