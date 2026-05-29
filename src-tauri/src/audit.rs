use serde::Serialize;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::PathBuf;
use std::time::SystemTime;

#[derive(Serialize)]
pub struct AuditEntry {
    pub timestamp: String,
    pub tool: String,
    pub args: String,
    pub success: bool,
    pub error: Option<String>,
    pub working_dir: Option<String>,
}

fn log_dir() -> PathBuf {
    let home = std::env::var("HOME").unwrap_or_else(|_| ".".into());
    PathBuf::from(home).join(".solaria")
}

fn log_path() -> PathBuf {
    log_dir().join("audit.log")
}

fn timestamp() -> String {
    let now = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .unwrap_or_default();
    let secs = now.as_secs();

    let days = secs / 86400;
    let time_secs = secs % 86400;
    let hours = time_secs / 3600;
    let minutes = (time_secs % 3600) / 60;
    let seconds = time_secs % 60;

    // Simple date from days since epoch (1970-01-01)
    let _year = 1970f64;
    let mut remaining = days as i64;

    let mut y = 1970i64;
    loop {
        let days_in_year = if is_leap(y) { 366 } else { 365 };
        if remaining < days_in_year {
            break;
        }
        remaining -= days_in_year;
        y += 1;
    }

    let months_days: &[i64] = if is_leap(y) {
        &[31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    } else {
        &[31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    };

    let mut m = 1u32;
    for &md in months_days {
        if remaining < md {
            break;
        }
        remaining -= md;
        m += 1;
    }

    format!(
        "{:04}-{:02}-{:02} {:02}:{:02}:{:02}",
        y, m, remaining + 1, hours, minutes, seconds
    )
}

fn is_leap(y: i64) -> bool {
    (y % 4 == 0 && y % 100 != 0) || y % 400 == 0
}

fn truncate_args(args: &str) -> String {
    if args.len() > 120 {
        format!("{}...", &args[..117])
    } else {
        args.to_string()
    }
}

pub fn log_execution(
    tool: &str,
    args: &str,
    success: bool,
    error: Option<&str>,
    working_dir: Option<&str>,
) {
    let dir = log_dir();
    let path = log_path();

    if !dir.exists() {
        let _ = fs::create_dir_all(&dir);
    }

    let ts = timestamp();
    let args_short = truncate_args(args);
    let status = if success { "OK" } else { "FAIL" };
    let err = error.unwrap_or("");
    let wd = working_dir.unwrap_or("");

    let line = format!(
        "[{}] {} | {} | {} | {} | {}\n",
        ts, tool, args_short, status, err, wd
    );

    let _ = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
        .map(|mut f| f.write_all(line.as_bytes()));
}

#[derive(Serialize)]
pub struct AuditLogResult {
    pub entries: Vec<AuditEntry>,
    pub total_lines: u32,
}

pub fn read_log(max_lines: u32) -> AuditLogResult {
    let path = log_path();
    if !path.exists() {
        return AuditLogResult {
            entries: vec![],
            total_lines: 0,
        };
    }

    let content = match fs::read_to_string(&path) {
        Ok(c) => c,
        Err(_) => return AuditLogResult {
            entries: vec![],
            total_lines: 0,
        },
    };

    let all_lines: Vec<&str> = content.lines().collect();
    let total = all_lines.len() as u32;

    let start = if total > max_lines { total - max_lines } else { 0 };
    let entries: Vec<AuditEntry> = all_lines[start as usize..]
        .iter()
        .filter_map(|line| parse_line(line))
        .collect();

    AuditLogResult { entries, total_lines: total }
}

fn parse_line(line: &str) -> Option<AuditEntry> {
    // Format: [timestamp] tool | args | OK/FAIL | error | working_dir
    let line = line.trim();
    if line.is_empty() || !line.starts_with('[') {
        return None;
    }

    let close_bracket = line.find(']')?;
    let timestamp = line[1..close_bracket].to_string();
    let rest = line[close_bracket + 1..].trim_start();

    let parts: Vec<&str> = rest.split(" | ").collect();
    if parts.len() < 4 {
        return None;
    }

    Some(AuditEntry {
        timestamp,
        tool: parts[0].to_string(),
        args: parts[1].to_string(),
        success: parts[2] == "OK",
        error: if parts[3].is_empty() { None } else { Some(parts[3].to_string()) },
        working_dir: parts.get(4).filter(|s| !s.is_empty()).map(|s| s.to_string()),
    })
}

pub fn clear_log() -> Result<(), String> {
    let path = log_path();
    if path.exists() {
        fs::write(&path, "").map_err(|e| e.to_string())
    } else {
        Ok(())
    }
}

// ── MCP settings persistence ─────────────────────────────────────────────────

fn mcp_settings_path() -> PathBuf {
    log_dir().join("mcp_servers.json")
}

pub fn load_mcp_settings() -> Result<Vec<crate::mcp::McpServerConfig>, String> {
    let path = mcp_settings_path();
    if !path.exists() {
        return Ok(default_mcp_servers());
    }
    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    if content.trim().is_empty() {
        return Ok(default_mcp_servers());
    }
    serde_json::from_str(&content).map_err(|e| e.to_string())
}

pub fn save_mcp_settings(servers: &[crate::mcp::McpServerConfig]) -> Result<(), String> {
    let dir = log_dir();
    if !dir.exists() {
        fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    }
    let json = serde_json::to_string_pretty(servers).map_err(|e| e.to_string())?;
    fs::write(mcp_settings_path(), json).map_err(|e| e.to_string())
}

fn default_mcp_servers() -> Vec<crate::mcp::McpServerConfig> {
    vec![
        crate::mcp::McpServerConfig {
            name: "GitHub".into(),
            command: "npx".into(),
            args: vec!["-y".into(), "@modelcontextprotocol/server-github".into()],
            enabled: false,
        },
        crate::mcp::McpServerConfig {
            name: "Filesystem".into(),
            command: "npx".into(),
            args: vec!["-y".into(), "@modelcontextprotocol/server-filesystem".into(), "/".into()],
            enabled: false,
        },
    ]
}
