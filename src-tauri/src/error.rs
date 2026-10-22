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
    /// Fallo interno de base de datos; el detalle no es para mostrar tal cual.
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

pub type AppResult<T> = Result<T, AppError>;
