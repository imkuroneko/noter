//! Registro de bóvedas (`vaults.json` en la carpeta de datos) y archivos de claves.
//! Cada bóveda es su propio archivo .db; si está protegida, su encabezado de claves vive en
//! `<archivo>.keys.json` al lado.

use crate::crypto::KeyHeader;
use crate::error::{AppError, AppResult};
use crate::repo::now_ms;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

const REGISTRY_FILE: &str = "vaults.json";
/// Archivo de la primera bóveda; ya existía antes del registro.
const DEFAULT_FILE: &str = "noter-dev.db";
pub const DEFAULT_IDLE_MINUTES: u32 = 5;
pub const MAX_IDLE_MINUTES: u32 = 240;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VaultInfo {
    pub id: String,
    pub name: String,
    pub file: String,
    /// Carpeta elegida por la persona (ruta completa). None = carpeta de datos de la app.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub dir: Option<String>,
    /// true si la base está cifrada y existe su archivo de claves.
    #[serde(default)]
    pub encrypted: bool,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Registry {
    pub vaults: Vec<VaultInfo>,
    pub active_id: Option<String>,
    /// Minutos de inactividad para bloquear solo las bóvedas protegidas; 0 = nunca.
    pub idle_minutes: u32,
}

impl Default for Registry {
    fn default() -> Self {
        Self { vaults: Vec::new(), active_id: None, idle_minutes: DEFAULT_IDLE_MINUTES }
    }
}

pub fn io_err(e: impl std::fmt::Display) -> AppError {
    AppError::Db(format!("archivos de la bóveda: {e}"))
}

/// Lee el registro; si no existe, crea la bóveda inicial "Mi bóveda".
pub fn load(dir: &Path) -> AppResult<Registry> {
    let path = dir.join(REGISTRY_FILE);
    let mut reg: Registry = match std::fs::read_to_string(&path) {
        Ok(text) => serde_json::from_str(&text).map_err(io_err)?,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Registry::default(),
        Err(e) => return Err(io_err(e)),
    };
    if let Some(bad) = reg.vaults.iter().find(|v| !is_safe_file_name(&v.file)) {
        return Err(AppError::Db(format!("vaults.json trae un nombre de archivo no permitido: {}", bad.id)));
    }
    if reg.vaults.is_empty() {
        reg.vaults.push(VaultInfo { id: "default".into(), name: "Mi bóveda".into(), file: DEFAULT_FILE.into(), dir: None, encrypted: false });
        reg.active_id = Some("default".into());
        save(dir, &reg)?;
    }
    Ok(reg)
}

/// Escritura atómica: archivo temporal y renombrado.
fn write_atomic(path: &Path, text: &str) -> AppResult<()> {
    use std::io::Write;
    let mut tmp = path.as_os_str().to_owned();
    tmp.push(".tmp");
    let tmp = PathBuf::from(tmp);
    let mut file = std::fs::File::create(&tmp).map_err(io_err)?;
    file.write_all(text.as_bytes()).map_err(io_err)?;
    // Forzar a disco antes de reemplazar: un corte de luz no debe dejar el archivo vacío.
    file.sync_all().map_err(io_err)?;
    drop(file);
    std::fs::rename(&tmp, path).map_err(io_err)
}

/// Nombre de archivo de un solo componente: sin carpetas, sin "..", sin caracteres que Windows
/// no admite ni de control. Se permiten espacios y letras con tilde (los nombres los elige la persona).
pub fn is_safe_file_name(name: &str) -> bool {
    !name.is_empty()
        && name.chars().count() <= 120
        && !name.starts_with('.')
        && !name.contains("..")
        && !name.ends_with([' ', '.'])
        && name.chars().all(|c| !c.is_control() && !matches!(c, '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|'))
}

pub fn save(dir: &Path, reg: &Registry) -> AppResult<()> {
    let text = serde_json::to_string_pretty(reg).map_err(io_err)?;
    write_atomic(&dir.join(REGISTRY_FILE), &text)
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
    Ok(VaultInfo { file: format!("vault-{id}.db"), id, name: clean_name(name)?, dir: None, encrypted: false })
}

/// Id que no choca con los ya registrados.
pub fn unique_id(reg: &Registry) -> String {
    let mut n = now_ms();
    loop {
        let id = format!("v{n:x}");
        if !reg.vaults.iter().any(|v| v.id == id) {
            return id;
        }
        n += 1;
    }
}

/// Valida una carpeta elegida por la persona: ruta completa, existente y con permiso de escritura.
pub fn check_folder(raw: &str) -> AppResult<PathBuf> {
    let path = PathBuf::from(raw);
    if !path.is_absolute() {
        return Err(AppError::Invalid("Elige una carpeta con su ruta completa.".into()));
    }
    if !path.is_dir() {
        return Err(AppError::Invalid("La carpeta elegida no existe.".into()));
    }
    let probe = path.join(".noter-prueba-escritura");
    std::fs::File::create(&probe)
        .map_err(|_| AppError::Invalid("No se puede escribir en esa carpeta. Elige otra.".into()))?;
    let _ = std::fs::remove_file(probe);
    Ok(path)
}

/// Nombre de archivo legible para una bóveda en una carpeta elegida: "Mi trabajo" -> "Mi trabajo.db",
/// y si ya existe, "Mi trabajo (2).db".
pub fn friendly_file_name(folder: &Path, name: &str) -> String {
    let base: String = name
        .chars()
        .map(|c| if c.is_control() || matches!(c, '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|') { '-' } else { c })
        .collect::<String>()
        .trim_matches(|c: char| c == '.' || c == ' ')
        .replace("..", ".");
    let base = if base.is_empty() { "Bóveda".to_string() } else { base };
    let mut n = 1;
    loop {
        let file = if n == 1 { format!("{base}.db") } else { format!("{base} ({n}).db") };
        if !folder.join(&file).exists() && !folder.join(format!("{file}.keys.json")).exists() {
            return file;
        }
        n += 1;
    }
}

/// Carpeta donde vive la bóveda: la elegida por la persona o la carpeta de datos de la app.
pub fn base_dir(dir: &Path, info: &VaultInfo) -> PathBuf {
    match &info.dir {
        Some(custom) => PathBuf::from(custom),
        None => dir.to_path_buf(),
    }
}

pub fn db_path(dir: &Path, info: &VaultInfo) -> PathBuf {
    base_dir(dir, info).join(&info.file)
}

pub fn keys_path(dir: &Path, info: &VaultInfo) -> PathBuf {
    base_dir(dir, info).join(format!("{}.keys.json", info.file))
}

pub fn read_header(dir: &Path, info: &VaultInfo) -> AppResult<KeyHeader> {
    let text = std::fs::read_to_string(keys_path(dir, info)).map_err(io_err)?;
    serde_json::from_str(&text).map_err(io_err)
}

pub fn write_header(dir: &Path, info: &VaultInfo, header: &KeyHeader) -> AppResult<()> {
    let text = serde_json::to_string_pretty(header).map_err(io_err)?;
    let path = keys_path(dir, info);
    // El archivo de claves es el único material para abrir la bóveda: se conserva la versión anterior.
    if path.exists() {
        let mut bak = path.as_os_str().to_owned();
        bak.push(".bak");
        let _ = std::fs::copy(&path, PathBuf::from(bak));
    }
    write_atomic(&path, &text)
}

pub fn backups_dir(dir: &Path) -> PathBuf {
    dir.join("backups")
}

/// Copias sin cifrar que dejó `protect`, para recordar al usuario que las borre.
pub fn list_backups(dir: &Path) -> Vec<String> {
    let mut names: Vec<String> = std::fs::read_dir(backups_dir(dir))
        .map(|rd| {
            rd.filter_map(|e| e.ok())
                .filter_map(|e| e.file_name().into_string().ok())
                .filter(|n| n.ends_with(".sin-cifrar"))
                .collect()
        })
        .unwrap_or_default();
    names.sort();
    names
}
