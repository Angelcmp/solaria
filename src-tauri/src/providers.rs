use serde::{Deserialize, Serialize};

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
