use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::{AppHandle, Emitter};
use std::sync::atomic::Ordering;
use futures_util::StreamExt;

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

pub async fn send_chat_stream(
    app: AppHandle,
    stream_id: String,
    model: String,
    messages_str: String,
    system_prompt: Option<String>,
    temperature: Option<f32>,
    top_p: Option<f32>,
    max_tokens: Option<u32>,
) {
    let cancel_flag = crate::register_cancel(&stream_id);

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(300))
        .build()
        .unwrap_or_default();

    let mut ollama_messages: Vec<Message> = Vec::new();
    if let Some(sp) = system_prompt {
        ollama_messages.push(Message {
            role: "system".into(),
            content: format!("{} IMPORTANTE: Responde siempre en español.", sp),
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

    use serde_json::json;
    let mut request = serde_json::json!({
        "model": model,
        "messages": ollama_messages,
        "stream": true,
    });
    let mut options = serde_json::Map::new();
    if let Some(t) = temperature { options.insert("temperature".into(), json!(t)); }
    if let Some(p) = top_p { options.insert("top_p".into(), json!(p)); }
    if let Some(m) = max_tokens { options.insert("num_predict".into(), json!(m)); }
    if !options.is_empty() {
        request["options"] = json!(options);
    }

    match client.post(OLLAMA_URL).json(&request).send().await {
        Ok(resp) => {
            if !resp.status().is_success() {
                let _ = app.emit("stream://error", serde_json::json!({
                    "stream_id": stream_id,
                    "error": format!("Error HTTP {} de Ollama", resp.status().as_u16()),
                }));
                return;
            }

            let mut full_content = String::new();
            let mut stream = resp.bytes_stream();

            while let Some(chunk_result) = stream.next().await {
                if cancel_flag.load(Ordering::SeqCst) {
                    let _ = app.emit("stream://done", serde_json::json!({
                        "stream_id": stream_id,
                        "full_content": full_content,
                        "cancelled": true,
                    }));
                    return;
                }

                match chunk_result {
                    Ok(chunk) => {
                        let chunk_str = String::from_utf8_lossy(&chunk);
                        for line in chunk_str.lines() {
                            if line.is_empty() { continue; }
                            if let Ok(val) = serde_json::from_str::<Value>(line) {
                                if let Some(error) = val["error"].as_str() {
                                    let _ = app.emit("stream://error", serde_json::json!({
                                        "stream_id": stream_id,
                                        "error": error,
                                    }));
                                    return;
                                }
                                if let Some(content) = val["message"]["content"].as_str() {
                                    full_content.push_str(content);
                                    let _ = app.emit("stream://token", serde_json::json!({
                                        "stream_id": stream_id,
                                        "token": content,
                                    }));
                                }
                                if val["done"].as_bool().unwrap_or(false) {
                                    break;
                                }
                            }
                        }
                    }
                    Err(e) => {
                        let _ = app.emit("stream://error", serde_json::json!({
                            "stream_id": stream_id,
                            "error": format!("Error de stream: {}", e),
                        }));
                        return;
                    }
                }
            }

            let _ = app.emit("stream://done", serde_json::json!({
                "stream_id": stream_id,
                "full_content": full_content,
                "cancelled": false,
            }));
        }
        Err(e) => {
            let _ = app.emit("stream://error", serde_json::json!({
                "stream_id": stream_id,
                "error": format!("No se puede conectar a Ollama: {}", e),
            }));
        }
    }

    crate::unregister_cancel(&stream_id);
}

pub async fn pull_model(model_name: &str) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(600))
        .build()
        .unwrap_or_default();

    let pull_url = "http://localhost:11434/api/pull";
    let body = serde_json::json!({ "name": model_name, "stream": false });

    let resp = client
        .post(pull_url)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Error al conectar con Ollama: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("Ollama error HTTP {}", resp.status().as_u16()));
    }

    let result: Value = resp.json().await.map_err(|e| format!("Error parseando: {}", e))?;

    if let Some(err) = result["error"].as_str() {
        return Err(err.to_string());
    }

    Ok(format!("Modelo '{}' descargado correctamente", model_name))
}

pub async fn delete_model(model_name: &str) -> Result<String, String> {
    let client = reqwest::Client::new();
    let delete_url = "http://localhost:11434/api/delete";

    let resp = client
        .delete(delete_url)
        .json(&serde_json::json!({ "name": model_name }))
        .send()
        .await
        .map_err(|e| format!("Error al conectar con Ollama: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("Ollama error HTTP {}", resp.status().as_u16()));
    }

    Ok(format!("Modelo '{}' eliminado", model_name))
}
