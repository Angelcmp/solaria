use serde::{Deserialize, Serialize};

const TAVILY_URL: &str = "https://api.tavily.com/search";

#[derive(Serialize)]
struct TavilyRequest {
    api_key: String,
    query: String,
    search_depth: String,
    include_answer: bool,
    max_results: u32,
}

#[derive(Deserialize, Serialize)]
pub struct TavilyResult {
    pub title: String,
    pub url: String,
    pub content: String,
}

#[derive(Deserialize)]
struct TavilyResponse {
    answer: Option<String>,
    results: Vec<TavilyResultResponse>,
}

#[derive(Deserialize)]
struct TavilyResultResponse {
    title: String,
    url: String,
    content: String,
}

#[derive(Serialize)]
pub struct SearchResponse {
    pub success: bool,
    pub answer: Option<String>,
    pub results: Vec<TavilyResult>,
    pub error: Option<String>,
}

pub async fn search_tavily(api_key: String, query: String) -> SearchResponse {
    let client = reqwest::Client::new();

    let request = TavilyRequest {
        api_key,
        query,
        search_depth: "advanced".into(),
        include_answer: true,
        max_results: 5,
    };

    match client.post(TAVILY_URL).json(&request).send().await {
        Ok(resp) => {
            if !resp.status().is_success() {
                let status = resp.status().as_u16();
                let body = resp.text().await.unwrap_or_default();
                return SearchResponse {
                    success: false,
                    answer: None,
                    results: vec![],
                    error: Some(format!("Tavily error HTTP {}: {}", status, body)),
                };
            }

            match resp.json::<TavilyResponse>().await {
                Ok(data) => {
                    let results: Vec<TavilyResult> = data
                        .results
                        .into_iter()
                        .map(|r| TavilyResult {
                            title: r.title,
                            url: r.url,
                            content: r.content,
                        })
                        .collect();

                    SearchResponse {
                        success: true,
                        answer: data.answer,
                        results,
                        error: None,
                    }
                }
                Err(e) => SearchResponse {
                    success: false,
                    answer: None,
                    results: vec![],
                    error: Some(format!("Error parsing Tavily response: {}", e)),
                },
            }
        }
        Err(e) => SearchResponse {
            success: false,
            answer: None,
            results: vec![],
            error: Some(format!("Error connecting to Tavily: {}", e)),
        },
    }
}
