use rusqlite::{params, Connection, Result as SqliteResult};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;
use zerocopy::AsBytes;

const DEFAULT_DIM: usize = 768;

pub struct MemoryStore {
    conn: Mutex<Connection>,
    dim: Mutex<usize>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MemoryChunk {
    pub id: i64,
    pub source: String,
    pub source_id: String,
    pub text: String,
    pub metadata: Option<String>,
    pub created_at: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SearchResult {
    pub chunk: MemoryChunk,
    pub distance: f32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MemoryStats {
    pub total_chunks: i64,
    pub total_conversations: i64,
    pub total_project_files: i64,
    pub db_path: String,
    pub dim: usize,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchFilters {
    pub sources: Option<Vec<String>>,
    pub max_age_days: Option<f64>,
}

fn memory_path() -> PathBuf {
    let home = std::env::var("HOME").unwrap_or_else(|_| ".".into());
    PathBuf::from(home).join(".solaria").join("memory.db")
}

impl MemoryStore {
    pub fn open() -> SqliteResult<Self> {
        let path = memory_path();
        if let Some(parent) = path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        let conn = Connection::open(&path)?;
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS config (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS chunks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                source TEXT NOT NULL,
                source_id TEXT NOT NULL,
                text TEXT NOT NULL,
                metadata TEXT,
                created_at INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_chunks_source ON chunks(source, source_id);
            CREATE INDEX IF NOT EXISTS idx_chunks_created ON chunks(created_at DESC);",
        )?;

        let dim: usize = conn
            .query_row(
                "SELECT value FROM config WHERE key = 'dim'",
                [],
                |row| row.get::<_, String>(0),
            )
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(DEFAULT_DIM);

        conn.execute_batch(&format!(
            "CREATE VIRTUAL TABLE IF NOT EXISTS vec_chunks USING vec0(
                id INTEGER PRIMARY KEY,
                embedding float[{}]
            );",
            dim
        ))?;

        Ok(Self {
            conn: Mutex::new(conn),
            dim: Mutex::new(dim),
        })
    }

    pub fn dim(&self) -> usize {
        *self.dim.lock().unwrap()
    }

    pub fn ensure_dim(&self, new_dim: usize) -> SqliteResult<()> {
        let mut dim = self.dim.lock().unwrap();
        if new_dim == *dim {
            return Ok(());
        }
        let conn = self.conn.lock().unwrap();
        conn.execute("DROP TABLE IF EXISTS vec_chunks", [])?;
        conn.execute_batch(&format!(
            "CREATE VIRTUAL TABLE vec_chunks USING vec0(
                id INTEGER PRIMARY KEY,
                embedding float[{}]
            );",
            new_dim
        ))?;
        conn.execute(
            "INSERT OR REPLACE INTO config (key, value) VALUES ('dim', ?)",
            params![new_dim.to_string()],
        )?;
        *dim = new_dim;
        Ok(())
    }

    pub fn path(&self) -> String {
        memory_path().to_string_lossy().to_string()
    }

    pub fn insert_chunk(
        &self,
        source: &str,
        source_id: &str,
        text: &str,
        embedding: &[f32],
        metadata: Option<&str>,
    ) -> SqliteResult<i64> {
        let dim = *self.dim.lock().unwrap();
        if embedding.len() != dim {
            return Err(rusqlite::Error::ToSqlConversionFailure(Box::new(
                std::io::Error::new(std::io::ErrorKind::InvalidData, "dim mismatch"),
            )));
        }
        let conn = self.conn.lock().unwrap();
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs() as i64;
        conn.execute(
            "INSERT INTO chunks (source, source_id, text, metadata, created_at) VALUES (?, ?, ?, ?, ?)",
            params![source, source_id, text, metadata, now],
        )?;
        let id = conn.last_insert_rowid();
        conn.execute(
            "INSERT INTO vec_chunks (id, embedding) VALUES (vec_int(?), ?)",
            params![id, embedding.as_bytes()],
        )?;
        Ok(id)
    }

    pub fn search(
        &self,
        query_embedding: &[f32],
        top_k: usize,
        filters: Option<&SearchFilters>,
    ) -> SqliteResult<Vec<SearchResult>> {
        let dim = *self.dim.lock().unwrap();
        if query_embedding.len() != dim {
            return Err(rusqlite::Error::ToSqlConversionFailure(Box::new(
                std::io::Error::new(std::io::ErrorKind::InvalidData, "dim mismatch"),
            )));
        }

        let where_clause = build_filter_clause(filters);
        let sql = format!(
            "SELECT v.id, v.distance, c.source, c.source_id, c.text, c.metadata, c.created_at
             FROM vec_chunks v
             JOIN chunks c ON c.id = v.id
             WHERE v.embedding MATCH vec_f32(?)
             {}
             ORDER BY v.distance
             LIMIT ?",
            where_clause
        );

        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(&sql)?;

        let mut param_idx = 1;
        if let Some(f) = filters {
            if let Some(ref sources) = f.sources {
                for s in sources {
                    stmt.raw_bind_parameter(param_idx, s)?;
                    param_idx += 1;
                }
            }
            if let Some(max_days) = f.max_age_days {
                let cutoff = (std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs() as f64
                    - max_days * 86400.0) as i64;
                stmt.raw_bind_parameter(param_idx, cutoff)?;
            }
        }

        let rows = stmt.query_map(
            params![query_embedding.as_bytes(), top_k as i64],
            |row| {
                let id: i64 = row.get(0)?;
                let distance: f32 = row.get(1)?;
                let source: String = row.get(2)?;
                let source_id: String = row.get(3)?;
                let text: String = row.get(4)?;
                let metadata: Option<String> = row.get(5)?;
                let created_at: i64 = row.get(6)?;
                Ok(SearchResult {
                    chunk: MemoryChunk {
                        id,
                        source,
                        source_id,
                        text,
                        metadata,
                        created_at,
                    },
                    distance,
                })
            },
        )?;
        rows.collect()
    }

    pub fn delete_by_source(&self, source: &str, source_id: &str) -> SqliteResult<usize> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT id FROM chunks WHERE source = ? AND source_id = ?")?;
        let ids: Vec<i64> = stmt
            .query_map(params![source, source_id], |r| r.get::<_, i64>(0))?
            .filter_map(|r| r.ok())
            .collect();
        for id in &ids {
            conn.execute("DELETE FROM vec_chunks WHERE id = vec_int(?)", params![id])?;
        }
        let deleted = conn.execute(
            "DELETE FROM chunks WHERE source = ? AND source_id = ?",
            params![source, source_id],
        )?;
        Ok(deleted)
    }

    pub fn clear(&self) -> SqliteResult<usize> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM vec_chunks", [])?;
        let deleted = conn.execute("DELETE FROM chunks", [])?;
        Ok(deleted)
    }

    pub fn stats(&self) -> SqliteResult<MemoryStats> {
        let conn = self.conn.lock().unwrap();
        let total: i64 = conn.query_row("SELECT COUNT(*) FROM chunks", [], |r| r.get(0))?;
        let conv: i64 = conn.query_row(
            "SELECT COUNT(DISTINCT source_id) FROM chunks WHERE source = 'conversation'",
            [],
            |r| r.get(0),
        )?;
        let files: i64 = conn.query_row(
            "SELECT COUNT(DISTINCT source_id) FROM chunks WHERE source = 'file'",
            [],
            |r| r.get(0),
        )?;
        let dim = *self.dim.lock().unwrap();
        Ok(MemoryStats {
            total_chunks: total,
            total_conversations: conv,
            total_project_files: files,
            db_path: self.path(),
            dim,
        })
    }
}

fn build_filter_clause(filters: Option<&SearchFilters>) -> String {
    let Some(f) = filters else {
        return String::new();
    };
    let mut clauses: Vec<String> = Vec::new();
    if let Some(ref sources) = f.sources {
        if !sources.is_empty() {
            let placeholders: Vec<String> = sources.iter().map(|_| "?".to_string()).collect();
            clauses.push(format!("c.source IN ({})", placeholders.join(",")));
        }
    }
    if f.max_age_days.is_some() {
        clauses.push("c.created_at >= ?".to_string());
    }
    if clauses.is_empty() {
        String::new()
    } else {
        format!("AND {}", clauses.join(" AND "))
    }
}

use std::sync::OnceLock;

static STORE: OnceLock<MemoryStore> = OnceLock::new();

pub fn store() -> &'static MemoryStore {
    STORE.get_or_init(|| MemoryStore::open().expect("failed to open memory store"))
}
