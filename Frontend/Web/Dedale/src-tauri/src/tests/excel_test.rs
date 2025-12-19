use crate::excel::{
    calculate_range, cell_reference, column_index_to_letter, column_letter_to_index,
    estimate_file_size, format_file_size, format_optional_float, format_optional_number,
    format_optional_string, generate_empty_obstacle_row, generate_obstacle_row, get_column_count,
    get_column_index, get_column_name, is_valid_dimension, is_valid_excel_range,
    is_valid_obstacle_count, is_valid_obstacle_name, parse_cell_reference, EXCEL_HEADERS,
};

// ============== Tests pour EXCEL_HEADERS ==============

#[test]
fn test_excel_headers_count() {
    assert_eq!(EXCEL_HEADERS.len(), 8);
}

#[test]
fn test_excel_headers_contains_essential() {
    let headers: Vec<&str> = EXCEL_HEADERS.to_vec();
    assert!(headers.contains(&"Point ID"));
    assert!(headers.contains(&"X"));
    assert!(headers.contains(&"Y"));
}

// ============== Tests pour get_column_count ==============

#[test]
fn test_get_column_count() {
    let count = get_column_count();
    assert_eq!(count, EXCEL_HEADERS.len());
    assert_eq!(count, 8);
}

// ============== Tests pour get_column_index ==============

#[test]
fn test_get_column_index_existing() {
    let index = get_column_index("Point ID");
    assert!(index.is_some());
    assert_eq!(index.unwrap(), 0);
}

#[test]
fn test_get_column_index_x() {
    let index = get_column_index("X");
    assert!(index.is_some());
    assert_eq!(index.unwrap(), 1);
}

#[test]
fn test_get_column_index_nonexistent() {
    let index = get_column_index("ColonneInexistante");
    assert!(index.is_none());
}

// ============== Tests pour get_column_name ==============

#[test]
fn test_get_column_name_valid() {
    let name = get_column_name(0);
    assert!(name.is_some());
    assert_eq!(name.unwrap(), "Point ID");
}

#[test]
fn test_get_column_name_y() {
    let name = get_column_name(2);
    assert!(name.is_some());
    assert_eq!(name.unwrap(), "Y");
}

#[test]
fn test_get_column_name_invalid() {
    let name = get_column_name(1000);
    assert!(name.is_none());
}

// ============== Tests pour is_valid_obstacle_name ==============

#[test]
fn test_is_valid_obstacle_name_valid() {
    assert!(is_valid_obstacle_name(Some("Arbre")));
    assert!(is_valid_obstacle_name(Some("Rocher_1")));
    assert!(is_valid_obstacle_name(Some("Obstacle-test")));
}

#[test]
fn test_is_valid_obstacle_name_invalid() {
    assert!(!is_valid_obstacle_name(Some("")));
    assert!(!is_valid_obstacle_name(Some("   ")));
    assert!(!is_valid_obstacle_name(None));
}

#[test]
fn test_is_valid_obstacle_name_with_spaces() {
    assert!(is_valid_obstacle_name(Some("Mon Obstacle")));
}

// ============== Tests pour format_optional_string ==============

#[test]
fn test_format_optional_string_some() {
    let result = format_optional_string(Some("test"));
    assert_eq!(result, "test");
}

#[test]
fn test_format_optional_string_none() {
    let result = format_optional_string(None);
    assert_eq!(result, "");
}

// ============== Tests pour format_optional_number ==============

#[test]
fn test_format_optional_number_some() {
    assert_eq!(format_optional_number(Some(42)), 42);
}

#[test]
fn test_format_optional_number_none() {
    assert_eq!(format_optional_number(None), 0);
}

#[test]
fn test_format_optional_number_negative() {
    assert_eq!(format_optional_number(Some(-10)), -10);
}

// ============== Tests pour format_optional_float ==============

#[test]
fn test_format_optional_float_some() {
    let result = format_optional_float(Some(3.5));
    assert!((result - 3.5).abs() < 0.01);
}

#[test]
fn test_format_optional_float_none() {
    assert!((format_optional_float(None) - 0.0).abs() < 0.001);
}

#[test]
fn test_format_optional_float_integer() {
    assert!((format_optional_float(Some(42.0)) - 42.0).abs() < 0.01);
}

// ============== Tests pour generate_empty_obstacle_row ==============

#[test]
fn test_generate_empty_obstacle_row() {
    let (name, desc, number, width, length) = generate_empty_obstacle_row();
    assert_eq!(name, "");
    assert_eq!(desc, "");
    assert_eq!(number, 0);
    assert!((width - 0.0).abs() < 0.001);
    assert!((length - 0.0).abs() < 0.001);
}

// ============== Tests pour generate_obstacle_row ==============

#[test]
fn test_generate_obstacle_row_complete() {
    let (name, desc, number, width, length) = generate_obstacle_row(
        Some("Arbre"),
        Some("Grand arbre"),
        Some(5),
        Some(2.5),
        Some(3.0),
    );
    assert_eq!(name, "Arbre");
    assert_eq!(desc, "Grand arbre");
    assert_eq!(number, 5);
    assert!((width - 2.5).abs() < 0.01);
    assert!((length - 3.0).abs() < 0.01);
}

#[test]
fn test_generate_obstacle_row_partial() {
    let (name, desc, number, width, length) =
        generate_obstacle_row(Some("Test"), None, None, Some(1.0), None);
    assert_eq!(name, "Test");
    assert_eq!(desc, "");
    assert_eq!(number, 0);
    assert!((width - 1.0).abs() < 0.01);
    assert!((length - 0.0).abs() < 0.001);
}

// ============== Tests pour is_valid_dimension ==============

#[test]
fn test_is_valid_dimension_positive() {
    assert!(is_valid_dimension(Some(5.0)));
    assert!(is_valid_dimension(Some(0.0)));
}

#[test]
fn test_is_valid_dimension_negative() {
    assert!(!is_valid_dimension(Some(-1.0)));
}

#[test]
fn test_is_valid_dimension_none() {
    assert!(is_valid_dimension(None));
}

// ============== Tests pour is_valid_obstacle_count ==============

#[test]
fn test_is_valid_obstacle_count_positive() {
    assert!(is_valid_obstacle_count(Some(5)));
    assert!(is_valid_obstacle_count(Some(0)));
}

#[test]
fn test_is_valid_obstacle_count_negative() {
    assert!(!is_valid_obstacle_count(Some(-1)));
}

#[test]
fn test_is_valid_obstacle_count_none() {
    assert!(is_valid_obstacle_count(None));
}

// ============== Tests pour column_index_to_letter ==============

#[test]
fn test_column_index_to_letter_single() {
    assert_eq!(column_index_to_letter(0), "A");
    assert_eq!(column_index_to_letter(1), "B");
    assert_eq!(column_index_to_letter(25), "Z");
}

#[test]
fn test_column_index_to_letter_double() {
    assert_eq!(column_index_to_letter(26), "AA");
    assert_eq!(column_index_to_letter(27), "AB");
    assert_eq!(column_index_to_letter(51), "AZ");
}

// ============== Tests pour column_letter_to_index ==============

#[test]
fn test_column_letter_to_index_single() {
    assert_eq!(column_letter_to_index("A"), Some(0));
    assert_eq!(column_letter_to_index("B"), Some(1));
    assert_eq!(column_letter_to_index("Z"), Some(25));
}

#[test]
fn test_column_letter_to_index_double() {
    assert_eq!(column_letter_to_index("AA"), Some(26));
    assert_eq!(column_letter_to_index("AB"), Some(27));
}

#[test]
fn test_column_letter_to_index_invalid() {
    assert_eq!(column_letter_to_index(""), None);
    assert_eq!(column_letter_to_index("123"), None);
    assert_eq!(column_letter_to_index("aB"), None);
}

// ============== Tests pour cell_reference ==============

#[test]
fn test_cell_reference_basic() {
    assert_eq!(cell_reference(0, 0), "A1");
    assert_eq!(cell_reference(1, 0), "B1");
    assert_eq!(cell_reference(0, 9), "A10");
}

#[test]
fn test_cell_reference_double_letter() {
    assert_eq!(cell_reference(26, 0), "AA1");
}

// ============== Tests pour parse_cell_reference ==============

#[test]
fn test_parse_cell_reference_valid() {
    let result = parse_cell_reference("A1");
    assert!(result.is_some());
    let (col, row) = result.unwrap();
    assert_eq!(col, 0);
    assert_eq!(row, 0);
}

#[test]
fn test_parse_cell_reference_complex() {
    let result = parse_cell_reference("AA100");
    assert!(result.is_some());
    let (col, row) = result.unwrap();
    assert_eq!(col, 26);
    assert_eq!(row, 99);
}

#[test]
fn test_parse_cell_reference_invalid() {
    assert!(parse_cell_reference("").is_none());
    assert!(parse_cell_reference("123").is_none());
    assert!(parse_cell_reference("A0").is_none());
}

// ============== Tests pour calculate_range ==============

#[test]
fn test_calculate_range_basic() {
    let range = calculate_range(0, 0, 5, 9);
    assert_eq!(range, "A1:F10");
}

#[test]
fn test_calculate_range_single_cell() {
    let range = calculate_range(0, 0, 0, 0);
    assert_eq!(range, "A1:A1");
}

// ============== Tests pour is_valid_excel_range ==============

#[test]
fn test_is_valid_excel_range_valid() {
    assert!(is_valid_excel_range(0, 0));
    assert!(is_valid_excel_range(100, 1000));
    assert!(is_valid_excel_range(16383, 1048575));
}

#[test]
fn test_is_valid_excel_range_invalid() {
    assert!(!is_valid_excel_range(16384, 0));
    assert!(!is_valid_excel_range(0, 1048576));
}

// ============== Tests pour estimate_file_size ==============

#[test]
fn test_estimate_file_size_basic() {
    let size = estimate_file_size(100, 10);
    assert!(size > 0);
    assert!(size > 5000); // At least base overhead
}

#[test]
fn test_estimate_file_size_zero() {
    let size = estimate_file_size(0, 10);
    assert!(size >= 5000); // Base overhead
}

// ============== Tests pour format_file_size ==============

#[test]
fn test_format_file_size_bytes() {
    assert_eq!(format_file_size(500), "500 B");
}

#[test]
fn test_format_file_size_kb() {
    assert_eq!(format_file_size(2048), "2.00 KB");
}

#[test]
fn test_format_file_size_mb() {
    let size = 2 * 1024 * 1024;
    assert_eq!(format_file_size(size), "2.00 MB");
}
