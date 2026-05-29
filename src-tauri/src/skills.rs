use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SkillDefinition {
    pub name: String,
    pub description: String,
    pub enabled: bool,
    pub content: String,
    pub path: String,
}

fn skills_dir() -> PathBuf {
    let home = std::env::var("HOME").unwrap_or_else(|_| ".".into());
    PathBuf::from(home).join(".agents").join("skills")
}

fn settings_path() -> PathBuf {
    let home = std::env::var("HOME").unwrap_or_else(|_| ".".into());
    PathBuf::from(home).join(".solaria").join("skills_enabled.json")
}

fn load_enabled_skills() -> Vec<String> {
    let path = settings_path();
    if !path.exists() {
        return Vec::new();
    }
    fs::read_to_string(&path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

fn save_enabled_skills(names: &[String]) {
    let path = settings_path();
    if let Some(dir) = path.parent() {
        let _ = fs::create_dir_all(dir);
    }
    if let Ok(json) = serde_json::to_string(names) {
        let _ = fs::write(&path, json);
    }
}

/// Extract YAML frontmatter name/description from SKILL.md
fn parse_skill_metadata(content: &str) -> (String, String) {
    let content = content.trim();
    if !content.starts_with("---") {
        return ("unknown".into(), String::new());
    }

    let end = content[3..].find("---").map(|i| i + 3);
    let frontmatter = match end {
        Some(e) => &content[3..e],
        None => return ("unknown".into(), String::new()),
    };

    let mut name = String::new();
    let mut desc = String::new();

    for line in frontmatter.lines() {
        if let Some(val) = line.strip_prefix("name:") {
            name = val.trim().trim_matches('"').to_string();
        } else if let Some(val) = line.strip_prefix("description:") {
            desc = val.trim().trim_matches('"').to_string();
        }
    }

    (if name.is_empty() { "unknown".into() } else { name }, desc)
}

pub fn discover_skills() -> Vec<SkillDefinition> {
    let dir = skills_dir();
    if !dir.exists() {
        return Vec::new();
    }

    let enabled = load_enabled_skills();

    let mut skills = Vec::new();
    let entries = match fs::read_dir(&dir) {
        Ok(e) => e,
        Err(_) => return Vec::new(),
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }

        let skill_path = path.join("SKILL.md");
        if !skill_path.exists() {
            continue;
        }

        let content = match fs::read_to_string(&skill_path) {
            Ok(c) => c,
            Err(_) => continue,
        };

        let skill_name = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("unknown")
            .to_string();

        let (meta_name, meta_desc) = parse_skill_metadata(&content);
        let display_name = if meta_name.is_empty() || meta_name == "unknown" {
            skill_name.clone()
        } else {
            meta_name
        };

        let is_enabled = enabled.contains(&skill_name) || enabled.contains(&display_name);

        skills.push(SkillDefinition {
            name: skill_name,
            description: meta_desc,
            enabled: is_enabled,
            content,
            path: skill_path.to_string_lossy().to_string(),
        });
    }

    skills.sort_by(|a, b| a.name.cmp(&b.name));
    skills
}

pub fn get_enabled_skills_prompt() -> String {
    let skills = discover_skills();
    let enabled: Vec<_> = skills.into_iter().filter(|s| s.enabled).collect();

    if enabled.is_empty() {
        return String::new();
    }

    let mut prompt = String::from("\n\n## SKILLS ACTIVAS\n\nLas siguientes skills contienen guías y mejores prácticas que DEBES seguir:\n\n");

    for skill in &enabled {
        prompt.push_str(&format!("### SKILL: {}\n", skill.name));
        if !skill.description.is_empty() {
            prompt.push_str(&format!("_{}_\n\n", skill.description));
        }
        prompt.push_str(&skill.content);
        prompt.push('\n');
    }

    prompt
}

pub fn toggle_skill(name: &str, enabled: bool) {
    let mut list = load_enabled_skills();
    if enabled {
        if !list.contains(&name.to_string()) {
            list.push(name.to_string());
        }
    } else {
        list.retain(|n| n != name);
    }
    save_enabled_skills(&list);
}
