//! Comandos Tauri. Finos: validan entrada, toman la conexión y llaman a `repo`. Sin SQL.

use crate::error::{AppError, AppResult};
use crate::import::{self, ImportOptions, ImportPreview, ImportResult, ImportSource};
use crate::repo::{self, Category, ListParams, Note, NoteSummary, TagCount, TrashNote};
use crate::state::AppState;
use crate::session::{self, VaultStatus};
use crate::vaults;
use zeroize::Zeroizing;
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
    session::touch(state);
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
#[serde(rename_all = "camelCase")]
pub struct VaultCreated {
    pub status: VaultStatus,
    /// Solo cuando la bóveda nueva tiene contraseña; se muestra una única vez.
    pub recovery_key: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultProtected {
    pub status: VaultStatus,
    pub recovery_key: String,
    /// Copia sin cifrar de la base original, en la carpeta `backups` de los datos de la app.
    pub backup_file: String,
}

#[tauri::command]
pub fn vault_list(state: State<'_, AppState>) -> AppResult<VaultStatus> {
    session::status(&state)
}

#[tauri::command]
pub fn vault_rename(state: State<'_, AppState>, id: String, name: String) -> AppResult<VaultStatus> {
    let mut reg = vaults::load(&state.dir)?;
    let name = vaults::clean_name(&name)?;
    reg.vaults.iter_mut().find(|v| v.id == id).ok_or(AppError::NotFound)?.name = name;
    vaults::save(&state.dir, &reg)?;
    session::status(&state)
}

/// Cambia a otra bóveda. Si está protegida, queda en la pantalla de bloqueo hasta desbloquearla.
/// El frontend debe recargar categorías, etiquetas y notas.
#[tauri::command]
pub fn vault_switch(state: State<'_, AppState>, id: String) -> AppResult<VaultStatus> {
    session::activate(&state, &id)
}

// Las órdenes que derivan claves (Argon2) son async para no congelar la interfaz.

#[tauri::command]
pub async fn vault_create(
    state: State<'_, AppState>,
    name: String,
    password: Option<String>,
    folder: Option<String>,
) -> AppResult<VaultCreated> {
    let password = password.map(Zeroizing::new);
    let (status, recovery_key) =
        session::create_vault(&state, &name, password.as_ref().map(|p| p.as_str()), folder.as_deref())?;
    Ok(VaultCreated { status, recovery_key })
}

/// Agrega a la lista una bóveda que ya existe en otra carpeta (ruta de su archivo .db).
#[tauri::command]
pub fn vault_open_existing(state: State<'_, AppState>, path: String) -> AppResult<VaultStatus> {
    session::open_existing(&state, &path)
}

/// Apunta una bóveda de la lista a otro archivo .db (por ejemplo, tras moverla de carpeta).
#[tauri::command]
pub fn vault_relocate(state: State<'_, AppState>, id: String, path: String) -> AppResult<VaultStatus> {
    session::relocate(&state, &id, &path)
}

/// Quita una bóveda de la lista sin borrar sus archivos.
#[tauri::command]
pub fn vault_forget(state: State<'_, AppState>, id: String) -> AppResult<VaultStatus> {
    session::forget(&state, &id)
}

#[tauri::command]
pub async fn vault_unlock(state: State<'_, AppState>, id: String, password: String) -> AppResult<VaultStatus> {
    let password = Zeroizing::new(password);
    session::unlock(&state, &id, &password)
}

#[tauri::command]
pub fn vault_lock(state: State<'_, AppState>) -> AppResult<VaultStatus> {
    session::lock(&state)
}

#[tauri::command]
pub async fn vault_protect(state: State<'_, AppState>, password: String) -> AppResult<VaultProtected> {
    let password = Zeroizing::new(password);
    let done = session::protect(&state, &password)?;
    Ok(VaultProtected { status: session::status(&state)?, recovery_key: done.recovery_key, backup_file: done.backup_file })
}

#[tauri::command]
pub async fn vault_change_password(state: State<'_, AppState>, id: String, old_password: String, new_password: String) -> AppResult<()> {
    let (old, new) = (Zeroizing::new(old_password), Zeroizing::new(new_password));
    session::change_password(&state, &id, &old, &new)
}

#[tauri::command]
pub async fn vault_recover(state: State<'_, AppState>, id: String, recovery_key: String, new_password: String) -> AppResult<VaultStatus> {
    let (key, new) = (Zeroizing::new(recovery_key), Zeroizing::new(new_password));
    session::recover(&state, &id, &key, &new)
}

/// Borra (sobrescribiendo con ceros) una copia sin cifrar que dejó `vault_protect`.
#[tauri::command]
pub fn vault_delete_backup(state: State<'_, AppState>, file: String) -> AppResult<VaultStatus> {
    session::delete_backup(&state, &file)
}

#[tauri::command]
pub fn vault_set_idle(state: State<'_, AppState>, minutes: u32) -> AppResult<VaultStatus> {
    session::set_idle(&state, minutes)
}

/// El frontend avisa de actividad (con límite de frecuencia) para el bloqueo por inactividad.
#[tauri::command]
pub fn vault_touch(state: State<'_, AppState>) {
    session::touch(&state);
}

// ---------- Importar desde otra bóveda ----------

/// Datos básicos del archivo elegido (nombre y si pide contraseña), sin leer su contenido.
#[tauri::command]
pub fn import_inspect(path: String) -> AppResult<ImportSource> {
    import::inspect(&path)
}

/// Lista las categorías y notas de la bóveda de origen para elegir qué importar.
#[tauri::command]
pub async fn import_preview(state: State<'_, AppState>, path: String, password: Option<String>) -> AppResult<ImportPreview> {
    let password = password.map(Zeroizing::new);
    import::preview(&state, &path, password.as_ref().map(|p| p.as_str()))
}

/// Agrega las notas elegidas a la bóveda abierta.
#[tauri::command]
pub async fn import_run(
    state: State<'_, AppState>,
    path: String,
    password: Option<String>,
    options: ImportOptions,
) -> AppResult<ImportResult> {
    let password = password.map(Zeroizing::new);
    import::run(&state, &path, password.as_ref().map(|p| p.as_str()), &options)
}

#[tauri::command]
pub fn tag_list(state: State<'_, AppState>, category_id: Option<i64>) -> AppResult<Vec<TagCount>> {
    with_conn(&state, |c| repo::tag_list(c, category_id))
}

#[tauri::command]
pub fn note_set_tags(state: State<'_, AppState>, note_id: i64, names: Vec<String>) -> AppResult<Vec<String>> {
    with_conn(&state, |c| repo::note_set_tags(c, note_id, &names))
}
