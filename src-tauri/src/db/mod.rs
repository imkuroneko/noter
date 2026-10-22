//! Capa de base de datos de Noter: apertura cifrada (SQLCipher), PRAGMAs y migraciones.
//! Solo infraestructura y validacion del esquema; los repos y comandos Tauri los implementa otra persona.
#![allow(dead_code)]

use rusqlite::Connection;
use std::path::Path;
use std::time::Duration;

/// Migraciones embebidas, en orden. El indice + 1 es el valor de PRAGMA user_version tras aplicarla.
/// Para agregar una: nuevo archivo NNNN_nombre.sql (+ su .down.sql de referencia) y una linea aqui. Nunca editar una ya publicada.
const MIGRATIONS: &[&str] = &[include_str!("migrations/0001_init.sql")];

/// Versión del esquema que entiende esta app (cantidad de migraciones).
pub const SCHEMA_VERSION: usize = MIGRATIONS.len();

const QUERIES: &str = include_str!("queries.sql");

/// Devuelve el SQL del bloque `-- name: <name>` de queries.sql.
pub fn sql(name: &str) -> &'static str {
    let marker = format!("-- name: {name}");
    let start = QUERIES
        .lines()
        .position(|l| l.trim_end() == marker)
        .unwrap_or_else(|| panic!("consulta '{name}' no existe en queries.sql"));
    let mut begin = 0usize;
    for (i, l) in QUERIES.split_inclusive('\n').enumerate() {
        if i == start + 1 {
            break;
        }
        begin += l.len();
    }
    let rest = &QUERIES[begin..];
    let end = rest.find("\n-- name: ").map(|p| p + 1).unwrap_or(rest.len());
    rest[..end].trim()
}

/// Arma una expresion MATCH segura para FTS5 a partir de texto libre: cada palabra entre comillas
/// y con prefijo (`"canc"*`), unidas por AND implicito. None si no queda ninguna palabra.
pub fn fts_match(input: &str) -> Option<String> {
    let terms: Vec<String> = input
        .split_whitespace()
        .map(|w| w.replace('"', ""))
        // Una palabra solo de signos ("-", "(") tokeniza a nada y anularia todo el AND: se descarta.
        .filter(|w| w.chars().any(|c| c.is_alphanumeric()))
        .map(|w| format!("\"{w}\"*"))
        .collect();
    if terms.is_empty() { None } else { Some(terms.join(" ")) }
}

/// Abre (o crea) la boveda cifrada, aplica PRAGMAs y migra. Clave incorrecta => Err.
pub fn open(path: &Path, passphrase: &str) -> rusqlite::Result<Connection> {
    let mut conn = Connection::open(path)?;
    // La clave debe ser lo primero que se ejecuta en la conexion.
    // Clave vacia = base sin cifrar (solo fase 1 de desarrollo; SQLCipher rechaza PRAGMA key vacio).
    if !passphrase.is_empty() {
        conn.pragma_update(None, "key", passphrase)?;
    }
    // Verifica la clave: con clave incorrecta esta lectura falla ("file is not a database").
    conn.query_row("SELECT count(*) FROM sqlite_master", [], |r| r.get::<_, i64>(0))?;
    conn.busy_timeout(Duration::from_millis(5000))?;
    conn.pragma_update(None, "foreign_keys", "ON")?;
    let mode: String = conn.pragma_update_and_check(None, "journal_mode", "WAL", |r| r.get(0))?;
    if !mode.eq_ignore_ascii_case("wal") {
        return Err(rusqlite::Error::SqliteFailure(
            rusqlite::ffi::Error::new(rusqlite::ffi::SQLITE_MISUSE),
            Some(format!("journal_mode WAL no activado (queda en '{mode}')")),
        ));
    }
    conn.pragma_update(None, "synchronous", "NORMAL")?;
    migrate(&mut conn)?;
    Ok(conn)
}

/// Aplica las migraciones pendientes, cada una en su propia transaccion junto con su user_version.
pub fn migrate(conn: &mut Connection) -> rusqlite::Result<()> {
    let current: usize = conn.query_row("PRAGMA user_version", [], |r| r.get::<_, i64>(0))? as usize;
    for (i, script) in MIGRATIONS.iter().enumerate().skip(current) {
        let tx = conn.transaction()?;
        tx.execute_batch(script)?;
        // PRAGMA no admite parametros; el valor es un entero propio, no entrada externa.
        tx.execute_batch(&format!("PRAGMA user_version = {};", i + 1))?;
        tx.commit()?;
    }
    Ok(())
}

#[cfg(test)]
mod tests;
