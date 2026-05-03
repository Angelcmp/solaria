use serde::{Deserialize, Serialize};
use serde_json::Value;

const OLLAMA_URL: &str = "http://localhost:11434/api/chat";

#[derive(Serialize)]
struct ChatRequest {
    model: String,
    messages: Vec<Message>,
    stream: bool,
}

#[derive(Serialize, Deserialize)]
struct Message {
    role: String,
    content: String,
}

#[derive(Deserialize)]
struct ChatResponse {
    message: Option<MessageResponse>,
    error: Option<String>,
}

#[derive(Deserialize)]
struct MessageResponse {
    content: String,
}

#[derive(Serialize)]
pub struct OllamaResult {
    pub success: bool,
    pub content: String,
    pub error: Option<String>,
}

pub async fn check_connection() -> bool {
    let client = reqwest::Client::new();
    match client.get("http://localhost:11434/api/tags").send().await {
        Ok(resp) => resp.status().is_success(),
        Err(_) => false,
    }
}

pub async fn list_models() -> Result<Vec<String>, String> {
    let client = reqwest::Client::new();
    let resp = client
        .get("http://localhost:11434/api/tags")
        .send()
        .await
        .map_err(|e| format!("Error al conectar con Ollama: {}", e))?;

    if !resp.status().is_success() {
        return Err("Ollama no responde. ¿Está ejecutándose?".into());
    }

    let body: Value = resp
        .json()
        .await
        .map_err(|e| format!("Error al parsear respuesta: {}", e))?;

    let models = body["models"]
        .as_array()
        .ok_or("Formato de respuesta inválido")?;

    let names: Vec<String> = models
        .iter()
        .filter_map(|m| m["name"].as_str().map(|s| s.to_string()))
        .collect();

    Ok(names)
}

pub async fn send_chat(
    model: String,
    messages_str: String,
    system_prompt: Option<String>,
) -> OllamaResult {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(300))
        .build()
        .unwrap_or_default();

    let mut ollama_messages: Vec<Message> = Vec::new();

    if let Some(sp) = system_prompt {
        ollama_messages.push(Message {
            role: "system".into(),
            content: format!(
                "{} IMPORTANTE: Responde siempre en español.",
                sp
            ),
        });
    } else {
        ollama_messages.push(Message {
            role: "system".into(),
            content: "Eres Solaria, un asistente de IA amigable y servicial. \
                       Responde siempre en español de forma clara y concisa."
                .into(),
        });
    }

    if let Ok(parsed) = serde_json::from_str::<Vec<Message>>(&messages_str) {
        ollama_messages.extend(parsed);
    }

    let request = ChatRequest {
        model,
        messages: ollama_messages,
        stream: false,
    };

    match client.post(OLLAMA_URL).json(&request).send().await {
        Ok(resp) => {
            if !resp.status().is_success() {
                return OllamaResult {
                    success: false,
                    content: String::new(),
                    error: Some(format!(
                        "Error HTTP {} de Ollama",
                        resp.status().as_u16()
                    )),
                };
            }

            match resp.json::<ChatResponse>().await {
                Ok(chat_resp) => {
                    if let Some(err) = chat_resp.error {
                        return OllamaResult {
                            success: false,
                            content: String::new(),
                            error: Some(err),
                        };
                    }

                    OllamaResult {
                        success: true,
                        content: chat_resp
                            .message
                            .map(|m| m.content)
                            .unwrap_or_default(),
                        error: None,
                    }
                }
                Err(e) => OllamaResult {
                    success: false,
                    content: String::new(),
                    error: Some(format!("Error al decodificar respuesta: {}", e)),
                },
            }
        }
        Err(e) => OllamaResult {
            success: false,
            content: String::new(),
            error: Some(format!(
                "No se puede conectar a Ollama (localhost:11434). \
                 Asegúrate de que Ollama esté ejecutándose.\n\nError: {}",
                e
            )),
        },
    }
}
