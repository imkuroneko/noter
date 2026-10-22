mod commands;
mod crypto;
mod db;
mod error;
mod import;
#[cfg(test)]
mod import_tests;
mod repo;
#[cfg(test)]
mod repo_tests;
mod session;
#[cfg(test)]
mod session_tests;
mod state;
mod vaults;

use state::AppState;
use std::sync::atomic::Ordering::Relaxed;
use std::time::Duration;
use tauri::{Emitter, Manager};

/// Cada cuántos segundos se revisa si hay que bloquear por inactividad.
const IDLE_POLL_SECS: u64 = 5;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&dir)?;
            app.manage(AppState::new(dir.clone()));
            // Restos de una importación interrumpida (copias temporales): se borran al arrancar.
            import::cleanup_leftovers(&dir);

            let reg = vaults::load(&dir).map_err(|e| format!("{e:?}"))?;
            let state = app.state::<AppState>();
            state.idle_minutes.store(reg.idle_minutes, Relaxed);
            let first = reg
                .active_id
                .as_ref()
                .filter(|id| reg.vaults.iter().any(|v| &v.id == *id))
                .or_else(|| reg.vaults.first().map(|v| &v.id))
                .cloned()
                .ok_or("no hay bóvedas")?;
            // Si la bóveda activa tiene contraseña, queda esperando en la pantalla de bloqueo.
            // Si no se puede abrir (por ejemplo, falta el archivo en un disco desconectado), la app
            // arranca igual: la interfaz muestra la lista de bóvedas para reubicar o elegir otra.
            if let Err(e) = session::activate(&state, &first) {
                eprintln!("No se pudo abrir la bóveda activa al arrancar: {e:?}");
            }

            // Bloqueo por inactividad: solo afecta a bóvedas con contraseña.
            let handle = app.handle().clone();
            std::thread::spawn(move || {
                loop {
                    std::thread::sleep(Duration::from_secs(IDLE_POLL_SECS));
                    let state = handle.state::<AppState>();
                    if session::idle_check(&state) {
                        let _ = handle.emit("vault://locked", serde_json::json!({ "reason": "idle" }));
                    }
                }
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::category_list,
            commands::category_create,
            commands::category_update,
            commands::category_delete,
            commands::note_list,
            commands::note_get,
            commands::note_create,
            commands::note_update,
            commands::note_move,
            commands::note_pin,
            commands::note_trash,
            commands::note_trash_many,
            commands::trash_list,
            commands::note_restore,
            commands::note_purge,
            commands::trash_empty,
            commands::tag_list,
            commands::note_set_tags,
            commands::vault_list,
            commands::vault_create,
            commands::vault_rename,
            commands::vault_switch,
            commands::vault_unlock,
            commands::vault_lock,
            commands::vault_protect,
            commands::vault_change_password,
            commands::vault_recover,
            commands::vault_delete_backup,
            commands::vault_open_existing,
            commands::vault_relocate,
            commands::vault_forget,
            commands::import_inspect,
            commands::import_preview,
            commands::import_run,
            commands::vault_set_idle,
            commands::vault_touch,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
