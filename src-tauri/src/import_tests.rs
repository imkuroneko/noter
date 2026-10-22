//! Pruebas de la importación desde la bóveda de otra persona.

use crate::error::AppError;
use crate::import::{self, ImportOptions};
use crate::repo::*;
use crate::session;
use crate::state::AppState;
use crate::vaults;
use rusqlite::Connection;
use std::path::PathBuf;
use std::sync::atomic::{AtomicUsize, Ordering};

/// Cada llamada obtiene carpetas propias: las pruebas corren en paralelo y no deben pisarse.
static COUNTER: AtomicUsize = AtomicUsize::new(0);
fn unique() -> usize {
    COUNTER.fetch_add(1, Ordering::Relaxed)
}

const FAST: (u32, u32, u32) = (64, 1, 1);
const PASS: &str = "clave-de-mi-companero";

fn state(name: &str) -> AppState {
    let dir = std::env::temp_dir().join(format!("noter_imp_{name}_{}_{}", std::process::id(), unique()));
    let _ = std::fs::remove_dir_all(&dir);
    std::fs::create_dir_all(&dir).unwrap();
    AppState::with_kdf(dir, FAST)
}

fn folder(name: &str) -> PathBuf {
    let p = std::env::temp_dir().join(format!("noter_impdir_{name}_{}_{}", std::process::id(), unique()));
    let _ = std::fs::remove_dir_all(&p);
    std::fs::create_dir_all(&p).unwrap();
    p
}

fn with<T>(s: &AppState, f: impl FnOnce(&Connection) -> T) -> T {
    let g = s.conn.lock().unwrap();
    f(g.as_ref().expect("bóveda abierta"))
}

/// Bóveda "del compañero": protegida, con categorías, etiquetas, una nota repetida y una en la papelera.
/// Devuelve la ruta de su archivo .db y los ids de sus notas (en el orden en que se crearon).
fn colleague_vault(protected: bool) -> (PathBuf, Vec<i64>) {
    let theirs = state("theirs");
    let dest = folder(if protected { "theirs_enc" } else { "theirs_plain" });
    let pw = protected.then_some(PASS);
    session::create_vault(&theirs, "Del companero", pw, Some(dest.to_str().unwrap())).unwrap();
    let id = vaults::load(&theirs.dir).unwrap().vaults.last().unwrap().id.clone();
    if protected {
        session::unlock(&theirs, &id, PASS).unwrap();
    } else {
        session::activate(&theirs, &id).unwrap();
    }
    let ids = with(&theirs, |c| {
        let work = category_create(c, "ESTUDIO", "\u{1F393}", 200).unwrap(); // en mi bóveda existe "Estudio" (sembrada): se junta sin distinguir mayúsculas
        let rec = category_create(c, "Recetas", "\u{1F35E}", 150).unwrap(); // no existe en el destino
        let mut ids = Vec::new();
        for (title, body, cat, tags) in [
            ("Reunión semanal", "puntos de la reunión", Some(work.id), vec!["Reunión", "pendiente"]),
            ("Pan de masa madre", "harina y agua", Some(rec.id), vec!["receta", "pendiente"]),
            ("Sin categoría", "nota suelta", None, vec![]),
            ("Ya la tienes", "texto idéntico", Some(work.id), vec!["duplicada"]),
            ("Borrada", "esta estaba en la papelera", None, vec![]),
        ] {
            let n = note_create(c, cat).unwrap();
            note_update(c, n.id, title, body).unwrap();
            note_set_tags(c, n.id, &tags.iter().map(|s| s.to_string()).collect::<Vec<_>>()).unwrap();
            ids.push(n.id);
        }
        note_trash(c, *ids.last().unwrap()).unwrap();
        note_pin(c, ids[0], true).unwrap();
        ids
    });
    if protected {
        session::lock(&theirs).unwrap();
    }
    (dest.join("Del companero.db"), ids)
}

/// Mi bóveda abierta: viene con sus 4 categorías de ejemplo (incluida "Estudio") y una nota idéntica a una del compañero.
fn my_vault() -> AppState {
    let mine = state("mine");
    session::activate(&mine, "default").unwrap();
    with(&mine, |c| {
        let n = note_create(c, None).unwrap();
        note_update(c, n.id, "Ya la tienes", "texto idéntico").unwrap();
    });
    mine
}

fn opts(ids: Vec<i64>) -> ImportOptions {
    ImportOptions { note_ids: ids, keep_categories: true, target_category_id: None, skip_duplicates: true }
}

fn note_count(s: &AppState) -> usize {
    with(s, |c| note_list(c, &ListParams::default()).unwrap().len())
}

#[test]
fn inspeccionar_y_vista_previa_de_una_boveda_protegida() {
    let (path, ids) = colleague_vault(true);
    let mine = my_vault();
    let p = path.to_str().unwrap();

    let info = import::inspect(p).unwrap();
    assert!(info.encrypted);
    assert_eq!(info.name, "Del companero");

    // Sin contraseña o con una mala: se rechaza.
    assert!(matches!(import::preview(&mine, p, None), Err(AppError::Invalid(_))));
    assert!(matches!(import::preview(&mine, p, Some("otra-clave-larga")), Err(AppError::BadPassword)));

    let pv = import::preview(&mine, p, Some(PASS)).unwrap();
    // 4 notas del compañero + la de bienvenida que Noter siembra en toda bóveda nueva; la de la papelera no cuenta.
    assert_eq!(pv.total_notes, 5);
    assert_eq!(pv.notes.len(), 5);
    assert!(!pv.notes.iter().any(|n| n.title == "Borrada"));
    assert_eq!(pv.categories.len(), 6, "4 de ejemplo + ESTUDIO + Recetas");
    assert_eq!(pv.uncategorized, 1);
    assert!(pv.notes[0].pinned, "las fijadas primero");
    assert_eq!(pv.notes[0].id, ids[0]);
    let reunion = pv.notes.iter().find(|n| n.title == "Reunión semanal").unwrap();
    assert_eq!(reunion.tags.len(), 2);
    assert!(reunion.snippet.contains("puntos"));
}

#[test]
fn importar_conserva_categorias_etiquetas_y_omite_duplicados() {
    let (path, ids) = colleague_vault(true);
    let mine = my_vault();
    let before_original = std::fs::read(&path).unwrap();
    let before = note_count(&mine);

    let res = import::run(&mine, path.to_str().unwrap(), Some(PASS), &opts(ids[..4].to_vec())).unwrap();
    assert_eq!(res.imported, 3);
    assert_eq!(res.skipped_duplicates, 1, "«Ya la tienes» ya existe");
    assert_eq!(res.created_categories, 1, "solo «Recetas»: «ESTUDIO» se junta con «Estudio»");
    assert!(res.created_tags >= 3);
    assert_eq!(note_count(&mine), before + 3);

    with(&mine, |c| {
        let cats = category_list(c).unwrap();
        assert_eq!(cats.len(), 4 + 1, "las 4 de ejemplo + Recetas; nada tuyo cambió");
        let work = cats.iter().find(|x| x.name == "Estudio").unwrap();
        let recipes = cats.iter().find(|x| x.name == "Recetas").unwrap();
        let all = note_list(c, &ListParams { limit: Some(500), ..Default::default() }).unwrap();
        let reunion = all.iter().find(|n| n.title == "Reunión semanal").unwrap();
        assert_eq!(reunion.category_id, Some(work.id));
        assert_eq!(reunion.tags, vec!["pendiente", "reunión"]);
        assert!(reunion.pinned, "conserva fijada");
        let pan = all.iter().find(|n| n.title == "Pan de masa madre").unwrap();
        assert_eq!(pan.category_id, Some(recipes.id));
        let suelta = all.iter().find(|n| n.title == "Sin categoría").unwrap();
        assert_eq!(suelta.category_id, None);
        // La búsqueda ve lo importado.
        let found = note_list(c, &ListParams { query: Some("harina".into()), ..Default::default() }).unwrap();
        assert_eq!(found.len(), 1);
    });

    // El archivo original no se tocó y no quedan copias temporales.
    assert_eq!(std::fs::read(&path).unwrap(), before_original);
    let tmp = mine.dir.join("import-tmp");
    assert!(!tmp.exists() || std::fs::read_dir(&tmp).unwrap().next().is_none(), "temporales borrados");

    // Importar otra vez lo mismo no duplica nada.
    let again = import::run(&mine, path.to_str().unwrap(), Some(PASS), &opts(ids[..4].to_vec())).unwrap();
    assert_eq!((again.imported, again.skipped_duplicates), (0, 4));
}

#[test]
fn importar_todo_a_una_categoria_y_con_duplicados_permitidos() {
    let (path, ids) = colleague_vault(false);
    let mine = my_vault();
    let dest = with(&mine, |c| category_create(c, "Archivo", "\u{1F4E6}", 45).unwrap().id);
    let before = note_count(&mine);

    let o = ImportOptions { note_ids: ids[..4].to_vec(), keep_categories: false, target_category_id: Some(dest), skip_duplicates: false };
    let res = import::run(&mine, path.to_str().unwrap(), None, &o).unwrap();
    assert_eq!((res.imported, res.skipped_duplicates, res.created_categories), (4, 0, 0));
    assert_eq!(note_count(&mine), before + 4);
    with(&mine, |c| {
        let n = note_list(c, &ListParams { category_id: Some(dest), ..Default::default() }).unwrap();
        assert_eq!(n.len(), 4);
    });

    // Una categoría de destino que no existe se rechaza y no entra nada.
    let bad = ImportOptions { note_ids: ids[..1].to_vec(), keep_categories: false, target_category_id: Some(99999), skip_duplicates: false };
    assert!(matches!(import::run(&mine, path.to_str().unwrap(), None, &bad), Err(AppError::Invalid(_))));
    assert_eq!(note_count(&mine), before + 4);
}

#[test]
fn la_importacion_es_atomica_y_valida_lo_que_se_pide() {
    let (path, ids) = colleague_vault(false);
    let mine = my_vault();
    let p = path.to_str().unwrap();

    assert!(matches!(import::run(&mine, p, None, &opts(vec![])), Err(AppError::Invalid(_))));
    // Ids que no existen o la nota de la papelera: no hay nada que importar.
    assert!(matches!(import::run(&mine, p, None, &opts(vec![9999, *ids.last().unwrap()])), Err(AppError::Invalid(_))));

    // Con mi bóveda bloqueada no se importa nada.
    let (_dir, locked) = {
        let s = state("locked_target");
        session::activate(&s, "default").unwrap();
        session::protect(&s, "mi-clave-larga-1").unwrap();
        session::lock(&s).unwrap();
        (s.dir.clone(), s)
    };
    assert!(matches!(import::run(&locked, p, None, &opts(ids[..1].to_vec())), Err(AppError::Locked)));
}

#[test]
fn archivos_que_no_son_de_noter_o_de_otra_version_se_rechazan_sin_tocarlos() {
    let mine = my_vault();
    let dir = folder("hostile");

    // Una base ajena con tablas de otro tipo.
    let ajena = dir.join("ajena.db");
    Connection::open(&ajena).unwrap().execute_batch("CREATE TABLE contactos(id INTEGER);").unwrap();
    assert!(matches!(import::inspect(ajena.to_str().unwrap()), Err(AppError::Invalid(_))));

    // Tiene las 3 tablas pero con otras columnas (formato desconocido): se rechaza al leer.
    let rara = dir.join("rara.db");
    Connection::open(&rara)
        .unwrap()
        .execute_batch(
            "CREATE TABLE notes(id INTEGER, texto TEXT); CREATE TABLE categories(id INTEGER); CREATE TABLE tags(id INTEGER);",
        )
        .unwrap();
    let before = std::fs::read(&rara).unwrap();
    let r = import::preview(&mine, rara.to_str().unwrap(), None);
    assert!(matches!(r, Err(AppError::Invalid(_))), "{r:?}");
    assert_eq!(std::fs::read(&rara).unwrap(), before, "el archivo ajeno no se modifica");

    // Versión de esquema más nueva que la de esta app.
    let (path, _) = colleague_vault(false);
    {
        let c = Connection::open(&path).unwrap();
        c.execute_batch("PRAGMA user_version = 99;").unwrap();
    }
    assert!(matches!(import::preview(&mine, path.to_str().unwrap(), None), Err(AppError::Invalid(m)) if m.contains("más nueva")));

    // Los temporales no quedan aunque haya fallado.
    let tmp = mine.dir.join("import-tmp");
    assert!(!tmp.exists() || std::fs::read_dir(&tmp).unwrap().next().is_none());
}

#[test]
fn una_boveda_cifrada_sin_su_archivo_de_claves_pide_que_se_copie() {
    let (path, _) = colleague_vault(true);
    let mine = my_vault();
    std::fs::remove_file(format!("{}.keys.json", path.display())).unwrap();
    let r = import::inspect(path.to_str().unwrap());
    assert!(matches!(r, Err(AppError::Invalid(m)) if m.contains("claves")));
    let _ = mine;
}

#[test]
fn restos_de_una_importacion_interrumpida_se_limpian_al_arrancar() {
    let s = state("leftovers");
    let leftover = s.dir.join("import-tmp").join("123");
    std::fs::create_dir_all(&leftover).unwrap();
    std::fs::write(leftover.join("origen.db"), b"datos privados").unwrap();
    import::cleanup_leftovers(&s.dir);
    assert!(!s.dir.join("import-tmp").exists());
}
