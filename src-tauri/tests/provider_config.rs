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
fn test_get_google_config() {
    let config = providers::get_provider_config("google", "gemini-2.0-flash");
    assert!(config.is_some());
    let c = config.unwrap();
    assert_eq!(c.api_type, "google");
    assert_eq!(c.model, "gemini-2.0-flash");
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
