//! Registro de bóvedas: `vaults.json` en la carpeta de datos. Cada bóveda es su propio archivo .db.

use crate::error::{AppError, AppResult};
use crate::repo::now_ms;
use serde::{Deserialize, Serialize};
use std::path::Path;

const REGISTRY_FILE: &str = "vaults.json";
/// Archivo de la primera bóveda; ya existía antes del registro.
const DEFAULT_FILE: &str = "noter-dev.db";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VaultInfo {
    pub id: String,
    pub name: String,
    pub file: String,
}

#[derive(Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Registry {
    pub vaults: Vec<VaultInfo>,
    pub active_id: Option<String>,
}

fn io_err(e: impl std::fmt::Display) -> AppError {
    AppError::Db(format!("registro de bóvedas: {e}"))
}

/// Lee el registro; si no existe, crea la bóveda inicial "Mi bóveda".
pub fn load(dir: &Path) -> AppResult<Registry> {
    let path = dir.join(REGISTRY_FILE);
    let mut reg: Registry = match std::fs::read_to_string(&path) {
        Ok(text) => serde_json::from_str(&text).map_err(io_err)?,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Registry::default(),
        Err(e) => return Err(io_err(e)),
    };
    if reg.vaults.is_empty() {
        reg.vaults.push(VaultInfo { id: "default".into(), name: "Mi bóveda".into(), file: DEFAULT_FILE.into() });
        reg.active_id = Some("default".into());
        save(dir, &reg)?;
    }
    Ok(reg)
}

/// Escritura atómica: archivo temporal y renombrado.
pub fn save(dir: &Path, reg: &Registry) -> AppResult<()> {
    let text = serde_json::to_string_pretty(reg).map_err(io_err)?;
    let tmp = dir.join(format!("{REGISTRY_FILE}.tmp"));
    std::fs::write(&tmp, text).map_err(io_err)?;
    std::fs::rename(&tmp, dir.join(REGISTRY_FILE)).map_err(io_err)
}

pub fn clean_name(raw: &str) -> AppResult<String> {
    let name = raw.trim();
    if name.is_empty() {
        return Err(AppError::Invalid("La bóveda necesita un nombre.".into()));
    }
    if name.chars().count() > 40 {
        return Err(AppError::Invalid("El nombre no puede pasar de 40 caracteres.".into()));
    }
    Ok(name.to_string())
}

pub fn new_vault(name: &str) -> AppResult<VaultInfo> {
    let id = format!("v{:x}", now_ms());
    Ok(VaultInfo { file: format!("vault-{id}.db"), id, name: clean_name(name)? })
}
