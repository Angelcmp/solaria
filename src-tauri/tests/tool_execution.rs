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
async fn test_glob_recursive_patterns() {
    let root = std::env::temp_dir().join(format!("solaria_glob_{}", std::process::id()));
    let root_str = root.to_string_lossy().to_string();
    let _ = std::fs::remove_dir_all(&root_str);
    std::fs::create_dir_all(format!("{}/sub/deep", root_str)).unwrap();
    std::fs::write(format!("{}/a.md", root_str), "a").unwrap();
    std::fs::write(format!("{}/sub/b.md", root_str), "b").unwrap();
    std::fs::write(format!("{}/sub/deep/c.md", root_str), "c").unwrap();
    std::fs::write(format!("{}/sub/ignore.txt", root_str), "x").unwrap();

    // `**/*` debe listar todo recursivamente (antes devolvía vacío).
    let all = tools::execute_tool("glob", r#"{"pattern": "**/*"}"#, Some(root_str.clone()), false, false).await;
    assert!(all.success, "{:?}", all.error);
    assert!(all.output.contains("a.md"), "output: {}", all.output);
    assert!(all.output.contains("sub/deep/c.md"), "output: {}", all.output);

    // `**/*.md` filtra por extensión a cualquier profundidad.
    let md = tools::execute_tool("glob", r#"{"pattern": "**/*.md"}"#, Some(root_str.clone()), false, false).await;
    assert!(md.success);
    assert!(md.output.contains("sub/deep/c.md"), "output: {}", md.output);
    assert!(!md.output.contains("ignore.txt"), "output: {}", md.output);

    // Patrón con prefijo de directorio.
    let nested = tools::execute_tool("glob", r#"{"pattern": "sub/**/*.md"}"#, Some(root_str.clone()), false, false).await;
    assert!(nested.success);
    assert!(nested.output.contains("sub/deep/c.md"), "output: {}", nested.output);

    let _ = std::fs::remove_dir_all(&root_str);
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

#[tokio::test]
async fn test_write_file_blocked_path_is_dry_run() {
    let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".into());
    let target = format!("{}/.ssh/solaria_gate_{}.txt", home, std::process::id());
    let result = tools::execute_tool(
        "write_file",
        &format!(r#"{{"path": "{}", "content": "no debe escribirse"}}"#, target),
        None, false, false,
    ).await;
    assert!(!result.success);
    assert!(result.requires_confirmation);
    assert!(result.error.is_none(), "el dry-run no debe devolver error: {:?}", result.error);
    assert!(
        !std::path::Path::new(&target).exists(),
        "no debe escribir nada antes de la confirmación"
    );
}
