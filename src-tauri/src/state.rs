use crate::crypto::DEFAULT_KDF;
use rusqlite::Connection;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Mutex;
use std::sync::atomic::{AtomicBool, AtomicI64, AtomicU32};
use std::time::Instant;

/// Intentos fallidos de desbloqueo de una bóveda.
pub struct Fails {
    pub count: u32,
    pub until: Instant,
}

/// Estado compartido de la app. `conn` es None mientras no haya una bóveda abierta
/// (por ejemplo, con la pantalla de bloqueo).
pub struct AppState {
    pub conn: Mutex<Option<Connection>>,
    /// Candado único de sesión: toda transición (abrir, bloquear, desbloquear, proteger, recuperar,
    /// cambiar contraseña) lo toma, así que no hay carreras ni intentos de contraseña simultáneos.
    pub session: Mutex<()>,
    /// Bóveda activa, en memoria: bloquear no debe depender de leer el disco.
    pub active: Mutex<Option<String>>,
    /// Carpeta de datos de la app (bases, archivos de claves y registro de bóvedas).
    pub dir: PathBuf,
    /// Bóveda protegida que está esperando contraseña en la pantalla de bloqueo.
    pub locked: Mutex<Option<String>>,
    pub fails: Mutex<HashMap<String, Fails>>,
    /// Último movimiento de la persona usuaria (epoch ms), para el bloqueo por inactividad.
    pub last_touch: AtomicI64,
    pub idle_minutes: AtomicU32,
    /// true mientras hay abierta una bóveda protegida (solo esas se bloquean por inactividad).
    pub auto_lock: AtomicBool,
    /// Parámetros de Argon2id (memoria KiB, pasadas, hilos); las pruebas usan unos más livianos.
    pub kdf: (u32, u32, u32),
}

impl AppState {
    pub fn new(dir: PathBuf) -> Self {
        Self::with_kdf(dir, DEFAULT_KDF)
    }

    pub fn with_kdf(dir: PathBuf, kdf: (u32, u32, u32)) -> Self {
        Self {
            conn: Mutex::new(None),
            session: Mutex::new(()),
            active: Mutex::new(None),
            dir,
            locked: Mutex::new(None),
            fails: Mutex::new(HashMap::new()),
            last_touch: AtomicI64::new(crate::repo::now_ms()),
            idle_minutes: AtomicU32::new(crate::vaults::DEFAULT_IDLE_MINUTES),
            auto_lock: AtomicBool::new(false),
            kdf,
        }
    }
}
