use solaria_desktop_lib::tools;

#[tokio::test]
async fn test_read_write_file_integration() {
    let tmp = std::env::temp_dir().join(format!("solaria_test_{}", std::process::id()));
    let test_path = tmp.to_string_lossy().to_string();
    let _ = std::fs::remove_dir_all(&test_path);
    std::fs::create_dir_all(&test_path).unwrap();

    let file_path = format!("{}/integration_test.txt", test_path);

    let write_result = tools::execute_tool(
        "write_file",
        &format!(r#"{{"path": "{}", "content": "integration test content 456"}}"#, file_path),
        None, true, false,
    ).await;
    assert!(write_result.success, "write debería funcionar: {:?}", write_result.error);
    assert!(write_result.output.contains("escrito correctamente"));

    let read_result = tools::execute_tool(
        "read_file",
        &format!(r#"{{"path": "{}"}}"#, file_path),
        None, true, false,
    ).await;
    assert!(read_result.success, "read debería funcionar: {:?}", read_result.error);
    assert_eq!(read_result.output.trim(), "integration test content 456");

    let _ = std::fs::remove_dir_all(&test_path);
}

#[tokio::test]
async fn test_read_nonexistent_file() {
    let result = tools::execute_tool(
        "read_file",
        r#"{"path": "/tmp/solaria_test_nonexistent_abc123.txt"}"#,
        None, true, false,
    ).await;
    assert!(!result.success);
    assert!(result.error.as_deref().unwrap().contains("Error al leer archivo"));
}

#[tokio::test]
async fn test_glob_execute() {
    let result = tools::execute_tool(
        "glob",
        r#"{"pattern": "**/*.rs"}"#,
        None, true, false,
    ).await;
    assert!(result.success, "glob debería funcionar: {:?}", result.error);
}

#[tokio::test]
async fn test_tool_list_includes_all_tools() {
    let tools_list = tools::get_all_tools();
    let names: Vec<&str> = tools_list.iter().map(|t| t.name.as_str()).collect();
    assert!(names.contains(&"read_file"));
    assert!(names.contains(&"write_file"));
    assert!(names.contains(&"glob"));
    assert!(names.contains(&"grep"));
    assert!(names.contains(&"web_search"));
    assert!(names.contains(&"fetch_url"));
    assert_eq!(tools_list.len(), 6);
}

#[tokio::test]
async fn test_unknown_tool_returns_error() {
    let result = tools::execute_tool(
        "nonexistent_tool_xyz",
        "{}",
        None, true, false,
    ).await;
    assert!(!result.success);
    assert!(result.error.as_deref().unwrap().contains("no encontrada"));
}

#[tokio::test]
async fn test_fetch_url_validation() {
    let result = tools::execute_tool(
        "fetch_url",
        r#"{"url": "invalid"}"#,
        None, true, false,
    ).await;
    assert!(!result.success);
    assert!(result.error.as_deref().unwrap().contains("http"));
}

#[tokio::test]
async fn test_web_search_empty_query() {
    let result = tools::execute_tool(
        "web_search",
        r#"{"query": ""}"#,
        None, true, false,
    ).await;
    assert!(!result.success);
    assert!(result.error.as_deref().unwrap().contains("'query' es requerido"));
}

#[tokio::test]
async fn test_write_file_empty_path() {
    let result = tools::execute_tool(
        "write_file",
        r#"{"path": "", "content": "test"}"#,
        None, true, false,
    ).await;
    assert!(!result.success);
    assert!(result.error.as_deref().unwrap().contains("'path' es requerido"));
}

#[tokio::test]
async fn test_grep_empty_pattern() {
    let result = tools::execute_tool(
        "grep",
        r#"{"pattern": ""}"#,
        None, true, false,
    ).await;
    assert!(!result.success);
    assert!(result.error.as_deref().unwrap().contains("'pattern' es requerido"));
}

#[tokio::test]
async fn test_fetch_url_empty() {
    let result = tools::execute_tool(
        "fetch_url",
        r#"{"url": ""}"#,
        None, true, false,
    ).await;
    assert!(!result.success);
    assert!(result.error.as_deref().unwrap().contains("'url' es requerido"));
}

#[tokio::test]
async fn test_read_blocked_path() {
    let result = tools::execute_tool(
        "read_file",
        r#"{"path": "/etc/shadow"}"#,
        None, false, false,
    ).await;
    assert!(!result.success);
    assert!(result.requires_confirmation);
}
