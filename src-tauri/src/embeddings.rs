use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmbeddingConfig {
    pub provider: EmbeddingProvider,
    pub model: String,
    pub ollama_host: Option<String>,
    pub api_key: Option<String>,
    pub api_url: Option<String>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum EmbeddingProvider {
    Ollama,
    OpenAI,
    Custom,
}

impl EmbeddingProvider {
    pub fn from_str(s: &str) -> Self {
        match s {
            "openai" => Self::OpenAI,
            "custom" => Self::Custom,
            _ => Self::Ollama,
        }
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Ollama => "ollama",
            Self::OpenAI => "openai",
            Self::Custom => "custom",
        }
    }
}

#[derive(Serialize)]
struct OllamaEmbedRequest<'a> {
    model: &'a str,
    prompt: &'a str,
}

#[derive(Deserialize)]
struct OllamaEmbedResponse {
    embedding: Vec<f32>,
}

#[derive(Serialize)]
struct OpenAIEmbedRequest<'a> {
    model: &'a str,
    input: &'a str,
}

#[derive(Deserialize)]
struct OpenAIEmbedResponse {
    data: Vec<OpenAIEmbedDatum>,
}

#[derive(Deserialize)]
struct OpenAIEmbedDatum {
    embedding: Vec<f32>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct EmbeddingResult {
    pub embedding: Vec<f32>,
    pub model: String,
    pub dim: usize,
}

pub async fn embed(text: &str, config: &EmbeddingConfig) -> Result<EmbeddingResult, String> {
    if text.trim().is_empty() {
        return Err("Cannot embed empty text".into());
    }
    match config.provider {
        EmbeddingProvider::Ollama => embed_ollama(text, config).await,
        EmbeddingProvider::OpenAI => embed_openai(text, config).await,
        EmbeddingProvider::Custom => embed_custom(text, config).await,
    }
}

async fn embed_ollama(text: &str, config: &EmbeddingConfig) -> Result<EmbeddingResult, String> {
    let host = config.ollama_host.as_deref().unwrap_or("http://localhost:11434");
    let url = format!("{}/api/embeddings", host);
    let req = OllamaEmbedRequest {
        model: &config.model,
        prompt: text,
    };
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(60))
        .build()
        .map_err(|e| e.to_string())?;
    let resp = client
        .post(&url)
        .json(&req)
        .send()
        .await
        .map_err(|e| format!("Ollama embeddings request failed: {}", e))?;
    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("Ollama returned {}: {}", status, body));
    }
    let body: OllamaEmbedResponse = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse Ollama response: {}", e))?;
    let dim = body.embedding.len();
    Ok(EmbeddingResult {
        embedding: body.embedding,
        model: config.model.clone(),
        dim,
    })
}

async fn embed_openai(text: &str, config: &EmbeddingConfig) -> Result<EmbeddingResult, String> {
    let key = config
        .api_key
        .as_deref()
        .ok_or("OpenAI API key required for embeddings")?;
    let url = config
        .api_url
        .as_deref()
        .unwrap_or("https://api.openai.com/v1/embeddings");
    let req = OpenAIEmbedRequest {
        model: &config.model,
        input: text,
    };
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(60))
        .build()
        .map_err(|e| e.to_string())?;
    let resp = client
        .post(url)
        .header("Authorization", format!("Bearer {}", key))
        .json(&req)
        .send()
        .await
        .map_err(|e| format!("OpenAI embeddings request failed: {}", e))?;
    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("OpenAI returned {}: {}", status, body));
    }
    let body: OpenAIEmbedResponse = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse OpenAI response: {}", e))?;
    let embedding = body
        .data
        .into_iter()
        .next()
        .map(|d| d.embedding)
        .ok_or("OpenAI returned no embeddings")?;
    let dim = embedding.len();
    Ok(EmbeddingResult {
        embedding,
        model: config.model.clone(),
        dim,
    })
}

async fn embed_custom(text: &str, config: &EmbeddingConfig) -> Result<EmbeddingResult, String> {
    let url = config
        .api_url
        .as_deref()
        .ok_or("Custom provider requires api_url")?;
    let req = OpenAIEmbedRequest {
        model: &config.model,
        input: text,
    };
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(60))
        .build()
        .map_err(|e| e.to_string())?;
    let mut req_builder = client.post(url).json(&req);
    if let Some(key) = config.api_key.as_deref() {
        req_builder = req_builder.header("Authorization", format!("Bearer {}", key));
    }
    let resp = req_builder
        .send()
        .await
        .map_err(|e| format!("Custom embeddings request failed: {}", e))?;
    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("Custom returned {}: {}", status, body));
    }
    let body: OpenAIEmbedResponse = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse custom response: {}", e))?;
    let embedding = body
        .data
        .into_iter()
        .next()
        .map(|d| d.embedding)
        .ok_or("Custom provider returned no embeddings")?;
    let dim = embedding.len();
    Ok(EmbeddingResult {
        embedding,
        model: config.model.clone(),
        dim,
    })
}

pub fn chunk_text(text: &str, max_chars: usize, overlap: usize) -> Vec<String> {
    let text = text.trim();
    if text.is_empty() {
        return vec![];
    }
    if text.len() <= max_chars {
        return vec![text.to_string()];
    }
    let mut chunks = Vec::new();
    let mut start = 0;
    while start < text.len() {
        let end = (start + max_chars).min(text.len());
        let mut actual_end = end;
        if end < text.len() {
            if let Some(boundary) = text[start..end].rfind(|c: char| c == '.' || c == '\n') {
                actual_end = start + boundary + 1;
            }
        }
        let chunk = text[start..actual_end].trim();
        if !chunk.is_empty() {
            chunks.push(chunk.to_string());
        }
        if actual_end <= start {
            start += max_chars;
        } else {
            let next_start = actual_end.saturating_sub(overlap);
            if next_start <= start {
                start = actual_end;
            } else {
                start = next_start;
            }
        }
    }
    chunks
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn chunk_short_text() {
        let chunks = chunk_text("hola mundo", 100, 0);
        assert_eq!(chunks.len(), 1);
        assert_eq!(chunks[0], "hola mundo");
    }

    #[test]
    fn chunk_empty() {
        let chunks = chunk_text("", 100, 0);
        assert!(chunks.is_empty());
    }

    #[test]
    fn chunk_long_text_splits_at_boundary() {
        let text = "a".repeat(500) + "." + &"b".repeat(500);
        let chunks = chunk_text(&text, 200, 0);
        assert!(chunks.len() >= 4);
        for c in &chunks {
            assert!(c.len() <= 200);
        }
    }

    #[test]
    fn chunk_with_overlap() {
        let text = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        let chunks = chunk_text(text, 10, 5);
        assert!(chunks.len() >= 3);
        for i in 1..chunks.len() {
            assert!(chunks[i].contains(&chunks[i - 1][chunks[i - 1].len().saturating_sub(5)..]));
        }
    }

    #[test]
    fn provider_roundtrip() {
        assert_eq!(EmbeddingProvider::from_str("ollama"), EmbeddingProvider::Ollama);
        assert_eq!(EmbeddingProvider::from_str("openai"), EmbeddingProvider::OpenAI);
        assert_eq!(EmbeddingProvider::from_str("custom"), EmbeddingProvider::Custom);
        assert_eq!(EmbeddingProvider::from_str("unknown"), EmbeddingProvider::Ollama);
        assert_eq!(EmbeddingProvider::Ollama.as_str(), "ollama");
    }
}
