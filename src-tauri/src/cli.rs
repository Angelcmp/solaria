use crate::keyring;
use crate::ollama;
use crate::providers;
use crate::skills;
use crate::tools;

const DEFAULT_PROVIDER: &str = "ollama";
const DEFAULT_OLLAMA_MODEL: &str = "qwen3.5";
const DEFAULT_CLOUD_MODEL: &str = "gpt-4o-mini";

const HELP_TEXT: &str = r###"Solaria Agent — Deep Research Agentic System

USAGE:
  solaria [COMMAND] [OPTIONS]

COMMANDS:
  (none)              Launch the GUI (detached from terminal)
  ask "PROMPT"        One-shot chat — send a prompt and print the response
  agent "TASK"        Run the research agent on a task
  serve               Start background daemon with tray icon

OPTIONS (for ask / agent):
  --provider <NAME>   LLM provider: ollama, openai, deepseek, anthropic, groq,
                      google, cohere, kimi, glm
                      [default: ollama]
  --model <NAME>      Model name
                      [default: qwen3.5 for ollama, gpt-4o-mini for cloud]
  --host <URL>        Ollama host URL [default: http://localhost:11434]
  --dir <PATH>        Working directory for agent tools [default: current dir]
  --dry               Preview tool calls without executing (agent only)
  -h, --help          Print this help

EXAMPLES:
  solaria                                       # Open GUI
  solaria ask "what is Rust?"                   # Quick chat with Ollama
  solaria agent "research the history of Linux"  # Run research agent
  cat file.txt | solaria ask "summarize this"
"###;

pub fn print_help() {
    eprintln!("{}", HELP_TEXT);
}

#[derive(Default)]
pub struct CliConfig {
    pub provider: String,
    pub model: String,
    pub ollama_host: String,
    pub working_dir: String,
    pub prompt: String,
    pub dry_run: bool,
}

fn parse_cli_args(args: &[String]) -> CliConfig {
    let mut config = CliConfig {
        provider: DEFAULT_PROVIDER.to_string(),
        model: DEFAULT_OLLAMA_MODEL.to_string(),
        ollama_host: "http://localhost:11434".to_string(),
        working_dir: std::env::current_dir()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string(),
        prompt: String::new(),
        dry_run: false,
    };

    let mut i = 2; // skip binary path and command name
    while i < args.len() {
        match args[i].as_str() {
            "--provider" => {
                if i + 1 < args.len() {
                    config.provider = args[i + 1].clone();
                    i += 1;
                }
            }
            "--model" => {
                if i + 1 < args.len() {
                    config.model = args[i + 1].clone();
                    i += 1;
                }
            }
            "--host" => {
                if i + 1 < args.len() {
                    config.ollama_host = args[i + 1].clone();
                    i += 1;
                }
            }
            "--dir" => {
                if i + 1 < args.len() {
                    config.working_dir = args[i + 1].clone();
                    i += 1;
                }
            }
            "--dry" => {
                config.dry_run = true;
            }
            "-h" | "--help" => {
                // handled before this is called
            }
            _ if !args[i].starts_with('-') => {
                config.prompt = args[i..].join(" ");
                break;
            }
            _ => {
                eprintln!("solaria: unknown flag '{}'", args[i]);
                std::process::exit(1);
            }
        }
        i += 1;
    }

    if config.model == DEFAULT_OLLAMA_MODEL && config.provider != DEFAULT_PROVIDER {
        config.model = DEFAULT_CLOUD_MODEL.to_string();
    }

    config
}

pub fn ask(args: &[String]) {
    let config = parse_cli_args(args);
    if config.prompt.is_empty() {
        let mut input = String::new();
        if let Ok(_) = std::io::Read::read_to_string(&mut std::io::stdin(), &mut input) {
            if !input.trim().is_empty() {
                let trimmed = input.trim().to_string();
                let runtime = tokio::runtime::Runtime::new().unwrap();
                runtime.block_on(run_ask(&config, &trimmed));
                return;
            }
        }
        eprintln!("solaria: no prompt provided");
        std::process::exit(1);
    }
    let runtime = tokio::runtime::Runtime::new().unwrap();
    runtime.block_on(run_ask(&config, &config.prompt.clone()));
}

pub fn agent(args: &[String]) {
    let config = parse_cli_args(args);
    if config.prompt.is_empty() {
        eprintln!("solaria: no task provided");
        std::process::exit(1);
    }
    let runtime = tokio::runtime::Runtime::new().unwrap();
    runtime.block_on(run_agent(&config));
}

pub fn serve() {
    // Drop a lock/pid file and fork the GUI process in the background
    let pid_path = home_dir().join(".solaria").join("solaria.pid");
    if pid_path.exists() {
        eprintln!("solaria: already running (pid file exists at {:?})", pid_path);
        std::process::exit(1);
    }
    let _ = std::fs::create_dir_all(pid_path.parent().unwrap());
    let pid = std::process::id();
    let _ = std::fs::write(&pid_path, pid.to_string());

    let self_path = std::env::current_exe().unwrap();
    std::process::Command::new(&self_path)
        .arg("--gui")
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .stdin(std::process::Stdio::null())
        .spawn()
        .ok();

    eprintln!("solaria: daemon started (pid {})", pid);
    eprintln!("         pid file: {:?}", pid_path);
}

fn home_dir() -> std::path::PathBuf {
    std::env::var("HOME")
        .map(std::path::PathBuf::from)
        .unwrap_or_else(|_| std::path::PathBuf::from("."))
}

async fn run_ask(config: &CliConfig, prompt: &str) {
    let api_key = get_api_key(&config.provider);
    let messages = serde_json::json!([{"role": "user", "content": prompt}]).to_string();

    if config.provider == "ollama" {
        let result = ollama::send_chat(config.model.clone(), messages, None).await;
        if result.success {
            println!("{}", result.content);
        } else {
            eprintln!("Error: {}", result.error.unwrap_or_default());
            std::process::exit(1);
        }
    } else {
        let provider_config = providers::get_provider_config(&config.provider, &config.model);
        match provider_config {
            Some(pc) => {
                let result = providers::route_chat(
                    pc.api_type.clone(),
                    api_key.unwrap_or_default(),
                    pc,
                    None,
                    messages,
                )
                .await;
                if result.success {
                    println!("{}", result.content);
                } else {
                    eprintln!("Error: {}", result.error.unwrap_or_default());
                    std::process::exit(1);
                }
            }
            None => {
                eprintln!("Error: provider '{}' not supported", config.provider);
                std::process::exit(1);
            }
        }
    }
}

async fn run_agent(config: &CliConfig) {
    let api_key = get_api_key(&config.provider);

    let skills_prompt = skills::get_enabled_skills_prompt(
        Some(&config.working_dir),
        Some(&config.prompt),
    );

    let allowed_tools = vec![
        "read_file", "write_file", "glob", "grep", "web_search", "fetch_url",
    ];

    let tool_desc = build_tool_prompt(&allowed_tools);

    let system_prompt = format!(
        r###"Eres Solaria Agent, un asistente de investigación y análisis.

DIRECTORIO DE TRABAJO: {}

HERRAMIENTAS DISPONIBLES:
{}

{}

REGLAS:
1. NO preguntes al usuario. Entrega resultados completos y termina.
2. Si usas web_search, DEBES hacer fetch_url en al menos 1 fuente.
3. Maximo 3 fetch_url por sesion. Luego sintetiza.
4. Al terminar, da la respuesta final SIN tool_calls.
5. Incluye fuentes numeradas al final.

Para usar una herramienta, responde UNICAMENTE con:
<tool_call>
{{"name": "tool_name", "arguments": {{"key": "value"}}}}
</tool_call>"###,
        config.working_dir,
        tool_desc,
        if skills_prompt.is_empty() { String::new() } else { format!("SKILLS ACTIVAS:\n{}", skills_prompt) },
    );

    let mut messages: Vec<serde_json::Value> = vec![
        serde_json::json!({"role": "user", "content": config.prompt}),
    ];

    for _ in 0..5 {
        let messages_json = serde_json::to_string(&messages).unwrap();

        let (success, content, error) = if config.provider == "ollama" {
            let result = ollama::send_chat(
                config.model.clone(),
                messages_json,
                Some(system_prompt.clone()),
            )
            .await;
            (result.success, result.content, result.error)
        } else {
            match providers::get_provider_config(&config.provider, &config.model) {
                Some(pc) => {
                    let result = providers::route_chat(
                        pc.api_type.clone(),
                        api_key.clone().unwrap_or_default(),
                        pc,
                        Some(system_prompt.clone()),
                        messages_json,
                    )
                    .await;
                    (result.success, result.content, result.error)
                }
                None => {
                    eprintln!("Error: provider '{}' not supported", config.provider);
                    return;
                }
            }
        };

        if !success {
            eprintln!("Error: {}", error.unwrap_or_default());
            return;
        }

        let tool_call = extract_tool_call_json(&content);
        if tool_call.is_none() {
            println!("{}", content);
            return;
        }

        let (tool_name, tool_args): (String, serde_json::Value) = tool_call.unwrap();
        if !allowed_tools.contains(&tool_name.as_str()) {
            messages.push(serde_json::json!({
                "role": "assistant",
                "content": content,
            }));
            messages.push(serde_json::json!({
                "role": "user",
                "content": format!("Tool '{}' is not allowed. Available: {}", tool_name, allowed_tools.join(", ")),
            }));
            continue;
        }

        eprintln!("  → {}", tool_name);

        if config.dry_run {
            eprintln!("    (dry run — skipping)");
            messages.push(serde_json::json!({
                "role": "assistant",
                "content": content,
            }));
            messages.push(serde_json::json!({
                "role": "user",
                "content": format!("Resultado de {}: [simulado, dry-run activado]", tool_name),
            }));
            continue;
        }

        let tool_args_json = serde_json::to_string(&tool_args).unwrap();
        let tool_result = tools::execute_tool(
            &tool_name,
            &tool_args_json,
            Some(config.working_dir.clone()),
            false,
            false,
        )
        .await;

        let result_text = if tool_result.success {
            tool_result.output
        } else {
            format!("Error: {}", tool_result.error.unwrap_or_default())
        };

        // Print write_file feedback
        if tool_name == "write_file" && tool_result.success {
            let path = tool_args.get("path").and_then(|v: &serde_json::Value| v.as_str()).unwrap_or("unknown");
            eprintln!("    ✅ written: {}", path);
        }

        messages.push(serde_json::json!({
            "role": "assistant",
            "content": content,
        }));
        messages.push(serde_json::json!({
            "role": "user",
            "content": format!("Resultado de {}:\n```\n{}\n```", tool_name, result_text),
        }));
    }

    eprintln!("⚠️  max iterations reached — agent stopped");
}

fn get_api_key(provider: &str) -> Option<String> {
    keyring::get_key(provider).ok()
}

fn build_tool_prompt(allowed: &[&str]) -> String {
    let all_tools = tools::get_all_tools();
    all_tools
        .iter()
        .filter(|t| allowed.contains(&t.name.as_str()))
        .map(|t| {
            let params = t
                .parameters
                .iter()
                .map(|p| format!("  - {} ({}): {}", p.name, p.param_type, p.description))
                .collect::<Vec<_>>()
                .join("\n");
            format!("### {}\n{}\nParámetros:\n{}", t.name, t.description, params)
        })
        .collect::<Vec<_>>()
        .join("\n\n")
}

/// Simplified tool call extraction from LLM response (mirrors useAgent.ts logic).
fn extract_tool_call_json(text: &str) -> Option<(String, serde_json::Value)> {
    // Try <tool_call> JSON </tool_call> format
    if let Some(caps) = regex_capture(r"<tool_call>\s*(\{[\s\S]*?\})\s*</tool_call>", text) {
        if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&caps) {
            if let (Some(name), Some(args)) = (
                parsed["name"].as_str().map(|s| s.to_string()),
                Some(parsed["arguments"].clone()),
            ) {
                return Some((name, args));
            }
        }
    }

    // Try bare JSON with "name" key
    let re = regex::Regex::new(r#""name"\s*:\s*"([^"]+)""#).ok()?;
    if let Some(caps) = re.captures(text) {
        let name = caps.get(1)?.as_str().to_string();
        // Try to parse the full JSON block
        let json_start = text.find('{')?;
        let json_end = text.rfind('}')?;
        let json_str = &text[json_start..=json_end];
        if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(json_str) {
            let args = parsed.get("arguments").cloned().unwrap_or_else(|| {
                // Collect extra keys as args
                let known = ["name", "nombre", "arguments", "parametros"];
                let mut obj = serde_json::Map::new();
                for (k, v) in parsed.as_object().unwrap_or(&serde_json::Map::new()) {
                    if !known.contains(&k.as_str()) {
                        obj.insert(k.clone(), v.clone());
                    }
                }
                serde_json::Value::Object(obj)
            });
            return Some((name, args));
        }
    }

    None
}

fn regex_capture(pattern: &str, text: &str) -> Option<String> {
    let re = regex::Regex::new(pattern).ok()?;
    re.captures(text)
        .and_then(|caps| caps.get(1))
        .map(|m| m.as_str().to_string())
}
