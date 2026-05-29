use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::OnceLock;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, ChildStdin, Command};
use tokio::sync::Mutex;

// ── MCP Server Configuration ─────────────────────────────────────────────────

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct McpServerConfig {
    pub name: String,
    pub command: String,
    pub args: Vec<String>,
    pub enabled: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct McpToolDefinition {
    pub name: String,
    pub description: String,
    pub server_name: String,
    pub input_schema: Value,
}

// ── JSON-RPC types ───────────────────────────────────────────────────────────

#[derive(Serialize, Deserialize)]
struct JsonRpcRequest {
    jsonrpc: String,
    id: u64,
    method: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    params: Option<Value>,
}

#[derive(Serialize, Deserialize, Debug)]
struct JsonRpcResponse {
    jsonrpc: String,
    id: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    result: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<JsonRpcError>,
}

#[derive(Serialize, Deserialize, Debug)]
struct JsonRpcError {
    code: i64,
    message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    data: Option<Value>,
}

// ── MCP Server process handle ────────────────────────────────────────────────

struct McpServerProcess {
    _child: Child,
    stdin: ChildStdin,
}

struct McpState {
    servers: HashMap<String, McpServerProcess>,
    tools: Vec<McpToolDefinition>,
    next_id: u64,
}

fn mcp_state() -> &'static Mutex<Option<McpState>> {
    static STATE: OnceLock<Mutex<Option<McpState>>> = OnceLock::new();
    STATE.get_or_init(|| Mutex::new(None))
}

async fn ensure_state() -> &'static Mutex<Option<McpState>> {
    let state = mcp_state();
    if state.lock().await.is_none() {
        let mut guard = state.lock().await;
        if guard.is_none() {
            *guard = Some(McpState {
                servers: HashMap::new(),
                tools: Vec::new(),
                next_id: 1,
            });
        }
    }
    state
}

// ── Public API ───────────────────────────────────────────────────────────────

pub fn get_mcp_tools_sync() -> Vec<McpToolDefinition> {
    mcp_state().try_lock()
        .ok()
        .and_then(|g| g.as_ref().map(|s| s.tools.clone()))
        .unwrap_or_default()
}

pub async fn get_mcp_tools() -> Vec<McpToolDefinition> {
    mcp_state().lock().await.as_ref().map(|s| s.tools.clone()).unwrap_or_default()
}

pub fn get_mcp_tool_definitions() -> Vec<crate::tools::ToolDefinition> {
    get_mcp_tools_sync().iter().map(|t| {
        crate::tools::ToolDefinition {
            name: format!("mcp__{}__{}", t.server_name, t.name),
            description: format!("[MCP: {}] {}", t.server_name, t.description),
            parameters: schema_to_params(&t.input_schema),
        }
    }).collect()
}

fn schema_to_params(schema: &Value) -> Vec<crate::tools::ToolParam> {
    let mut params = Vec::new();
    if let Some(properties) = schema.get("properties").and_then(|p| p.as_object()) {
        let required = schema.get("required")
            .and_then(|r| r.as_array())
            .map(|a| a.iter().filter_map(|v| v.as_str().map(String::from)).collect::<Vec<_>>())
            .unwrap_or_default();

        for (name, prop) in properties {
            let param_type = prop.get("type").and_then(|t| t.as_str()).unwrap_or("string").to_string();
            let description = prop.get("description").and_then(|d| d.as_str()).unwrap_or("").to_string();
            params.push(crate::tools::ToolParam {
                name: name.clone(),
                param_type,
                description,
                required: required.contains(name),
            });
        }
    }
    params
}

pub async fn call_mcp_tool(full_name: &str, args: &str) -> Result<String, String> {
    let parts: Vec<&str> = full_name.splitn(3, "__").collect();
    if parts.len() < 3 || parts[0] != "mcp" {
        return Err(format!("Nombre MCP inválido: {}", full_name));
    }
    let server_name = parts[1].to_string();
    let tool_name = parts[2];

    let args_value: Value = serde_json::from_str(args).map_err(|e| format!("Argumentos JSON inválidos: {}", e))?;

    let state = ensure_state().await;
    let mut state_guard = state.lock().await;
    let s = state_guard.as_mut().ok_or("Estado MCP no inicializado")?;

    if !s.servers.contains_key(&server_name) {
        return Err(format!("Servidor MCP '{}' no está conectado", server_name));
    }

    let id = s.next_id;
    s.next_id += 1;

    let process = s.servers.get_mut(&server_name).ok_or("Servidor MCP no encontrado")?;

    let req = serde_json::to_string(&JsonRpcRequest {
        jsonrpc: "2.0".into(),
        id,
        method: "tools/call".into(),
        params: Some(json!({
            "name": tool_name,
            "arguments": args_value,
        })),
    }).map_err(|e| e.to_string())?;

    process.stdin.write_all(format!("{}\n", req).as_bytes()).await
        .map_err(|e| format!("Error escribiendo a MCP server: {}", e))?;
    process.stdin.flush().await.map_err(|e| e.to_string())?;

    drop(state_guard);

    Ok("{\"status\": \"pending\", \"note\": \"MCP tool call enviado al servidor.\"}".to_string())
}

pub async fn start_mcp_server(config: &McpServerConfig) -> Result<(), String> {
    let state = ensure_state().await;

    // Kill existing if running
    stop_mcp_server(&config.name).await;

    let mut cmd = Command::new(&config.command);
    cmd.args(&config.args)
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::inherit());

    let mut child = cmd.spawn().map_err(|e| format!("Error iniciando MCP server '{}': {}", config.name, e))?;

    let stdin = child.stdin.take().ok_or("No se pudo tomar stdin del MCP server")?;
    let stdout = child.stdout.take().ok_or("No se pudo tomar stdout del MCP server")?;

    // Build the initialize request
    let init_request = serde_json::to_string(&JsonRpcRequest {
        jsonrpc: "2.0".into(),
        id: 1,
        method: "initialize".into(),
        params: Some(json!({
            "protocolVersion": "0.1.0",
            "capabilities": {},
            "clientInfo": {
                "name": "solaria-agent",
                "version": "0.2.1"
            }
        })),
    }).map_err(|e| e.to_string())?;

    // Write initialize
    let mut stdin_w = stdin;
    stdin_w.write_all(format!("{}\n", init_request).as_bytes()).await
        .map_err(|e| format!("Error escribiendo init: {}", e))?;
    stdin_w.flush().await.map_err(|e| e.to_string())?;

    // Read response line by line
    let reader = BufReader::new(stdout);
    let mut lines = reader.lines();
    let mut initialized = false;
    let mut tool_list_response: Option<Value> = None;

    // Try to read up to 100 lines for init response + tools/list
    for _ in 0..100 {
        let line = lines.next_line().await
            .map_err(|e| format!("Error leyendo de MCP server: {}", e))?;

        let line = match line {
            Some(l) => l,
            None => break,
        };

        let resp: JsonRpcResponse = match serde_json::from_str(&line) {
            Ok(r) => r,
            Err(_) => continue,
        };

        // After initialize result, send initialized notification + tools/list
        if !initialized && resp.id == 1 {
            initialized = true;

            // Send initialized notification
            let notif = serde_json::to_string(&JsonRpcRequest {
                jsonrpc: "2.0".into(),
                id: 0,
                method: "notifications/initialized".into(),
                params: None,
            }).map_err(|e| e.to_string())?;
            stdin_w.write_all(format!("{}\n", notif).as_bytes()).await.map_err(|e| e.to_string())?;
            stdin_w.flush().await.map_err(|e| e.to_string())?;

            // Request tools/list
            let list_req = serde_json::to_string(&JsonRpcRequest {
                jsonrpc: "2.0".into(),
                id: 2,
                method: "tools/list".into(),
                params: None,
            }).map_err(|e| e.to_string())?;
            stdin_w.write_all(format!("{}\n", list_req).as_bytes()).await.map_err(|e| e.to_string())?;
            stdin_w.flush().await.map_err(|e| e.to_string())?;
        }

        // tools/list response
        if resp.id == 2 {
            tool_list_response = resp.result;
            break;
        }
    }

    let tools = match tool_list_response {
        Some(val) => {
            let tools_arr = val.get("tools").and_then(|t| t.as_array()).cloned().unwrap_or_default();
            tools_arr.iter().map(|t| McpToolDefinition {
                name: t.get("name").and_then(|n| n.as_str()).unwrap_or("unknown").to_string(),
                description: t.get("description").and_then(|d| d.as_str()).unwrap_or("").to_string(),
                server_name: config.name.clone(),
                input_schema: t.get("inputSchema").cloned().unwrap_or(json!({})),
            }).collect::<Vec<_>>()
        }
        None => Vec::new(),
    };

    // Store the process
    {
        let mut guard = state.lock().await;
        if let Some(s) = guard.as_mut() {
            s.servers.insert(config.name.clone(), McpServerProcess {
                _child: child,
                stdin: stdin_w,
            });
            // Add discovered tools
            s.tools.retain(|t| t.server_name != config.name);
            s.tools.extend(tools);
        }
    }

    Ok(())
}

pub async fn stop_mcp_server(name: &str) {
    let name_owned = name.to_string();

    let process = {
        let state = mcp_state();
        let mut guard = state.lock().await;
        if let Some(s) = guard.as_mut() {
            s.tools.retain(|t| t.server_name != name_owned);
            s.servers.remove(&name_owned)
        } else {
            None
        }
    };

    if let Some(mut proc) = process {
        let _ = proc.stdin.write_all(b"{\"jsonrpc\":\"2.0\",\"id\":0,\"method\":\"exit\"}\n").await;
        let _ = proc.stdin.flush().await;
        let _ = proc._child.kill().await;
        let _ = proc._child.wait().await;
    }
}

pub async fn stop_all_mcp_servers() {
    let names = {
        let state = mcp_state();
        let guard = state.lock().await;
        guard.as_ref().map(|s| s.servers.keys().cloned().collect::<Vec<_>>()).unwrap_or_default()
    };
    for name in names {
        stop_mcp_server(&name).await;
    }
}
