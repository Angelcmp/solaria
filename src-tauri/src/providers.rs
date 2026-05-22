use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};
use futures_util::StreamExt;
use std::sync::atomic::{AtomicBool, Ordering};

#[derive(Serialize, Deserialize, Clone)]
struct ChatMessage {
    role: String,
    content: String,
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
}

#[derive(Clone)]
pub struct ModelParams {
    pub temperature: Option<f32>,
    pub top_p: Option<f32>,
    pub max_tokens: Option<u32>,
}

pub fn get_provider_config(provider: &str, model: &str) -> Option<ProviderConfig> {
    match provider {
        "openai" => Some(ProviderConfig {
            name: "OpenAI".into(),
            base_url: "https://api.openai.com/v1/chat/completions".into(),
            model: model.into(),
            api_type: "openai".into(),
        }),
        "deepseek" => Some(ProviderConfig {
            name: "DeepSeek".into(),
            base_url: "https://api.deepseek.com/chat/completions".into(),
            model: model.into(),
            api_type: "openai".into(),
        }),
        "groq" => Some(ProviderConfig {
            name: "Groq".into(),
            base_url: "https://api.groq.com/openai/v1/chat/completions".into(),
            model: model.into(),
            api_type: "openai".into(),
        }),
        "kimi" => Some(ProviderConfig {
            name: "Kimi".into(),
            base_url: "https://api.moonshot.cn/v1/chat/completions".into(),
            model: model.into(),
            api_type: "openai".into(),
        }),
        "glm" => Some(ProviderConfig {
            name: "GLM".into(),
            base_url: "https://api.z.ai/api/paas/v4/chat/completions".into(),
            model: model.into(),
            api_type: "openai".into(),
        }),
        "anthropic" => Some(ProviderConfig {
            name: "Anthropic".into(),
            base_url: "https://api.anthropic.com/v1/messages".into(),
            model: model.into(),
            api_type: "anthropic".into(),
        }),
        "google" => Some(ProviderConfig {
            name: "Google".into(),
            base_url: "https://generativelanguage.googleapis.com/v1beta/models".into(),
            model: model.into(),
            api_type: "google".into(),
        }),
        "cohere" => Some(ProviderConfig {
            name: "Cohere".into(),
            base_url: "https://api.cohere.ai/v2/chat".into(),
            model: model.into(),
            api_type: "cohere".into(),
        }),
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
            content: format!("{} IMPORTANTE: Responde siempre en español.", sp),
        });
    } else {
        chat_messages.push(ChatMessage {
            role: "system".into(),
            content: "Eres Solaria, un asistente de IA. Responde siempre en español de forma clara y concisa.".into(),
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
    let client = reqwest::Client::new();
    let chat_messages = build_messages(system_prompt, &messages_str);

    let request = OpenAIRequest {
        model: config.model,
        messages: chat_messages,
        stream: false,
    };

    match client
        .post(&config.base_url)
        .header("Authorization", format!("Bearer {}", api_key))
        .json(&request)
        .send()
        .await
    {
        Ok(resp) => {
            if !resp.status().is_success() {
                let status = resp.status().as_u16();
                return ProviderResult {
                    success: false,
                    content: String::new(),
                    error: Some(format!("{} error HTTP {}", config.name, status)),
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
        model: config.model,
        max_tokens: 4096,
        system: if system.is_empty() { None } else { Some(system) },
        messages: non_system,
    };

    match client
        .post(&config.base_url)
        .header("x-api-key", &api_key)
        .header("anthropic-version", "2023-06-01")
        .json(&request)
        .send()
        .await
    {
        Ok(resp) => {
            if !resp.status().is_success() {
                let status = resp.status().as_u16();
                return ProviderResult {
                    success: false,
                    content: String::new(),
                    error: Some(format!("Anthropic error HTTP {}", status)),
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

    match client.post(&url).json(&request).send().await {
        Ok(resp) => {
            if !resp.status().is_success() {
                return ProviderResult {
                    success: false, content: String::new(),
                    error: Some(format!("Google error HTTP {}", resp.status().as_u16())),
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
    let client = reqwest::Client::new();
    let chat_messages = build_messages(system_prompt, &messages_str);

    let request = CohereRequest {
        model: config.model,
        messages: chat_messages,
    };

    match client
        .post(&config.base_url)
        .header("Authorization", format!("Bearer {}", api_key))
        .json(&request)
        .send()
        .await
    {
        Ok(resp) => {
            if !resp.status().is_success() {
                return ProviderResult {
                    success: false, content: String::new(),
                    error: Some(format!("Cohere error HTTP {}", resp.status().as_u16())),
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
    match api_type.as_str() {
        "anthropic" => chat_anthropic(api_key, config, system_prompt, messages_str).await,
        "google" => chat_google(api_key, config, system_prompt, messages_str).await,
        "cohere" => chat_cohere(api_key, config, system_prompt, messages_str).await,
        _ => chat_openai_compatible(api_key, config, system_prompt, messages_str).await,
    }
}

// ── Streaming ────────────────────────────────────────────────────────────────

async fn stream_sse(
    app: &AppHandle,
    stream_id: &str,
    cancel_flag: &AtomicBool,
    response: reqwest::Response,
) -> String {
    let mut full_content = String::new();
    let mut stream = response.bytes_stream();
    while let Some(chunk_result) = stream.next().await {
        if cancel_flag.load(Ordering::SeqCst) {
            return full_content;
        }
        match chunk_result {
            Ok(chunk) => {
                let chunk_str = String::from_utf8_lossy(&chunk);
                for line in chunk_str.lines() {
                    let line = line.trim();
                    if line.is_empty() { continue; }
                    if line == "data: [DONE]" { return full_content; }
                    if let Some(data) = line.strip_prefix("data: ") {
                        if let Ok(val) = serde_json::from_str::<serde_json::Value>(data) {
                            if let Some(content) = val["choices"][0]["delta"]["content"].as_str() {
                                full_content.push_str(content);
                                let _ = app.emit("stream://token", serde_json::json!({
                                    "stream_id": stream_id,
                                    "token": content,
                                }));
                            }
                        }
                    }
                }
            }
            Err(_) => return full_content,
        }
    }
    full_content
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
) {
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

    match client
        .post(&config.base_url)
        .header("Authorization", format!("Bearer {}", api_key))
        .json(&request)
        .send()
        .await
    {
        Ok(resp) => {
            if !resp.status().is_success() {
                let _ = app.emit("stream://error", serde_json::json!({
                    "stream_id": stream_id, "error": format!("HTTP {}", resp.status().as_u16()),
                }));
                return;
            }
            let full = stream_sse(&app, &stream_id, &cancel_flag, resp).await;
            let _ = app.emit("stream://done", serde_json::json!({
                "stream_id": stream_id, "full_content": full, "cancelled": false,
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
) {
    let cancel_flag = crate::register_cancel(&stream_id);

    let client = reqwest::Client::new();
    let chat_messages = build_messages_for_stream(system_prompt, &messages_str);

    let system = chat_messages.iter()
        .filter(|m| m.role == "system")
        .map(|m| m.content.as_str())
        .collect::<Vec<_>>()
        .join("\n");

    let non_system: Vec<AnthropicChatMessage> = chat_messages.iter()
        .filter(|m| m.role != "system")
        .map(|m| AnthropicChatMessage { role: m.role.clone(), content: m.content.clone() })
        .collect();

    let mut request = serde_json::json!({
        "model": config.model,
        "max_tokens": params.max_tokens.unwrap_or(4096),
        "stream": true,
        "system": if system.is_empty() { serde_json::Value::Null } else { serde_json::Value::String(system) },
        "messages": non_system,
    });
    if let Some(t) = params.temperature { request["temperature"] = serde_json::json!(t); }
    if let Some(p) = params.top_p { request["top_p"] = serde_json::json!(p); }

    match client
        .post(&config.base_url)
        .header("x-api-key", &api_key)
        .header("anthropic-version", "2023-06-01")
        .json(&request)
        .send()
        .await
    {
        Ok(resp) => {
            if !resp.status().is_success() {
                let _ = app.emit("stream://error", serde_json::json!({
                    "stream_id": stream_id, "error": format!("Anthropic HTTP {}", resp.status().as_u16()),
                }));
                return;
            }
            let mut full_content = String::new();
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
                                if val.get("type").and_then(|t| t.as_str()) == Some("content_block_delta") {
                                    if let Some(text) = val["delta"]["text"].as_str() {
                                        full_content.push_str(text);
                                        let _ = app.emit("stream://token", serde_json::json!({
                                            "stream_id": stream_id, "token": text,
                                        }));
                                    }
                                }
                            }
                        }
                    }
                }
            }
            let _ = app.emit("stream://done", serde_json::json!({
                "stream_id": stream_id, "full_content": full_content, "cancelled": false,
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
) {
    let cancel_flag = crate::register_cancel(&stream_id);

    let client = reqwest::Client::new();
    let chat_messages = build_messages_for_stream(system_prompt, &messages_str);

    let system_text: String = chat_messages.iter()
        .filter(|m| m.role == "system")
        .map(|m| m.content.as_str())
        .collect::<Vec<_>>()
        .join("\n");

    let contents: Vec<serde_json::Value> = chat_messages.iter()
        .filter(|m| m.role != "system")
        .map(|m| {
            let role = if m.role == "assistant" { "model".into() } else { m.role.clone() };
            serde_json::json!({
                "role": role,
                "parts": [{"text": m.content}],
            })
        })
        .collect();

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

    let url = format!("{}/{}:streamGenerateContent?alt=sse&key={}", config.base_url, config.model, api_key);

    match client.post(&url).json(&request).send().await {
        Ok(resp) => {
            if !resp.status().is_success() {
                let _ = app.emit("stream://error", serde_json::json!({
                    "stream_id": stream_id, "error": format!("Google HTTP {}", resp.status().as_u16()),
                }));
                return;
            }
            let mut full_content = String::new();
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
                                if let Some(text) = val["candidates"][0]["content"]["parts"][0]["text"].as_str() {
                                    full_content.push_str(text);
                                    let _ = app.emit("stream://token", serde_json::json!({
                                        "stream_id": stream_id, "token": text,
                                    }));
                                }
                            }
                        }
                    }
                }
            }
            let _ = app.emit("stream://done", serde_json::json!({
                "stream_id": stream_id, "full_content": full_content, "cancelled": false,
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
) {
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

    match client
        .post(&config.base_url)
        .header("Authorization", format!("Bearer {}", api_key))
        .json(&request)
        .send()
        .await
    {
        Ok(resp) => {
            if !resp.status().is_success() {
                let _ = app.emit("stream://error", serde_json::json!({
                    "stream_id": stream_id, "error": format!("Cohere HTTP {}", resp.status().as_u16()),
                }));
                return;
            }
            let mut full_content = String::new();
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
                                if let Some(text) = val["text"].as_str() {
                                    full_content.push_str(text);
                                    let _ = app.emit("stream://token", serde_json::json!({
                                        "stream_id": stream_id, "token": text,
                                    }));
                                }
                            }
                        }
                    }
                }
            }
            let _ = app.emit("stream://done", serde_json::json!({
                "stream_id": stream_id, "full_content": full_content, "cancelled": false,
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
) {
    match api_type.as_str() {
        "anthropic" => stream_anthropic(app, stream_id, api_key, config, system_prompt, messages_str, params).await,
        "google" => stream_google(app, stream_id, api_key, config, system_prompt, messages_str, params).await,
        "cohere" => stream_cohere(app, stream_id, api_key, config, system_prompt, messages_str, params).await,
        _ => stream_openai_compatible(app, stream_id, api_key, config, system_prompt, messages_str, params).await,
    }
}
