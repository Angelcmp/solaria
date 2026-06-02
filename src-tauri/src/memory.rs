use rusqlite::{params, Connection, Result as SqliteResult};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;
use zerocopy::AsBytes;

const DEFAULT_DIM: usize = 768;

pub struct MemoryStore {
    conn: Mutex<Connection>,
    dim: usize,
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
            "CREATE TABLE IF NOT EXISTS chunks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                source TEXT NOT NULL,
                source_id TEXT NOT NULL,
                text TEXT NOT NULL,
                metadata TEXT,
                created_at INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_chunks_source ON chunks(source, source_id);
            CREATE INDEX IF NOT EXISTS idx_chunks_created ON chunks(created_at DESC);
            CREATE VIRTUAL TABLE IF NOT EXISTS vec_chunks USING vec0(
                id INTEGER PRIMARY KEY,
                embedding float[768]
            );",
        )?;
        Ok(Self {
            conn: Mutex::new(conn),
            dim: DEFAULT_DIM,
        })
    }

    pub fn dim(&self) -> usize {
        self.dim
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
        if embedding.len() != self.dim {
            return Err(rusqlite::Error::InvalidQuery);
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

    pub fn search(&self, query_embedding: &[f32], top_k: usize) -> SqliteResult<Vec<SearchResult>> {
        if query_embedding.len() != self.dim {
            return Err(rusqlite::Error::InvalidQuery);
        }
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT v.id, v.distance, c.source, c.source_id, c.text, c.metadata, c.created_at
             FROM vec_chunks v
             JOIN chunks c ON c.id = v.id
             WHERE v.embedding MATCH vec_f32(?)
             ORDER BY v.distance
             LIMIT ?",
        )?;
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
        Ok(MemoryStats {
            total_chunks: total,
            total_conversations: conv,
            total_project_files: files,
            db_path: self.path(),
            dim: self.dim,
        })
    }
}

use std::sync::OnceLock;

static STORE: OnceLock<MemoryStore> = OnceLock::new();

pub fn store() -> &'static MemoryStore {
    STORE.get_or_init(|| MemoryStore::open().expect("failed to open memory store"))
}
