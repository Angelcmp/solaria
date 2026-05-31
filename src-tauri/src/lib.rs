pub mod audit;
mod keyring;
mod mcp;
mod ollama;
pub mod providers;
mod search;
mod skills;
pub mod tools;

use serde::Serialize;
use std::sync::Arc;

#[derive(Serialize, Clone)]
struct FileEntry {
    name: String,
    is_dir: bool,
    size: u64,
}
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::collections::HashMap;
use tauri::Emitter;

// ── Cancel infrastructure for streaming ─────────────────────────────────────

fn cancel_map() -> &'static Mutex<HashMap<String, Arc<AtomicBool>>> {
    static MAP: std::sync::OnceLock<Mutex<HashMap<String, Arc<AtomicBool>>>> = std::sync::OnceLock::new();
    MAP.get_or_init(|| Mutex::new(HashMap::new()))
}

pub fn register_cancel(stream_id: &str) -> Arc<AtomicBool> {
    let flag = Arc::new(AtomicBool::new(false));
    if let Ok(mut map) = cancel_map().lock() {
        map.insert(stream_id.to_string(), flag.clone());
    }
    flag
}

pub fn cancel_stream(stream_id: &str) {
    if let Ok(map) = cancel_map().lock() {
        if let Some(flag) = map.get(stream_id) {
            flag.store(true, Ordering::SeqCst);
        }
    }
}

pub fn unregister_cancel(stream_id: &str) {
    if let Ok(mut map) = cancel_map().lock() {
        map.remove(stream_id);
    }
}

#[tauri::command]
fn stop_stream(stream_id: String) {
    cancel_stream(&stream_id);
}

#[tauri::command]
fn stop_all_streams() {
    if let Ok(map) = cancel_map().lock() {
        for (_, flag) in map.iter() {
            flag.store(true, Ordering::SeqCst);
        }
    }
}

// ── Chat commands ────────────────────────────────────────────────────────────

#[tauri::command]
async fn ollama_chat(
    model: String,
    messages: String,
    system_prompt: Option<String>,
) -> ollama::OllamaResult {
    ollama::send_chat(model, messages, system_prompt).await
}

#[tauri::command]
async fn ollama_check() -> bool {
    ollama::check_connection().await
}

#[tauri::command]
async fn ollama_models() -> Result<Vec<String>, String> {
    ollama::list_models().await
}

#[tauri::command]
async fn provider_chat(
    provider: String,
    model: String,
    api_key: String,
    messages: String,
    system_prompt: Option<String>,
) -> providers::ProviderResult {
    match providers::get_provider_config(&provider, &model) {
        Some(config) => {
            providers::route_chat(config.api_type.clone(), api_key, config, system_prompt, messages).await
        }
        None => providers::ProviderResult {
            success: false,
            content: String::new(),
            error: Some(format!("Proveedor '{}' no soportado", provider)),
        },
    }
}

#[tauri::command]
async fn web_search(api_key: String, query: String) -> search::SearchResponse {
    search::search_tavily(api_key, query).await
}

#[tauri::command]
fn list_tools() -> Vec<tools::ToolDefinition> {
    tools::get_all_tools()
}

#[tauri::command]
async fn execute_tool(
    name: String,
    args: String,
    working_dir: Option<String>,
    confirmed: bool,
    restrict_to_workdir: bool,
) -> tools::ToolResult {
    let wd = working_dir.as_deref();

    let result = tools::execute_tool(
        &name, &args, working_dir.clone(), confirmed, restrict_to_workdir,
    ).await;

    audit::log_execution(&name, &args, result.success, result.error.as_deref(), wd);

    result
}

#[tauri::command]
fn store_api_key(provider: String, key: String) -> keyring::KeyResult {
    keyring::store_key(&provider, &key)
}

#[tauri::command]
fn get_api_key(provider: String) -> Result<String, String> {
    keyring::get_key(&provider)
}

#[tauri::command]
fn delete_api_key(provider: String) -> keyring::KeyResult {
    keyring::delete_key(&provider)
}

#[tauri::command]
async fn ollama_pull_model(model_name: String) -> Result<String, String> {
    ollama::pull_model(&model_name).await
}

#[tauri::command]
async fn ollama_delete_model(model_name: String) -> Result<String, String> {
    ollama::delete_model(&model_name).await
}

#[tauri::command]
fn get_cwd() -> Result<String, String> {
    let start = std::env::current_dir().map_err(|e| e.to_string())?;
    let mut dir = start.clone();
    loop {
        if dir.join(".solaria").exists() {
            return Ok(dir.to_string_lossy().to_string());
        }
        if !dir.pop() {
            return Ok(start.to_string_lossy().to_string());
        }
    }
}

#[tauri::command]
fn read_audit_log(max_lines: u32) -> audit::AuditLogResult {
    audit::read_log(max_lines)
}

#[tauri::command]
fn clear_audit_log() -> Result<(), String> {
    audit::clear_log()
}

// ── Streaming commands ───────────────────────────────────────────────────────

#[tauri::command]
async fn ollama_chat_stream(
    app: tauri::AppHandle,
    stream_id: String,
    model: String,
    messages: String,
    system_prompt: Option<String>,
    temperature: Option<f32>,
    top_p: Option<f32>,
    max_tokens: Option<u32>,
) {
    ollama::send_chat_stream(app, stream_id, model, messages, system_prompt, temperature, top_p, max_tokens).await
}

#[tauri::command]
async fn provider_chat_stream(
    app: tauri::AppHandle,
    stream_id: String,
    provider: String,
    model: String,
    api_key: String,
    messages: String,
    system_prompt: Option<String>,
    temperature: Option<f32>,
    top_p: Option<f32>,
    max_tokens: Option<u32>,
) {
    let model_params = providers::ModelParams { temperature, top_p, max_tokens };
    if let Some(config) = providers::get_provider_config(&provider, &model) {
        providers::route_chat_stream(
            app, stream_id,
            config.api_type.clone(), api_key, config,
            system_prompt, messages, model_params,
        ).await
    } else {
        let _ = app.emit("stream://error", serde_json::json!({
            "stream_id": stream_id,
            "error": format!("Proveedor '{}' no soportado", provider),
        }));
    }
}

// ── MCP commands ─────────────────────────────────────────────────────────────

#[tauri::command]
async fn mcp_list_servers() -> Vec<mcp::McpServerConfig> {
    let settings = crate::audit::load_mcp_settings().unwrap_or_default();
    settings
}

#[tauri::command]
async fn mcp_save_servers(servers: Vec<mcp::McpServerConfig>) -> Result<(), String> {
    crate::audit::save_mcp_settings(&servers)
}

#[tauri::command]
async fn mcp_start_server(server: mcp::McpServerConfig) -> Result<(), String> {
    mcp::start_mcp_server(&server).await
}

#[tauri::command]
async fn mcp_stop_server(name: String) {
    mcp::stop_mcp_server(&name).await
}

#[tauri::command]
async fn mcp_restart_all() -> Result<(), String> {
    mcp::stop_all_mcp_servers().await;
    let settings = crate::audit::load_mcp_settings().unwrap_or_default();
    for server in settings {
        if server.enabled {
            mcp::start_mcp_server(&server).await?;
        }
    }
    Ok(())
}

#[tauri::command]
async fn mcp_list_tools() -> Vec<mcp::McpToolDefinition> {
    mcp::get_mcp_tools().await
}

// ── Skills commands ──────────────────────────────────────────────────────────

fn resolve_project_root() -> Option<String> {
    let cwd = std::env::current_dir().ok()?;
    let mut dir = cwd;
    loop {
        if dir.join(".solaria").exists() {
            return Some(dir.to_string_lossy().to_string());
        }
        if !dir.pop() {
            return None;
        }
    }
}

#[tauri::command]
fn list_skills(working_dir: Option<String>) -> Vec<skills::SkillDefinition> {
    let wd = working_dir
        .filter(|d| !d.is_empty() && std::path::PathBuf::from(d).join(".solaria").join("skills").exists())
        .or_else(resolve_project_root);
    skills::discover_all_skills(wd.as_deref())
}

#[tauri::command]
fn toggle_skill(name: String, enabled: bool) {
    skills::toggle_skill(&name, enabled);
}

#[tauri::command]
fn get_skills_prompt(working_dir: Option<String>, query: Option<String>) -> String {
    let wd = working_dir
        .filter(|d| !d.is_empty() && std::path::PathBuf::from(d).join(".solaria").join("skills").exists())
        .or_else(resolve_project_root);
    skills::get_enabled_skills_prompt(wd.as_deref(), query.as_deref())
}

#[tauri::command]
fn create_skill(working_dir: String, name: String, description: String, body: String) -> Result<String, String> {
    skills::create_project_skill(&working_dir, &name, &description, &body)
}

#[tauri::command]
fn list_directory(path: String) -> Result<Vec<FileEntry>, String> {
    use std::fs;
    let entries = fs::read_dir(&path).map_err(|e| format!("Error al leer directorio: {}", e))?;
    let mut result = Vec::new();
    for entry in entries {
        let entry = entry.map_err(|e| format!("Error: {}", e))?;
        let file_type = entry.file_type().map_err(|e| format!("Error: {}", e))?;
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with('.') || name == "target" || name == "node_modules" { continue; }
        result.push(FileEntry {
            name,
            is_dir: file_type.is_dir(),
            size: if file_type.is_file() { entry.metadata().ok().map(|m| m.len()).unwrap_or(0) } else { 0 },
        });
    }
    result.sort_by(|a, b| {
        if a.is_dir != b.is_dir { return if a.is_dir { std::cmp::Ordering::Less } else { std::cmp::Ordering::Greater } }
        a.name.cmp(&b.name)
    });
    Ok(result)
}

#[tauri::command]
fn write_text_file(path: String, content: String) -> Result<(), String> {
    use std::fs;
    if let Some(parent) = std::path::Path::new(&path).parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Error creating directory: {}", e))?;
    }
    fs::write(&path, &content).map_err(|e| format!("Error writing file: {}", e))
}

// ── App entry ────────────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            ollama_chat,
            ollama_chat_stream,
            ollama_check,
            ollama_models,
            ollama_pull_model,
            ollama_delete_model,
            provider_chat,
            provider_chat_stream,
            web_search,
            list_tools,
            execute_tool,
            store_api_key,
            get_api_key,
            delete_api_key,
            get_cwd,
            read_audit_log,
            clear_audit_log,
            stop_stream,
            stop_all_streams,
            mcp_list_servers,
            mcp_save_servers,
            mcp_start_server,
            mcp_stop_server,
            mcp_restart_all,
            mcp_list_tools,
            list_skills,
            toggle_skill,
            get_skills_prompt,
            create_skill,
            write_text_file,
            list_directory,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
