//! Importar notas desde otra bóveda (un archivo que te entrega otra persona).
//!
//! El archivo ajeno nunca se modifica ni se abre directamente: se trabaja sobre una copia temporal
//! (en `import-tmp/`) que se sobrescribe con ceros y se borra al terminar. Se abre en modo de solo
//! consulta, con `trusted_schema` apagado, y solo se leen columnas conocidas. Las notas se agregan
//! a la bóveda abierta en una sola transacción: o entra todo lo elegido o no entra nada.
//!
//! La contraseña de la bóveda ajena solo existe en memoria durante la operación.

use crate::crypto;
use crate::db;
use crate::error::{AppError, AppResult};
use crate::repo::{self, normalize_tag};
use crate::session;
use crate::state::AppState;
use crate::vaults;
use rusqlite::{Connection, OptionalExtension, named_params};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::hash::{Hash, Hasher};
use std::io::Write;
use std::path::{Path, PathBuf};

/// Tope de tamaño del archivo a importar.
const MAX_SOURCE_BYTES: u64 = 512 * 1024 * 1024;
/// Tope de notas que se listan en la vista previa.
const MAX_PREVIEW_NOTES: i64 = 5000;
const MAX_IMPORT_NOTES: usize = 20_000;
const TMP_DIR: &str = "import-tmp";

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportSource {
    /// Nombre sugerido (el del archivo, sin extensión).
    pub name: String,
    pub encrypted: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceCategory {
    pub id: i64,
    pub name: String,
    pub emoji: String,
    pub hue: i64,
    pub note_count: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceNote {
    pub id: i64,
    pub title: String,
    pub snippet: String,
    pub category_id: Option<i64>,
    pub pinned: bool,
    pub updated_at: i64,
    pub tags: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportPreview {
    pub name: String,
    pub categories: Vec<SourceCategory>,
    pub notes: Vec<SourceNote>,
    /// Notas activas en la bóveda de origen (puede ser más que las listadas).
    pub total_notes: i64,
    pub uncategorized: i64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportOptions {
    pub note_ids: Vec<i64>,
    /// true: conserva las categorías de origen (se juntan con las tuyas si el nombre coincide).
    /// false: todas las notas van a `target_category_id`.
    pub keep_categories: bool,
    pub target_category_id: Option<i64>,
    /// Omite las notas que ya tienes con el mismo título y el mismo texto.
    pub skip_duplicates: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportResult {
    pub imported: usize,
    pub skipped_duplicates: usize,
    pub created_categories: usize,
    pub created_tags: usize,
}

/// Carpeta temporal con la copia de trabajo. Al soltarse, sobrescribe con ceros y borra todo.
struct TempWork {
    dir: PathBuf,
}

impl Drop for TempWork {
    fn drop(&mut self) {
        wipe_dir(&self.dir);
    }
}

fn wipe_dir(dir: &Path) {
    if let Ok(entries) = std::fs::read_dir(dir) {
        for e in entries.flatten() {
            let p = e.path();
            if p.is_file() {
                if let (Ok(meta), Ok(mut f)) = (e.metadata(), std::fs::OpenOptions::new().write(true).open(&p)) {
                    let zeros = vec![0u8; 64 * 1024];
                    let mut left = meta.len();
                    while left > 0 {
                        let n = left.min(zeros.len() as u64) as usize;
                        if f.write_all(&zeros[..n]).is_err() {
                            break;
                        }
                        left -= n as u64;
                    }
                    let _ = f.sync_all();
                }
            }
        }
    }
    let _ = std::fs::remove_dir_all(dir);
}

/// Borra restos de importaciones que quedaron a medias (por ejemplo, si la app se cerró).
pub fn cleanup_leftovers(data_dir: &Path) {
    wipe_dir(&data_dir.join(TMP_DIR));
}

/// Bóveda de origen abierta sobre una copia temporal. `conn` va primero: se cierra antes de borrar.
struct Source {
    conn: Connection,
    name: String,
    _work: TempWork,
}

fn incompatible() -> AppError {
    AppError::Invalid("Esta bóveda tiene un formato que esta versión de Noter no puede leer.".into())
}

fn open_source(state: &AppState, path: &str, password: Option<&str>) -> AppResult<Source> {
    let info = session::describe_file(path)?;
    let original = vaults::db_path(&state.dir, &info);
    let size = std::fs::metadata(&original).map_err(|_| AppError::NotFound)?.len();
    if size > MAX_SOURCE_BYTES {
        return Err(AppError::Invalid("El archivo es demasiado grande para importarlo (máximo 512 MB).".into()));
    }

    let dir = state.dir.join(TMP_DIR).join(format!("{}", repo::now_ms()));
    std::fs::create_dir_all(&dir).map_err(vaults::io_err)?;
    let work = TempWork { dir: dir.clone() };
    let copy = dir.join("origen.db");
    std::fs::copy(&original, &copy).map_err(vaults::io_err)?;
    // Si quedó un registro de transacciones junto al original, viaja con la copia.
    let mut wal = original.as_os_str().to_owned();
    wal.push("-wal");
    if Path::new(&wal).exists() {
        let _ = std::fs::copy(Path::new(&wal), dir.join("origen.db-wal"));
    }

    let conn = Connection::open(&copy)?;
    if info.encrypted {
        let pw = password.filter(|p| !p.is_empty()).ok_or_else(|| {
            AppError::Invalid("Esta bóveda tiene contraseña: escríbela para continuar.".into())
        })?;
        let header = vaults::read_header(&state.dir, &info)?;
        let dek = crypto::unlock_with_password(&header, pw)?;
        let key = crypto::sql_key(&dek);
        conn.pragma_update(None, "key", &*key)?;
    }
    // La copia no se modifica; y el esquema ajeno no puede ejecutar funciones no confiables.
    conn.execute_batch("PRAGMA trusted_schema = OFF; PRAGMA query_only = ON;")?;
    if conn.query_row("SELECT COUNT(*) FROM sqlite_master", [], |r| r.get::<_, i64>(0)).is_err() {
        return Err(if info.encrypted {
            AppError::BadPassword
        } else {
            AppError::Invalid("Este archivo no se pudo leer como bóveda de Noter.".into())
        });
    }

    let version: i64 = conn.query_row("PRAGMA user_version", [], |r| r.get(0))?;
    if version as usize > db::SCHEMA_VERSION {
        return Err(AppError::Invalid(
            "Esta bóveda se creó con una versión más nueva de Noter. Actualiza la app para importarla.".into(),
        ));
    }
    // Solo se usan columnas conocidas: si falta alguna, el formato no es el esperado.
    for check in [
        "SELECT id, name, emoji, hue, position FROM categories LIMIT 0",
        "SELECT id, title, body, category_id, pinned, created_at, updated_at, deleted_at FROM notes LIMIT 0",
        "SELECT id, name FROM tags LIMIT 0",
        "SELECT note_id, tag_id FROM note_tags LIMIT 0",
    ] {
        conn.prepare(check).map_err(|_| incompatible())?;
    }

    let name = Path::new(path).file_stem().and_then(|s| s.to_str()).unwrap_or("Bóveda").to_string();
    Ok(Source { conn, name, _work: work })
}

/// Datos básicos del archivo, sin leer su contenido ni pedir contraseña.
pub fn inspect(path: &str) -> AppResult<ImportSource> {
    let info = session::describe_file(path)?;
    let name = Path::new(path).file_stem().and_then(|s| s.to_str()).unwrap_or("Bóveda").to_string();
    Ok(ImportSource { name, encrypted: info.encrypted })
}

/// Lista lo que contiene la bóveda de origen para que la persona elija qué importar.
pub fn preview(state: &AppState, path: &str, password: Option<&str>) -> AppResult<ImportPreview> {
    let _session = session::session_lock(state)?;
    let src = open_source(state, path, password)?;
    let conn = &src.conn;

    let mut stmt = conn.prepare(
        "SELECT c.id, c.name, c.emoji, c.hue,
                (SELECT COUNT(*) FROM notes n WHERE n.category_id = c.id AND n.deleted_at IS NULL)
         FROM categories c ORDER BY c.position, c.id",
    )?;
    let categories: Vec<SourceCategory> = stmt
        .query_map([], |r| {
            Ok(SourceCategory { id: r.get(0)?, name: r.get(1)?, emoji: r.get(2)?, hue: r.get(3)?, note_count: r.get(4)? })
        })?
        .collect::<Result<_, _>>()?;

    let mut stmt = conn.prepare(
        "SELECT n.id, n.title, substr(n.body, 1, 160), n.category_id, n.pinned, n.updated_at,
                (SELECT json_group_array(t.name) FROM note_tags nt JOIN tags t ON t.id = nt.tag_id WHERE nt.note_id = n.id)
         FROM notes n WHERE n.deleted_at IS NULL
         ORDER BY n.pinned DESC, n.updated_at DESC, n.id DESC LIMIT ?1",
    )?;
    let notes: Vec<SourceNote> = stmt
        .query_map([MAX_PREVIEW_NOTES], |r| {
            let tags_json: Option<String> = r.get(6)?;
            Ok(SourceNote {
                id: r.get(0)?,
                title: r.get(1)?,
                snippet: r.get::<_, Option<String>>(2)?.unwrap_or_default(),
                category_id: r.get(3)?,
                pinned: r.get::<_, i64>(4)? != 0,
                updated_at: r.get(5)?,
                tags: tags_json.and_then(|j| serde_json::from_str(&j).ok()).unwrap_or_default(),
            })
        })?
        .collect::<Result<_, _>>()?;

    let total_notes: i64 = conn.query_row("SELECT COUNT(*) FROM notes WHERE deleted_at IS NULL", [], |r| r.get(0))?;
    let uncategorized: i64 = conn.query_row(
        "SELECT COUNT(*) FROM notes WHERE deleted_at IS NULL AND (category_id IS NULL OR category_id NOT IN (SELECT id FROM categories))",
        [],
        |r| r.get(0),
    )?;
    Ok(ImportPreview { name: src.name.clone(), categories, notes, total_notes, uncategorized })
}

fn content_hash(title: &str, body: &str) -> u64 {
    let mut h = std::collections::hash_map::DefaultHasher::new();
    title.hash(&mut h);
    body.hash(&mut h);
    h.finish()
}

/// Agrega a la bóveda abierta las notas elegidas de la bóveda de origen.
pub fn run(state: &AppState, path: &str, password: Option<&str>, opts: &ImportOptions) -> AppResult<ImportResult> {
    let _session = session::session_lock(state)?;
    if opts.note_ids.is_empty() {
        return Err(AppError::Invalid("Elige al menos una nota para importar.".into()));
    }
    if opts.note_ids.len() > MAX_IMPORT_NOTES {
        return Err(AppError::Invalid("Son demasiadas notas de una vez. Importa en tandas.".into()));
    }
    let target_guard = state.conn.lock().map_err(|_| AppError::Db("estado interno corrupto".into()))?;
    let target = target_guard.as_ref().ok_or(AppError::Locked)?;
    let src = open_source(state, path, password)?;

    let mut ids = opts.note_ids.clone();
    ids.sort_unstable();
    ids.dedup();
    let ids_json = serde_json::to_string(&ids).map_err(|e| AppError::Db(e.to_string()))?;

    // Notas elegidas (solo activas), en el orden en que se crearon.
    struct Row {
        title: String,
        body: String,
        category_id: Option<i64>,
        pinned: i64,
        created_at: i64,
        updated_at: i64,
        tags: Vec<String>,
    }
    let mut stmt = src.conn.prepare(
        "SELECT n.title, n.body, n.category_id, n.pinned, n.created_at, n.updated_at,
                (SELECT json_group_array(t.name) FROM note_tags nt JOIN tags t ON t.id = nt.tag_id WHERE nt.note_id = n.id)
         FROM notes n
         WHERE n.deleted_at IS NULL AND n.id IN (SELECT value FROM json_each(:ids))
         ORDER BY n.created_at, n.id",
    )?;
    let rows: Vec<Row> = stmt
        .query_map(named_params! { ":ids": ids_json }, |r| {
            let tags_json: Option<String> = r.get(6)?;
            Ok(Row {
                title: r.get(0)?,
                body: r.get(1)?,
                category_id: r.get(2)?,
                pinned: r.get(3)?,
                created_at: r.get(4)?,
                updated_at: r.get(5)?,
                tags: tags_json.and_then(|j| serde_json::from_str(&j).ok()).unwrap_or_default(),
            })
        })?
        .collect::<Result<_, _>>()?;
    drop(stmt);
    if rows.is_empty() {
        return Err(AppError::Invalid("Ninguna de las notas elegidas existe en la bóveda de origen.".into()));
    }

    // Categorías de origen, por id.
    let mut src_categories: HashMap<i64, (String, String, i64)> = HashMap::new();
    {
        let mut st = src.conn.prepare("SELECT id, name, emoji, hue FROM categories")?;
        let it = st.query_map([], |r| Ok((r.get::<_, i64>(0)?, (r.get::<_, String>(1)?, r.get::<_, String>(2)?, r.get::<_, i64>(3)?))))?;
        for r in it {
            let (id, v) = r?;
            src_categories.insert(id, v);
        }
    }

    if !opts.keep_categories {
        if let Some(id) = opts.target_category_id {
            let exists: Option<i64> = target.query_row("SELECT 1 FROM categories WHERE id = ?1", [id], |r| r.get(0)).optional()?;
            if exists.is_none() {
                return Err(AppError::Invalid("La categoría de destino ya no existe.".into()));
            }
        }
    }

    let tx = target.unchecked_transaction()?;

    // Para omitir duplicados: huella de título + texto de las notas activas que ya tienes.
    let mut existing: HashSet<u64> = HashSet::new();
    if opts.skip_duplicates {
        let mut st = tx.prepare("SELECT title, body FROM notes WHERE deleted_at IS NULL")?;
        let it = st.query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)))?;
        for r in it {
            let (t, b) = r?;
            existing.insert(content_hash(&t, &b));
        }
    }

    let mut category_map: HashMap<i64, Option<i64>> = HashMap::new();
    let mut result = ImportResult { imported: 0, skipped_duplicates: 0, created_categories: 0, created_tags: 0 };

    for row in rows {
        if opts.skip_duplicates && !existing.insert(content_hash(&row.title, &row.body)) {
            result.skipped_duplicates += 1;
            continue;
        }
        let target_category: Option<i64> = if opts.keep_categories {
            match row.category_id.and_then(|c| src_categories.get(&c).map(|v| (c, v.clone()))) {
                None => None,
                Some((src_id, (name, emoji, hue))) => match category_map.get(&src_id) {
                    Some(mapped) => *mapped,
                    None => {
                        // Se junta con una categoría tuya del mismo nombre (sin distinguir mayúsculas) o se crea.
                        let found: Option<i64> = tx
                            .query_row(
                                "SELECT id FROM categories WHERE lower(name) = lower(?1) ORDER BY position, id LIMIT 1",
                                [name.trim()],
                                |r| r.get(0),
                            )
                            .optional()?;
                        let id = match found {
                            Some(id) => id,
                            None => {
                                let nm = if name.trim().is_empty() { "Importadas" } else { name.trim() };
                                let em = if emoji.trim().is_empty() { "\u{1F4C1}" } else { emoji.trim() };
                                let hue = hue.clamp(0, 360);
                                result.created_categories += 1;
                                repo::category_create(&tx, nm, em, hue)?.id
                            }
                        };
                        category_map.insert(src_id, Some(id));
                        Some(id)
                    }
                },
            }
        } else {
            opts.target_category_id
        };

        let title: String = row.title.chars().take(2000).collect();
        tx.execute(
            "INSERT INTO notes (title, body, category_id, pinned, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            rusqlite::params![title, row.body, target_category, (row.pinned != 0) as i64, row.created_at, row.updated_at],
        )?;
        let note_id = tx.last_insert_rowid();

        let mut names: Vec<String> = row.tags.iter().map(|t| normalize_tag(t)).filter(|t| !t.is_empty() && t.chars().count() <= 40).collect();
        names.sort();
        names.dedup();
        for name in names {
            let existed: Option<i64> = tx.query_row("SELECT id FROM tags WHERE name = ?1", [&name], |r| r.get(0)).optional()?;
            let tag_id: i64 = tx.query_row(db::sql("tag_upsert"), named_params! { ":name": name }, |r| r.get(0))?;
            if existed.is_none() {
                result.created_tags += 1;
            }
            tx.execute(db::sql("tag_attach"), named_params! { ":note_id": note_id, ":tag_id": tag_id })?;
        }
        result.imported += 1;
    }
    tx.commit()?;
    session::touch(state);
    Ok(result)
}
