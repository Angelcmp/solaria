use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct CommandDefinition {
    pub command: String,
    pub title: String,
    pub description: String,
    pub argument_hint: String,
    pub agent: bool,
    pub prompt: String,
    pub path: String,
    pub source: String, // "global" or "project"
}

fn global_commands_dir() -> PathBuf {
    let home = std::env::var("HOME").unwrap_or_else(|_| ".".into());
    PathBuf::from(home).join(".solaria").join("commands")
}

fn project_commands_dir(working_dir: &str) -> PathBuf {
    PathBuf::from(working_dir).join(".solaria").join("commands")
}

struct RawCommand {
    command: String,
    description: String,
    argument_hint: String,
    agent: bool,
    body: String,
}

fn parse_command_markdown(content: &str) -> Option<RawCommand> {
    let content = content.trim();
    if !content.starts_with("---") {
        return None;
    }

    let end = content[3..].find("---").map(|i| i + 3)?;
    let frontmatter = &content[3..end];
    let body = content[end..].trim().to_string();
    if body.is_empty() {
        return None;
    }

    let mut command = String::new();
    let mut description = String::new();
    let mut argument_hint = String::new();
    let mut agent = false;

    for line in frontmatter.lines() {
        if let Some(val) = line.strip_prefix("command:") {
            command = val.trim().trim_matches('"').to_string();
        } else if let Some(val) = line.strip_prefix("description:") {
            description = val.trim().trim_matches('"').to_string();
        } else if let Some(val) = line.strip_prefix("argument-hint:") {
            argument_hint = val.trim().trim_matches('"').to_string();
        } else if let Some(val) = line.strip_prefix("agent:") {
            agent = val.trim() == "true";
        }
    }

    if command.is_empty() {
        return None;
    }

    Some(RawCommand {
        command,
        description,
        argument_hint,
        agent,
        body,
    })
}

fn discover_from_dir(dir: &PathBuf, source: &str) -> Vec<CommandDefinition> {
    if !dir.exists() {
        return Vec::new();
    }

    let mut commands = Vec::new();
    let entries = match fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return Vec::new(),
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        if !path.extension().map(|e| e == "md").unwrap_or(false) {
            continue;
        }

        let content = match fs::read_to_string(&path) {
            Ok(c) => c,
            Err(_) => continue,
        };

        let raw = match parse_command_markdown(&content) {
            Some(r) => r,
            None => continue,
        };

        let title = path
            .file_stem()
            .and_then(|n| n.to_str())
            .unwrap_or(&raw.command)
            .to_string()
            .replace('-', " ");

        commands.push(CommandDefinition {
            command: raw.command,
            title,
            description: raw.description,
            argument_hint: raw.argument_hint,
            agent: raw.agent,
            prompt: raw.body,
            path: path.to_string_lossy().to_string(),
            source: source.to_string(),
        });
    }

    commands.sort_by(|a, b| a.command.cmp(&b.command));
    commands
}

pub fn list_commands(working_dir: Option<&str>) -> Vec<CommandDefinition> {
    let global = discover_from_dir(&global_commands_dir(), "global");
    let project = working_dir
        .map(|wd| discover_from_dir(&project_commands_dir(wd), "project"))
        .unwrap_or_default();

    if project.is_empty() {
        return global;
    }

    let mut result = project;
    for cmd in global {
        if !result.iter().any(|c| c.command == cmd.command) {
            result.push(cmd);
        }
    }

    result.sort_by(|a, b| a.command.cmp(&b.command));
    result
}
