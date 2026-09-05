use crate::keyring;
use crate::ollama;
use crate::providers;
use crate::skills;
use crate::tools;

const DEFAULT_PROVIDER: &str = "openai";
const DEFAULT_MODEL: &str = "gpt-4o-mini";

const HELP_TEXT: &str = r###"Solaria Agent — Deep Research Agentic System

USAGE:
  solaria [COMMAND] [OPTIONS]

COMMANDS:
  (none)              Launch the GUI (detached from terminal)
  ask "PROMPT"        One-shot chat — send a prompt and print the response
  agent "TASK"        Run the research agent on a task
  set-key <PROVIDER> <KEY>
                      Store an API key in the system keyring
  serve               Start background daemon with tray icon
  status              Show whether the background daemon is running
  stop                Stop the background daemon
  version             Print version
  update [--check]    Check for updates (GitHub Releases) and install
  uninstall [--yes]   Remove Solaria completely (binaries, repo, data)

OPTIONS (for ask / agent):
  --provider <NAME>   LLM provider: openai, deepseek, anthropic, groq,
                      google, cohere, kimi, glm, ollama
                      [default: openai]
  --model <NAME>      Model name [default: gpt-4o-mini]
  --api-key <KEY>     API key for the selected provider (one-shot use)
  --host <URL>        Ollama host URL [default: http://localhost:11434]
  --dir <PATH>        Working directory for agent tools [default: current dir]
                      (`--dir=/path` and `-d` also accepted)
  --dry               Preview tool calls without executing (agent only)
  -h, --help          Print this help

EXAMPLES:
  solaria                                       # Open GUI
  solaria set-key openai sk-...                 # Save API key
  solaria ask "what is Rust?"                   # Quick chat with OpenAI
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
    pub api_key: Option<String>,
    pub ollama_host: String,
    pub working_dir: String,
    pub prompt: String,
    pub dry_run: bool,
}

fn parse_cli_args(args: &[String]) -> CliConfig {
    let mut config = CliConfig {
        provider: DEFAULT_PROVIDER.to_string(),
        model: DEFAULT_MODEL.to_string(),
        api_key: None,
        ollama_host: "http://localhost:11434".to_string(),
        working_dir: std::env::current_dir()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string(),
        prompt: String::new(),
        dry_run: false,
    };

    // Flags conocidos se aceptan en cualquier posición (antes o después
    // del prompt): primero se extraen, el resto positional se une como prompt.
    let mut positionals: Vec<String> = Vec::new();
    let mut i = 2; // skip binary path and command name
    while i < args.len() {
        let arg = args[i].as_str();
        if let Some(value) = arg.strip_prefix("--dir=") {
            config.working_dir = value.to_string();
        } else if let Some(value) = arg.strip_prefix("--provider=") {
            config.provider = value.to_string();
        } else if let Some(value) = arg.strip_prefix("--model=") {
            config.model = value.to_string();
        } else if let Some(value) = arg.strip_prefix("--api-key=") {
            config.api_key = Some(value.to_string());
        } else if let Some(value) = arg.strip_prefix("--host=") {
            config.ollama_host = value.to_string();
        } else {
            match arg {
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
                "--api-key" => {
                    if i + 1 < args.len() {
                        config.api_key = Some(args[i + 1].clone());
                        i += 1;
                    }
                }
                "--host" => {
                    if i + 1 < args.len() {
                        config.ollama_host = args[i + 1].clone();
                        i += 1;
                    }
                }
                "--dir" | "-d" => {
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
                _ if !arg.starts_with('-') => {
                    positionals.push(args[i].clone());
                }
                _ => {
                    eprintln!("solaria: unknown flag '{}'", args[i]);
                    std::process::exit(1);
                }
            }
        }
        i += 1;
    }
    config.prompt = positionals.join(" ");

    config
}

pub fn ask(args: &[String]) {
    let config = parse_cli_args(args);
    if config.prompt.is_empty() {
        // Solo leer stdin si viene por pipe/redirección; en una TTY
        // interactiva read_to_string bloquearía para siempre.
        if !std::io::IsTerminal::is_terminal(&std::io::stdin()) {
            let mut input = String::new();
            if std::io::Read::read_to_string(&mut std::io::stdin(), &mut input).is_ok()
                && !input.trim().is_empty()
            {
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

pub fn set_key(args: &[String]) {
    if args.len() < 4 {
        eprintln!("solaria: uso: solaria set-key <provider> <api-key>");
        std::process::exit(1);
    }
    let provider = &args[2];
    let key = &args[3];
    let result = keyring::store_key(provider, key);
    if result.success {
        println!("API key para '{}' guardada correctamente.", provider);
    } else {
        eprintln!(
            "solaria: no se pudo guardar la API key: {}",
            result.error.unwrap_or_default()
        );
        std::process::exit(1);
    }
}

pub fn serve() {
    // Drop a lock/pid file and fork the GUI process in the background.
    // El pid guardado es el del daemon hijo, no el del CLI efímero.
    let pid_path = home_dir().join(".solaria").join("solaria.pid");
    if let Some(running) = read_daemon_pid(&pid_path) {
        eprintln!(
            "solaria: already running (pid {} exists at {:?})",
            running, pid_path
        );
        std::process::exit(1);
    }
    let _ = std::fs::create_dir_all(pid_path.parent().unwrap());

    let self_path = std::env::current_exe().unwrap();
    match std::process::Command::new(&self_path)
        .arg("--gui")
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .stdin(std::process::Stdio::null())
        .spawn()
    {
        Ok(child) => {
            let _ = std::fs::write(&pid_path, child.id().to_string());
            eprintln!("solaria: daemon started (pid {})", child.id());
            eprintln!("         pid file: {:?}", pid_path);
        }
        Err(e) => {
            eprintln!("solaria: failed to start daemon: {}", e);
            std::process::exit(1);
        }
    }
}

pub fn status() {
    let pid_path = home_dir().join(".solaria").join("solaria.pid");
    match read_daemon_pid(&pid_path) {
        Some(pid) => {
            println!("solaria: running (pid {})", pid);
        }
        None => {
            println!("solaria: not running");
            std::process::exit(1);
        }
    }
}

pub fn stop() {
    let pid_path = home_dir().join(".solaria").join("solaria.pid");
    let pid = match read_daemon_pid(&pid_path) {
        Some(pid) => pid,
        None => {
            eprintln!("solaria: not running (no pid file at {:?})", pid_path);
            std::process::exit(1);
        }
    };
    // SIGTERM via kill(2) externo para no añadir dependencias.
    let killed = std::process::Command::new("kill")
        .arg(pid.to_string())
        .status()
        .map(|s| s.success())
        .unwrap_or(false);
    if killed {
        let _ = std::fs::remove_file(&pid_path);
        eprintln!("solaria: stopped (pid {})", pid);
    } else {
        eprintln!("solaria: could not signal pid {}", pid);
        std::process::exit(1);
    }
}

/// Lee el pid file y verifica que el proceso siga vivo (portable: sysinfo).
fn read_daemon_pid(pid_path: &std::path::Path) -> Option<u32> {
    let content = std::fs::read_to_string(pid_path).ok()?;
    let pid: u32 = content.trim().parse().ok()?;
    if process_alive(pid) {
        Some(pid)
    } else {
        // Pid rancio de una ejecución anterior: limpiarlo.
        let _ = std::fs::remove_file(pid_path);
        None
    }
}

/// ¿Sigue vivo el proceso? (Linux usaba /proc; ahora sysinfo en todo OS).
fn process_alive(pid: u32) -> bool {
    let sys = sysinfo::System::new_all();
    sys.process(sysinfo::Pid::from_u32(pid)).is_some()
}

// ── update / uninstall: cáscaras finas que delegan en install.sh ──

const UPDATE_REPO: &str = "Angelcmp/solaria";
const DEFAULT_API_BASE: &str = "https://api.github.com";
#[cfg(not(target_os = "macos"))]
const DEFAULT_INSTALL_SH_URL: &str =
    "https://raw.githubusercontent.com/Angelcmp/solaria/main/install.sh";

/// Base de la API de releases (sobreescribible para GHES o pruebas).
fn api_base() -> String {
    std::env::var("SOLARIA_API_BASE").unwrap_or_else(|_| DEFAULT_API_BASE.to_string())
}

/// URL del instalador (sobreescribible para pruebas).
fn install_sh_url() -> String {
    if let Ok(url) = std::env::var("SOLARIA_INSTALL_SH_URL") {
        return url;
    }
    #[cfg(target_os = "macos")]
    {
        "https://raw.githubusercontent.com/Angelcmp/solaria/main/install-macos.sh".to_string()
    }
    #[cfg(not(target_os = "macos"))]
    {
        DEFAULT_INSTALL_SH_URL.to_string()
    }
}

pub fn update(args: &[String]) {
    let check_only = args.iter().any(|a| a == "--check");
    let current = env!("CARGO_PKG_VERSION").to_string();
    let runtime = tokio::runtime::Runtime::new().unwrap();
    let latest = runtime.block_on(fetch_latest_tag()).unwrap_or_else(|e| {
        eprintln!("solaria: no se pudo consultar actualizaciones: {}", e);
        std::process::exit(1);
    });
    let latest_ver = normalize_version(&latest);
    if !version_is_newer(&latest_ver, &current) {
        println!("solaria: ya estás al día (versión {})", current);
        return;
    }
    if check_only {
        println!(
            "solaria: hay actualización disponible: {} → {} (ejecuta `solaria update`)",
            current, latest_ver
        );
        return;
    }
    println!("solaria: actualizando {} → {}...", current, latest_ver);
    let installer = runtime
        .block_on(download_installer())
        .unwrap_or_else(|e| {
            eprintln!("solaria: no se pudo descargar el instalador: {}", e);
            std::process::exit(1);
        });
    exec_installer(&installer, &[], Some(&latest));
}

pub fn uninstall(args: &[String]) {
    let yes = args.iter().any(|a| a == "--yes" || a == "-y");
    if !yes {
        if !std::io::IsTerminal::is_terminal(&std::io::stdin()) {
            eprintln!("solaria: esto borrará binarios, repo y datos (~/.solaria). Re-ejecuta con --yes para confirmar.");
            std::process::exit(1);
        }
        eprintln!("Esto desinstalará Solaria por completo:");
        eprintln!("  - binario, wrapper, entrada de menú, paquete .deb");
        eprintln!("  - repo clonado y datos locales (~/.solaria: keys, conversaciones)");
        eprint!("¿Continuar? [s/N] ");
        let _ = std::io::Write::flush(&mut std::io::stderr());
        let mut answer = String::new();
        if std::io::BufRead::read_line(&mut std::io::stdin().lock(), &mut answer).is_err() {
            std::process::exit(1);
        }
        let a = answer.trim().to_lowercase();
        if !["s", "si", "sí", "y", "yes"].contains(&a.as_str()) {
            eprintln!("solaria: cancelado.");
            return;
        }
    }
    let runtime = tokio::runtime::Runtime::new().unwrap();
    let installer = runtime
        .block_on(download_installer())
        .unwrap_or_else(|e| {
            eprintln!("solaria: no se pudo descargar el instalador: {}", e);
            std::process::exit(1);
        });
    exec_installer(&installer, &["--uninstall"], None);
}

async fn fetch_latest_tag() -> Result<String, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .user_agent("solaria-cli")
        .build()
        .map_err(|e| e.to_string())?;
    let url = format!("{}/repos/{}/releases/latest", api_base(), UPDATE_REPO);
    let v: serde_json::Value = client
        .get(&url)
        .send()
        .await
        .map_err(|e| e.to_string())?
        .error_for_status()
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())?;
    v.get("tag_name")
        .and_then(|t| t.as_str())
        .map(|s| s.to_string())
        .ok_or_else(|| "respuesta sin tag_name".to_string())
}

async fn download_installer() -> Result<std::path::PathBuf, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .user_agent("solaria-cli")
        .build()
        .map_err(|e| e.to_string())?;
    let bytes = client
        .get(install_sh_url())
        .send()
        .await
        .map_err(|e| e.to_string())?
        .error_for_status()
        .map_err(|e| e.to_string())?
        .bytes()
        .await
        .map_err(|e| e.to_string())?;
    let path =
        std::env::temp_dir().join(format!("solaria-install-{}.sh", std::process::id()));
    std::fs::write(&path, &bytes).map_err(|e| e.to_string())?;
    Ok(path)
}

/// Reemplaza el proceso actual por `bash <instalador>` (en Unix vía exec:
/// el binario puede borrarse bajo sus pies sin problema).
fn exec_installer(path: &std::path::Path, args: &[&str], version: Option<&str>) -> ! {
    #[cfg(unix)]
    {
        use std::os::unix::process::CommandExt;
        let mut cmd = std::process::Command::new("bash");
        cmd.arg(path);
        for a in args {
            cmd.arg(a);
        }
        if let Some(v) = version {
            cmd.env("SOLARIA_VERSION", v);
        }
        let err = cmd.exec();
        eprintln!("solaria: no se pudo ejecutar el instalador: {}", err);
        std::process::exit(1);
    }
    #[cfg(not(unix))]
    {
        let mut cmd = std::process::Command::new("bash");
        cmd.arg(path);
        for a in args {
            cmd.arg(a);
        }
        if let Some(v) = version {
            cmd.env("SOLARIA_VERSION", v);
        }
        match cmd.status() {
            Ok(s) => std::process::exit(s.code().unwrap_or(1)),
            Err(e) => {
                eprintln!("solaria: no se pudo ejecutar el instalador: {}", e);
                std::process::exit(1);
            }
        }
    }
}

fn normalize_version(v: &str) -> String {
    let v = v.trim().trim_start_matches(['v', 'V'].as_slice());
    v.split(['-', '+']).next().unwrap_or("").to_string()
}

fn version_parts(v: &str) -> Vec<u64> {
    normalize_version(v)
        .split('.')
        .map(|p| p.parse().unwrap_or(0))
        .collect()
}

fn version_is_newer(latest: &str, current: &str) -> bool {
    let (mut l, mut c) = (version_parts(latest), version_parts(current));
    let n = l.len().max(c.len());
    l.resize(n, 0);
    c.resize(n, 0);
    l > c
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalize_strips_v_and_suffix() {
        assert_eq!(normalize_version("v0.9.1"), "0.9.1");
        assert_eq!(normalize_version("  V1.2.3-beta+1 "), "1.2.3");
        assert_eq!(normalize_version("0.9.0"), "0.9.0");
    }

    #[test]
    fn newer_compares_semver() {
        assert!(version_is_newer("0.9.1", "0.9.0"));
        assert!(!version_is_newer("0.9.0", "0.9.1"));
        assert!(!version_is_newer("0.9.0", "0.9.0"));
        assert!(version_is_newer("0.10.0", "0.9.9"));
        assert!(version_is_newer("v1.0.0", "0.9.9"));
    }
}

fn home_dir() -> std::path::PathBuf {
    std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .map(std::path::PathBuf::from)
        .unwrap_or_else(|_| std::path::PathBuf::from("."))
}

async fn run_ask(config: &CliConfig, prompt: &str) {
    let api_key = if config.provider == "ollama" {
        None
    } else {
        Some(require_api_key(&config.provider, config.api_key.as_deref()))
    };
    let messages = serde_json::json!([{"role": "user", "content": prompt}]).to_string();

    if config.provider == "ollama" {
        let result = ollama::send_chat(
            config.model.clone(),
            messages,
            None,
            Some(config.ollama_host.clone()),
        )
        .await;
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
    let api_key = if config.provider == "ollama" {
        None
    } else {
        Some(require_api_key(&config.provider, config.api_key.as_deref()))
    };

    let skills_prompt = skills::get_enabled_skills_prompt(
        Some(&config.working_dir),
        Some(&config.prompt),
        false,
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
                Some(config.ollama_host.clone()),
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

fn get_api_key(provider: &str, cli_key: Option<&str>) -> Option<String> {
    if let Some(key) = cli_key {
        return Some(key.to_string());
    }
    keyring::get_key(provider).ok()
}

fn require_api_key(provider: &str, cli_key: Option<&str>) -> String {
    match get_api_key(provider, cli_key) {
        Some(key) => key,
        None => {
            eprintln!("solaria: no se encontró API key para '{}'.", provider);
            eprintln!("  Guarda una con: solaria set-key {} <tu-api-key>", provider);
            eprintln!("  O úsala una vez con: --api-key <tu-api-key>");
            std::process::exit(1);
        }
    }
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
