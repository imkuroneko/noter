//! Sesión de bóvedas: abrir, bloquear, desbloquear, proteger con contraseña y recuperar.
//! No depende de Tauri; los comandos solo llaman a estas funciones.
//!
//! Reglas de seguridad:
//! - Un único candado de sesión cubre toda transición. Así los intentos de contraseña son
//!   secuenciales (el límite de intentos no se salta con peticiones simultáneas) y solo hay una
//!   derivación de clave a la vez (no se puede agotar la memoria con muchas en paralelo).
//! - Bloquear no depende del disco: la bóveda activa vive en memoria y la conexión se cierra siempre.
//! - La clave de datos (DEK) solo existe en memoria mientras se abre la base y se borra al soltarla.
//! - Tras 3 intentos fallidos se exige esperar (1, 2, 4... hasta 30 s) antes de reintentar.
//! - Una bóveda sin contraseña nunca se bloquea sola; solo las protegidas se bloquean por inactividad.
//! - El estado en disco se autorrepara: si un corte dejó el registro distinto de lo que dicen los
//!   archivos, manda el archivo (ver `reconcile`).

use crate::crypto::{self, CryptoError, Secret32};
use crate::db;
use crate::error::{AppError, AppResult};
use crate::repo;
use crate::state::{AppState, Fails};
use crate::vaults::{self, MAX_IDLE_MINUTES, Registry, VaultInfo};
use rusqlite::Connection;
use serde::Serialize;
use std::io::{Read, Write};
use std::path::Path;
use std::sync::MutexGuard;
use std::sync::atomic::Ordering::Relaxed;
use std::time::{Duration, Instant};

const MIN_PASSWORD_CHARS: usize = 8;
const FREE_ATTEMPTS: u32 = 3;
const MAX_DELAY_SECS: u64 = 30;
const SQLITE_HEADER: &[u8; 16] = b"SQLite format 3\0";
const BACKUP_SUFFIX: &str = ".sin-cifrar";

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultSummary {
    pub id: String,
    pub name: String,
    pub encrypted: bool,
    /// Ruta completa del archivo de la bóveda (para mostrarla).
    pub path: String,
    /// false si el archivo no está (por ejemplo, un disco desconectado): se puede reubicar o quitar de la lista.
    pub available: bool,
    /// true si la persona eligió la carpeta; false si está en la carpeta de datos de la app.
    pub custom: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultStatus {
    pub vaults: Vec<VaultSummary>,
    pub active_id: Option<String>,
    /// true si hay una bóveda protegida esperando contraseña (pantalla de bloqueo).
    pub locked: bool,
    /// true si hay una bóveda abierta y lista para usar. Si no está bloqueada y esto es false,
    /// la bóveda activa no se pudo abrir (por ejemplo, falta su archivo).
    pub open: bool,
    pub idle_minutes: u32,
    /// Copias sin cifrar que dejó "proteger" y que conviene borrar (nombres dentro de `backups/`).
    pub backups: Vec<String>,
}

fn poisoned<T>(_: T) -> AppError {
    AppError::Db("estado interno corrupto".into())
}

fn conn_guard(state: &AppState) -> AppResult<MutexGuard<'_, Option<Connection>>> {
    state.conn.lock().map_err(poisoned)
}

/// Candado de sesión para otros módulos (la importación).
pub fn session_lock(state: &AppState) -> AppResult<MutexGuard<'_, ()>> {
    session_guard(state)
}

fn session_guard(state: &AppState) -> AppResult<MutexGuard<'_, ()>> {
    state.session.lock().map_err(poisoned)
}

pub fn touch(state: &AppState) {
    state.last_touch.store(repo::now_ms(), Relaxed);
}

fn find(reg: &Registry, id: &str) -> AppResult<VaultInfo> {
    reg.vaults.iter().find(|v| v.id == id).cloned().ok_or(AppError::NotFound)
}

pub fn status(state: &AppState) -> AppResult<VaultStatus> {
    let reg = vaults::load(&state.dir)?;
    let locked_id = state.locked.lock().map_err(poisoned)?.clone();
    let locked = locked_id.is_some();
    Ok(VaultStatus {
        vaults: reg
            .vaults
            .iter()
            .map(|v| {
                let path = vaults::db_path(&state.dir, v);
                VaultSummary {
                    id: v.id.clone(),
                    name: v.name.clone(),
                    encrypted: v.encrypted,
                    // La bóveda inicial aún no tiene archivo en el primer arranque: no es "no disponible".
                    available: path.exists() || (v.id == "default" && v.dir.is_none()),
                    path: path.to_string_lossy().into_owned(),
                    custom: v.dir.is_some(),
                }
            })
            .collect(),
        active_id: locked_id.or(reg.active_id),
        locked,
        open: conn_guard(state)?.is_some(),
        idle_minutes: reg.idle_minutes,
        backups: vaults::list_backups(&state.dir),
    })
}

fn check_password(password: &str) -> AppResult<()> {
    if password.chars().count() < MIN_PASSWORD_CHARS {
        return Err(AppError::Invalid(format!("La contraseña debe tener al menos {MIN_PASSWORD_CHARS} caracteres.")));
    }
    Ok(())
}

// ---------- Intentos fallidos ----------

fn throttle_check(state: &AppState, id: &str) -> AppResult<()> {
    let fails = state.fails.lock().map_err(poisoned)?;
    if let Some(f) = fails.get(id) {
        let now = Instant::now();
        if now < f.until {
            return Err(AppError::Throttled((f.until - now).as_secs() + 1));
        }
    }
    Ok(())
}

fn register_fail(state: &AppState, id: &str) {
    if let Ok(mut fails) = state.fails.lock() {
        let f = fails.entry(id.to_string()).or_insert(Fails { count: 0, until: Instant::now() });
        f.count += 1;
        if f.count >= FREE_ATTEMPTS {
            let secs = (1u64 << (f.count - FREE_ATTEMPTS).min(5)).min(MAX_DELAY_SECS);
            f.until = Instant::now() + Duration::from_secs(secs);
        }
    }
}

fn clear_fails(state: &AppState, id: &str) {
    if let Ok(mut fails) = state.fails.lock() {
        fails.remove(id);
    }
}

/// Convierte un error de criptografía y, si fue una clave incorrecta, cuenta el intento fallido.
fn secret_error(state: &AppState, id: &str, e: CryptoError) -> AppError {
    if e == CryptoError::BadSecret {
        register_fail(state, id);
    }
    e.into()
}

// ---------- Estado de los archivos ----------

#[derive(PartialEq, Eq)]
enum FileKind {
    Missing,
    /// SQLite en claro (o vacío).
    Plain,
    /// Existe y no es SQLite en claro: está cifrado.
    Other,
}

fn file_kind(path: &Path) -> FileKind {
    let Ok(mut f) = std::fs::File::open(path) else { return FileKind::Missing };
    let mut head = [0u8; 16];
    match f.read(&mut head) {
        Ok(0) => FileKind::Plain,
        Ok(n) if n < 16 => FileKind::Other,
        Ok(_) => if &head == SQLITE_HEADER { FileKind::Plain } else { FileKind::Other },
        Err(_) => FileKind::Other,
    }
}

fn corrupt_vault() -> AppError {
    AppError::Invalid(
        "No se encontró el archivo de esta bóveda o falta su archivo de claves. Si estabas protegiéndola, \
         revisa la carpeta de datos de la app (archivos .enc.tmp y la carpeta backups)."
            .into(),
    )
}

/// Devuelve la bóveda `id` con su estado de cifrado corregido según lo que dicen los archivos.
/// Si un corte de luz dejó el registro y los archivos en desacuerdo, manda el archivo:
/// SQLite en claro = sin contraseña; otra cosa más un .keys.json = cifrada.
fn reconcile(state: &AppState, reg: &mut Registry, id: &str) -> AppResult<VaultInfo> {
    let mut info = find(reg, id)?;
    let path = vaults::db_path(&state.dir, &info);
    let has_keys = vaults::keys_path(&state.dir, &info).exists();
    let real_encrypted = match file_kind(&path) {
        FileKind::Missing => {
            // Solo la bóveda inicial puede no tener archivo todavía (primer arranque).
            if has_keys || info.id != "default" {
                return Err(corrupt_vault());
            }
            false
        }
        FileKind::Plain => false,
        FileKind::Other => {
            if !has_keys {
                return Err(corrupt_vault());
            }
            true
        }
    };
    if real_encrypted != info.encrypted {
        info.encrypted = real_encrypted;
        if let Some(v) = reg.vaults.iter_mut().find(|v| v.id == id) {
            v.encrypted = real_encrypted;
        }
        vaults::save(&state.dir, reg)?;
    }
    Ok(info)
}

// ---------- Abrir y cerrar ----------

/// Cierra la conexión actual (con checkpoint del WAL) y deja de vigilar la inactividad.
/// No lee ni escribe el registro: siempre debe poder ejecutarse.
fn close_current(state: &AppState) {
    let mut guard = match state.conn.lock() {
        Ok(g) => g,
        Err(poisoned) => poisoned.into_inner(),
    };
    if let Some(conn) = guard.take() {
        let _ = conn.query_row("PRAGMA wal_checkpoint(TRUNCATE)", [], |_| Ok(()));
        drop(conn);
    }
    state.auto_lock.store(false, Relaxed);
}

/// Deja `conn` como la bóveda abierta (la anterior se cierra al soltarse).
fn install(state: &AppState, conn: Connection, info: &VaultInfo) -> AppResult<()> {
    repo::seed_if_new(&conn)?;
    *conn_guard(state)? = Some(conn);
    *state.locked.lock().map_err(poisoned)? = None;
    *state.active.lock().map_err(poisoned)? = Some(info.id.clone());
    state.auto_lock.store(info.encrypted, Relaxed);
    touch(state);
    Ok(())
}

fn open_with_dek(state: &AppState, info: &VaultInfo, dek: &Secret32) -> AppResult<()> {
    let path = vaults::db_path(&state.dir, info);
    if !path.exists() {
        return Err(corrupt_vault());
    }
    let key = crypto::sql_key(dek);
    let conn = db::open(&path, &key)?;
    install(state, conn, info)
}

fn set_active(state: &AppState, reg: &mut Registry, id: &str) -> AppResult<()> {
    reg.active_id = Some(id.to_string());
    vaults::save(&state.dir, reg)
}

/// Cambia a la bóveda `id`. Si está protegida, queda esperando contraseña (la anterior se cierra).
pub fn activate(state: &AppState, id: &str) -> AppResult<VaultStatus> {
    let _session = session_guard(state)?;
    let mut reg = vaults::load(&state.dir)?;
    let info = reconcile(state, &mut reg, id)?;
    let already_open = conn_guard(state)?.is_some() && reg.active_id.as_deref() == Some(id);
    if !already_open {
        if info.encrypted {
            close_current(state);
            *state.locked.lock().map_err(poisoned)? = Some(info.id.clone());
            *state.active.lock().map_err(poisoned)? = Some(info.id.clone());
        } else {
            let conn = db::open(&vaults::db_path(&state.dir, &info), "")?;
            install(state, conn, &info)?;
        }
        set_active(state, &mut reg, id)?;
    }
    status(state)
}

pub fn unlock(state: &AppState, id: &str, password: &str) -> AppResult<VaultStatus> {
    let _session = session_guard(state)?;
    let mut reg = vaults::load(&state.dir)?;
    let info = reconcile(state, &mut reg, id)?;
    if !info.encrypted {
        return Err(AppError::Invalid("Esta bóveda no tiene contraseña.".into()));
    }
    throttle_check(state, id)?;
    let header = vaults::read_header(&state.dir, &info)?;
    let dek = crypto::unlock_with_password(&header, password).map_err(|e| secret_error(state, id, e))?;
    close_current(state);
    open_with_dek(state, &info, &dek)?;
    clear_fails(state, id);
    set_active(state, &mut reg, id)?;
    status(state)
}

fn lock_inner(state: &AppState) -> AppResult<()> {
    if !state.auto_lock.load(Relaxed) {
        return Err(AppError::Invalid("Esta bóveda no tiene contraseña. Protégela primero para poder bloquearla.".into()));
    }
    let id = state.active.lock().map_err(poisoned)?.clone().ok_or(AppError::NotFound)?;
    close_current(state);
    *state.locked.lock().map_err(poisoned)? = Some(id);
    Ok(())
}

/// Bloquea la bóveda protegida que está abierta: cierra la conexión y muestra la pantalla de bloqueo.
pub fn lock(state: &AppState) -> AppResult<VaultStatus> {
    let _session = session_guard(state)?;
    lock_inner(state)?;
    status(state)
}

/// Bloqueo por inactividad. Devuelve true si la bóveda quedó bloqueada. No depende del disco.
pub fn idle_check(state: &AppState) -> bool {
    if !state.auto_lock.load(Relaxed) {
        return false;
    }
    let minutes = state.idle_minutes.load(Relaxed) as i64;
    if minutes == 0 || repo::now_ms() - state.last_touch.load(Relaxed) < minutes * 60_000 {
        return false;
    }
    let Ok(_session) = session_guard(state) else { return false };
    lock_inner(state).is_ok()
}

/// Cambia el tiempo de inactividad. Exige una bóveda abierta: con la pantalla de bloqueo no se toca.
pub fn set_idle(state: &AppState, minutes: u32) -> AppResult<VaultStatus> {
    let _session = session_guard(state)?;
    if conn_guard(state)?.is_none() {
        return Err(AppError::Locked);
    }
    let minutes = minutes.min(MAX_IDLE_MINUTES);
    let mut reg = vaults::load(&state.dir)?;
    reg.idle_minutes = minutes;
    vaults::save(&state.dir, &reg)?;
    state.idle_minutes.store(minutes, Relaxed);
    status(state)
}

// ---------- Crear y proteger ----------

fn remove_db_files(path: &Path) {
    for suffix in ["", "-wal", "-shm"] {
        let mut p = path.as_os_str().to_owned();
        p.push(suffix);
        let _ = std::fs::remove_file(p);
    }
}

/// Crea una bóveda nueva (no cambia a ella). Con contraseña, nace cifrada y devuelve la clave de
/// recuperación, que solo se puede ver esta vez.
pub fn create_vault(
    state: &AppState,
    name: &str,
    password: Option<&str>,
    folder: Option<&str>,
) -> AppResult<(VaultStatus, Option<String>)> {
    let _session = session_guard(state)?;
    let mut reg = vaults::load(&state.dir)?;
    let mut info = vaults::new_vault(name)?;
    info.id = vaults::unique_id(&reg);
    if let Some(raw) = folder.filter(|f| !f.is_empty()) {
        let folder = vaults::check_folder(raw)?;
        info.file = vaults::friendly_file_name(&folder, &info.name);
        info.dir = Some(folder.to_string_lossy().into_owned());
    } else {
        info.file = format!("vault-{}.db", info.id);
    }
    let path = vaults::db_path(&state.dir, &info);
    let mut recovery = None;
    if let Some(pw) = password.filter(|p| !p.is_empty()) {
        check_password(pw)?;
        let (header, dek, recovery_key) = crypto::create(pw, state.kdf)?;
        let key = crypto::sql_key(&dek);
        drop(db::open(&path, &key)?);
        if let Err(e) = vaults::write_header(&state.dir, &info, &header) {
            remove_db_files(&path);
            return Err(e);
        }
        info.encrypted = true;
        recovery = Some(recovery_key.to_string());
    } else {
        // Se crea ya el archivo: así una base que falte después se detecta como anomalía.
        drop(db::open(&path, "")?);
    }
    reg.vaults.push(info);
    vaults::save(&state.dir, &reg)?;
    Ok((status(state)?, recovery))
}

/// Resultado de proteger una bóveda existente.
pub struct Protected {
    pub recovery_key: String,
    /// Nombre del archivo con la copia sin cifrar, dentro de la carpeta `backups`.
    pub backup_file: String,
}

/// Convierte la bóveda activa (sin contraseña) en una cifrada, sin perder notas. Copia los datos
/// a una base nueva cifrada, verifica que coincidan y solo entonces la reemplaza; la base original
/// queda como copia de respaldo sin cifrar en `backups/`. Si algo falla, se deshace.
pub fn protect(state: &AppState, password: &str) -> AppResult<Protected> {
    let _session = session_guard(state)?;
    check_password(password)?;
    let mut reg = vaults::load(&state.dir)?;
    let id = state.active.lock().map_err(poisoned)?.clone().ok_or(AppError::NotFound)?;
    let info = reconcile(state, &mut reg, &id)?;
    if info.encrypted || state.auto_lock.load(Relaxed) {
        return Err(AppError::Invalid("Esta bóveda ya tiene contraseña.".into()));
    }
    {
        // El checkpoint debe completarse: lo que siga en el WAL tiene que quedar en la copia.
        let guard = conn_guard(state)?;
        let conn = guard.as_ref().ok_or(AppError::Locked)?;
        let busy: i64 = conn.query_row("PRAGMA wal_checkpoint(TRUNCATE)", [], |r| r.get(0))?;
        if busy != 0 {
            return Err(AppError::Invalid("La bóveda está ocupada; inténtalo de nuevo en unos segundos.".into()));
        }
    }
    // Soltar la conexión original libera el archivo.
    close_current(state);
    let plain_path = vaults::db_path(&state.dir, &info);
    match protect_files(state, &info, password) {
        Ok((dek, recovery_key, backup_file)) => {
            let mut encrypted_info = info.clone();
            encrypted_info.encrypted = true;
            let mut finish = || -> AppResult<()> {
                open_with_dek(state, &encrypted_info, &dek)?;
                if let Some(v) = reg.vaults.iter_mut().find(|v| v.id == id) {
                    v.encrypted = true;
                }
                vaults::save(&state.dir, &reg)
            };
            if let Err(e) = finish() {
                // Deshacer: la base original vuelve a su sitio y la app sigue con ella.
                close_current(state);
                remove_db_files(&plain_path);
                let _ = std::fs::rename(vaults::backups_dir(&state.dir).join(&backup_file), &plain_path);
                if let Ok(conn) = db::open(&plain_path, "") {
                    let _ = install(state, conn, &info);
                }
                return Err(e);
            }
            Ok(Protected { recovery_key, backup_file })
        }
        Err(e) => {
            // Falló antes de tocar la original: se vuelve a abrir para no dejar la app sin datos.
            if let Ok(conn) = db::open(&plain_path, "") {
                let _ = install(state, conn, &info);
            }
            Err(e)
        }
    }
}

const COPY_TABLES: [&str; 5] = ["categories", "tags", "notes", "note_tags", "settings"];

fn protect_files(state: &AppState, info: &VaultInfo, password: &str) -> AppResult<(Secret32, String, String)> {
    let plain = vaults::db_path(&state.dir, info);
    let tmp = plain.with_file_name(format!("{}.enc.tmp", info.file));
    remove_db_files(&tmp);

    let (header, dek, recovery_key) = crypto::create(password, state.kdf)?;
    let key = crypto::sql_key(&dek);

    let copy = || -> AppResult<()> {
        let enc = db::open(&tmp, &key)?;
        enc.execute("ATTACH DATABASE ?1 AS old KEY ''", [plain.to_string_lossy().as_ref()])?;

        // Si una migración futura agrega tablas, no se migra en silencio: se detiene.
        let mut stmt = enc.prepare(
            "SELECT name FROM old.sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' \
             AND name NOT LIKE 'notes_fts%' ORDER BY name",
        )?;
        let found: Vec<String> = stmt.query_map([], |r| r.get(0))?.collect::<Result<_, _>>()?;
        drop(stmt);
        let mut expected: Vec<String> = COPY_TABLES.iter().map(|s| s.to_string()).collect();
        expected.sort();
        if found != expected {
            return Err(AppError::Db(format!("la base tiene tablas que la protección no conoce: {found:?}")));
        }

        let tx = enc.unchecked_transaction()?;
        for t in COPY_TABLES {
            tx.execute_batch(&format!("INSERT INTO main.{t} SELECT * FROM old.{t};"))?;
        }
        for t in COPY_TABLES {
            let before: i64 = tx.query_row(&format!("SELECT COUNT(*) FROM old.{t}"), [], |r| r.get(0))?;
            let after: i64 = tx.query_row(&format!("SELECT COUNT(*) FROM main.{t}"), [], |r| r.get(0))?;
            if before != after {
                return Err(AppError::Db(format!("la copia cifrada no coincide en {t}: {before} contra {after}")));
            }
        }
        tx.commit()?;
        let check: String = enc.query_row("PRAGMA main.integrity_check", [], |r| r.get(0))?;
        if check != "ok" {
            return Err(AppError::Db(format!("la base cifrada no pasó la verificación: {check}")));
        }
        enc.execute_batch("INSERT INTO notes_fts(notes_fts) VALUES('integrity-check')")?;
        enc.execute_batch("DETACH DATABASE old")?;
        Ok(())
    };
    if let Err(e) = copy() {
        remove_db_files(&tmp);
        return Err(e);
    }

    // La copia está verificada: guardar las claves y hacer el cambio de archivos.
    // Si un corte interrumpe esto, `reconcile` lo corrige al arrancar mirando los archivos.
    vaults::write_header(&state.dir, info, &header)?;
    let backups = vaults::backups_dir(&state.dir);
    std::fs::create_dir_all(&backups).map_err(vaults::io_err)?;
    let backup_file = format!("{}.{}{BACKUP_SUFFIX}", info.file, repo::now_ms());
    let backup_path = backups.join(&backup_file);
    std::fs::rename(&plain, &backup_path).map_err(vaults::io_err)?;
    if let Err(e) = std::fs::rename(&tmp, &plain) {
        let _ = std::fs::rename(&backup_path, &plain);
        remove_db_files(&tmp);
        return Err(vaults::io_err(e));
    }
    for suffix in ["-wal", "-shm"] {
        let mut p = plain.as_os_str().to_owned();
        p.push(suffix);
        let _ = std::fs::remove_file(p);
    }
    Ok((dek, recovery_key.to_string(), backup_file))
}

/// Borra una copia sin cifrar de `backups/`: primero la sobrescribe con ceros y luego la elimina.
/// (En discos SSD o con copias de sombra de Windows el contenido anterior puede seguir recuperable.)
pub fn delete_backup(state: &AppState, file: &str) -> AppResult<VaultStatus> {
    if !vaults::is_safe_file_name(file) || !file.ends_with(BACKUP_SUFFIX) {
        return Err(AppError::Invalid("Nombre de copia no válido.".into()));
    }
    let path = vaults::backups_dir(&state.dir).join(file);
    let len = std::fs::metadata(&path).map_err(|_| AppError::NotFound)?.len();
    {
        let mut f = std::fs::OpenOptions::new().write(true).open(&path).map_err(vaults::io_err)?;
        let zeros = vec![0u8; 64 * 1024];
        let mut left = len;
        while left > 0 {
            let n = left.min(zeros.len() as u64) as usize;
            f.write_all(&zeros[..n]).map_err(vaults::io_err)?;
            left -= n as u64;
        }
        f.sync_all().map_err(vaults::io_err)?;
    }
    std::fs::remove_file(&path).map_err(vaults::io_err)?;
    status(state)
}

// ---------- Ubicación de las bóvedas ----------

/// Describe el archivo de una bóveda existente que eligió la persona (sin tocar su contenido).
pub(crate) fn describe_file(path: &str) -> AppResult<VaultInfo> {
    let invalid = |m: &str| AppError::Invalid(m.to_string());
    let p = std::path::PathBuf::from(path);
    if !p.is_absolute() || !p.is_file() {
        return Err(invalid("Elige el archivo de una bóveda (.db)."));
    }
    let file = p.file_name().and_then(|f| f.to_str()).ok_or_else(|| invalid("El nombre del archivo no es válido."))?;
    if !vaults::is_safe_file_name(file) {
        return Err(invalid("El nombre del archivo no es válido."));
    }
    let folder = p.parent().ok_or_else(|| invalid("No se encontró la carpeta del archivo."))?;
    let stem = p.file_stem().and_then(|s| s.to_str()).unwrap_or("Bóveda");
    let mut info = VaultInfo {
        id: String::new(),
        name: vaults::clean_name(stem).unwrap_or_else(|_| "Bóveda".to_string()),
        file: file.to_string(),
        dir: Some(folder.to_string_lossy().into_owned()),
        encrypted: false,
    };
    match file_kind(&p) {
        FileKind::Missing => return Err(invalid("Elige el archivo de una bóveda (.db).")),
        FileKind::Plain => {
            // Solo lectura: no se migra ni se modifica un archivo que quizá no sea de Noter.
            let not_noter = || invalid("Este archivo no parece una bóveda de Noter.");
            let conn = Connection::open_with_flags(&p, rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY).map_err(|_| not_noter())?;
            let found: i64 = conn
                .query_row(
                    "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name IN ('notes', 'categories', 'tags')",
                    [],
                    |r| r.get(0),
                )
                .map_err(|_| not_noter())?;
            if found != 3 {
                return Err(not_noter());
            }
        }
        FileKind::Other => {
            if !vaults::keys_path(Path::new(""), &info).exists() {
                return Err(invalid("Falta el archivo de claves (.keys.json) junto a la bóveda. Cópialo a la misma carpeta."));
            }
            vaults::read_header(Path::new(""), &info).map_err(|_| invalid("El archivo de claves de esta bóveda no es válido."))?;
            info.encrypted = true;
        }
    }
    Ok(info)
}

fn same_file(a: &Path, b: &Path) -> bool {
    match (std::fs::canonicalize(a), std::fs::canonicalize(b)) {
        (Ok(x), Ok(y)) => x == y,
        _ => a == b,
    }
}

/// Agrega a la lista una bóveda que ya existe en otra carpeta (no cambia a ella).
pub fn open_existing(state: &AppState, path: &str) -> AppResult<VaultStatus> {
    let _session = session_guard(state)?;
    let mut reg = vaults::load(&state.dir)?;
    let mut info = describe_file(path)?;
    let new_path = vaults::db_path(&state.dir, &info);
    if reg.vaults.iter().any(|v| same_file(&vaults::db_path(&state.dir, v), &new_path)) {
        return Err(AppError::Invalid("Esa bóveda ya está en tu lista.".into()));
    }
    info.id = vaults::unique_id(&reg);
    reg.vaults.push(info);
    vaults::save(&state.dir, &reg)?;
    status(state)
}

/// Apunta una bóveda de la lista a otro archivo (por ejemplo, tras moverla de carpeta).
pub fn relocate(state: &AppState, id: &str, path: &str) -> AppResult<VaultStatus> {
    let _session = session_guard(state)?;
    let mut reg = vaults::load(&state.dir)?;
    find(&reg, id)?;
    let open_now = conn_guard(state)?.is_some() && state.active.lock().map_err(poisoned)?.as_deref() == Some(id);
    if open_now {
        return Err(AppError::Invalid("Cambia a otra bóveda antes de reubicar esta.".into()));
    }
    let found = describe_file(path)?;
    let new_path = vaults::db_path(&state.dir, &found);
    if reg.vaults.iter().any(|v| v.id != id && same_file(&vaults::db_path(&state.dir, v), &new_path)) {
        return Err(AppError::Invalid("Esa bóveda ya está en tu lista con otro nombre.".into()));
    }
    if let Some(v) = reg.vaults.iter_mut().find(|v| v.id == id) {
        v.file = found.file;
        v.dir = found.dir;
        v.encrypted = found.encrypted;
    }
    vaults::save(&state.dir, &reg)?;
    status(state)
}

/// Quita una bóveda de la lista sin borrar ningún archivo.
pub fn forget(state: &AppState, id: &str) -> AppResult<VaultStatus> {
    let _session = session_guard(state)?;
    let mut reg = vaults::load(&state.dir)?;
    find(&reg, id)?;
    let in_use = state.active.lock().map_err(poisoned)?.as_deref() == Some(id) && reg.active_id.as_deref() == Some(id);
    if in_use {
        return Err(AppError::Invalid("No puedes quitar la bóveda que estás usando. Cambia a otra primero.".into()));
    }
    if reg.vaults.len() <= 1 {
        return Err(AppError::Invalid("Debe quedar al menos una bóveda en la lista.".into()));
    }
    reg.vaults.retain(|v| v.id != id);
    vaults::save(&state.dir, &reg)?;
    clear_fails(state, id);
    status(state)
}

// ---------- Cambiar contraseña y recuperar ----------

pub fn change_password(state: &AppState, id: &str, old: &str, new: &str) -> AppResult<()> {
    let _session = session_guard(state)?;
    check_password(new)?;
    let mut reg = vaults::load(&state.dir)?;
    let info = reconcile(state, &mut reg, id)?;
    if !info.encrypted {
        return Err(AppError::Invalid("Esta bóveda no tiene contraseña.".into()));
    }
    throttle_check(state, id)?;
    let header = vaults::read_header(&state.dir, &info)?;
    let dek = crypto::unlock_with_password(&header, old).map_err(|e| secret_error(state, id, e))?;
    let next = crypto::rewrap_password(&header, &dek, new, state.kdf)?;
    vaults::write_header(&state.dir, &info, &next)?;
    clear_fails(state, id);
    Ok(())
}

/// Entra con la clave de recuperación y fija una contraseña nueva. La clave de recuperación sigue siendo válida.
pub fn recover(state: &AppState, id: &str, recovery_key: &str, new_password: &str) -> AppResult<VaultStatus> {
    let _session = session_guard(state)?;
    check_password(new_password)?;
    let mut reg = vaults::load(&state.dir)?;
    let info = reconcile(state, &mut reg, id)?;
    if !info.encrypted {
        return Err(AppError::Invalid("Esta bóveda no tiene contraseña.".into()));
    }
    throttle_check(state, id)?;
    let header = vaults::read_header(&state.dir, &info)?;
    let dek = crypto::unlock_with_recovery(&header, recovery_key).map_err(|e| secret_error(state, id, e))?;
    let next = crypto::rewrap_password(&header, &dek, new_password, state.kdf)?;
    vaults::write_header(&state.dir, &info, &next)?;
    close_current(state);
    open_with_dek(state, &info, &dek)?;
    clear_fails(state, id);
    set_active(state, &mut reg, id)?;
    status(state)
}
