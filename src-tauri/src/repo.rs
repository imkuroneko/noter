//! Acceso a datos. Todo el SQL de la aplicación vive aquí (y en db/queries.sql); no depende de Tauri.

use crate::db;
use crate::error::{AppError, AppResult};
use rusqlite::{Connection, OptionalExtension, named_params, params};
use serde::{Deserialize, Serialize};
use std::time::{SystemTime, UNIX_EPOCH};

pub fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

// ---------- Categorías ----------

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Category {
    pub id: i64,
    pub name: String,
    pub emoji: String,
    pub hue: i64,
    pub position: i64,
}

fn category_from_row(r: &rusqlite::Row) -> rusqlite::Result<Category> {
    Ok(Category {
        id: r.get("id")?,
        name: r.get("name")?,
        emoji: r.get("emoji")?,
        hue: r.get("hue")?,
        position: r.get("position")?,
    })
}

pub fn category_list(conn: &Connection) -> AppResult<Vec<Category>> {
    let mut st = conn.prepare("SELECT id, name, emoji, hue, position FROM categories ORDER BY position, id")?;
    let rows = st.query_map([], category_from_row)?;
    Ok(rows.collect::<Result<_, _>>()?)
}

fn check_category(name: &str, emoji: &str, hue: i64) -> AppResult<()> {
    if name.trim().is_empty() {
        return Err(AppError::Invalid("La categoría necesita un nombre.".into()));
    }
    if emoji.trim().is_empty() {
        return Err(AppError::Invalid("Elige un emoji para la categoría.".into()));
    }
    if !(0..=360).contains(&hue) {
        return Err(AppError::Invalid("El color debe estar entre 0 y 360.".into()));
    }
    Ok(())
}

pub fn category_create(conn: &Connection, name: &str, emoji: &str, hue: i64) -> AppResult<Category> {
    check_category(name, emoji, hue)?;
    conn.execute(
        "INSERT INTO categories (name, emoji, hue, position, created_at)
         VALUES (?1, ?2, ?3, (SELECT COALESCE(MAX(position), 0) + 1 FROM categories), ?4)",
        params![name.trim(), emoji.trim(), hue, now_ms()],
    )?;
    let id = conn.last_insert_rowid();
    Ok(conn.query_row(
        "SELECT id, name, emoji, hue, position FROM categories WHERE id = ?1",
        [id],
        category_from_row,
    )?)
}

pub fn category_update(
    conn: &Connection,
    id: i64,
    name: Option<String>,
    emoji: Option<String>,
    hue: Option<i64>,
) -> AppResult<Category> {
    let current: Category = conn
        .query_row("SELECT id, name, emoji, hue, position FROM categories WHERE id = ?1", [id], category_from_row)
        .optional()?
        .ok_or(AppError::NotFound)?;
    let name = name.unwrap_or(current.name);
    let emoji = emoji.unwrap_or(current.emoji);
    let hue = hue.unwrap_or(current.hue);
    check_category(&name, &emoji, hue)?;
    conn.execute(
        "UPDATE categories SET name = ?1, emoji = ?2, hue = ?3 WHERE id = ?4",
        params![name.trim(), emoji.trim(), hue, id],
    )?;
    Ok(conn.query_row(
        "SELECT id, name, emoji, hue, position FROM categories WHERE id = ?1",
        [id],
        category_from_row,
    )?)
}

/// Las notas de la categoría quedan sin categoría (ON DELETE SET NULL).
pub fn category_delete(conn: &Connection, id: i64) -> AppResult<()> {
    let n = conn.execute("DELETE FROM categories WHERE id = ?1", [id])?;
    if n == 0 { Err(AppError::NotFound) } else { Ok(()) }
}

// ---------- Notas ----------

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NoteSummary {
    pub id: i64,
    pub title: String,
    /// Con búsqueda activa trae marcas char(2)/char(3) alrededor de las coincidencias.
    pub snippet: String,
    pub title_hl: Option<String>,
    pub category_id: Option<i64>,
    pub pinned: bool,
    pub updated_at: i64,
    pub tags: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Note {
    pub id: i64,
    pub title: String,
    pub body: String,
    pub category_id: Option<i64>,
    pub pinned: bool,
    pub created_at: i64,
    pub updated_at: i64,
    pub tags: Vec<String>,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ListParams {
    pub category_id: Option<i64>,
    pub tag_ids: Vec<i64>,
    pub query: Option<String>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

fn tags_of(conn: &Connection, note_id: i64) -> AppResult<Vec<String>> {
    let mut st = conn.prepare(
        "SELECT t.name FROM note_tags nt JOIN tags t ON t.id = nt.tag_id WHERE nt.note_id = ?1 ORDER BY t.name COLLATE NOCASE",
    )?;
    let rows = st.query_map([note_id], |r| r.get::<_, String>(0))?;
    Ok(rows.collect::<Result<_, _>>()?)
}

fn summary_from_row(r: &rusqlite::Row) -> rusqlite::Result<NoteSummary> {
    Ok(NoteSummary {
        id: r.get("id")?,
        title: r.get("title")?,
        snippet: r.get::<_, Option<String>>("snippet")?.unwrap_or_default(),
        title_hl: r.get::<_, Option<String>>("title_hl").ok().flatten(),
        category_id: r.get("category_id")?,
        pinned: r.get::<_, i64>("pinned")? != 0,
        updated_at: r.get("updated_at")?,
        tags: Vec::new(),
    })
}

pub fn note_list(conn: &Connection, p: &ListParams) -> AppResult<Vec<NoteSummary>> {
    let mut tag_ids = p.tag_ids.clone();
    tag_ids.sort_unstable();
    tag_ids.dedup();
    let tag_json = serde_json::to_string(&tag_ids).unwrap_or_else(|_| "[]".into());
    let limit = p.limit.unwrap_or(200).clamp(1, 500);
    let offset = p.offset.unwrap_or(0).max(0);

    let mut out: Vec<NoteSummary> = Vec::new();
    match p.query.as_deref().and_then(db::fts_match) {
        Some(fts) => {
            let mut st = conn.prepare(db::sql("note_list_search"))?;
            let rows = st.query_map(
                named_params! { ":fts": fts, ":category_id": p.category_id, ":tag_ids": tag_json, ":limit": limit, ":offset": offset },
                summary_from_row,
            )?;
            for r in rows {
                out.push(r?);
            }
        }
        None => {
            let mut st = conn.prepare(db::sql("note_list"))?;
            let rows = st.query_map(
                named_params! { ":category_id": p.category_id, ":tag_ids": tag_json, ":limit": limit, ":offset": offset },
                summary_from_row,
            )?;
            for r in rows {
                out.push(r?);
            }
        }
    }
    for n in &mut out {
        n.tags = tags_of(conn, n.id)?;
    }
    Ok(out)
}

pub fn note_get(conn: &Connection, id: i64) -> AppResult<Note> {
    let mut note = conn
        .query_row(
            "SELECT id, title, body, category_id, pinned, created_at, updated_at
             FROM notes WHERE id = ?1 AND deleted_at IS NULL",
            [id],
            |r| {
                Ok(Note {
                    id: r.get(0)?,
                    title: r.get(1)?,
                    body: r.get(2)?,
                    category_id: r.get(3)?,
                    pinned: r.get::<_, i64>(4)? != 0,
                    created_at: r.get(5)?,
                    updated_at: r.get(6)?,
                    tags: Vec::new(),
                })
            },
        )
        .optional()?
        .ok_or(AppError::NotFound)?;
    note.tags = tags_of(conn, id)?;
    Ok(note)
}

pub fn note_create(conn: &Connection, category_id: Option<i64>) -> AppResult<Note> {
    let now = now_ms();
    conn.execute(
        "INSERT INTO notes (title, body, category_id, created_at, updated_at) VALUES ('', '', ?1, ?2, ?2)",
        params![category_id, now],
    )
    .map_err(|e| match e {
        rusqlite::Error::SqliteFailure(f, _) if f.code == rusqlite::ErrorCode::ConstraintViolation => AppError::NotFound,
        other => other.into(),
    })?;
    note_get(conn, conn.last_insert_rowid())
}

/// Guarda título y cuerpo; devuelve el nuevo `updated_at`.
pub fn note_update(conn: &Connection, id: i64, title: &str, body: &str) -> AppResult<i64> {
    let now = now_ms();
    let n = conn.execute(
        "UPDATE notes SET title = ?1, body = ?2, updated_at = ?3 WHERE id = ?4 AND deleted_at IS NULL",
        params![title, body, now, id],
    )?;
    if n == 0 { Err(AppError::NotFound) } else { Ok(now) }
}

pub fn note_move(conn: &Connection, id: i64, category_id: Option<i64>) -> AppResult<()> {
    let n = conn
        .execute(
            "UPDATE notes SET category_id = ?1 WHERE id = ?2 AND deleted_at IS NULL",
            params![category_id, id],
        )
        .map_err(|e| match e {
            rusqlite::Error::SqliteFailure(f, _) if f.code == rusqlite::ErrorCode::ConstraintViolation => AppError::NotFound,
            other => other.into(),
        })?;
    if n == 0 { Err(AppError::NotFound) } else { Ok(()) }
}

pub fn note_pin(conn: &Connection, id: i64, pinned: bool) -> AppResult<()> {
    let n = conn.execute(
        "UPDATE notes SET pinned = ?1 WHERE id = ?2 AND deleted_at IS NULL",
        params![pinned as i64, id],
    )?;
    if n == 0 { Err(AppError::NotFound) } else { Ok(()) }
}

/// Borrado suave: la nota va a la papelera.
pub fn note_trash(conn: &Connection, id: i64) -> AppResult<()> {
    let n = conn.execute(db::sql("note_trash"), named_params! { ":now": now_ms(), ":id": id })?;
    if n == 0 { Err(AppError::NotFound) } else { Ok(()) }
}

/// Manda varias notas a la papelera en una sola transacción. Devuelve cuántas se movieron.
pub fn note_trash_many(conn: &Connection, ids: &[i64]) -> AppResult<usize> {
    let tx = conn.unchecked_transaction()?;
    let now = now_ms();
    let mut moved = 0;
    for id in ids {
        moved += tx.execute(db::sql("note_trash"), named_params! { ":now": now, ":id": id })?;
    }
    tx.commit()?;
    Ok(moved)
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrashNote {
    pub id: i64,
    pub title: String,
    pub snippet: String,
    pub category_id: Option<i64>,
    pub deleted_at: i64,
}

pub fn trash_list(conn: &Connection) -> AppResult<Vec<TrashNote>> {
    let mut st = conn.prepare(db::sql("trash_list"))?;
    let rows = st.query_map([], |r| {
        Ok(TrashNote {
            id: r.get("id")?,
            title: r.get("title")?,
            snippet: r.get("snippet")?,
            category_id: r.get("category_id")?,
            deleted_at: r.get("deleted_at")?,
        })
    })?;
    Ok(rows.collect::<Result<_, _>>()?)
}

pub fn note_restore(conn: &Connection, id: i64) -> AppResult<()> {
    let n = conn.execute(db::sql("note_restore"), named_params! { ":id": id })?;
    if n == 0 { Err(AppError::NotFound) } else { Ok(()) }
}

/// Borrado definitivo de una nota que ya está en la papelera. Las etiquetas sin notas se limpian.
pub fn note_purge(conn: &Connection, id: i64) -> AppResult<()> {
    let n = conn.execute("DELETE FROM notes WHERE id = ?1 AND deleted_at IS NOT NULL", [id])?;
    if n == 0 {
        return Err(AppError::NotFound);
    }
    conn.execute_batch(db::sql("tags_cleanup_orphans"))?;
    Ok(())
}

/// Vacía la papelera. Devuelve cuántas notas se borraron.
pub fn trash_empty(conn: &Connection) -> AppResult<usize> {
    let n = conn.execute("DELETE FROM notes WHERE deleted_at IS NOT NULL", [])?;
    conn.execute_batch(db::sql("tags_cleanup_orphans"))?;
    Ok(n)
}

// ---------- Etiquetas ----------

#[derive(Debug, Serialize)]
pub struct TagCount {
    pub id: i64,
    pub name: String,
    pub count: i64,
}

pub fn tag_list(conn: &Connection, category_id: Option<i64>) -> AppResult<Vec<TagCount>> {
    let mut st = conn.prepare(db::sql("tag_list"))?;
    let rows = st.query_map(named_params! { ":category_id": category_id }, |r| {
        Ok(TagCount { id: r.get("id")?, name: r.get("name")?, count: r.get("count")? })
    })?;
    Ok(rows.collect::<Result<_, _>>()?)
}

/// Quita "#", espacios sobrantes y mayúsculas (COLLATE NOCASE solo cubre ASCII).
pub(crate) fn normalize_tag(raw: &str) -> String {
    raw.trim().trim_start_matches('#').trim().to_lowercase()
}

/// Reemplaza las etiquetas de la nota. Devuelve los nombres finales, ordenados.
pub fn note_set_tags(conn: &Connection, note_id: i64, names: &[String]) -> AppResult<Vec<String>> {
    let mut clean: Vec<String> = names.iter().map(|n| normalize_tag(n)).filter(|n| !n.is_empty()).collect();
    clean.sort();
    clean.dedup();
    if clean.iter().any(|n| n.chars().count() > 40) {
        return Err(AppError::Invalid("Una etiqueta no puede pasar de 40 caracteres.".into()));
    }
    let tx = conn.unchecked_transaction()?;
    let exists: Option<i64> = tx
        .query_row("SELECT 1 FROM notes WHERE id = ?1 AND deleted_at IS NULL", [note_id], |r| r.get(0))
        .optional()?;
    if exists.is_none() {
        return Err(AppError::NotFound);
    }
    tx.execute("DELETE FROM note_tags WHERE note_id = ?1", [note_id])?;
    for name in &clean {
        let tag_id: i64 = tx.query_row(db::sql("tag_upsert"), named_params! { ":name": name }, |r| r.get(0))?;
        tx.execute(db::sql("tag_attach"), named_params! { ":note_id": note_id, ":tag_id": tag_id })?;
    }
    tx.execute_batch(db::sql("tags_cleanup_orphans"))?;
    tx.commit()?;
    tags_of(conn, note_id)
}

// ---------- Datos de ejemplo del primer arranque ----------

/// Crea categorías y una nota de bienvenida una sola vez por bóveda.
pub fn seed_if_new(conn: &Connection) -> AppResult<()> {
    let done: Option<String> = conn
        .query_row("SELECT value FROM settings WHERE key = 'seeded'", [], |r| r.get(0))
        .optional()?;
    if done.is_some() {
        return Ok(());
    }
    let empty: i64 = conn.query_row(
        "SELECT (SELECT COUNT(*) FROM notes) + (SELECT COUNT(*) FROM categories)",
        [],
        |r| r.get(0),
    )?;
    if empty == 0 {
        let work = category_create(conn, "Trabajo", "\u{1F4BC}", 200)?;
        category_create(conn, "Estudio", "\u{1F4DA}", 265)?;
        category_create(conn, "Ideas", "\u{1F4A1}", 45)?;
        category_create(conn, "Diario", "\u{1F4D3}", 335)?;
        let note = note_create(conn, Some(work.id))?;
        note_update(
            conn,
            note.id,
            "Bienvenida a Noter",
            "# Bienvenida a Noter\n\nEscribe en **Markdown** y mira el resultado al lado.\n\n- Crea categorías en la barra de la izquierda\n- Agrega etiquetas para filtrar\n- [x] Primera nota\n- [ ] Probar el modo Dividir\n",
        )?;
        note_set_tags(conn, note.id, &["bienvenida".to_string()])?;
    }
    conn.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('seeded', '1')", [])?;
    Ok(())
}
