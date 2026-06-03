pub mod audit;
mod cookbook;
pub mod embeddings;
mod keyring;
mod mcp;
mod memory;
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

#[derive(Serialize, Clone)]
struct WikiFile {
    name: String,
    path: String,
    size: u64,
    modified: i64,
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

// ── Wiki commands ────────────────────────────────────────────────────────────

#[tauri::command]
fn wiki_list_files(dir: String) -> Result<Vec<WikiFile>, String> {
    use std::fs;
    use std::time::UNIX_EPOCH;
    let path = std::path::Path::new(&dir);
    if !path.exists() { return Ok(Vec::new()); }
    if !path.is_dir() { return Err(format!("No es un directorio: {}", dir)); }
    let mut result = Vec::new();
    let entries = fs::read_dir(path).map_err(|e| format!("Error leyendo directorio: {}", e))?;
    for entry in entries {
        let entry = match entry { Ok(e) => e, Err(_) => continue };
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with('.') || name == "target" || name == "node_modules" { continue; }
        let file_type = match entry.file_type() { Ok(t) => t, Err(_) => continue };
        if !file_type.is_file() { continue; }
        if !name.to_lowercase().ends_with(".md") { continue; }
        let metadata = entry.metadata().ok();
        let size = metadata.as_ref().map(|m| m.len()).unwrap_or(0);
        let modified = metadata
            .and_then(|m| m.modified().ok())
            .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
            .map(|d| d.as_secs() as i64)
            .unwrap_or(0);
        result.push(WikiFile {
            name,
            path: entry.path().to_string_lossy().to_string(),
            size,
            modified,
        });
    }
    result.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(result)
}

#[tauri::command]
fn wiki_read_file(path: String) -> Result<String, String> {
    use std::fs;
    let p = std::path::Path::new(&path);
    if !p.exists() { return Err(format!("Archivo no encontrado: {}", path)); }
    fs::read_to_string(&path).map_err(|e| format!("Error leyendo archivo: {}", e))
}

#[tauri::command]
fn write_text_file(path: String, content: String) -> Result<(), String> {
    use std::fs;
    if let Some(parent) = std::path::Path::new(&path).parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Error creating directory: {}", e))?;
    }
    fs::write(&path, &content).map_err(|e| format!("Error writing file: {}", e))
}

// ── Memory commands ──────────────────────────────────────────────────────────

#[tauri::command]
async fn memory_index_text(
    source: String,
    source_id: String,
    text: String,
    metadata: Option<String>,
    provider: String,
    model: String,
    ollama_host: Option<String>,
    api_key: Option<String>,
    api_url: Option<String>,
) -> Result<i64, String> {
    let cfg = embeddings::EmbeddingConfig {
        provider: embeddings::EmbeddingProvider::from_str(&provider),
        model,
        ollama_host,
        api_key,
        api_url,
    };
    let store = memory::store();
    let dim = store.dim();
    let chunks = embeddings::chunk_text(&text, dim * 4);
    if chunks.is_empty() {
        return Err("No text to index".into());
    }
    let first_embed = embeddings::embed(&chunks[0], &cfg).await?;
    if first_embed.dim != dim {
        return Err(format!(
            "Embedding dim {} does not match memory dim {}",
            first_embed.dim, dim
        ));
    }
    let mut last_id: i64 = {
        memory::store()
            .insert_chunk(&source, &source_id, &chunks[0], &first_embed.embedding, metadata.as_deref())
            .map_err(|e| e.to_string())?
    };
    for chunk in chunks.iter().skip(1) {
        let res = embeddings::embed(chunk, &cfg).await?;
        last_id = memory::store()
            .insert_chunk(&source, &source_id, chunk, &res.embedding, None)
            .map_err(|e| e.to_string())?;
    }
    Ok(last_id)
}

#[tauri::command]
async fn memory_search(
    query: String,
    top_k: Option<usize>,
    provider: String,
    model: String,
    ollama_host: Option<String>,
    api_key: Option<String>,
    api_url: Option<String>,
) -> Result<Vec<memory::SearchResult>, String> {
    let cfg = embeddings::EmbeddingConfig {
        provider: embeddings::EmbeddingProvider::from_str(&provider),
        model,
        ollama_host,
        api_key,
        api_url,
    };
    let res = embeddings::embed(&query, &cfg).await?;
    let store = memory::store();
    if res.dim != store.dim() {
        return Err(format!(
            "Query embedding dim {} does not match memory dim {}",
            res.dim,
            store.dim()
        ));
    }
    store.search(&res.embedding, top_k.unwrap_or(5)).map_err(|e| e.to_string())
}

#[tauri::command]
fn memory_stats() -> memory::MemoryStats {
    memory::store()
        .stats()
        .unwrap_or_else(|_| memory::MemoryStats {
            total_chunks: 0,
            total_conversations: 0,
            total_project_files: 0,
            db_path: memory::store().path(),
            dim: memory::store().dim(),
        })
}

#[tauri::command]
fn memory_delete_source(source: String, source_id: String) -> Result<usize, String> {
    memory::store()
        .delete_by_source(&source, &source_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn memory_clear() -> Result<usize, String> {
    memory::store().clear().map_err(|e| e.to_string())
}

#[tauri::command]
async fn memory_index_project_files(
    working_dir: String,
    extensions: Option<Vec<String>>,
    provider: String,
    model: String,
    ollama_host: Option<String>,
    api_key: Option<String>,
    api_url: Option<String>,
) -> Result<usize, String> {
    if working_dir.is_empty() {
        return Err("Working directory required".into());
    }
    let cfg = embeddings::EmbeddingConfig {
        provider: embeddings::EmbeddingProvider::from_str(&provider),
        model,
        ollama_host,
        api_key,
        api_url,
    };
    let allowed_exts: Vec<String> = extensions
        .unwrap_or_else(|| vec![
            "md".into(), "txt".into(), "rs".into(), "ts".into(), "tsx".into(),
            "js".into(), "jsx".into(), "py".into(), "json".into(), "yaml".into(),
            "yml".into(), "toml".into(),
        ])
        .into_iter()
        .map(|e| e.to_lowercase())
        .collect();

    let path = std::path::PathBuf::from(&working_dir);
    if !path.exists() {
        return Err(format!("Path does not exist: {}", working_dir));
    }

    let mut entries: Vec<std::path::PathBuf> = Vec::new();
    collect_files(&path, &mut entries, 4)?;
    entries.sort();

    let store = memory::store();
    let _ = store.delete_by_source("file", &working_dir);
    let dim = store.dim();

    let mut indexed = 0;
    for file_path in entries {
        let ext = file_path
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .to_lowercase();
        if !allowed_exts.contains(&ext) {
            continue;
        }
        let content = match std::fs::read_to_string(&file_path) {
            Ok(c) => c,
            Err(_) => continue,
        };
        if content.trim().is_empty() || content.len() > 500_000 {
            continue;
        }
        let path_str = file_path.to_string_lossy().to_string();
        let chunks = embeddings::chunk_text(&content, dim * 4);
        for chunk in chunks {
            let res = match embeddings::embed(&chunk, &cfg).await {
                Ok(r) => r,
                Err(_) => continue,
            };
            if res.dim != dim {
                continue;
            }
            let _ = store.insert_chunk("file", &working_dir, &chunk, &res.embedding, Some(&path_str));
            indexed += 1;
        }
    }
    Ok(indexed)
}

fn collect_files(
    dir: &std::path::Path,
    out: &mut Vec<std::path::PathBuf>,
    depth: u32,
) -> Result<(), String> {
    if depth == 0 {
        return Ok(());
    }
    let entries = std::fs::read_dir(dir).map_err(|e| format!("Read dir failed: {}", e))?;
    for entry in entries.flatten() {
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with('.') || name == "target" || name == "node_modules" || name == "dist" {
            continue;
        }
        let p = entry.path();
        if p.is_dir() {
            collect_files(&p, out, depth - 1)?;
        } else if p.is_file() {
            out.push(p);
        }
    }
    Ok(())
}

// ── Cookbook commands ────────────────────────────────────────────────────────

#[tauri::command]
fn cookbook_scan_hardware() -> cookbook::HardwareInfo {
    cookbook::scan_hardware_cmd()
}

#[tauri::command]
fn cookbook_list_models(category: Option<String>) -> Vec<cookbook::ModelEntry> {
    cookbook::list_models_cmd(category)
}

#[tauri::command]
fn cookbook_list_downloaded() -> Vec<cookbook::DownloadedModel> {
    cookbook::list_downloaded_cmd()
}

#[tauri::command]
async fn cookbook_download_model(
    app: tauri::AppHandle,
    stream_id: String,
    model_id: String,
) -> Result<String, String> {
    cookbook::download_model_cmd(app, stream_id, model_id).await
}

#[tauri::command]
fn cookbook_cancel_download(stream_id: String) {
    cookbook::cancel_download_cmd(stream_id);
}

#[tauri::command]
fn cookbook_delete_model(model_id: String) -> Result<String, String> {
    cookbook::delete_model_cmd(model_id)
}

#[tauri::command]
async fn cookbook_create_ollama_model(model_id: String) -> Result<String, String> {
    cookbook::create_ollama_model_cmd(model_id).await
}

#[tauri::command]
fn cookbook_get_ollama_status(model_id: String) -> Result<String, String> {
    cookbook::get_ollama_status_cmd(model_id)
}

// ── App entry ────────────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Register sqlite-vec as a SQLite auto-extension so it loads with every connection.
    unsafe {
        rusqlite::ffi::sqlite3_auto_extension(Some(std::mem::transmute(
            sqlite_vec::sqlite3_vec_init as *const (),
        )));
    }

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
            wiki_list_files,
            wiki_read_file,
            memory_index_text,
            memory_search,
            memory_stats,
            memory_delete_source,
            memory_clear,
            memory_index_project_files,
            cookbook_scan_hardware,
            cookbook_list_models,
            cookbook_list_downloaded,
            cookbook_download_model,
            cookbook_cancel_download,
            cookbook_delete_model,
            cookbook_create_ollama_model,
            cookbook_get_ollama_status,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
