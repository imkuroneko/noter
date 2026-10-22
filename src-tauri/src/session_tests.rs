//! Pruebas del flujo completo de seguridad: crear, bloquear, desbloquear, proteger, recuperar.

use crate::error::AppError;
use crate::repo::*;
use crate::session;
use crate::state::AppState;
use crate::vaults;
use rusqlite::Connection;
use std::path::PathBuf;
use std::sync::atomic::Ordering::Relaxed;

/// Parámetros de Argon2 livianos para que las pruebas no tarden.
const FAST: (u32, u32, u32) = (64, 1, 1);
const PASS: &str = "contraseña-segura";

fn fresh(name: &str) -> (PathBuf, AppState) {
    let dir = std::env::temp_dir().join(format!("noter_sess_{name}_{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&dir);
    std::fs::create_dir_all(&dir).unwrap();
    let state = AppState::with_kdf(dir.clone(), FAST);
    (dir, state)
}

fn with<T>(state: &AppState, f: impl FnOnce(&Connection) -> T) -> T {
    let g = state.conn.lock().unwrap();
    f(g.as_ref().expect("hay una bóveda abierta"))
}

fn is_open(state: &AppState) -> bool {
    state.conn.lock().unwrap().is_some()
}

fn titles(state: &AppState) -> Vec<String> {
    with(state, |c| note_list(c, &ListParams::default()).unwrap().into_iter().map(|n| n.title).collect())
}

/// Crea una bóveda protegida con una nota "secreta" y la deja bloqueada.
fn protected_vault(state: &AppState) -> (String, String) {
    let (_, recovery) = session::create_vault(state, "Privada", Some(PASS), None).unwrap();
    let id = vaults::load(&state.dir).unwrap().vaults.last().unwrap().id.clone();
    session::unlock(state, &id, PASS).unwrap();
    with(state, |c| {
        let n = note_create(c, None).unwrap();
        note_update(c, n.id, "Secreto", "contenido-muy-privado").unwrap();
    });
    session::lock(state).unwrap();
    (id, recovery.expect("trae clave de recuperación"))
}

#[test]
fn bloquear_y_desbloquear_una_boveda_protegida() {
    let (_dir, state) = fresh("lock");
    session::activate(&state, "default").unwrap();
    let (id, _) = protected_vault(&state);

    // Bloqueada: no hay conexión y los comandos de datos dirían Locked.
    assert!(!is_open(&state));
    assert!(session::status(&state).unwrap().locked);
    assert_eq!(session::status(&state).unwrap().active_id.as_deref(), Some(id.as_str()));

    // Contraseña mala: se rechaza y sigue bloqueada.
    assert!(matches!(session::unlock(&state, &id, "otra-clave-larga"), Err(AppError::BadPassword)));
    assert!(!is_open(&state));

    // Contraseña buena: abre con los datos y la bóveda queda marcada para bloqueo por inactividad.
    session::unlock(&state, &id, PASS).unwrap();
    assert!(titles(&state).contains(&"Secreto".to_string()));
    assert!(state.auto_lock.load(Relaxed));
    assert!(!session::status(&state).unwrap().locked);
}

#[test]
fn el_archivo_cifrado_no_deja_texto_en_claro() {
    let (dir, state) = fresh("plain");
    session::activate(&state, "default").unwrap();
    let (id, _) = protected_vault(&state);
    let info = vaults::load(&dir).unwrap().vaults.into_iter().find(|v| v.id == id).unwrap();
    let raw = std::fs::read(vaults::db_path(&dir, &info)).unwrap();
    assert!(!raw.starts_with(b"SQLite format 3"));
    assert!(!String::from_utf8_lossy(&raw).contains("contenido-muy-privado"));
    // El archivo de claves tampoco contiene la contraseña ni la DEK en claro.
    let keys = std::fs::read_to_string(vaults::keys_path(&dir, &info)).unwrap();
    assert!(!keys.contains(PASS));
}

#[test]
fn tras_tres_fallos_hay_que_esperar() {
    let (_dir, state) = fresh("throttle");
    session::activate(&state, "default").unwrap();
    let (id, _) = protected_vault(&state);
    for _ in 0..3 {
        assert!(matches!(session::unlock(&state, &id, "mala-clave-larga"), Err(AppError::BadPassword)));
    }
    // Ahora incluso la contraseña correcta espera.
    assert!(matches!(session::unlock(&state, &id, PASS), Err(AppError::Throttled(s)) if s >= 1));
    assert!(!is_open(&state));
}

#[test]
fn la_clave_de_recuperacion_restablece_la_contrasena() {
    let (_dir, state) = fresh("recover");
    session::activate(&state, "default").unwrap();
    let (id, recovery) = protected_vault(&state);

    assert!(matches!(session::recover(&state, &id, "AAAA-BBBB-CCCC", "nueva-clave-larga"), Err(AppError::BadPassword)));
    assert!(matches!(session::recover(&state, &id, &recovery, "corta"), Err(AppError::Invalid(_))));

    session::recover(&state, &id, &recovery, "nueva-clave-larga").unwrap();
    assert!(titles(&state).contains(&"Secreto".to_string()));
    session::lock(&state).unwrap();
    assert!(matches!(session::unlock(&state, &id, PASS), Err(AppError::BadPassword)));
    session::unlock(&state, &id, "nueva-clave-larga").unwrap();
}

#[test]
fn cambiar_la_contrasena_no_toca_los_datos() {
    let (dir, state) = fresh("change");
    session::activate(&state, "default").unwrap();
    let (id, _) = protected_vault(&state);
    let info = vaults::load(&dir).unwrap().vaults.into_iter().find(|v| v.id == id).unwrap();
    let before = std::fs::read(vaults::db_path(&dir, &info)).unwrap();

    assert!(matches!(session::change_password(&state, &id, "no-es-la-clave", "otra-clave-larga"), Err(AppError::BadPassword)));
    session::change_password(&state, &id, PASS, "otra-clave-larga").unwrap();
    assert_eq!(std::fs::read(vaults::db_path(&dir, &info)).unwrap(), before, "la base no se reescribe");

    assert!(matches!(session::unlock(&state, &id, PASS), Err(AppError::BadPassword)));
    session::unlock(&state, &id, "otra-clave-larga").unwrap();
    assert!(titles(&state).contains(&"Secreto".to_string()));
}

#[test]
fn bloqueo_por_inactividad_solo_en_bovedas_protegidas() {
    let (_dir, state) = fresh("idle");
    session::activate(&state, "default").unwrap();

    // Sin contraseña: nunca se bloquea sola, aunque haya pasado mucho tiempo.
    state.last_touch.store(0, Relaxed);
    assert!(!session::idle_check(&state));
    assert!(is_open(&state));
    assert!(matches!(session::lock(&state), Err(AppError::Invalid(_))));

    // Protegida: se bloquea al pasar el tiempo configurado.
    let (id, _) = protected_vault(&state);
    session::unlock(&state, &id, PASS).unwrap();
    session::set_idle(&state, 5).unwrap();
    assert!(!session::idle_check(&state), "recién usada, no se bloquea");
    state.last_touch.store(crate::repo::now_ms() - 6 * 60_000, Relaxed);
    assert!(session::idle_check(&state));
    assert!(!is_open(&state));
    assert!(session::status(&state).unwrap().locked);

    // 0 minutos = nunca.
    session::unlock(&state, &id, PASS).unwrap();
    session::set_idle(&state, 0).unwrap();
    state.last_touch.store(0, Relaxed);
    assert!(!session::idle_check(&state));
}

#[test]
fn cambiar_a_una_boveda_protegida_pide_contrasena() {
    let (_dir, state) = fresh("switch");
    session::activate(&state, "default").unwrap();
    let (id, _) = protected_vault(&state);

    let st = session::activate(&state, "default").unwrap();
    assert!(!st.locked && is_open(&state));
    let st = session::activate(&state, &id).unwrap();
    assert!(st.locked && !is_open(&state), "la bóveda protegida espera contraseña");
    assert!(!state.auto_lock.load(Relaxed));
}

#[test]
fn proteger_la_boveda_existente_conserva_todo() {
    let (dir, state) = fresh("protect");
    session::activate(&state, "default").unwrap();
    // Datos de ejemplo + una nota con tildes y etiqueta para comprobar búsqueda y etiquetas.
    let (notes_before, tags_before) = with(&state, |c| {
        let n = note_create(c, None).unwrap();
        note_update(c, n.id, "Canción de cuna", "letra muy privada").unwrap();
        note_set_tags(c, n.id, &["música".into()]).unwrap();
        (note_list(c, &ListParams::default()).unwrap().len(), tag_list(c, None).unwrap().len())
    });
    let plain_path = dir.join("noter-dev.db");
    assert!(std::fs::read(&plain_path).unwrap().starts_with(b"SQLite format 3"));

    assert!(matches!(session::protect(&state, "corta"), Err(AppError::Invalid(_))));
    let done = session::protect(&state, PASS).unwrap();
    assert_eq!(done.recovery_key.len(), 52 + 12);

    // La base abierta ahora es la cifrada y tiene lo mismo, incluida la búsqueda.
    assert!(state.auto_lock.load(Relaxed));
    with(&state, |c| {
        assert_eq!(note_list(c, &ListParams::default()).unwrap().len(), notes_before);
        assert_eq!(tag_list(c, None).unwrap().len(), tags_before);
        let found = note_list(c, &ListParams { query: Some("cancion".into()), ..Default::default() }).unwrap();
        assert_eq!(found.len(), 1);
    });

    // El archivo de la bóveda ya no es SQLite en claro; la copia sin cifrar quedó aparte.
    assert!(!std::fs::read(&plain_path).unwrap().starts_with(b"SQLite format 3"));
    let backup = dir.join("backups").join(&done.backup_file);
    assert!(std::fs::read(&backup).unwrap().starts_with(b"SQLite format 3"));
    assert!(vaults::load(&dir).unwrap().vaults[0].encrypted);

    // Bloquear y abrir con la contraseña funciona; una segunda protección se rechaza.
    session::lock(&state).unwrap();
    session::unlock(&state, "default", PASS).unwrap();
    assert!(titles(&state).contains(&"Canción de cuna".to_string()));
    assert!(matches!(session::protect(&state, PASS), Err(AppError::Invalid(_))));

    // Reiniciar la app (estado nuevo, mismo disco): la bóveda arranca bloqueada.
    let restarted = AppState::with_kdf(dir.clone(), FAST);
    let st = session::activate(&restarted, "default").unwrap();
    assert!(st.locked && !is_open(&restarted));
}

#[test]
fn el_bloqueo_funciona_aunque_falle_el_registro_en_disco() {
    let (dir, state) = fresh("lockdisk");
    session::activate(&state, "default").unwrap();
    let (id, _) = protected_vault(&state);
    session::unlock(&state, &id, PASS).unwrap();
    // Se daña vaults.json: el bloqueo por inactividad debe cerrar igual.
    std::fs::write(dir.join("vaults.json"), "{ no es json").unwrap();
    state.last_touch.store(0, Relaxed);
    assert!(session::idle_check(&state), "debe bloquear sin leer el disco");
    assert!(!is_open(&state));
}

#[test]
fn intentos_simultaneos_no_saltan_el_limite() {
    use std::sync::Arc;
    let (_dir, state) = fresh("concurrent");
    session::activate(&state, "default").unwrap();
    let (id, _) = protected_vault(&state);
    let state = Arc::new(state);
    let handles: Vec<_> = (0..8)
        .map(|_| {
            let (s, id) = (state.clone(), id.clone());
            std::thread::spawn(move || session::unlock(&s, &id, "mala-clave-larga"))
        })
        .collect();
    let results: Vec<_> = handles.into_iter().map(|h| h.join().unwrap()).collect();
    let bad = results.iter().filter(|r| matches!(r, Err(AppError::BadPassword))).count();
    let throttled = results.iter().filter(|r| matches!(r, Err(AppError::Throttled(_)))).count();
    assert_eq!(bad, 3, "solo 3 intentos reales antes de la espera");
    assert_eq!(throttled, 5);
    assert!(matches!(session::unlock(&state, &id, PASS), Err(AppError::Throttled(_))));
}

#[test]
fn proteger_se_autorrepara_tras_un_corte() {
    let (dir, state) = fresh("crash");
    session::activate(&state, "default").unwrap();
    session::protect(&state, PASS).unwrap();
    session::lock(&state).unwrap();

    // Corte entre el cambio de archivos y el guardado del registro: el registro dice "sin contraseña".
    let mut reg = vaults::load(&dir).unwrap();
    reg.vaults[0].encrypted = false;
    vaults::save(&dir, &reg).unwrap();
    let restarted = AppState::with_kdf(dir.clone(), FAST);
    let st = session::activate(&restarted, "default").unwrap();
    assert!(st.locked, "manda el archivo: está cifrado, pide contraseña");
    assert!(st.vaults[0].encrypted);
    session::unlock(&restarted, "default", PASS).unwrap();
    assert!(titles(&restarted).contains(&"Bienvenida a Noter".to_string()));
}

#[test]
fn no_se_crea_una_base_vacia_si_falta_el_archivo() {
    let (dir, state) = fresh("missing");
    session::activate(&state, "default").unwrap();
    session::protect(&state, PASS).unwrap();
    session::lock(&state).unwrap();

    // Falta la base de una bóveda protegida: error claro, sin crear una vacía en su lugar.
    std::fs::remove_file(dir.join("noter-dev.db")).unwrap();
    let restarted = AppState::with_kdf(dir.clone(), FAST);
    assert!(matches!(session::activate(&restarted, "default"), Err(AppError::Invalid(_))));
    assert!(!dir.join("noter-dev.db").exists());

    // Una bóveda no inicial sin archivo tampoco se inventa.
    let (_dir2, state2) = fresh("missing2");
    session::create_vault(&state2, "Otra", None, None).unwrap();
    let info = vaults::load(&state2.dir).unwrap().vaults.pop().unwrap();
    std::fs::remove_file(vaults::db_path(&state2.dir, &info)).unwrap();
    assert!(matches!(session::activate(&state2, &info.id), Err(AppError::Invalid(_))));
}

#[test]
fn el_respaldo_sin_cifrar_se_puede_borrar_y_solo_ese_tipo_de_archivo() {
    let (dir, state) = fresh("backup");
    session::activate(&state, "default").unwrap();
    let done = session::protect(&state, PASS).unwrap();
    let st = session::status(&state).unwrap();
    assert_eq!(st.backups, vec![done.backup_file.clone()]);

    // Nombres con rutas o de otro tipo se rechazan.
    for bad in ["../vaults.json", "vaults.json", "..\\x.sin-cifrar", "", "a/b.sin-cifrar"] {
        assert!(matches!(session::delete_backup(&state, bad), Err(AppError::Invalid(_))), "{bad}");
    }
    assert!(dir.join("vaults.json").exists());

    let st = session::delete_backup(&state, &done.backup_file).unwrap();
    assert!(st.backups.is_empty());
    assert!(!dir.join("backups").join(&done.backup_file).exists());
    assert!(matches!(session::delete_backup(&state, &done.backup_file), Err(AppError::NotFound)));
}

#[test]
fn un_registro_con_rutas_peligrosas_se_rechaza() {
    let dir = std::env::temp_dir().join(format!("noter_reg_bad_{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&dir);
    std::fs::create_dir_all(&dir).unwrap();
    std::fs::write(
        dir.join("vaults.json"),
        r#"{"vaults":[{"id":"x","name":"X","file":"..\\..\\Windows\\sistema.db"}],"activeId":"x"}"#,
    )
    .unwrap();
    assert!(vaults::load(&dir).is_err());
    assert!(vaults::is_safe_file_name("vault-v1a2b.db"));
    for bad in ["../x.db", "a/b.db", ".oculto", "x..db", ""] {
        assert!(!vaults::is_safe_file_name(bad), "{bad}");
    }
}

#[test]
fn set_idle_exige_una_boveda_abierta() {
    let (_dir, state) = fresh("idleset");
    session::activate(&state, "default").unwrap();
    let (id, _) = protected_vault(&state); // queda bloqueada
    assert!(matches!(session::set_idle(&state, 0), Err(AppError::Locked)));
    session::unlock(&state, &id, PASS).unwrap();
    assert_eq!(session::set_idle(&state, 999).unwrap().idle_minutes, 240, "tope de 240 min");
}

fn temp_folder(name: &str) -> PathBuf {
    let p = std::env::temp_dir().join(format!("noter_loc_{name}_{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&p);
    std::fs::create_dir_all(&p).unwrap();
    p
}

#[test]
fn crear_una_boveda_en_una_carpeta_elegida() {
    let (dir, state) = fresh("custom");
    let folder = temp_folder("custom_dest");
    let folder_str = folder.to_string_lossy().into_owned();

    let (st, key) = session::create_vault(&state, "Mi trabajo", Some(PASS), Some(&folder_str)).unwrap();
    assert!(key.is_some());
    let v = st.vaults.last().unwrap();
    assert!(v.custom && v.available && v.encrypted);
    assert!(v.path.starts_with(&folder_str) && v.path.ends_with("Mi trabajo.db"));
    // Base y claves quedan juntas en la carpeta elegida, y nada en la carpeta de datos de la app.
    assert!(folder.join("Mi trabajo.db").exists() && folder.join("Mi trabajo.db.keys.json").exists());
    assert!(!dir.join("Mi trabajo.db").exists());

    // Un segundo "Mi trabajo" no pisa al primero.
    let (st, _) = session::create_vault(&state, "Mi trabajo", None, Some(&folder_str)).unwrap();
    assert!(st.vaults.last().unwrap().path.ends_with("Mi trabajo (2).db"));

    // Se puede abrir con la contraseña como cualquier otra.
    let id = st.vaults[st.vaults.len() - 2].id.clone();
    session::unlock(&state, &id, PASS).unwrap();

    // Carpetas inválidas.
    assert!(matches!(session::create_vault(&state, "X", None, Some("relativa/carpeta")), Err(AppError::Invalid(_))));
    assert!(matches!(
        session::create_vault(&state, "X", None, Some(folder.join("no-existe").to_str().unwrap())),
        Err(AppError::Invalid(_))
    ));
}

#[test]
fn abrir_una_boveda_existente_desde_su_archivo() {
    // "Equipo A" crea la bóveda en una carpeta compartida (por ejemplo, sincronizada).
    let (_dir_a, a) = fresh("open_a");
    let shared = temp_folder("shared");
    session::create_vault(&a, "Compartida", Some(PASS), Some(shared.to_str().unwrap())).unwrap();
    let id_a = vaults::load(&a.dir).unwrap().vaults.last().unwrap().id.clone();
    session::unlock(&a, &id_a, PASS).unwrap();
    with(&a, |c| {
        let n = note_create(c, None).unwrap();
        note_update(c, n.id, "Nota compartida", "hola").unwrap();
    });
    session::lock(&a).unwrap();

    // "Equipo B" (otra carpeta de datos) la agrega desde el archivo y la abre con la contraseña.
    let (_dir_b, b) = fresh("open_b");
    session::activate(&b, "default").unwrap();
    let file = shared.join("Compartida.db");
    let st = session::open_existing(&b, file.to_str().unwrap()).unwrap();
    let v = st.vaults.last().unwrap();
    assert_eq!(v.name, "Compartida");
    assert!(v.encrypted && v.custom);
    let id_b = v.id.clone();
    session::unlock(&b, &id_b, PASS).unwrap();
    assert!(titles(&b).contains(&"Nota compartida".to_string()));

    // No se agrega dos veces.
    assert!(matches!(session::open_existing(&b, file.to_str().unwrap()), Err(AppError::Invalid(_))));
}

#[test]
fn abrir_existente_rechaza_archivos_que_no_son_de_noter() {
    let (_dir, state) = fresh("notnoter");
    let folder = temp_folder("notnoter");

    // Un archivo cualquiera, uno vacío, una base SQLite ajena y uno cifrado sin su archivo de claves.
    std::fs::write(folder.join("texto.txt"), "hola").unwrap();
    std::fs::write(folder.join("otra.db"), "").unwrap();
    {
        let c = Connection::open(folder.join("ajena.db")).unwrap();
        c.execute_batch("CREATE TABLE contactos(id INTEGER); INSERT INTO contactos VALUES (1);").unwrap();
    }
    std::fs::write(folder.join("cifrada.db"), vec![7u8; 4096]).unwrap();

    for name in ["texto.txt", "otra.db", "ajena.db", "cifrada.db", "no-existe.db"] {
        let r = session::open_existing(&state, folder.join(name).to_str().unwrap());
        assert!(matches!(r, Err(AppError::Invalid(_))), "{name}: {r:?}");
    }
    // La base ajena no se tocó (no se migró ni se le agregaron tablas).
    let c = Connection::open(folder.join("ajena.db")).unwrap();
    let tables: i64 = c.query_row("SELECT COUNT(*) FROM sqlite_master WHERE type='table'", [], |r| r.get(0)).unwrap();
    assert_eq!(tables, 1);
    assert_eq!(vaults::load(&state.dir).unwrap().vaults.len(), 1);
}

#[test]
fn reubicar_una_boveda_movida_y_quitarla_de_la_lista() {
    let (_dir, state) = fresh("relocate");
    session::activate(&state, "default").unwrap();
    let old = temp_folder("reloc_old");
    let new = temp_folder("reloc_new");
    session::create_vault(&state, "Movible", Some(PASS), Some(old.to_str().unwrap())).unwrap();
    let id = vaults::load(&state.dir).unwrap().vaults.last().unwrap().id.clone();

    // La persona mueve los dos archivos a otra carpeta: la bóveda queda "no disponible".
    for f in ["Movible.db", "Movible.db.keys.json"] {
        std::fs::rename(old.join(f), new.join(f)).unwrap();
    }
    let st = session::status(&state).unwrap();
    assert!(!st.vaults.last().unwrap().available);
    assert!(matches!(session::activate(&state, &id), Err(AppError::Invalid(_))));

    // Se reubica apuntando al archivo nuevo y vuelve a abrir con la misma contraseña.
    let st = session::relocate(&state, &id, new.join("Movible.db").to_str().unwrap()).unwrap();
    assert!(st.vaults.last().unwrap().available);
    session::activate(&state, &id).unwrap();
    session::unlock(&state, &id, PASS).unwrap();

    // No se puede quitar la que se está usando; sí otra, y siempre debe quedar al menos una.
    assert!(matches!(session::forget(&state, &id), Err(AppError::Invalid(_))));
    let st = session::forget(&state, "default").unwrap();
    assert_eq!(st.vaults.len(), 1);
    assert!(matches!(session::forget(&state, &id), Err(AppError::Invalid(_))));
    // Quitar de la lista no borra archivos.
    assert!(new.join("Movible.db").exists());
}

#[test]
fn nombres_de_archivo_con_tildes_y_espacios_son_validos_pero_no_las_rutas() {
    for ok in ["Mi trabajo.db", "Bóveda de Ñandú.db", "notas (2).db", "vault-v1a2b.db"] {
        assert!(vaults::is_safe_file_name(ok), "{ok}");
    }
    for bad in ["a/b.db", "a\\b.db", "C:x.db", "..", ".db", "x..db", "x.db.", "x .", "co*n.db", "nul\0.db"] {
        assert!(!vaults::is_safe_file_name(bad), "{bad}");
    }
    let folder = temp_folder("friendly");
    assert_eq!(vaults::friendly_file_name(&folder, "Mi/trabajo: 2024"), "Mi-trabajo- 2024.db");
    assert_eq!(vaults::friendly_file_name(&folder, "..."), "Bóveda.db");
}

#[test]
fn las_bovedas_nuevas_pueden_ser_con_o_sin_contrasena() {
    let (dir, state) = fresh("create");
    assert!(matches!(session::create_vault(&state, "Corta", Some("1234"), None), Err(AppError::Invalid(_))));
    assert!(matches!(session::create_vault(&state, "  ", None, None), Err(AppError::Invalid(_))));

    let (st, none) = session::create_vault(&state, "Abierta", None, None).unwrap();
    assert!(none.is_none());
    assert!(!st.vaults.last().unwrap().encrypted);
    // Contraseña vacía equivale a sin contraseña.
    let (st, none) = session::create_vault(&state, "Vacía", Some(""), None).unwrap();
    assert!(none.is_none() && !st.vaults.last().unwrap().encrypted);

    let (st, key) = session::create_vault(&state, "Cerrada", Some(PASS), None).unwrap();
    assert!(key.is_some() && st.vaults.last().unwrap().encrypted);
    let info = vaults::load(&dir).unwrap().vaults.into_iter().find(|v| v.name == "Cerrada").unwrap();
    assert!(vaults::keys_path(&dir, &info).exists());
}
