use crate::pdf::{
    clean_base64_string, decode_base64, extract_base64_content, format_comments_list,
    format_obstacle, format_obstacles_list, generate_image_filename, generate_point_heading,
    generate_typst_header, generate_typst_image_entry, generate_typst_image_grid_start,
    generate_typst_separator, is_valid_font_extension,
};

// ============== Tests pour format_obstacle ==============

#[test]
fn test_format_obstacle_basic() {
    let result = format_obstacle(Some("Arbre"), Some(3));
    assert_eq!(result, "Arbre (x3)");
}

#[test]
fn test_format_obstacle_none_name() {
    let result = format_obstacle(None, Some(2));
    assert_eq!(result, "N/A (x2)");
}

#[test]
fn test_format_obstacle_none_number() {
    let result = format_obstacle(Some("Rocher"), None);
    assert_eq!(result, "Rocher (x0)");
}

#[test]
fn test_format_obstacle_both_none() {
    let result = format_obstacle(None, None);
    assert_eq!(result, "N/A (x0)");
}

// ============== Tests pour format_obstacles_list ==============

#[test]
fn test_format_obstacles_list_single() {
    let obstacles = vec![(Some("Arbre".to_string()), Some(5))];
    let result = format_obstacles_list(&obstacles);
    assert_eq!(result, "Arbre (x5)");
}

#[test]
fn test_format_obstacles_list_multiple() {
    let obstacles = vec![
        (Some("Arbre".to_string()), Some(3)),
        (Some("Rocher".to_string()), Some(2)),
    ];
    let result = format_obstacles_list(&obstacles);
    assert!(result.contains("Arbre (x3)"));
    assert!(result.contains("Rocher (x2)"));
}

#[test]
fn test_format_obstacles_list_empty() {
    let obstacles: Vec<(Option<String>, Option<i32>)> = vec![];
    let result = format_obstacles_list(&obstacles);
    assert_eq!(result, "None");
}

// ============== Tests pour format_comments_list ==============

#[test]
fn test_format_comments_list_single() {
    let comments = vec!["Premier commentaire".to_string()];
    let result = format_comments_list(&comments);
    assert_eq!(result, "Premier commentaire");
}

#[test]
fn test_format_comments_list_multiple() {
    let comments = vec!["Commentaire 1".to_string(), "Commentaire 2".to_string()];
    let result = format_comments_list(&comments);
    assert!(result.contains("Commentaire 1"));
    assert!(result.contains("Commentaire 2"));
}

#[test]
fn test_format_comments_list_empty() {
    let comments: Vec<String> = vec![];
    let result = format_comments_list(&comments);
    assert_eq!(result, "None");
}

// ============== Tests pour generate_point_heading ==============

#[test]
fn test_generate_point_heading_basic() {
    let heading = generate_point_heading("P1", 48.8566, 2.3522);
    assert!(heading.contains("P1"));
    assert!(heading.contains("48.8566"));
    assert!(heading.contains("2.3522"));
    assert!(heading.starts_with("== Point"));
}

#[test]
fn test_generate_point_heading_with_negative() {
    let heading = generate_point_heading("P2", -33.8688, 151.2093);
    assert!(heading.contains("-33.8688"));
    assert!(heading.contains("151.2093"));
}

// ============== Tests pour clean_base64_string ==============

#[test]
fn test_clean_base64_string_with_prefix() {
    let input = "data:image/png;base64,iVBORw0KGgo=";
    let cleaned = clean_base64_string(input);
    assert_eq!(cleaned, "iVBORw0KGgo=");
}

#[test]
fn test_clean_base64_string_without_prefix() {
    let input = "iVBORw0KGgo=";
    let cleaned = clean_base64_string(input);
    assert_eq!(cleaned, "iVBORw0KGgo=");
}

#[test]
fn test_clean_base64_string_jpeg() {
    let input = "data:image/jpeg;base64,/9j/4AAQ";
    let cleaned = clean_base64_string(input);
    assert_eq!(cleaned, "/9j/4AAQ");
}

// ============== Tests pour extract_base64_content ==============

#[test]
fn test_extract_base64_content_png() {
    let input = "data:image/png;base64,iVBORw0KGgo=";
    let (mime, content) = extract_base64_content(input);
    assert_eq!(mime, Some("image/png"));
    assert_eq!(content, "iVBORw0KGgo=");
}

#[test]
fn test_extract_base64_content_jpeg() {
    let input = "data:image/jpeg;base64,/9j/4AAQSkYJRg==";
    let (mime, content) = extract_base64_content(input);
    assert_eq!(mime, Some("image/jpeg"));
    assert_eq!(content, "/9j/4AAQSkYJRg==");
}

#[test]
fn test_extract_base64_content_no_prefix() {
    let input = "iVBORw0KGgo=";
    let (mime, content) = extract_base64_content(input);
    assert_eq!(mime, None);
    assert_eq!(content, "iVBORw0KGgo=");
}

// ============== Tests pour decode_base64 ==============

#[test]
fn test_decode_base64_valid() {
    let input = "SGVsbG8gV29ybGQ="; // "Hello World"
    let result = decode_base64(input);
    assert!(result.is_ok());
    assert_eq!(result.unwrap(), b"Hello World");
}

#[test]
fn test_decode_base64_empty() {
    let input = "";
    let result = decode_base64(input);
    assert!(result.is_ok());
    assert!(result.unwrap().is_empty());
}

#[test]
fn test_decode_base64_with_whitespace() {
    let input = "SGVs bG8g V29y bGQ=";
    let result = decode_base64(input);
    assert!(result.is_ok());
    assert_eq!(result.unwrap(), b"Hello World");
}

// ============== Tests pour generate_image_filename ==============

#[test]
fn test_generate_image_filename_basic() {
    let filename = generate_image_filename(0, 0);
    assert_eq!(filename, "img_0_0.png");
}

#[test]
fn test_generate_image_filename_large_indices() {
    let filename = generate_image_filename(10, 25);
    assert_eq!(filename, "img_10_25.png");
}

// ============== Tests pour is_valid_font_extension ==============

#[test]
fn test_is_valid_font_extension_ttf() {
    assert!(is_valid_font_extension("ttf"));
    assert!(is_valid_font_extension("TTF"));
}

#[test]
fn test_is_valid_font_extension_otf() {
    assert!(is_valid_font_extension("otf"));
    assert!(is_valid_font_extension("OTF"));
}

#[test]
fn test_is_valid_font_extension_woff() {
    assert!(is_valid_font_extension("woff"));
    assert!(is_valid_font_extension("woff2"));
}

#[test]
fn test_is_valid_font_extension_invalid() {
    assert!(!is_valid_font_extension("txt"));
    assert!(!is_valid_font_extension("pdf"));
    assert!(!is_valid_font_extension("jpg"));
}

// ============== Tests pour generate_typst_header ==============

#[test]
fn test_generate_typst_header_contains_page() {
    let header = generate_typst_header();
    assert!(header.contains("page"));
    assert!(header.contains("a4"));
}

#[test]
fn test_generate_typst_header_contains_font() {
    let header = generate_typst_header();
    assert!(header.contains("font"));
    assert!(header.contains("Liberation Sans"));
}

#[test]
fn test_generate_typst_header_contains_title() {
    let header = generate_typst_header();
    assert!(header.contains("Recap"));
}

// ============== Tests pour generate_typst_separator ==============

#[test]
fn test_generate_typst_separator() {
    let separator = generate_typst_separator();
    assert!(!separator.is_empty());
    assert!(separator.contains("line"));
    assert!(separator.contains("gray"));
}

// ============== Tests pour generate_typst_image_grid_start ==============

#[test]
fn test_generate_typst_image_grid_start() {
    let grid = generate_typst_image_grid_start();
    assert!(grid.contains("grid"));
    assert!(grid.contains("columns"));
}

// ============== Tests pour generate_typst_image_entry ==============

#[test]
fn test_generate_typst_image_entry() {
    let entry = generate_typst_image_entry("image.png");
    assert!(entry.contains("image.png"));
    assert!(entry.contains("image("));
}

#[test]
fn test_generate_typst_image_entry_with_path() {
    let entry = generate_typst_image_entry("path/to/photo.jpg");
    assert!(entry.contains("path/to/photo.jpg"));
}
