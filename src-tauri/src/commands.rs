//! Comandos Tauri. Finos: validan entrada, toman la conexión y llaman a `repo`. Sin SQL.

use crate::db;
use crate::error::{AppError, AppResult};
use crate::repo::{self, Category, ListParams, Note, NoteSummary, TagCount, TrashNote};
use crate::state::AppState;
use crate::vaults::{self, Registry};
use rusqlite::Connection;
use serde::Serialize;
use tauri::State;

/// Ejecuta `f` con la conexión de la bóveda abierta; `Locked` si no hay ninguna.
fn with_conn<T>(state: &AppState, f: impl FnOnce(&Connection) -> AppResult<T>) -> AppResult<T> {
    let guard = state
        .conn
        .lock()
        .map_err(|_| AppError::Db("estado interno corrupto".into()))?;
    let conn = guard.as_ref().ok_or(AppError::Locked)?;
    f(conn)
}

#[tauri::command]
pub fn category_list(state: State<'_, AppState>) -> AppResult<Vec<Category>> {
    with_conn(&state, repo::category_list)
}

#[tauri::command]
pub fn category_create(state: State<'_, AppState>, name: String, emoji: String, hue: i64) -> AppResult<Category> {
    with_conn(&state, |c| repo::category_create(c, &name, &emoji, hue))
}

#[tauri::command]
pub fn category_update(
    state: State<'_, AppState>,
    id: i64,
    name: Option<String>,
    emoji: Option<String>,
    hue: Option<i64>,
) -> AppResult<Category> {
    with_conn(&state, |c| repo::category_update(c, id, name, emoji, hue))
}

#[tauri::command]
pub fn category_delete(state: State<'_, AppState>, id: i64) -> AppResult<()> {
    with_conn(&state, |c| repo::category_delete(c, id))
}

#[tauri::command]
pub fn note_list(state: State<'_, AppState>, params: ListParams) -> AppResult<Vec<NoteSummary>> {
    with_conn(&state, |c| repo::note_list(c, &params))
}

#[tauri::command]
pub fn note_get(state: State<'_, AppState>, id: i64) -> AppResult<Note> {
    with_conn(&state, |c| repo::note_get(c, id))
}

#[tauri::command]
pub fn note_create(state: State<'_, AppState>, category_id: Option<i64>) -> AppResult<Note> {
    with_conn(&state, |c| repo::note_create(c, category_id))
}

#[tauri::command]
pub fn note_update(state: State<'_, AppState>, id: i64, title: String, body: String) -> AppResult<i64> {
    with_conn(&state, |c| repo::note_update(c, id, &title, &body))
}

#[tauri::command]
pub fn note_move(state: State<'_, AppState>, id: i64, category_id: Option<i64>) -> AppResult<()> {
    with_conn(&state, |c| repo::note_move(c, id, category_id))
}

#[tauri::command]
pub fn note_pin(state: State<'_, AppState>, id: i64, pinned: bool) -> AppResult<()> {
    with_conn(&state, |c| repo::note_pin(c, id, pinned))
}

#[tauri::command]
pub fn note_trash(state: State<'_, AppState>, id: i64) -> AppResult<()> {
    with_conn(&state, |c| repo::note_trash(c, id))
}

#[tauri::command]
pub fn note_trash_many(state: State<'_, AppState>, ids: Vec<i64>) -> AppResult<usize> {
    with_conn(&state, |c| repo::note_trash_many(c, &ids))
}

#[tauri::command]
pub fn trash_list(state: State<'_, AppState>) -> AppResult<Vec<TrashNote>> {
    with_conn(&state, repo::trash_list)
}

#[tauri::command]
pub fn note_restore(state: State<'_, AppState>, id: i64) -> AppResult<()> {
    with_conn(&state, |c| repo::note_restore(c, id))
}

#[tauri::command]
pub fn note_purge(state: State<'_, AppState>, id: i64) -> AppResult<()> {
    with_conn(&state, |c| repo::note_purge(c, id))
}

#[tauri::command]
pub fn trash_empty(state: State<'_, AppState>) -> AppResult<usize> {
    with_conn(&state, repo::trash_empty)
}

// ---------- Bóvedas ----------

#[derive(Serialize)]
pub struct VaultSummary {
    pub id: String,
    pub name: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultList {
    pub vaults: Vec<VaultSummary>,
    pub active_id: Option<String>,
}

fn vault_list_from(reg: &Registry) -> VaultList {
    VaultList {
        vaults: reg.vaults.iter().map(|v| VaultSummary { id: v.id.clone(), name: v.name.clone() }).collect(),
        active_id: reg.active_id.clone(),
    }
}

/// Abre la bóveda `id` (reemplaza la conexión actual) y la recuerda como activa.
pub fn open_vault(state: &AppState, id: &str) -> AppResult<()> {
    let mut reg = vaults::load(&state.dir)?;
    let info = reg.vaults.iter().find(|v| v.id == id).ok_or(AppError::NotFound)?.clone();
    // Fase 1: sin contraseña (clave vacía). La bóveda cifrada llega en la fase 5.
    let conn = db::open(&state.dir.join(&info.file), "")?;
    repo::seed_if_new(&conn)?;
    *state.conn.lock().map_err(|_| AppError::Db("estado interno corrupto".into()))? = Some(conn);
    reg.active_id = Some(info.id);
    vaults::save(&state.dir, &reg)
}

#[tauri::command]
pub fn vault_list(state: State<'_, AppState>) -> AppResult<VaultList> {
    Ok(vault_list_from(&vaults::load(&state.dir)?))
}

#[tauri::command]
pub fn vault_create(state: State<'_, AppState>, name: String) -> AppResult<VaultList> {
    let mut reg = vaults::load(&state.dir)?;
    reg.vaults.push(vaults::new_vault(&name)?);
    vaults::save(&state.dir, &reg)?;
    Ok(vault_list_from(&reg))
}

#[tauri::command]
pub fn vault_rename(state: State<'_, AppState>, id: String, name: String) -> AppResult<VaultList> {
    let mut reg = vaults::load(&state.dir)?;
    let name = vaults::clean_name(&name)?;
    reg.vaults.iter_mut().find(|v| v.id == id).ok_or(AppError::NotFound)?.name = name;
    vaults::save(&state.dir, &reg)?;
    Ok(vault_list_from(&reg))
}

/// Cambia a otra bóveda. El frontend debe recargar categorías, etiquetas y notas.
#[tauri::command]
pub fn vault_switch(state: State<'_, AppState>, id: String) -> AppResult<VaultList> {
    open_vault(&state, &id)?;
    Ok(vault_list_from(&vaults::load(&state.dir)?))
}

#[tauri::command]
pub fn tag_list(state: State<'_, AppState>, category_id: Option<i64>) -> AppResult<Vec<TagCount>> {
    with_conn(&state, |c| repo::tag_list(c, category_id))
}

#[tauri::command]
pub fn note_set_tags(state: State<'_, AppState>, note_id: i64, names: Vec<String>) -> AppResult<Vec<String>> {
    with_conn(&state, |c| repo::note_set_tags(c, note_id, &names))
}
