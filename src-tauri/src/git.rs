use serde::{Deserialize, Serialize};
use tokio::process::Command;

#[derive(Serialize, Deserialize, Clone)]
pub struct GitStatus {
    pub branch: String,
    pub ahead: i32,
    pub behind: i32,
    pub staged: Vec<GitFile>,
    pub unstaged: Vec<GitFile>,
    pub untracked: Vec<String>,
    pub has_conflicts: bool,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct GitFile {
    pub path: String,
    pub status: String,
}

#[derive(Serialize, Deserialize)]
pub struct GitLogEntry {
    pub hash: String,
    pub author: String,
    pub date: String,
    pub message: String,
}

#[derive(Serialize, Deserialize)]
pub struct GitBranch {
    pub name: String,
    pub current: bool,
}

async fn run_git(working_dir: &str, args: &[&str]) -> Result<String, String> {
    let output = Command::new("git")
        .args(args)
        .current_dir(working_dir)
        .output()
        .await
        .map_err(|e| format!("Error ejecutando git: {}", e))?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        Err(stderr)
    }
}

pub async fn git_status(working_dir: &str) -> Result<GitStatus, String> {
    let branch = run_git(working_dir, &["rev-parse", "--abbrev-ref", "HEAD"]).await?;

    let ahead_behind = run_git(working_dir, &["rev-list", "--left-right", "--count", "HEAD...@{upstream}"]).await;
    let (ahead, behind) = match ahead_behind {
        Ok(s) => {
            let parts: Vec<&str> = s.split_whitespace().collect();
            let a = parts.first().and_then(|x| x.parse().ok()).unwrap_or(0);
            let b = parts.get(1).and_then(|x| x.parse().ok()).unwrap_or(0);
            (a, b)
        }
        Err(_) => (0, 0),
    };

    let staged_raw = run_git(working_dir, &["diff", "--cached", "--name-status"]).await.unwrap_or_default();
    let unstaged_raw = run_git(working_dir, &["diff", "--name-status"]).await.unwrap_or_default();
    let untracked_raw = run_git(working_dir, &["ls-files", "--others", "--exclude-standard"]).await.unwrap_or_default();

    let parse_files = |s: &str| -> Vec<GitFile> {
        s.lines().filter_map(|l| {
            let mut parts = l.splitn(2, '\t');
            Some(GitFile {
                status: parts.next()?.to_string(),
                path: parts.next()?.to_string(),
            })
        }).collect()
    };

    let has_conflicts = run_git(working_dir, &["diff", "--name-only", "--diff-filter=U"]).await
        .map(|s| !s.trim().is_empty())
        .unwrap_or(false);

    Ok(GitStatus {
        branch,
        ahead,
        behind,
        staged: parse_files(&staged_raw),
        unstaged: parse_files(&unstaged_raw),
        untracked: untracked_raw.lines().map(String::from).collect(),
        has_conflicts,
    })
}

pub async fn git_log(working_dir: &str, max_count: u32) -> Result<Vec<GitLogEntry>, String> {
    let format = "%H|%an|%ai|%s";
    let raw = run_git(working_dir, &[
        "log", "--oneline", "--format", format,
        &format!("-{}", max_count),
    ]).await?;

    Ok(raw.lines().filter_map(|l| {
        let parts: Vec<&str> = l.splitn(4, '|').collect();
        if parts.len() < 4 { return None }
        Some(GitLogEntry {
            hash: parts[0].to_string(),
            author: parts[1].to_string(),
            date: parts[2].to_string(),
            message: parts[3].to_string(),
        })
    }).collect())
}

pub async fn git_branches(working_dir: &str) -> Result<Vec<GitBranch>, String> {
    let raw = run_git(working_dir, &["branch"]).await?;
    Ok(raw.lines().map(|l| GitBranch {
        name: l.trim_start_matches("* ").trim().to_string(),
        current: l.starts_with('*'),
    }).collect())
}

pub async fn git_add(working_dir: &str, files: &str) -> Result<String, String> {
    run_git(working_dir, &["add", "--", files]).await
}

pub async fn git_commit(working_dir: &str, message: &str) -> Result<String, String> {
    run_git(working_dir, &["commit", "-m", message]).await
}

pub async fn git_push(working_dir: &str, branch: &str) -> Result<String, String> {
    let args: &[&str] = if branch.is_empty() {
        &["push"]
    } else {
        &["push", "--set-upstream", "origin", branch]
    };
    run_git(working_dir, args).await
}

pub async fn git_checkout(working_dir: &str, branch: &str, create: bool) -> Result<String, String> {
    if create {
        run_git(working_dir, &["checkout", "-b", branch]).await
    } else {
        run_git(working_dir, &["checkout", branch]).await
    }
}

pub async fn git_diff(working_dir: &str, staged: bool, path: &str) -> Result<String, String> {
    if path.is_empty() {
        if staged {
            run_git(working_dir, &["diff", "--cached"]).await
        } else {
            run_git(working_dir, &["diff"]).await
        }
    } else {
        if staged {
            run_git(working_dir, &["diff", "--cached", "--", path]).await
        } else {
            run_git(working_dir, &["diff", "--", path]).await
        }
    }
}

pub fn get_git_tool_definitions() -> Vec<crate::tools::ToolDefinition> {
    vec![
        crate::tools::ToolDefinition {
            name: "git_status".into(),
            description: "Muestra el estado actual del repositorio git: rama, cambios staged, unstaged, untracked y conflictos.".into(),
            parameters: vec![],
        },
        crate::tools::ToolDefinition {
            name: "git_log".into(),
            description: "Muestra los últimos commits del repositorio.".into(),
            parameters: vec![crate::tools::ToolParam {
                name: "max_count".into(),
                param_type: "number".into(),
                description: "Número de commits a mostrar (default: 10)".into(),
                required: false,
            }],
        },
        crate::tools::ToolDefinition {
            name: "git_branches".into(),
            description: "Lista las ramas locales del repositorio.".into(),
            parameters: vec![],
        },
        crate::tools::ToolDefinition {
            name: "git_add".into(),
            description: "Añade archivos al staging area para ser commiteados.".into(),
            parameters: vec![crate::tools::ToolParam {
                name: "files".into(),
                param_type: "string".into(),
                description: "Patrón de archivos a añadir (ej: src/main.ts, .)".into(),
                required: true,
            }],
        },
        crate::tools::ToolDefinition {
            name: "git_commit".into(),
            description: "Crea un commit con los archivos en staging.".into(),
            parameters: vec![crate::tools::ToolParam {
                name: "message".into(),
                param_type: "string".into(),
                description: "Mensaje descriptivo del commit".into(),
                required: true,
            }],
        },
        crate::tools::ToolDefinition {
            name: "git_push".into(),
            description: "Sube commits al repositorio remoto.".into(),
            parameters: vec![crate::tools::ToolParam {
                name: "branch".into(),
                param_type: "string".into(),
                description: "Rama a pushear (opcional si ya tiene upstream)".into(),
                required: false,
            }],
        },
        crate::tools::ToolDefinition {
            name: "git_checkout".into(),
            description: "Cambia a otra rama existente o crea una nueva.".into(),
            parameters: vec![
                crate::tools::ToolParam {
                    name: "branch".into(),
                    param_type: "string".into(),
                    description: "Nombre de la rama destino".into(),
                    required: true,
                },
                crate::tools::ToolParam {
                    name: "create".into(),
                    param_type: "boolean".into(),
                    description: "Crear la rama si no existe (default: false)".into(),
                    required: false,
                },
            ],
        },
        crate::tools::ToolDefinition {
            name: "git_diff".into(),
            description: "Muestra las diferencias del working tree o del staging.".into(),
            parameters: vec![
                crate::tools::ToolParam {
                    name: "staged".into(),
                    param_type: "boolean".into(),
                    description: "Mostrar diff del staging area (default: false)".into(),
                    required: false,
                },
                crate::tools::ToolParam {
                    name: "path".into(),
                    param_type: "string".into(),
                    description: "Ruta específica del archivo a diff (opcional)".into(),
                    required: false,
                },
            ],
        },
    ]
}
