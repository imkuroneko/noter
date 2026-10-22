use crate::crypto::CryptoError;
use serde::Serialize;

/// Error que cruza la frontera con el frontend: `{ code, message? }`.
#[derive(Debug, Serialize)]
#[serde(tag = "code", content = "message")]
pub enum AppError {
    /// No hay una bóveda desbloqueada.
    Locked,
    NotFound,
    /// Entrada inválida; el mensaje se puede mostrar a la persona usuaria.
    Invalid(String),
    /// Contraseña o clave de recuperación incorrecta.
    BadPassword,
    /// Demasiados intentos fallidos: segundos que faltan para poder reintentar.
    Throttled(u64),
    /// Fallo interno (base de datos, archivos, criptografía); el detalle no es para mostrar tal cual.
    Db(String),
}

impl From<rusqlite::Error> for AppError {
    fn from(e: rusqlite::Error) -> Self {
        match e {
            rusqlite::Error::QueryReturnedNoRows => AppError::NotFound,
            other => AppError::Db(other.to_string()),
        }
    }
}

impl From<CryptoError> for AppError {
    fn from(e: CryptoError) -> Self {
        match e {
            CryptoError::BadSecret => AppError::BadPassword,
            CryptoError::Corrupt(m) => AppError::Db(format!("archivo de claves: {m}")),
            CryptoError::Random => AppError::Db("no se pudo generar aleatoriedad segura".into()),
        }
    }
}

pub type AppResult<T> = Result<T, AppError>;
