use rusqlite::Connection;
use std::path::PathBuf;
use std::sync::Mutex;

/// Estado compartido de la app. `conn` es None mientras no haya una bóveda abierta.
pub struct AppState {
    pub conn: Mutex<Option<Connection>>,
    /// Carpeta de datos de la app (bases y registro de bóvedas).
    pub dir: PathBuf,
}

impl AppState {
    pub fn new(dir: PathBuf) -> Self {
        Self { conn: Mutex::new(None), dir }
    }
}
