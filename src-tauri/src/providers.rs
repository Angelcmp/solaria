use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};
use futures_util::StreamExt;
use std::sync::atomic::{AtomicBool, Ordering};

#[derive(Serialize, Deserialize, Clone, Default)]
pub(crate) struct ChatMessage {
    pub(crate) role: String,
    #[serde(default)]
    pub(crate) content: String,
    /// Native function calling (OpenAI-compatible): assistant message que
    /// contiene las llamadas a herramientas.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) tool_calls: Option<serde_json::Value>,
    /// Native function calling: id de la llamada que responde un mensaje `tool`.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) tool_call_id: Option<String>,
}

// OpenAI-compatible format
#[derive(Serialize)]
struct OpenAIRequest {
    model: String,
    messages: Vec<ChatMessage>,
    stream: bool,
}

#[derive(Deserialize)]
struct OpenAIResponse {
    choices: Vec<Choice>,
    error: Option<APIError>,
}

#[derive(Deserialize)]
struct Choice {
    message: MessageContent,
}

#[derive(Deserialize)]
struct MessageContent {
    content: Option<String>,
}

#[derive(Deserialize)]
struct APIError {
    message: String,
}

// Anthropic format
#[derive(Serialize)]
struct AnthropicRequest {
    model: String,
    max_tokens: u32,
    system: Option<String>,
    messages: Vec<AnthropicChatMessage>,
}

#[derive(Serialize)]
struct AnthropicChatMessage {
    role: String,
    content: String,
}

#[derive(Deserialize)]
struct AnthropicResponse {
    content: Vec<AnthropicContentBlock>,
    error: Option<AnthropicError>,
}

#[derive(Deserialize)]
struct AnthropicContentBlock {
    #[serde(rename = "type")]
    block_type: String,
    text: Option<String>,
}

#[derive(Deserialize)]
struct AnthropicError {
    message: String,
}

// Google Gemini format
#[derive(Serialize)]
struct GeminiRequest {
    contents: Vec<GeminiContent>,
    system_instruction: Option<GeminiSystemInstruction>,
}

#[derive(Serialize)]
struct GeminiContent {
    role: String,
    parts: Vec<GeminiPart>,
}

#[derive(Serialize)]
struct GeminiSystemInstruction {
    parts: Vec<GeminiPart>,
}

#[derive(Serialize)]
struct GeminiPart {
    text: String,
}

#[derive(Deserialize)]
struct GeminiResponse {
    candidates: Option<Vec<GeminiCandidate>>,
    error: Option<GeminiError>,
}

#[derive(Deserialize)]
struct GeminiCandidate {
    content: Option<GeminiContentResponse>,
}

#[derive(Deserialize)]
struct GeminiContentResponse {
    parts: Option<Vec<GeminiPartResponse>>,
}

#[derive(Deserialize)]
struct GeminiPartResponse {
    text: Option<String>,
}

#[derive(Deserialize)]
struct GeminiError {
    message: String,
}

// Cohere format
#[derive(Serialize)]
struct CohereRequest {
    model: String,
    messages: Vec<ChatMessage>,
}

#[derive(Deserialize)]
struct CohereResponse {
    message: Option<CohereMessage>,
    error: Option<String>,
}

#[derive(Deserialize)]
struct CohereMessage {
    content: Vec<CohereContentBlock>,
}

#[derive(Deserialize)]
struct CohereContentBlock {
    text: String,
}

#[derive(Serialize)]
pub struct ProviderResult {
    pub success: bool,
    pub content: String,
    pub error: Option<String>,
}

#[derive(Clone)]
pub struct ProviderConfig {
    pub name: String,
    pub base_url: String,
    pub model: String,
    pub api_type: String,
    /// Esquema de autenticación: `bearer` (Authorization: Bearer <key>),
    /// `x-api-key` (header con la key en crudo) o `none` (sin auth).
    pub auth: String,
    /// Nombre de header a usar cuando `auth` no sea el default del esquema.
    pub auth_header: String,
    /// Headers extra (por ejemplo `anthropic-version` o cabeceras de un
    /// endpoint OpenAI-compatible propio).
    pub extra_headers: Vec<(String, String)>,
}

impl ProviderConfig {
    fn builtin(name: &str, base_url: &str, model: String, api_type: &str, auth: &str) -> Self {
        Self {
            name: name.into(),
            base_url: base_url.into(),
            model,
            api_type: api_type.into(),
            auth: auth.into(),
            auth_header: String::new(),
            extra_headers: Vec::new(),
        }
    }
}

#[derive(Clone)]
pub struct ModelParams {
    pub temperature: Option<f32>,
    pub top_p: Option<f32>,
    pub max_tokens: Option<u32>,
}

/// Aplica autenticación y headers extra a una request según la config.
fn apply_headers(
    req: reqwest::RequestBuilder,
    config: &ProviderConfig,
    api_key: &str,
) -> reqwest::RequestBuilder {
    let mut req = req;
    let key = api_key.trim();
    match config.auth.as_str() {
        "none" => {}
        "x-api-key" => {
            if !key.is_empty() {
                let header = if config.auth_header.is_empty() {
                    "x-api-key"
                } else {
                    config.auth_header.as_str()
                };
                req = req.header(header, key);
            }
        }
        // Default: bearer
        _ => {
            if !key.is_empty() {
                if config.auth_header.is_empty() {
                    req = req.header("Authorization", format!("Bearer {}", key));
                } else {
                    req = req.header(config.auth_header.as_str(), key);
                }
            }
        }
    }
    for (k, v) in &config.extra_headers {
        req = req.header(k.as_str(), v.as_str());
    }
    req
}

/// Construye la config de un proveedor definido por el usuario (endpoint
/// OpenAI-compatible u otro api_type). `provider` se usa como nombre visible.
pub fn custom_provider_config(
    provider: &str,
    base_url: &str,
    model: &str,
    api_type: Option<&str>,
    auth: Option<&str>,
    auth_header: Option<&str>,
    extra_headers: Option<&serde_json::Value>,
) -> ProviderConfig {
    let mut config = ProviderConfig::builtin(
        if provider.trim().is_empty() { "Custom" } else { provider.trim() },
        base_url.trim(),
        model.trim().to_string(),
        api_type.filter(|s| !s.trim().is_empty()).unwrap_or("openai"),
        auth.filter(|s| !s.trim().is_empty()).unwrap_or("bearer"),
    );
    if let Some(h) = auth_header {
        config.auth_header = h.trim().to_string();
    }
    if let Some(serde_json::Value::Object(map)) = extra_headers {
        for (k, v) in map {
            if let Some(s) = v.as_str() {
                config.extra_headers.push((k.clone(), s.to_string()));
            }
        }
    }
    config
}

/// Resuelve la config de un proveedor. Si `base_url` viene informado se
/// construye uno custom (el usuario trae su propio endpoint); si no, se busca
/// entre los proveedores integrados.
pub fn resolve_provider(
    provider: &str,
    model: &str,
    base_url: Option<String>,
    api_type: Option<String>,
    auth: Option<String>,
    auth_header: Option<String>,
    extra_headers: Option<String>,
) -> Option<ProviderConfig> {
    if let Some(url) = base_url.filter(|u| !u.trim().is_empty()) {
        let headers = extra_headers
            .as_deref()
            .and_then(|s| serde_json::from_str::<serde_json::Value>(s).ok());
        Some(custom_provider_config(
            provider,
            &url,
            model,
            api_type.as_deref(),
            auth.as_deref(),
            auth_header.as_deref(),
            headers.as_ref(),
        ))
    } else {
        get_provider_config(provider, model)
    }
}

fn normalize_model(provider: &str, model: &str) -> String {
    let m = model.trim();
    match provider.trim() {
        "deepseek" => match m {
            "deepseek-v4-flash" => "deepseek-chat".into(),
            "deepseek-v4-pro" => "deepseek-reasoner".into(),
            _ => m.into(),
        },
        "google" => match m {
            "gemini-2.0-flash" | "gemini-2.0-flash-001" => "gemini-2.5-flash".into(),
            "gemini-2.0-flash-lite" | "gemini-2.0-flash-lite-001" => "gemini-3.5-flash-lite".into(),
            "gemini-2.5-pro-preview-03-25" => "gemini-2.5-pro".into(),
            _ => m.into(),
        },
        "cohere" => match m {
            "command-r-plus-08-2024" => "command-r-plus".into(),
            _ => m.into(),
        },
        "groq" => match m {
            "llama-4-scout-17b-16e-instruct" => "meta-llama/llama-4-scout-17b-16e-instruct".into(),
            _ => m.into(),
        },
        "anthropic" => match m {
            "claude-haiku-4-5" => "claude-haiku-4-5-20251001".into(),
            _ => m.into(),
        },
        "ollama" => match m {
            "qwen3.5" => "qwen3".into(),
            "gemma4" => "gemma3".into(),
            _ => m.into(),
        },
        _ => m.into(),
    }
}

fn http_error(name: &str, status: u16, body: &str) -> String {
    let snippet: String = body.trim().chars().take(300).collect();
    let hint = match status {
        401 => " (revisa la key en Configuración → Proveedores: sin espacios, del proveedor correcto)",
        400 if snippet.to_lowercase().contains("model") => " (modelo no válido para este proveedor)",
        402 => " (saldo insuficiente en el proveedor)",
        _ => "",
    };
    if snippet.is_empty() {
        format!("{} error HTTP {}{}", name, status, hint)
    } else {
        format!("{} error HTTP {}{}: {}", name, status, hint, snippet)
    }
}

pub fn get_provider_config(provider: &str, model: &str) -> Option<ProviderConfig> {
    match provider.trim() {
        "openai" => Some(ProviderConfig::builtin(
            "OpenAI",
            "https://api.openai.com/v1/chat/completions",
            normalize_model("openai", model),
            "openai",
            "bearer",
        )),
        "deepseek" => Some(ProviderConfig::builtin(
            "DeepSeek",
            "https://api.deepseek.com/chat/completions",
            normalize_model("deepseek", model),
            "openai",
            "bearer",
        )),
        "groq" => Some(ProviderConfig::builtin(
            "Groq",
            "https://api.groq.com/openai/v1/chat/completions",
            normalize_model("groq", model),
            "openai",
            "bearer",
        )),
        "kimi" => Some(ProviderConfig::builtin(
            "Kimi",
            "https://api.moonshot.cn/v1/chat/completions",
            normalize_model("kimi", model),
            "openai",
            "bearer",
        )),
        "glm" => Some(ProviderConfig::builtin(
            "GLM",
            "https://api.z.ai/api/paas/v4/chat/completions",
            normalize_model("glm", model),
            "openai",
            "bearer",
        )),
        "anthropic" => Some(ProviderConfig::builtin(
            "Anthropic",
            "https://api.anthropic.com/v1/messages",
            normalize_model("anthropic", model),
            "anthropic",
            "x-api-key",
        )),
        "google" => Some(ProviderConfig::builtin(
            "Google",
            "https://generativelanguage.googleapis.com/v1beta/models",
            normalize_model("google", model),
            "google",
            "none",
        )),
        "cohere" => Some(ProviderConfig::builtin(
            "Cohere",
            "https://api.cohere.ai/v2/chat",
            normalize_model("cohere", model),
            "cohere",
            "bearer",
        )),
        _ => None,
    }
}

fn build_messages(
    system_prompt: Option<String>,
    messages_str: &str,
) -> Vec<ChatMessage> {
    let mut chat_messages: Vec<ChatMessage> = Vec::new();

    if let Some(sp) = system_prompt {
        chat_messages.push(ChatMessage {
            role: "system".into(),
            content: sp,
            ..Default::default()
        });
    } else {
        chat_messages.push(ChatMessage {
            role: "system".into(),
            content: "You are Solaria, a helpful AI assistant. Always respond in the user's language.".into(),
            ..Default::default()
        });
    }

    if let Ok(parsed) = serde_json::from_str::<Vec<ChatMessage>>(messages_str) {
        chat_messages.extend(parsed);
    }

    chat_messages
}

pub async fn chat_openai_compatible(
    api_key: String,
    config: ProviderConfig,
    system_prompt: Option<String>,
    messages_str: String,
) -> ProviderResult {
    let api_key = api_key.trim().to_string();
    let client = reqwest::Client::new();
    let chat_messages = build_messages(system_prompt, &messages_str);

    let request = OpenAIRequest {
        model: config.model.clone(),
        messages: chat_messages,
        stream: false,
    };

    match apply_headers(client.post(&config.base_url), &config, &api_key)
        .json(&request)
        .send()
        .await
    {
        Ok(resp) => {
            if !resp.status().is_success() {
                let status = resp.status().as_u16();
                let body = resp.text().await.unwrap_or_default();
                return ProviderResult {
                    success: false,
                    content: String::new(),
                    error: Some(http_error(&config.name, status, &body)),
                };
            }

            match resp.json::<OpenAIResponse>().await {
                Ok(data) => {
                    if let Some(err) = data.error {
                        return ProviderResult {
                            success: false,
                            content: String::new(),
                            error: Some(format!("{}: {}", config.name, err.message)),
                        };
                    }
                    let content = data.choices.first()
                        .and_then(|c| c.message.content.clone())
                        .unwrap_or_default();
                    ProviderResult { success: true, content, error: None }
                }
                Err(e) => ProviderResult {
                    success: false,
                    content: String::new(),
                    error: Some(format!("Error parsing {} response: {}", config.name, e)),
                },
            }
        }
        Err(e) => ProviderResult {
            success: false,
            content: String::new(),
            error: Some(format!("Error connecting to {}: {}", config.name, e)),
        },
    }
}

pub async fn chat_anthropic(
    api_key: String,
    config: ProviderConfig,
    system_prompt: Option<String>,
    messages_str: String,
) -> ProviderResult {
    let api_key = api_key.trim().to_string();
    let client = reqwest::Client::new();
    let chat_messages = build_messages(system_prompt, &messages_str);

    let system = std::mem::take(&mut chat_messages.clone().into_iter()
        .filter(|m| m.role == "system")
        .map(|m| m.content)
        .collect::<Vec<_>>()
        .join("\n"));

    let non_system: Vec<AnthropicChatMessage> = chat_messages.into_iter()
        .filter(|m| m.role != "system")
        .map(|m| AnthropicChatMessage { role: m.role, content: m.content })
        .collect();

    let request = AnthropicRequest {
        model: config.model.clone(),
        max_tokens: 4096,
        system: if system.is_empty() { None } else { Some(system) },
        messages: non_system,
    };

    match apply_headers(client.post(&config.base_url), &config, &api_key)
        .header("anthropic-version", "2023-06-01")
        .json(&request)
        .send()
        .await
    {
        Ok(resp) => {
            if !resp.status().is_success() {
                let status = resp.status().as_u16();
                let body = resp.text().await.unwrap_or_default();
                return ProviderResult {
                    success: false,
                    content: String::new(),
                    error: Some(http_error("Anthropic", status, &body)),
                };
            }
            match resp.json::<AnthropicResponse>().await {
                Ok(data) => {
                    if let Some(err) = data.error {
                        return ProviderResult {
                            success: false, content: String::new(),
                            error: Some(format!("Anthropic: {}", err.message)),
                        };
                    }
                    let text = data.content.into_iter()
                        .find(|b| b.block_type == "text")
                        .and_then(|b| b.text)
                        .unwrap_or_default();
                    ProviderResult { success: true, content: text, error: None }
                }
                Err(e) => ProviderResult {
                    success: false, content: String::new(),
                    error: Some(format!("Error parsing Anthropic response: {}", e)),
                },
            }
        }
        Err(e) => ProviderResult {
            success: false, content: String::new(),
            error: Some(format!("Error connecting to Anthropic: {}", e)),
        },
    }
}

pub async fn chat_google(
    api_key: String,
    config: ProviderConfig,
    system_prompt: Option<String>,
    messages_str: String,
) -> ProviderResult {
    let api_key = api_key.trim().to_string();
    let client = reqwest::Client::new();
    let chat_messages = build_messages(system_prompt, &messages_str);

    let system_text: String = chat_messages.iter()
        .filter(|m| m.role == "system")
        .map(|m| m.content.as_str())
        .collect::<Vec<_>>()
        .join("\n");

    let contents: Vec<GeminiContent> = chat_messages.iter()
        .filter(|m| m.role != "system")
        .map(|m| {
            let role = if m.role == "assistant" { "model".into() } else { m.role.clone() };
            GeminiContent {
                role,
                parts: vec![GeminiPart { text: m.content.clone() }],
            }
        })
        .collect();

    let request = GeminiRequest {
        system_instruction: if system_text.is_empty() {
            None
        } else {
            Some(GeminiSystemInstruction {
                parts: vec![GeminiPart { text: system_text }],
            })
        },
        contents,
    };

    let url = format!("{}/{}:generateContent?key={}", config.base_url, config.model, api_key);

    match apply_headers(client.post(&url), &config, &api_key).json(&request).send().await {
        Ok(resp) => {
            if !resp.status().is_success() {
                let status = resp.status().as_u16();
                let body = resp.text().await.unwrap_or_default();
                return ProviderResult {
                    success: false, content: String::new(),
                    error: Some(http_error("Google", status, &body)),
                };
            }
            match resp.json::<GeminiResponse>().await {
                Ok(data) => {
                    if let Some(err) = data.error {
                        return ProviderResult {
                            success: false, content: String::new(),
                            error: Some(format!("Google: {}", err.message)),
                        };
                    }
                    let text = data.candidates
                        .and_then(|c| c.into_iter().next())
                        .and_then(|c| c.content)
                        .and_then(|c| c.parts)
                        .and_then(|p| p.into_iter().next())
                        .and_then(|p| p.text)
                        .unwrap_or_default();
                    ProviderResult { success: true, content: text, error: None }
                }
                Err(e) => ProviderResult {
                    success: false, content: String::new(),
                    error: Some(format!("Error parsing Google response: {}", e)),
                },
            }
        }
        Err(e) => ProviderResult {
            success: false, content: String::new(),
            error: Some(format!("Error connecting to Google: {}", e)),
        },
    }
}

pub async fn chat_cohere(
    api_key: String,
    config: ProviderConfig,
    system_prompt: Option<String>,
    messages_str: String,
) -> ProviderResult {
    let api_key = api_key.trim().to_string();
    let client = reqwest::Client::new();
    let chat_messages = build_messages(system_prompt, &messages_str);

    let request = CohereRequest {
        model: config.model.clone(),
        messages: chat_messages,
    };

    match apply_headers(client.post(&config.base_url), &config, &api_key)
        .json(&request)
        .send()
        .await
    {
        Ok(resp) => {
            if !resp.status().is_success() {
                let status = resp.status().as_u16();
                let body = resp.text().await.unwrap_or_default();
                return ProviderResult {
                    success: false, content: String::new(),
                    error: Some(http_error("Cohere", status, &body)),
                };
            }
            match resp.json::<CohereResponse>().await {
                Ok(data) => {
                    if let Some(err) = data.error {
                        return ProviderResult {
                            success: false, content: String::new(),
                            error: Some(format!("Cohere: {}", err)),
                        };
                    }
                    let text = data.message
                        .and_then(|m| m.content.into_iter().next())
                        .map(|c| c.text)
                        .unwrap_or_default();
                    ProviderResult { success: true, content: text, error: None }
                }
                Err(e) => ProviderResult {
                    success: false, content: String::new(),
                    error: Some(format!("Error parsing Cohere response: {}", e)),
                },
            }
        }
        Err(e) => ProviderResult {
            success: false, content: String::new(),
            error: Some(format!("Error connecting to Cohere: {}", e)),
        },
    }
}

pub async fn route_chat(
    api_type: String,
    api_key: String,
    config: ProviderConfig,
    system_prompt: Option<String>,
    messages_str: String,
) -> ProviderResult {
    let api_key = api_key.trim().to_string();
    match api_type.as_str() {
        "anthropic" => chat_anthropic(api_key, config, system_prompt, messages_str).await,
        "google" => chat_google(api_key, config, system_prompt, messages_str).await,
        "cohere" => chat_cohere(api_key, config, system_prompt, messages_str).await,
        _ => chat_openai_compatible(api_key, config, system_prompt, messages_str).await,
    }
}

// ── Streaming ────────────────────────────────────────────────────────────────

/// Acumulador de tool_calls nativas que llegan troceadas en el stream de
/// OpenAI (`delta.tool_calls[]`).
#[derive(Default)]
struct ToolCallAcc {
    items: Vec<(String, String, String)>, // (id, name, arguments)
}

impl ToolCallAcc {
    fn absorb(&mut self, tcs: &[serde_json::Value]) {
        for tc in tcs {
            let idx = tc["index"].as_u64().unwrap_or(0) as usize;
            while self.items.len() <= idx {
                self.items.push((String::new(), String::new(), String::new()));
            }
            let slot = &mut self.items[idx];
            if let Some(id) = tc["id"].as_str() {
                if !id.is_empty() { slot.0 = id.to_string(); }
            }
            if let Some(name) = tc["function"]["name"].as_str() {
                slot.1.push_str(name);
            }
            if let Some(args) = tc["function"]["arguments"].as_str() {
                slot.2.push_str(args);
            }
        }
    }

    fn into_json(self) -> Vec<serde_json::Value> {
        self.items
            .into_iter()
            .filter(|(_, name, _)| !name.is_empty())
            .enumerate()
            .map(|(i, (id, name, args))| {
                let arguments: serde_json::Value =
                    serde_json::from_str(&args).unwrap_or_else(|_| serde_json::json!({}));
                serde_json::json!({
                    "id": if id.is_empty() { format!("call_{}", i) } else { id },
                    "name": name,
                    "arguments": arguments,
                })
            })
            .collect()
    }
}

async fn stream_sse(
    app: &AppHandle,
    stream_id: &str,
    cancel_flag: &AtomicBool,
    response: reqwest::Response,
) -> (String, Vec<serde_json::Value>) {
    let mut full_content = String::new();
    let mut tool_acc = ToolCallAcc::default();
    let mut stream = response.bytes_stream();
    while let Some(chunk_result) = stream.next().await {
        if cancel_flag.load(Ordering::SeqCst) {
            return (full_content, tool_acc.into_json());
        }
        match chunk_result {
            Ok(chunk) => {
                let chunk_str = String::from_utf8_lossy(&chunk);
                for line in chunk_str.lines() {
                    let line = line.trim();
                    if line.is_empty() { continue; }
                    if line == "data: [DONE]" {
                        return (full_content, tool_acc.into_json());
                    }
                    if let Some(data) = line.strip_prefix("data: ") {
                        if let Ok(val) = serde_json::from_str::<serde_json::Value>(data) {
                            if let Some(content) = val["choices"][0]["delta"]["content"].as_str() {
                                full_content.push_str(content);
                                let _ = app.emit("stream://token", serde_json::json!({
                                    "stream_id": stream_id,
                                    "token": content,
                                }));
                            }
                            if let Some(thinking) = val["choices"][0]["delta"]["reasoning_content"].as_str() {
                                let _ = app.emit("stream://thinking", serde_json::json!({
                                    "stream_id": stream_id,
                                    "token": thinking,
                                }));
                            }
                            if let Some(tcs) = val["choices"][0]["delta"]["tool_calls"].as_array() {
                                tool_acc.absorb(tcs);
                            }
                        }
                    }
                }
            }
            Err(_) => return (full_content, tool_acc.into_json()),
        }
    }
    (full_content, tool_acc.into_json())
}

fn build_messages_for_stream(
    system_prompt: Option<String>,
    messages_str: &str,
) -> Vec<ChatMessage> {
    build_messages(system_prompt, messages_str)
}

pub async fn stream_openai_compatible(
    app: AppHandle,
    stream_id: String,
    api_key: String,
    config: ProviderConfig,
    system_prompt: Option<String>,
    messages_str: String,
    params: ModelParams,
    tools: Option<String>,
) {
    let api_key = api_key.trim().to_string();
    let cancel_flag = crate::register_cancel(&stream_id);

    let client = reqwest::Client::new();
    let chat_messages = build_messages_for_stream(system_prompt, &messages_str);
    let mut request = serde_json::json!({
        "model": config.model,
        "messages": chat_messages,
        "stream": true,
    });
    if let Some(t) = params.temperature { request["temperature"] = serde_json::json!(t); }
    if let Some(p) = params.top_p { request["top_p"] = serde_json::json!(p); }
    if let Some(m) = params.max_tokens { request["max_tokens"] = serde_json::json!(m); }
    if let Some(tools_str) = tools {
        if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&tools_str) {
            request["tools"] = parsed;
            request["tool_choice"] = serde_json::json!("auto");
        }
    }

    match apply_headers(client.post(&config.base_url), &config, &api_key)
        .json(&request)
        .send()
        .await
    {
        Ok(resp) => {
            if !resp.status().is_success() {
                let status = resp.status().as_u16();
                let body = resp.text().await.unwrap_or_default();
                let _ = app.emit("stream://error", serde_json::json!({
                    "stream_id": stream_id, "error": http_error(&config.name, status, &body),
                }));
                return;
            }
            let (full, tool_calls) = stream_sse(&app, &stream_id, &cancel_flag, resp).await;
            let _ = app.emit("stream://done", serde_json::json!({
                "stream_id": stream_id, "full_content": full, "cancelled": false,
                "tool_calls": tool_calls,
            }));
        }
        Err(e) => {
            let _ = app.emit("stream://error", serde_json::json!({
                "stream_id": stream_id, "error": format!("Error de conexión: {}", e),
            }));
        }
    }

    crate::unregister_cancel(&stream_id);
}

pub async fn stream_anthropic(
    app: AppHandle,
    stream_id: String,
    api_key: String,
    config: ProviderConfig,
    system_prompt: Option<String>,
    messages_str: String,
    params: ModelParams,
    tools: Option<String>,
) {
    let api_key = api_key.trim().to_string();
    let cancel_flag = crate::register_cancel(&stream_id);

    let client = reqwest::Client::new();
    let chat_messages = build_messages_for_stream(system_prompt, &messages_str);

    let system = chat_messages.iter()
        .filter(|m| m.role == "system")
        .map(|m| m.content.as_str())
        .collect::<Vec<_>>()
        .join("\n");

    let non_system = crate::native_tools::to_anthropic_messages(&chat_messages);

    let mut request = serde_json::json!({
        "model": config.model,
        "max_tokens": params.max_tokens.unwrap_or(4096),
        "stream": true,
        "system": if system.is_empty() { serde_json::Value::Null } else { serde_json::Value::String(system) },
        "messages": non_system,
    });
    if let Some(t) = params.temperature { request["temperature"] = serde_json::json!(t); }
    if let Some(p) = params.top_p { request["top_p"] = serde_json::json!(p); }
    if let Some(tools_str) = tools {
        if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&tools_str) {
            let converted = crate::native_tools::anthropic_tools(&parsed);
            if converted.as_array().is_some_and(|a| !a.is_empty()) {
                request["tools"] = converted;
            }
        }
    }

    match apply_headers(client.post(&config.base_url), &config, &api_key)
        .header("anthropic-version", "2023-06-01")
        .json(&request)
        .send()
        .await
    {
        Ok(resp) => {
            if !resp.status().is_success() {
                let status = resp.status().as_u16();
                let body = resp.text().await.unwrap_or_default();
                let _ = app.emit("stream://error", serde_json::json!({
                    "stream_id": stream_id, "error": http_error("Anthropic", status, &body),
                }));
                return;
            }
            let mut full_content = String::new();
            let mut tool_builder = crate::native_tools::ToolCallBuilder::default();
            let mut block_to_tool: std::collections::HashMap<i64, usize> = std::collections::HashMap::new();
            let mut stream = resp.bytes_stream();
            while let Some(chunk_result) = stream.next().await {
                if cancel_flag.load(Ordering::SeqCst) { break; }
                if let Ok(chunk) = chunk_result {
                    let chunk_str = String::from_utf8_lossy(&chunk);
                    for line in chunk_str.lines() {
                        let line = line.trim();
                        if line.is_empty() { continue; }
                        if let Some(data) = line.strip_prefix("data: ") {
                            if let Ok(val) = serde_json::from_str::<serde_json::Value>(data) {
                                match val["type"].as_str().unwrap_or("") {
                                    "content_block_start" => {
                                        if val["content_block"]["type"].as_str() == Some("tool_use") {
                                            let idx = val["index"].as_i64().unwrap_or(0);
                                            let id = val["content_block"]["id"].as_str().unwrap_or("");
                                            let name = val["content_block"]["name"].as_str().unwrap_or("");
                                            let bi = tool_builder.start(id, name);
                                            block_to_tool.insert(idx, bi);
                                        }
                                    }
                                    "content_block_delta" => {
                                        if let Some(text) = val["delta"]["text"].as_str() {
                                            full_content.push_str(text);
                                            let _ = app.emit("stream://token", serde_json::json!({
                                                "stream_id": stream_id, "token": text,
                                            }));
                                        }
                                        if let Some(thinking) = val["delta"]["thinking"].as_str() {
                                            let _ = app.emit("stream://thinking", serde_json::json!({
                                                "stream_id": stream_id, "token": thinking,
                                            }));
                                        }
                                        if let Some(partial) = val["delta"]["partial_json"].as_str() {
                                            let idx = val["index"].as_i64().unwrap_or(0);
                                            if let Some(bi) = block_to_tool.get(&idx) {
                                                tool_builder.append(*bi, partial);
                                            }
                                        }
                                    }
                                    _ => {}
                                }
                            }
                        }
                    }
                }
            }
            let _ = app.emit("stream://done", serde_json::json!({
                "stream_id": stream_id, "full_content": full_content, "cancelled": false,
                "tool_calls": tool_builder.into_json(),
            }));
        }
        Err(e) => {
            let _ = app.emit("stream://error", serde_json::json!({
                "stream_id": stream_id, "error": format!("Error Anthropic: {}", e),
            }));
        }
    }

    crate::unregister_cancel(&stream_id);
}

pub async fn stream_google(
    app: AppHandle,
    stream_id: String,
    api_key: String,
    config: ProviderConfig,
    system_prompt: Option<String>,
    messages_str: String,
    params: ModelParams,
    tools: Option<String>,
) {
    let api_key = api_key.trim().to_string();
    let cancel_flag = crate::register_cancel(&stream_id);

    let client = reqwest::Client::new();
    let chat_messages = build_messages_for_stream(system_prompt, &messages_str);

    let system_text: String = chat_messages.iter()
        .filter(|m| m.role == "system")
        .map(|m| m.content.as_str())
        .collect::<Vec<_>>()
        .join("\n");

    let contents = crate::native_tools::to_google_contents(&chat_messages);

    let mut request = serde_json::json!({
        "system_instruction": if system_text.is_empty() {
            serde_json::Value::Null
        } else {
            serde_json::json!({ "parts": [{"text": system_text}] })
        },
        "contents": contents,
    });
    let mut generation_config = serde_json::Map::new();
    if let Some(t) = params.temperature { generation_config.insert("temperature".into(), serde_json::json!(t)); }
    if let Some(p) = params.top_p { generation_config.insert("topP".into(), serde_json::json!(p)); }
    if let Some(m) = params.max_tokens { generation_config.insert("maxOutputTokens".into(), serde_json::json!(m)); }
    if !generation_config.is_empty() {
        request["generationConfig"] = serde_json::json!(generation_config);
    }
    if let Some(tools_str) = tools {
        if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&tools_str) {
            let converted = crate::native_tools::google_tools(&parsed);
            if converted[0]["functionDeclarations"].as_array().is_some_and(|a| !a.is_empty()) {
                request["tools"] = converted;
                request["toolConfig"] = serde_json::json!({
                    "functionCallingConfig": { "mode": "AUTO" }
                });
            }
        }
    }

    let url = format!("{}/{}:streamGenerateContent?alt=sse&key={}", config.base_url, config.model, api_key);

    match apply_headers(client.post(&url), &config, &api_key).json(&request).send().await {
        Ok(resp) => {
            if !resp.status().is_success() {
                let status = resp.status().as_u16();
                let body = resp.text().await.unwrap_or_default();
                let _ = app.emit("stream://error", serde_json::json!({
                    "stream_id": stream_id, "error": http_error("Google", status, &body),
                }));
                return;
            }
            let mut full_content = String::new();
            let mut tool_builder = crate::native_tools::ToolCallBuilder::default();
            let mut stream = resp.bytes_stream();
            while let Some(chunk_result) = stream.next().await {
                if cancel_flag.load(Ordering::SeqCst) { break; }
                if let Ok(chunk) = chunk_result {
                    let chunk_str = String::from_utf8_lossy(&chunk);
                    for line in chunk_str.lines() {
                        let line = line.trim();
                        if line.is_empty() { continue; }
                        if let Some(data) = line.strip_prefix("data: ") {
                            if let Ok(val) = serde_json::from_str::<serde_json::Value>(data) {
                                if let Some(parts) = val["candidates"][0]["content"]["parts"].as_array() {
                                    for part in parts {
                                        if let Some(text) = part["text"].as_str() {
                                            full_content.push_str(text);
                                            let _ = app.emit("stream://token", serde_json::json!({
                                                "stream_id": stream_id, "token": text,
                                            }));
                                        }
                                        if let Some(fc) = part.get("functionCall") {
                                            let name = fc["name"].as_str().unwrap_or("");
                                            let args = fc.get("args").cloned().unwrap_or_else(|| serde_json::json!({}));
                                            let idx = tool_builder.start("", name);
                                            tool_builder.append(idx, &args.to_string());
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
            let _ = app.emit("stream://done", serde_json::json!({
                "stream_id": stream_id, "full_content": full_content, "cancelled": false,
                "tool_calls": tool_builder.into_json(),
            }));
        }
        Err(e) => {
            let _ = app.emit("stream://error", serde_json::json!({
                "stream_id": stream_id, "error": format!("Error Google: {}", e),
            }));
        }
    }

    crate::unregister_cancel(&stream_id);
}

pub async fn stream_cohere(
    app: AppHandle,
    stream_id: String,
    api_key: String,
    config: ProviderConfig,
    system_prompt: Option<String>,
    messages_str: String,
    params: ModelParams,
    tools: Option<String>,
) {
    let api_key = api_key.trim().to_string();
    let cancel_flag = crate::register_cancel(&stream_id);

    let client = reqwest::Client::new();
    let chat_messages = build_messages_for_stream(system_prompt, &messages_str);

    let mut request = serde_json::json!({
        "model": config.model,
        "messages": chat_messages,
        "stream": true,
    });
    if let Some(t) = params.temperature { request["temperature"] = serde_json::json!(t); }
    if let Some(p) = params.top_p { request["p"] = serde_json::json!(p); }
    if let Some(m) = params.max_tokens { request["max_tokens"] = serde_json::json!(m); }
    if let Some(tools_str) = tools {
        if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&tools_str) {
            let converted = crate::native_tools::cohere_tools(&parsed);
            if converted.as_array().is_some_and(|a| !a.is_empty()) {
                request["tools"] = converted;
            }
        }
    }

    match apply_headers(client.post(&config.base_url), &config, &api_key)
        .json(&request)
        .send()
        .await
    {
        Ok(resp) => {
            if !resp.status().is_success() {
                let status = resp.status().as_u16();
                let body = resp.text().await.unwrap_or_default();
                let _ = app.emit("stream://error", serde_json::json!({
                    "stream_id": stream_id, "error": http_error("Cohere", status, &body),
                }));
                return;
            }
            let mut full_content = String::new();
            let mut tool_builder = crate::native_tools::ToolCallBuilder::default();
            let mut index_to_tool: std::collections::HashMap<i64, usize> = std::collections::HashMap::new();
            let mut stream = resp.bytes_stream();
            while let Some(chunk_result) = stream.next().await {
                if cancel_flag.load(Ordering::SeqCst) { break; }
                if let Ok(chunk) = chunk_result {
                    let chunk_str = String::from_utf8_lossy(&chunk);
                    for line in chunk_str.lines() {
                        let line = line.trim();
                        if line.is_empty() { continue; }
                        if let Some(data) = line.strip_prefix("data: ") {
                            if let Ok(val) = serde_json::from_str::<serde_json::Value>(data) {
                                let event = val["type"].as_str().unwrap_or("");
                                let index = val["index"].as_i64().unwrap_or(0);
                                match event {
                                    "content-delta" => {
                                        let text = val["delta"]["message"]["content"]["text"]
                                            .as_str()
                                            .or_else(|| val["text"].as_str());
                                        if let Some(text) = text {
                                            full_content.push_str(text);
                                            let _ = app.emit("stream://token", serde_json::json!({
                                                "stream_id": stream_id, "token": text,
                                            }));
                                        }
                                    }
                                    "tool-call-start" => {
                                        let tc = &val["delta"]["message"]["tool_calls"];
                                        let id = tc["id"].as_str().unwrap_or("");
                                        let name = tc["function"]["name"].as_str().unwrap_or("");
                                        let bi = tool_builder.start(id, name);
                                        index_to_tool.insert(index, bi);
                                        if let Some(args) = tc["function"]["arguments"].as_str() {
                                            if !args.is_empty() {
                                                tool_builder.append(bi, args);
                                            }
                                        }
                                    }
                                    "tool-call-delta" => {
                                        if let Some(args) = val["delta"]["message"]["tool_calls"]["function"]["arguments"].as_str() {
                                            let bi = index_to_tool
                                                .get(&index)
                                                .copied()
                                                .unwrap_or_else(|| tool_builder.start("", ""));
                                            tool_builder.append(bi, args);
                                        }
                                    }
                                    _ => {}
                                }
                            }
                        }
                    }
                }
            }
            let _ = app.emit("stream://done", serde_json::json!({
                "stream_id": stream_id, "full_content": full_content, "cancelled": false,
                "tool_calls": tool_builder.into_json(),
            }));
        }
        Err(e) => {
            let _ = app.emit("stream://error", serde_json::json!({
                "stream_id": stream_id, "error": format!("Error Cohere: {}", e),
            }));
        }
    }

    crate::unregister_cancel(&stream_id);
}

pub async fn route_chat_stream(
    app: AppHandle,
    stream_id: String,
    api_type: String,
    api_key: String,
    config: ProviderConfig,
    system_prompt: Option<String>,
    messages_str: String,
    params: ModelParams,
    tools: Option<String>,
) {
    let api_key = api_key.trim().to_string();
    match api_type.as_str() {
        "anthropic" => stream_anthropic(app, stream_id, api_key, config, system_prompt, messages_str, params, tools).await,
        "google" => stream_google(app, stream_id, api_key, config, system_prompt, messages_str, params, tools).await,
        "cohere" => stream_cohere(app, stream_id, api_key, config, system_prompt, messages_str, params, tools).await,
        _ => stream_openai_compatible(app, stream_id, api_key, config, system_prompt, messages_str, params, tools).await,
    }
}

#[cfg(test)]
mod tool_call_tests {
    use super::ToolCallAcc;
    use serde_json::json;

    #[test]
    fn accumulates_fragmented_tool_calls() {
        let mut acc = ToolCallAcc::default();
        acc.absorb(&[json!({
            "index": 0, "id": "call_1",
            "function": { "name": "read_", "arguments": "{\"pa" }
        })]);
        acc.absorb(&[json!({
            "index": 0,
            "function": { "name": "file", "arguments": "th\":\"a.css\"}" }
        })]);
        let out = acc.into_json();
        assert_eq!(out.len(), 1);
        assert_eq!(out[0]["id"], "call_1");
        assert_eq!(out[0]["name"], "read_file");
        assert_eq!(out[0]["arguments"]["path"], "a.css");
    }

    #[test]
    fn generates_id_when_missing() {
        let mut acc = ToolCallAcc::default();
        acc.absorb(&[json!({ "index": 0, "function": { "name": "glob", "arguments": "{}" } })]);
        let out = acc.into_json();
        assert_eq!(out[0]["name"], "glob");
        assert_eq!(out[0]["arguments"], json!({}));
        assert!(out[0]["id"].as_str().unwrap().starts_with("call_"));
    }

    #[test]
    fn ignores_incomplete_tool_calls() {
        let acc = ToolCallAcc::default();
        assert!(acc.into_json().is_empty());
    }
}
