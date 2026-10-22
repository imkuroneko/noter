mod commands;
mod crypto;
mod db;
mod error;
mod repo;
#[cfg(test)]
mod repo_tests;
mod state;
mod vaults;

use state::AppState;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&dir)?;
            app.manage(AppState::new(dir.clone()));
            let reg = vaults::load(&dir).map_err(|e| format!("{e:?}"))?;
            let first = reg
                .active_id
                .as_ref()
                .filter(|id| reg.vaults.iter().any(|v| &v.id == *id))
                .or_else(|| reg.vaults.first().map(|v| &v.id))
                .cloned()
                .ok_or("no hay bóvedas")?;
            commands::open_vault(&app.state::<AppState>(), &first).map_err(|e| format!("{e:?}"))?;
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
            commands::tag_list,
            commands::note_set_tags,
            commands::note_trash_many,
            commands::trash_list,
            commands::note_restore,
            commands::note_purge,
            commands::trash_empty,
            commands::vault_list,
            commands::vault_create,
            commands::vault_rename,
            commands::vault_switch,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
