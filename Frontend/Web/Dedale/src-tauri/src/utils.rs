use dirs::data_dir;
use rfd::FileDialog;
use std::path::Path;
use std::path::PathBuf;

pub fn create_file_name(base_name: String, extension: String) -> (String, String) {
    let mut path: PathBuf = data_dir().expect("Impossible de récupérer data_dir");
    path.push("dedale");
    let file_path = path.to_str().expect("Invalid PDF path").to_string();
    let mut name = base_name.clone();

    let mut candidate = format!("{}/{}.{}", file_path, base_name, extension);
    let mut i = 1;

    while Path::new(&candidate).exists() {
        candidate = format!("{}/{}({}).{}", file_path, base_name, i, extension);
        name = format!("{}({})", base_name, i);
        i += 1;
    }

    (file_path, format!("{}.{}", name, extension))
}

pub fn show_save_dialog(
    default_file_name: &str,
    file_path: &String,
    extension: String,
) -> Option<PathBuf> {
    let mut dialog = FileDialog::new()
        .set_title("Enregistrer les données de la carte")
        .set_file_name(default_file_name)
        .set_directory(file_path);

    if extension.to_lowercase().contains("pdf") {
        dialog = dialog.add_filter("PDF (.pdf)", &["pdf"]);
        dialog = dialog.add_filter("EXCEL (.xlsx)", &["xlsx"]);
    } else {
        dialog = dialog.add_filter("EXCEL (.xlsx)", &["xlsx"]);
        dialog = dialog.add_filter("PDF (.pdf)", &["pdf"]);
    }

    dialog.add_filter("Any", &["*"]).save_file()
}
