//! Claves de bóveda: una clave de datos (DEK) aleatoria cifra la base con SQLCipher; la DEK vive
//! envuelta (XChaCha20-Poly1305) bajo una clave derivada de la contraseña (Argon2id) y, aparte,
//! bajo una clave de recuperación. Cambiar la contraseña solo re-envuelve la DEK: no se reescribe la base.
//!
//! Nada de este módulo escribe archivos ni toca la base; el llamador guarda el `KeyHeader`.

use argon2::{Algorithm, Argon2, Params, Version};
use base64::{Engine, engine::general_purpose::STANDARD as B64};
use chacha20poly1305::{
    Key, XChaCha20Poly1305, XNonce,
    aead::{Aead, KeyInit, Payload},
};
use serde::{Deserialize, Serialize};
use zeroize::Zeroizing;

/// 32 bytes que se borran de memoria al soltarse.
pub type Secret32 = Zeroizing<[u8; 32]>;

const HEADER_VERSION: u32 = 1;
const AAD_PASSWORD: &[u8] = b"noter/dek/password/v1";
const AAD_RECOVERY: &[u8] = b"noter/dek/recovery/v1";

/// Parámetros por defecto de Argon2id: 64 MiB, 3 pasadas, 1 hilo.
pub const DEFAULT_KDF: (u32, u32, u32) = (64 * 1024, 3, 1);
/// Límites al leer un archivo de claves, para que uno manipulado no pida memoria o tiempo absurdos.
const MAX_M_KIB: u32 = 1024 * 1024;
const MAX_T: u32 = 12;
const MAX_P: u32 = 8;

#[derive(Debug, PartialEq, Eq)]
pub enum CryptoError {
    /// Contraseña o clave de recuperación incorrecta (o datos alterados).
    BadSecret,
    /// El archivo de claves no es válido.
    Corrupt(String),
    /// Falló el generador de números aleatorios del sistema.
    Random,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Kdf {
    pub alg: String,
    pub m_kib: u32,
    pub t: u32,
    pub p: u32,
    pub salt: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Wrapped {
    pub nonce: String,
    pub ct: String,
}

/// Contenido del archivo `<bóveda>.keys.json`. No es secreto, pero sin la contraseña o la
/// clave de recuperación no sirve para descifrar nada.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KeyHeader {
    pub version: u32,
    pub kdf: Kdf,
    pub password: Wrapped,
    pub recovery: Option<Wrapped>,
}

fn random<const N: usize>() -> Result<[u8; N], CryptoError> {
    let mut buf = [0u8; N];
    getrandom::fill(&mut buf).map_err(|_| CryptoError::Random)?;
    Ok(buf)
}

fn corrupt(what: &str) -> CryptoError {
    CryptoError::Corrupt(what.to_string())
}

fn derive_kek(password: &str, kdf: &Kdf) -> Result<Secret32, CryptoError> {
    if kdf.alg != "argon2id" {
        return Err(corrupt("algoritmo de derivación desconocido"));
    }
    if kdf.m_kib > MAX_M_KIB || kdf.t > MAX_T || kdf.p > MAX_P {
        return Err(corrupt("parámetros de derivación fuera de rango"));
    }
    let salt = B64.decode(&kdf.salt).map_err(|_| corrupt("sal inválida"))?;
    let params = Params::new(kdf.m_kib, kdf.t, kdf.p, Some(32)).map_err(|_| corrupt("parámetros de derivación inválidos"))?;
    let mut out = Zeroizing::new([0u8; 32]);
    Argon2::new(Algorithm::Argon2id, Version::V0x13, params)
        .hash_password_into(password.as_bytes(), &salt, &mut *out)
        .map_err(|_| corrupt("falló la derivación de la clave"))?;
    Ok(out)
}

fn wrap(kek: &Secret32, aad: &[u8], dek: &Secret32) -> Result<Wrapped, CryptoError> {
    let nonce_bytes = random::<24>()?;
    let cipher = XChaCha20Poly1305::new(&Key::from(**kek));
    let ct = cipher
        .encrypt(&XNonce::from(nonce_bytes), Payload { msg: &dek[..], aad })
        .map_err(|_| corrupt("no se pudo envolver la clave"))?;
    Ok(Wrapped { nonce: B64.encode(nonce_bytes), ct: B64.encode(ct) })
}

fn unwrap(kek: &Secret32, aad: &[u8], w: &Wrapped) -> Result<Secret32, CryptoError> {
    let nonce: [u8; 24] = B64
        .decode(&w.nonce)
        .ok()
        .and_then(|v| v.try_into().ok())
        .ok_or_else(|| corrupt("nonce inválido"))?;
    let ct = B64.decode(&w.ct).map_err(|_| corrupt("datos de clave inválidos"))?;
    let cipher = XChaCha20Poly1305::new(&Key::from(**kek));
    let plain = Zeroizing::new(
        cipher
            .decrypt(&XNonce::from(nonce), Payload { msg: &ct, aad })
            .map_err(|_| CryptoError::BadSecret)?,
    );
    let arr: [u8; 32] = plain.as_slice().try_into().map_err(|_| corrupt("la clave de datos no mide 32 bytes"))?;
    Ok(Zeroizing::new(arr))
}

fn new_kdf(params: (u32, u32, u32)) -> Result<Kdf, CryptoError> {
    Ok(Kdf { alg: "argon2id".into(), m_kib: params.0, t: params.1, p: params.2, salt: B64.encode(random::<16>()?) })
}

/// Crea una bóveda nueva: devuelve el encabezado a guardar, la DEK y la clave de recuperación
/// (texto para mostrar una sola vez; solo se guarda su versión envuelta).
pub fn create(password: &str, params: (u32, u32, u32)) -> Result<(KeyHeader, Secret32, Zeroizing<String>), CryptoError> {
    let dek = Zeroizing::new(random::<32>()?);
    let kdf = new_kdf(params)?;
    let kek = derive_kek(password, &kdf)?;
    let password_wrapped = wrap(&kek, AAD_PASSWORD, &dek)?;

    let recovery_key = Zeroizing::new(random::<32>()?);
    let recovery_wrapped = wrap(&recovery_key, AAD_RECOVERY, &dek)?;
    let header = KeyHeader { version: HEADER_VERSION, kdf, password: password_wrapped, recovery: Some(recovery_wrapped) };
    Ok((header, dek, format_recovery_key(&recovery_key)))
}

pub fn unlock_with_password(header: &KeyHeader, password: &str) -> Result<Secret32, CryptoError> {
    check_version(header)?;
    let kek = derive_kek(password, &header.kdf)?;
    unwrap(&kek, AAD_PASSWORD, &header.password)
}

pub fn unlock_with_recovery(header: &KeyHeader, recovery_key: &str) -> Result<Secret32, CryptoError> {
    check_version(header)?;
    let wrapped = header.recovery.as_ref().ok_or_else(|| corrupt("esta bóveda no tiene clave de recuperación"))?;
    let key = parse_recovery_key(recovery_key).ok_or(CryptoError::BadSecret)?;
    unwrap(&key, AAD_RECOVERY, wrapped)
}

/// Nuevo encabezado con otra contraseña (sal nueva) para la misma DEK. La recuperación no cambia.
pub fn rewrap_password(
    header: &KeyHeader,
    dek: &Secret32,
    new_password: &str,
    params: (u32, u32, u32),
) -> Result<KeyHeader, CryptoError> {
    let kdf = new_kdf(params)?;
    let kek = derive_kek(new_password, &kdf)?;
    Ok(KeyHeader { version: HEADER_VERSION, kdf, password: wrap(&kek, AAD_PASSWORD, dek)?, recovery: header.recovery.clone() })
}

fn check_version(header: &KeyHeader) -> Result<(), CryptoError> {
    if header.version == HEADER_VERSION { Ok(()) } else { Err(corrupt("versión de archivo de claves no soportada")) }
}

/// Clave en el formato de SQLCipher para claves crudas: x'<64 hex>'.
pub fn sql_key(dek: &Secret32) -> Zeroizing<String> {
    Zeroizing::new(format!("x'{}'", data_encoding::HEXLOWER.encode(&dek[..])))
}

/// 52 caracteres base32 en grupos de 4 separados por guiones.
fn format_recovery_key(key: &Secret32) -> Zeroizing<String> {
    let raw = Zeroizing::new(data_encoding::BASE32_NOPAD.encode(&key[..]));
    let grouped: Vec<&str> = raw.as_bytes().chunks(4).map(|c| std::str::from_utf8(c).unwrap_or("")).collect();
    Zeroizing::new(grouped.join("-"))
}

/// Acepta mayúsculas o minúsculas, con o sin guiones y espacios.
fn parse_recovery_key(text: &str) -> Option<Secret32> {
    let cleaned: String = text.chars().filter(|c| c.is_ascii_alphanumeric()).collect::<String>().to_ascii_uppercase();
    let bytes = data_encoding::BASE32_NOPAD.decode(cleaned.as_bytes()).ok()?;
    let arr: [u8; 32] = bytes.try_into().ok()?;
    Some(Zeroizing::new(arr))
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Parámetros livianos para que las pruebas no tarden.
    const FAST: (u32, u32, u32) = (64, 1, 1);

    #[test]
    fn contrasena_correcta_abre_y_mala_falla() {
        let (header, dek, _) = create("una clave larga", FAST).unwrap();
        assert_eq!(*unlock_with_password(&header, "una clave larga").unwrap(), *dek);
        assert_eq!(unlock_with_password(&header, "otra").unwrap_err(), CryptoError::BadSecret);
        assert_eq!(unlock_with_password(&header, "").unwrap_err(), CryptoError::BadSecret);
    }

    #[test]
    fn clave_de_recuperacion_abre_con_cualquier_formato() {
        let (header, dek, recovery) = create("abcdefgh", FAST).unwrap();
        assert_eq!(recovery.len(), 52 + 12); // 52 caracteres + 12 guiones
        assert_eq!(*unlock_with_recovery(&header, &recovery).unwrap(), *dek);
        let loose = recovery.to_lowercase().replace('-', " ");
        assert_eq!(*unlock_with_recovery(&header, &loose).unwrap(), *dek);
        assert_eq!(unlock_with_recovery(&header, "AAAA-BBBB").unwrap_err(), CryptoError::BadSecret);
        assert_eq!(unlock_with_recovery(&header, "").unwrap_err(), CryptoError::BadSecret);
    }

    #[test]
    fn cambiar_contrasena_conserva_la_dek_y_la_recuperacion() {
        let (header, dek, recovery) = create("vieja-clave", FAST).unwrap();
        let unlocked = unlock_with_password(&header, "vieja-clave").unwrap();
        let next = rewrap_password(&header, &unlocked, "nueva-clave", FAST).unwrap();
        assert_ne!(next.kdf.salt, header.kdf.salt, "la sal debe renovarse");
        assert_eq!(*unlock_with_password(&next, "nueva-clave").unwrap(), *dek);
        assert_eq!(unlock_with_password(&next, "vieja-clave").unwrap_err(), CryptoError::BadSecret);
        assert_eq!(*unlock_with_recovery(&next, &recovery).unwrap(), *dek);
    }

    #[test]
    fn encabezado_alterado_o_con_parametros_absurdos_se_rechaza() {
        let (mut header, _, _) = create("clave-de-prueba", FAST).unwrap();
        let mut tampered = header.clone();
        tampered.password.ct = B64.encode([0u8; 48]);
        assert_eq!(unlock_with_password(&tampered, "clave-de-prueba").unwrap_err(), CryptoError::BadSecret);

        header.kdf.m_kib = u32::MAX;
        assert!(matches!(unlock_with_password(&header, "clave-de-prueba"), Err(CryptoError::Corrupt(_))));
        header.kdf.m_kib = 64;
        header.version = 99;
        assert!(matches!(unlock_with_password(&header, "clave-de-prueba"), Err(CryptoError::Corrupt(_))));
    }

    #[test]
    fn la_clave_sql_es_hex_crudo() {
        let (_, dek, _) = create("clave-de-prueba", FAST).unwrap();
        let key = sql_key(&dek);
        assert!(key.starts_with("x'") && key.ends_with('\'') && key.len() == 2 + 64 + 1);
    }

    #[test]
    fn cada_creacion_genera_claves_distintas() {
        let (_, a, ra) = create("clave-de-prueba", FAST).unwrap();
        let (_, b, rb) = create("clave-de-prueba", FAST).unwrap();
        assert_ne!(*a, *b);
        assert_ne!(*ra, *rb);
    }
}
