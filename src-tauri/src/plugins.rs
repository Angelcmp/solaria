use serde::Serialize;
use std::fs;
use std::path::PathBuf;

#[derive(Serialize)]
pub struct PluginDefinition {
    pub name: String,
    pub description: String,
    pub parameters: Vec<PluginParam>,
    pub file_path: String,
}

#[derive(Serialize)]
pub struct PluginParam {
    pub name: String,
    pub param_type: String,
    pub description: String,
    pub required: bool,
}

fn plugins_dir() -> PathBuf {
    let home = std::env::var("HOME").unwrap_or_else(|_| "~".into());
    let mut path = PathBuf::from(home);
    path.push(".solaria");
    path.push("plugins");
    path
}

fn parse_metadata(content: &str) -> (String, Vec<PluginParam>) {
    let mut description = String::new();
    let mut params = Vec::new();

    for line in content.lines() {
        if let Some(desc) = line.strip_prefix("# DESC: ") {
            description = desc.to_string();
        } else if let Some(p) = line.strip_prefix("# PARAM: ") {
            let parts: Vec<&str> = p.splitn(4, '|').collect();
            if parts.len() >= 2 {
                params.push(PluginParam {
                    name: parts[0].trim().to_string(),
                    param_type: parts.get(1).unwrap_or(&"string").trim().to_string(),
                    description: parts.get(2).unwrap_or(&"").trim().to_string(),
                    required: parts.get(3).map(|s| s.trim() == "required").unwrap_or(true),
                });
            }
        }
    }

    (description, params)
}

pub fn list_plugins() -> Vec<PluginDefinition> {
    let dir = plugins_dir();
    if !dir.exists() {
        fs::create_dir_all(&dir).ok();
        return Vec::new();
    }

    let mut plugins = Vec::new();

    if let Ok(entries) = fs::read_dir(&dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().map(|e| e == "sh").unwrap_or(false) {
                if let Some(name) = path.file_stem().and_then(|s| s.to_str()) {
                    let content = fs::read_to_string(&path).unwrap_or_default();
                    let (description, params) = parse_metadata(&content);
                    plugins.push(PluginDefinition {
                        name: name.to_string(),
                        description: if description.is_empty() {
                            format!("Plugin: {}", name)
                        } else {
                            description
                        },
                        parameters: params,
                        file_path: path.to_string_lossy().to_string(),
                    });
                }
            }
        }
    }

    plugins
}

#[derive(Serialize)]
pub struct PluginResult {
    pub success: bool,
    pub output: String,
    pub error: Option<String>,
}

pub fn execute_plugin(name: &str, args_json: &str) -> PluginResult {
    let plugins = list_plugins();
    let plugin = match plugins.iter().find(|p| p.name == name) {
        Some(p) => p,
        None => return PluginResult {
            success: false,
            output: String::new(),
            error: Some(format!("Plugin '{}' no encontrado", name)),
        },
    };

    let output = std::process::Command::new("sh")
        .arg(&plugin.file_path)
        .arg(args_json)
        .output();

    match output {
        Ok(out) => {
            let stdout = String::from_utf8_lossy(&out.stdout).to_string();
            let stderr = String::from_utf8_lossy(&out.stderr).to_string();
            let err_clone = stderr.clone();
            PluginResult {
                success: out.status.success(),
                output: if stdout.is_empty() { stderr } else { stdout },
                error: if out.status.success() { None } else { Some(err_clone) },
            }
        }
        Err(e) => PluginResult {
            success: false,
            output: String::new(),
            error: Some(format!("Error ejecutando plugin: {}", e)),
        },
    }
}
