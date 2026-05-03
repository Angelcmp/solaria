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
    "rm -rf $HOME",
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

    match name {
        "shell" => shell_execute(args, confirmed, use_allowlist, &command_allowlist).await,
        "read_file" => read_file_execute(args, &working_dir, confirmed, restrict_to_workdir).await,
        "write_file" => write_file_execute(args, &working_dir, confirmed, restrict_to_workdir).await,
        "glob" => glob_execute(args).await,
        "grep" => grep_execute(args).await,
        _ => ToolResult {
            success: false,
            output: String::new(),
            error: Some(format!("Herramienta '{}' no encontrada", name)),
            requires_confirmation: false,
            preview: None,
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
    use std::process::Command;

    let parsed: Result<serde_json::Value, _> = serde_json::from_str(args);
    let pattern = match parsed {
        Ok(ref v) => v["pattern"].as_str().unwrap_or(args),
        Err(_) => args,
    };

    let output = Command::new("sh")
        .arg("-c")
        .arg(format!("find . -path '{}' 2>/dev/null | head -200", pattern.replace('\'', "'\\''")))
        .output();

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
    use std::process::Command;

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

    let output = std::process::Command::new("sh")
        .arg("-c")
        .arg(format!("rg -n '{}' '{}' 2>/dev/null | head -200", pattern.replace('\'', "'\\''"), path))
        .output();

    match output {
        Ok(out) => {
            let stdout = String::from_utf8_lossy(&out.stdout).to_string();
            if stdout.is_empty() {
                let fallback = std::process::Command::new("sh")
                    .arg("-c")
                    .arg(format!("grep -rn '{}' '{}' 2>/dev/null | head -200", pattern.replace('\'', "'\\''"), path))
                    .output();
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
