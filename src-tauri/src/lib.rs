mod audit;
mod keyring;
mod ollama;
mod providers;
mod search;
mod tools;

use std::sync::OnceLock;

static LAUNCH_CWD: OnceLock<String> = OnceLock::new();

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
) -> tools::ToolResult {
    let result = tools::execute_tool(
        &name, &args, working_dir.clone(), confirmed,
        restrict_to_workdir, rate_limit, use_allowlist, command_allowlist,
    ).await;

    // Audit log
    let wd = working_dir.as_deref();
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
fn clear_audit_log() -> Result<(), String> {
    audit::clear_log()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Parse --working-dir from CLI args
    if let Some(cwd) = std::env::args().find_map(|a| {
        a.strip_prefix("--working-dir=").map(String::from)
    }) {
        LAUNCH_CWD.set(cwd).ok();
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            ollama_chat,
            ollama_check,
            ollama_models,
            provider_chat,
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
