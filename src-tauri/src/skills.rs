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
    pub source: String, // "global" or "project"
}

fn global_skills_dir() -> PathBuf {
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

fn discover_from_dir(dir: &PathBuf, source: &str, force_enabled: bool) -> Vec<SkillDefinition> {
    if !dir.exists() {
        return Vec::new();
    }

    let enabled = load_enabled_skills();

    let mut skills = Vec::new();
    let entries = match fs::read_dir(dir) {
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

        let is_enabled = if force_enabled {
            true
        } else {
            enabled.contains(&skill_name) || enabled.contains(&display_name)
        };

        skills.push(SkillDefinition {
            name: skill_name,
            description: meta_desc,
            enabled: is_enabled,
            content,
            path: skill_path.to_string_lossy().to_string(),
            source: source.to_string(),
        });
    }

    skills.sort_by(|a, b| a.name.cmp(&b.name));
    skills
}

pub fn discover_skills() -> Vec<SkillDefinition> {
    discover_from_dir(&global_skills_dir(), "global", false)
}

pub fn discover_project_skills(working_dir: &str) -> Vec<SkillDefinition> {
    let dir = PathBuf::from(working_dir).join(".solaria").join("skills");
    discover_from_dir(&dir, "project", false)
}

pub fn discover_all_skills(working_dir: Option<&str>) -> Vec<SkillDefinition> {
    let global = discover_skills();
    let project = if let Some(wd) = working_dir {
        discover_project_skills(wd)
    } else {
        Vec::new()
    };

    if project.is_empty() {
        return global;
    }

    let mut result = project;
    for skill in global {
        if !result.iter().any(|s| s.name == skill.name) {
            result.push(skill);
        }
    }

    result.sort_by(|a, b| a.name.cmp(&b.name));
    result
}

fn skill_relevant(skill: &SkillDefinition, query: &str) -> bool {
    let query_lower = query.to_lowercase();
    let query_words: Vec<&str> = query_lower.split_whitespace().collect();
    let haystack = format!("{} {} {} {}", skill.name, skill.description, skill.name.replace('-', " "), skill.description.to_lowercase());
    let haystack_lower = haystack.to_lowercase();

    query_words.iter().any(|word| {
        word.len() > 2 && (haystack_lower.contains(word) || skill.name.contains(word))
    })
}

pub fn get_enabled_skills_prompt(working_dir: Option<&str>, query: Option<&str>) -> String {
    let all = discover_all_skills(working_dir);
    let enabled: Vec<_> = all.into_iter()
        .filter(|s| s.enabled)
        .filter(|s| {
            if let Some(q) = query {
                if q.trim().is_empty() { return true; }
                skill_relevant(s, q)
            } else {
                true
            }
        })
        .collect();

    if enabled.is_empty() {
        return String::new();
    }

    let global_count = enabled.iter().filter(|s| s.source == "global").count();
    let project_count = enabled.iter().filter(|s| s.source == "project").count();

    let mut prompt = String::from("\n\n## SKILLS ACTIVAS\n\n");

    if project_count > 0 {
        prompt.push_str(&format!("Skills del proyecto ({}):\n\n", project_count));
        for skill in &enabled {
            if skill.source != "project" { continue; }
            prompt.push_str(&format!("### SKILL: {}\n", skill.name));
            if !skill.description.is_empty() {
                prompt.push_str(&format!("_{}_\n\n", skill.description));
            }
            prompt.push_str(&skill.content);
            prompt.push('\n');
        }
    }

    if global_count > 0 {
        if project_count > 0 {
            prompt.push_str("---\n\n");
        }
        prompt.push_str(&format!("Skills globales ({}):\n\n", global_count));
        for skill in &enabled {
            if skill.source != "global" { continue; }
            prompt.push_str(&format!("### SKILL: {}\n", skill.name));
            if !skill.description.is_empty() {
                prompt.push_str(&format!("_{}_\n\n", skill.description));
            }
            prompt.push_str(&skill.content);
            prompt.push('\n');
        }
    }

    prompt
}

pub fn create_project_skill(working_dir: &str, name: &str, description: &str, body: &str) -> Result<String, String> {
    let slug = name.to_lowercase().replace(' ', "-");
    let dir = PathBuf::from(working_dir).join(".solaria").join("skills").join(&slug);

    fs::create_dir_all(&dir).map_err(|e| format!("Error creando directorio: {}", e))?;

    let skill_path = dir.join("SKILL.md");

    let frontmatter = format!(
        "---\nname: {}\ndescription: {}\n---\n\n{}",
        name, description, body
    );

    fs::write(&skill_path, &frontmatter)
        .map_err(|e| format!("Error escribiendo SKILL.md: {}", e))?;

    Ok(skill_path.to_string_lossy().to_string())
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
