pub mod audit;
mod keyring;
mod ollama;
mod plugins;
pub mod providers;
mod sandbox;
mod search;
pub mod tools;

use std::sync::OnceLock;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::collections::HashMap;
use tauri::Emitter;

static LAUNCH_CWD: OnceLock<String> = OnceLock::new();

// ── Sandbox container management ────────────────────────────────────────────

struct SandboxState {
    container_id: String,
    network_enabled: bool,
    image: String,
}

fn sandbox_state() -> &'static Mutex<Option<SandboxState>> {
    static STATE: OnceLock<Mutex<Option<SandboxState>>> = OnceLock::new();
    STATE.get_or_init(|| Mutex::new(None))
}

pub fn get_or_create_sandbox(image: String, mount_dir: String, network_enabled: bool) -> Result<String, String> {
    let mut guard = sandbox_state().lock().map_err(|e| e.to_string())?;

    // If profile or image changed, recreate container
    if let Some(state) = guard.as_ref() {
        if state.network_enabled != network_enabled || state.image != image {
            let _ = sandbox::remove_container(&state.container_id);
            *guard = None;
        }
    }

    if let Some(state) = guard.as_ref() {
        // Verify container still exists
        let check = std::process::Command::new("docker")
            .args(["inspect", "--format", "{{.State.Status}}", &state.container_id])
            .output();
        match check {
            Ok(out) if String::from_utf8_lossy(&out.stdout).trim() == "running" => {
                return Ok(state.container_id.clone());
            }
            _ => {
                // Container is gone, remove stale reference
                *guard = None;
            }
        }
    }

    let id = sandbox::create_container(&image, &mount_dir, network_enabled)?;
    *guard = Some(SandboxState {
        container_id: id.clone(),
        network_enabled,
        image: image.clone(),
    });
    Ok(id)
}

pub fn remove_sandbox() -> String {
    let mut guard = sandbox_state().lock().unwrap_or_else(|e| e.into_inner());
    if let Some(state) = guard.take() {
        let result = sandbox::remove_container(&state.container_id);
        if result.success {
            format!("Contenedor sandbox eliminado: {}", state.container_id)
        } else {
            format!("Error eliminando sandbox: {}", result.error.unwrap_or_default())
        }
    } else {
        "No hay sandbox activo".into()
    }
}

// ── Cancel infrastructure for streaming ─────────────────────────────────────

fn cancel_map() -> &'static Mutex<HashMap<String, Arc<AtomicBool>>> {
    static MAP: OnceLock<Mutex<HashMap<String, Arc<AtomicBool>>>> = OnceLock::new();
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

// ── Existing commands ────────────────────────────────────────────────────────

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
    rate_limit: u32,
    use_allowlist: bool,
    command_allowlist: String,
    sandbox_enabled: Option<bool>,
    sandbox_image: Option<String>,
    security_profile: Option<String>,
    auto_confirm: Option<bool>,
    sandbox_air_gapped: Option<bool>,
) -> tools::ToolResult {
    let wd = working_dir.as_deref();
    let profile = security_profile.as_deref().unwrap_or("explore");
    let network_enabled = if sandbox_air_gapped.unwrap_or(false) {
        false
    } else {
        profile == "explore"
    };

    if sandbox_enabled.unwrap_or(false) {
        match get_or_create_sandbox(
            sandbox_image.unwrap_or_else(|| "ubuntu:latest".into()),
            working_dir.clone().unwrap_or_default(),
            network_enabled,
        ) {
            Ok(container_id) => {
                let result = tools::execute_tool_sandboxed(
                    &name, &args, &container_id,
                ).await;
                audit::log_execution(&name, &args, result.success, result.error.as_deref(), wd);
                return result;
            }
            Err(e) => {
                let result = tools::ToolResult {
                    success: false,
                    output: String::new(),
                    error: Some(format!("Error creando sandbox Docker: {}", e)),
                    requires_confirmation: false,
                    preview: None,
                };
                audit::log_execution(&name, &args, false, result.error.as_deref(), wd);
                return result;
            }
        }
    }

    let result = tools::execute_tool(
        &name, &args, working_dir.clone(), confirmed,
        restrict_to_workdir, rate_limit, use_allowlist, command_allowlist,
        auto_confirm.unwrap_or(false),
    ).await;

    audit::log_execution(
        &name,
        &args,
        result.success,
        result.error.as_deref(),
        wd,
    );

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
    std::env::current_dir()
        .map(|p| p.to_string_lossy().to_string())
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn get_launch_cwd() -> Option<String> {
    LAUNCH_CWD.get().cloned()
}

#[tauri::command]
fn read_audit_log(max_lines: u32) -> audit::AuditLogResult {
    audit::read_log(max_lines)
}

#[tauri::command]
fn list_plugins() -> Vec<plugins::PluginDefinition> {
    plugins::list_plugins()
}

#[tauri::command]
fn execute_plugin(name: String, args: String) -> plugins::PluginResult {
    plugins::execute_plugin(&name, &args)
}

#[tauri::command]
fn clear_audit_log() -> Result<(), String> {
    audit::clear_log()
}

#[tauri::command]
fn check_docker() -> bool {
    sandbox::check_docker_available()
}

#[tauri::command]
fn stop_sandbox() -> String {
    remove_sandbox()
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

// ── App entry ────────────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    if let Some(cwd) = std::env::args().find_map(|a| {
        a.strip_prefix("--working-dir=").map(String::from)
    }) {
        LAUNCH_CWD.set(cwd).ok();
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
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
            get_launch_cwd,
            read_audit_log,
            clear_audit_log,
            list_plugins,
            execute_plugin,
            check_docker,
            stop_sandbox,
            stop_stream,
            stop_all_streams,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
