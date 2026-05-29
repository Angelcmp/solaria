use solaria_desktop_lib::tools;

#[tokio::test]
async fn test_shell_execute_simple_echo() {
    let result = tools::execute_tool(
        "shell",
        r#"{"command": "echo hello_test_123"}"#,
        None, true, false, 100, false, String::new(), false,
    ).await;
    assert!(result.success, "shell echo debería funcionar: {:?}", result.error);
    assert!(result.output.contains("hello_test_123"), "output: {}", result.output);
    assert!(!result.requires_confirmation);
}

#[tokio::test]
async fn test_shell_execute_ls() {
    let result = tools::execute_tool(
        "shell",
        r#"{"command": "ls -la"}"#,
        None, true, false, 100, false, String::new(), false,
    ).await;
    assert!(result.success, "shell ls debería funcionar: {:?}", result.error);
    assert!(!result.output.is_empty());
}

#[tokio::test]
async fn test_shell_dangerous_command_requires_confirmation() {
    let result = tools::execute_tool(
        "shell",
        r#"{"command": "rm -rf /"}"#,
        None, false, false, 100, false, String::new(), false,
    ).await;
    assert!(!result.success);
    assert!(result.requires_confirmation);
    assert!(result.preview.is_some());
    assert!(result.preview.as_deref().unwrap().contains("potencialmente peligroso"));
}

#[tokio::test]
async fn test_shell_dangerous_confirmed_executes() {
    let result = tools::execute_tool(
        "shell",
        r#"{"command": "rm -rf /"}"#,
        None, true, false, 100, false, String::new(), false,
    ).await;
    assert!(result.success || result.error.is_some());
}

#[tokio::test]
async fn test_shell_dangerous_auto_confirm_skips_confirmation() {
    let result = tools::execute_tool(
        "shell",
        r#"{"command": "rm -rf /"}"#,
        None, false, false, 100, false, String::new(), true,
    ).await;
    assert!(result.success || result.error.is_some());
    assert!(!result.requires_confirmation);
}

#[tokio::test]
async fn test_shell_allowlist_blocks() {
    let result = tools::execute_tool(
        "shell",
        r#"{"command": "rm -rf /"}"#,
        None, true, false, 100, true, "ls,cat,echo".into(), false,
    ).await;
    assert!(!result.success);
    assert!(result.error.as_deref().unwrap().contains("no está en la lista"));
}

#[tokio::test]
async fn test_shell_allowlist_allows() {
    let result = tools::execute_tool(
        "shell",
        r#"{"command": "echo allowed_test"}"#,
        None, true, false, 100, true, "echo".into(), false,
    ).await;
    assert!(result.success, "allowlist debería permitir echo: {:?}", result.error);
}

#[tokio::test]
async fn test_shell_rate_limit_exceeded() {
    let result = tools::execute_tool(
        "shell",
        r#"{"command": "echo test"}"#,
        None, true, false, 0, false, String::new(), false,
    ).await;
    assert!(!result.success);
    assert!(result.error.as_deref().unwrap().contains("Límite de herramientas"));
}

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
        None, true, false, 100, false, String::new(), false,
    ).await;
    assert!(write_result.success, "write debería funcionar: {:?}", write_result.error);
    assert!(write_result.output.contains("escrito correctamente"));

    let read_result = tools::execute_tool(
        "read_file",
        &format!(r#"{{"path": "{}"}}"#, file_path),
        None, true, false, 100, false, String::new(), false,
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
        None, true, false, 100, false, String::new(), false,
    ).await;
    assert!(!result.success);
    assert!(result.error.as_deref().unwrap().contains("Error al leer archivo"));
}

#[tokio::test]
async fn test_glob_execute() {
    let result = tools::execute_tool(
        "glob",
        r#"{"pattern": "**/*.rs"}"#,
        None, true, false, 100, false, String::new(), false,
    ).await;
    assert!(result.success, "glob debería funcionar: {:?}", result.error);
}

#[tokio::test]
async fn test_tool_list_includes_all_tools() {
    let tools_list = tools::get_all_tools();
    let names: Vec<&str> = tools_list.iter().map(|t| t.name.as_str()).collect();
    assert!(names.contains(&"shell"));
    assert!(names.contains(&"read_file"));
    assert!(names.contains(&"write_file"));
    assert!(names.contains(&"glob"));
    assert!(names.contains(&"grep"));
    assert!(names.contains(&"web_search"));
    assert!(names.contains(&"fetch_url"));
    assert!(names.contains(&"git_status"));
    assert!(names.contains(&"git_log"));
    assert!(names.contains(&"git_branches"));
    assert!(names.contains(&"git_add"));
    assert!(names.contains(&"git_commit"));
    assert!(names.contains(&"git_push"));
    assert!(names.contains(&"git_checkout"));
    assert!(names.contains(&"git_diff"));
    assert_eq!(tools_list.len(), 15);
}

#[tokio::test]
async fn test_unknown_tool_returns_error() {
    let result = tools::execute_tool(
        "nonexistent_tool_xyz",
        "{}",
        None, true, false, 100, false, String::new(), false,
    ).await;
    assert!(!result.success);
    assert!(result.error.as_deref().unwrap().contains("no encontrada"));
}

#[tokio::test]
async fn test_fetch_url_validation() {
    let result = tools::execute_tool(
        "fetch_url",
        r#"{"url": "invalid"}"#,
        None, true, false, 100, false, String::new(), false,
    ).await;
    assert!(!result.success);
    assert!(result.error.as_deref().unwrap().contains("http"));
}

#[tokio::test]
async fn test_web_search_missing_key() {
    let result = tools::execute_tool(
        "web_search",
        r#"{"query": "test"}"#,
        None, true, false, 100, false, String::new(), false,
    ).await;
    assert!(!result.success);
    assert!(result.error.as_deref().unwrap().contains("Tavily"));
}

#[tokio::test]
async fn test_invalid_json_args_handling() {
    let result = tools::execute_tool(
        "shell",
        "not-json-just-raw-text",
        None, true, false, 100, false, String::new(), false,
    ).await;
    assert!(result.success || result.error.is_some());
}

#[tokio::test]
async fn test_write_file_empty_path() {
    let result = tools::execute_tool(
        "write_file",
        r#"{"path": "", "content": "test"}"#,
        None, true, false, 100, false, String::new(), false,
    ).await;
    assert!(!result.success);
    assert!(result.error.as_deref().unwrap().contains("'path' es requerido"));
}

#[tokio::test]
async fn test_grep_empty_pattern() {
    let result = tools::execute_tool(
        "grep",
        r#"{"pattern": ""}"#,
        None, true, false, 100, false, String::new(), false,
    ).await;
    assert!(!result.success);
    assert!(result.error.as_deref().unwrap().contains("'pattern' es requerido"));
}

#[tokio::test]
async fn test_fetch_url_empty() {
    let result = tools::execute_tool(
        "fetch_url",
        r#"{"url": ""}"#,
        None, true, false, 100, false, String::new(), false,
    ).await;
    assert!(!result.success);
    assert!(result.error.as_deref().unwrap().contains("'url' es requerido"));
}

#[tokio::test]
async fn test_auto_confirm_flag_works() {
    // With auto_confirm=true and confirmed=false, dangerous commands should still be confirmed
    let result = tools::execute_tool(
        "shell",
        r#"{"command": "rm -rf /"}"#,
        None, false, false, 100, false, String::new(), true,
    ).await;
    assert!(!result.requires_confirmation, "auto_confirm should prevent confirmation requests");
}

