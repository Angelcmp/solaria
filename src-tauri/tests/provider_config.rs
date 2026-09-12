use solaria_desktop_lib::providers;

#[test]
fn test_get_openai_config() {
    let config = providers::get_provider_config("openai", "gpt-4o");
    assert!(config.is_some());
    let c = config.unwrap();
    assert_eq!(c.api_type, "openai");
    assert_eq!(c.model, "gpt-4o");
    assert!(c.base_url.contains("openai"));
}

#[test]
fn test_get_anthropic_config() {
    let config = providers::get_provider_config("anthropic", "claude-3-opus-20240229");
    assert!(config.is_some());
    let c = config.unwrap();
    assert_eq!(c.api_type, "anthropic");
    assert_eq!(c.model, "claude-3-opus-20240229");
}

#[test]
fn test_get_deepseek_config() {
    let config = providers::get_provider_config("deepseek", "deepseek-coder");
    assert!(config.is_some());
    let c = config.unwrap();
    assert_eq!(c.api_type, "openai");
    assert_eq!(c.model, "deepseek-coder");
}

#[test]
fn test_deepseek_legacy_alias_flash() {
    let c = providers::get_provider_config("deepseek", "deepseek-v4-flash").unwrap();
    assert_eq!(c.model, "deepseek-chat");
}

#[test]
fn test_deepseek_legacy_alias_pro() {
    let c = providers::get_provider_config("deepseek", "deepseek-v4-pro").unwrap();
    assert_eq!(c.model, "deepseek-reasoner");
}

#[test]
fn test_provider_model_trims_whitespace() {
    let c = providers::get_provider_config(" deepseek ", "  deepseek-chat  ").unwrap();
    assert_eq!(c.model, "deepseek-chat");
}

#[test]
fn test_dead_google_model_alias() {
    let c = providers::get_provider_config("google", "gemini-2.0-flash").unwrap();
    assert_eq!(c.model, "gemini-2.5-flash");
}

#[test]
fn test_cohere_dated_alias() {
    let c = providers::get_provider_config("cohere", "command-r-plus-08-2024").unwrap();
    assert_eq!(c.model, "command-r-plus");
}

#[test]
fn test_groq_scout_alias() {
    let c = providers::get_provider_config("groq", "llama-4-scout-17b-16e-instruct").unwrap();
    assert_eq!(c.model, "meta-llama/llama-4-scout-17b-16e-instruct");
}

#[test]
fn test_get_google_config() {
    let config = providers::get_provider_config("google", "gemini-2.5-flash");
    assert!(config.is_some());
    let c = config.unwrap();
    assert_eq!(c.api_type, "google");
    assert_eq!(c.model, "gemini-2.5-flash");
}

#[test]
fn test_get_groq_config() {
    let config = providers::get_provider_config("groq", "mixtral-8x7b");
    assert!(config.is_some());
    let c = config.unwrap();
    assert_eq!(c.api_type, "openai");
    assert!(c.base_url.contains("groq"));
}

#[test]
fn test_get_cohere_config() {
    let config = providers::get_provider_config("cohere", "command-r-plus");
    assert!(config.is_some());
    let c = config.unwrap();
    assert_eq!(c.api_type, "cohere");
}

#[test]
fn test_get_kimi_config() {
    let config = providers::get_provider_config("kimi", "moonshot-v1-8k");
    assert!(config.is_some());
    let c = config.unwrap();
    assert_eq!(c.api_type, "openai");
}

#[test]
fn test_get_glm_config() {
    let config = providers::get_provider_config("glm", "glm-4-plus");
    assert!(config.is_some());
    let c = config.unwrap();
    assert_eq!(c.api_type, "openai");
}

#[test]
fn test_unknown_provider_returns_none() {
    let config = providers::get_provider_config("nonexistent_provider", "model");
    assert!(config.is_none());
}

#[test]
fn test_all_providers_have_required_fields() {
    let providers = ["openai", "anthropic", "deepseek", "groq", "google", "cohere", "kimi", "glm"];
    for name in &providers {
        let config = providers::get_provider_config(name, "test-model");
        assert!(config.is_some(), "Provider {} debería tener config", name);
        let c = config.unwrap();
        assert!(!c.base_url.is_empty(), "Provider {} debería tener base_url", name);
        assert!(!c.model.is_empty(), "Provider {} debería tener model", name);
        assert!(!c.api_type.is_empty(), "Provider {} debería tener api_type", name);
        assert!(c.api_type == "openai" || c.api_type == "anthropic" || c.api_type == "google" || c.api_type == "cohere",
            "Provider {} tiene api_type inesperado: {}", name, c.api_type);
    }
}

#[test]
fn test_builtin_auth_schemes() {
    assert_eq!(providers::get_provider_config("openai", "gpt-4o").unwrap().auth, "bearer");
    assert_eq!(providers::get_provider_config("anthropic", "claude").unwrap().auth, "x-api-key");
    assert_eq!(providers::get_provider_config("google", "gemini").unwrap().auth, "none");
}

#[test]
fn test_custom_provider_config_defaults() {
    let c = providers::custom_provider_config(
        "LM Studio",
        "http://localhost:1234/v1/chat/completions",
        "local-model",
        None,
        None,
        None,
        None,
    );
    assert_eq!(c.name, "LM Studio");
    assert_eq!(c.base_url, "http://localhost:1234/v1/chat/completions");
    assert_eq!(c.model, "local-model");
    assert_eq!(c.api_type, "openai");
    assert_eq!(c.auth, "bearer");
    assert!(c.extra_headers.is_empty());
}

#[test]
fn test_custom_provider_extra_headers() {
    let headers = serde_json::json!({ "X-Token": "abc", "X-Other": 5 });
    let c = providers::custom_provider_config(
        "Custom", "https://example.com/v1/chat/completions", "m",
        Some("openai"), Some("x-api-key"), Some("api-key"), Some(&headers),
    );
    assert_eq!(c.auth, "x-api-key");
    assert_eq!(c.auth_header, "api-key");
    // Solo se aceptan valores string en las cabeceras extra.
    assert_eq!(c.extra_headers, vec![("X-Token".to_string(), "abc".to_string())]);
}

#[test]
fn test_resolve_provider_prefers_custom_base_url() {
    let c = providers::resolve_provider(
        "mi-endpoint",
        "mistral-7b",
        Some("http://192.168.1.10:8000/v1/chat/completions".into()),
        Some("openai".into()),
        Some("none".into()),
        None,
        None,
    )
    .unwrap();
    assert_eq!(c.base_url, "http://192.168.1.10:8000/v1/chat/completions");
    assert_eq!(c.model, "mistral-7b");
    assert_eq!(c.auth, "none");
}

#[test]
fn test_resolve_provider_falls_back_to_builtin() {
    let c = providers::resolve_provider("openai", "gpt-4o", None, None, None, None, None).unwrap();
    assert!(c.base_url.contains("openai"));
}

#[test]
fn test_resolve_provider_ignores_blank_base_url() {
    let c = providers::resolve_provider("deepseek", "deepseek-chat", Some("   ".into()), None, None, None, None).unwrap();
    assert!(c.base_url.contains("deepseek"));
}

#[test]
fn test_normalize_model_does_not_alter_custom_models() {
    let c = providers::custom_provider_config(
        "Custom", "http://localhost:1234/v1/chat/completions", "Mi-Modelo-Raro", None, None, None, None,
    );
    assert_eq!(c.model, "Mi-Modelo-Raro");
}
