use crate::db;
use crate::error::AppError;
use crate::repo::*;
use rusqlite::Connection;

fn fresh(name: &str) -> (std::path::PathBuf, Connection) {
    let path = std::env::temp_dir().join(format!("noter_repo_{name}_{}.db", std::process::id()));
    for ext in ["", "-wal", "-shm"] {
        let _ = std::fs::remove_file(format!("{}{ext}", path.display()));
    }
    let conn = db::open(&path, "clave-de-prueba").unwrap();
    (path, conn)
}

#[test]
fn crud_notas_categorias_y_etiquetas() {
    let (_p, c) = fresh("crud");

    let cat = category_create(&c, " Estudio ", "\u{1F4DA}", 265).unwrap();
    assert_eq!(cat.name, "Estudio");
    assert!(matches!(category_create(&c, "  ", "x", 10), Err(AppError::Invalid(_))));
    assert!(matches!(category_create(&c, "A", "x", 400), Err(AppError::Invalid(_))));

    let n1 = note_create(&c, Some(cat.id)).unwrap();
    let n2 = note_create(&c, None).unwrap();
    assert!(matches!(note_create(&c, Some(9999)), Err(AppError::NotFound)));
    note_update(&c, n1.id, "Canción de cuna", "Letra con **negrita**").unwrap();
    note_update(&c, n2.id, "Lista de compras", "pan y leche").unwrap();

    // Etiquetas normalizadas: sin #, minúsculas (incluye tildes), sin duplicados.
    let tags = note_set_tags(&c, n1.id, &["#Música".into(), "música".into(), "  ".into(), "rust".into()]).unwrap();
    assert_eq!(tags, vec!["música", "rust"]);
    note_set_tags(&c, n2.id, &["rust".into()]).unwrap();

    let counts = tag_list(&c, None).unwrap();
    assert_eq!(counts.iter().find(|t| t.name == "rust").unwrap().count, 2);
    let in_cat = tag_list(&c, Some(cat.id)).unwrap();
    assert_eq!(in_cat.iter().find(|t| t.name == "rust").unwrap().count, 1);

    // Filtros: categoría, etiquetas AND y búsqueda sin tildes.
    let all = note_list(&c, &ListParams::default()).unwrap();
    assert_eq!(all.len(), 2);
    let by_cat = note_list(&c, &ListParams { category_id: Some(cat.id), ..Default::default() }).unwrap();
    assert_eq!(by_cat.iter().map(|n| n.id).collect::<Vec<_>>(), vec![n1.id]);
    let rust_id = counts.iter().find(|t| t.name == "rust").unwrap().id;
    let musica_id = counts.iter().find(|t| t.name == "música").unwrap().id;
    let and = note_list(&c, &ListParams { tag_ids: vec![rust_id, musica_id], ..Default::default() }).unwrap();
    assert_eq!(and.iter().map(|n| n.id).collect::<Vec<_>>(), vec![n1.id]);
    let found = note_list(&c, &ListParams { query: Some("cancion".into()), ..Default::default() }).unwrap();
    assert_eq!(found.len(), 1);
    assert_eq!(found[0].tags, vec!["música", "rust"]);
    let weird = note_list(&c, &ListParams { query: Some("- (".into()), ..Default::default() }).unwrap();
    assert_eq!(weird.len(), 2);

    // Fijar sube la nota; mover a "sin categoría"; papelera la oculta y limpia etiquetas huérfanas al reasignar.
    note_pin(&c, n2.id, true).unwrap();
    assert_eq!(note_list(&c, &ListParams::default()).unwrap()[0].id, n2.id);
    note_move(&c, n1.id, None).unwrap();
    assert_eq!(note_get(&c, n1.id).unwrap().category_id, None);
    note_trash(&c, n2.id).unwrap();
    assert!(matches!(note_get(&c, n2.id), Err(AppError::NotFound)));
    assert_eq!(note_list(&c, &ListParams::default()).unwrap().len(), 1);

    // Borrar una categoría deja sus notas sin categoría.
    note_move(&c, n1.id, Some(cat.id)).unwrap();
    category_delete(&c, cat.id).unwrap();
    assert_eq!(note_get(&c, n1.id).unwrap().category_id, None);
}

#[test]
fn papelera_restaurar_y_purgar() {
    let (_p, c) = fresh("trash");
    let a = note_create(&c, None).unwrap();
    let b = note_create(&c, None).unwrap();
    note_update(&c, a.id, "A", "uno").unwrap();
    note_update(&c, b.id, "B", "dos").unwrap();
    note_set_tags(&c, a.id, &["solo-a".into()]).unwrap();

    // Borrado masivo: ids repetidos o ya borrados no cuentan.
    let extra = note_create(&c, None).unwrap();
    assert_eq!(note_trash_many(&c, &[extra.id, extra.id, 99999]).unwrap(), 1);
    note_restore(&c, extra.id).unwrap();
    note_purge(&c, a.id).unwrap_err();
    note_trash(&c, extra.id).unwrap();
    note_purge(&c, extra.id).unwrap();

    // Una nota activa no se puede purgar.
    assert!(matches!(note_purge(&c, a.id), Err(AppError::NotFound)));

    note_trash(&c, a.id).unwrap();
    note_trash(&c, b.id).unwrap();
    assert_eq!(trash_list(&c).unwrap().len(), 2);
    assert!(note_list(&c, &ListParams::default()).unwrap().is_empty());

    note_restore(&c, a.id).unwrap();
    assert_eq!(note_list(&c, &ListParams::default()).unwrap()[0].id, a.id);
    assert_eq!(trash_list(&c).unwrap().len(), 1);
    assert!(matches!(note_restore(&c, a.id), Err(AppError::NotFound)));

    note_purge(&c, b.id).unwrap();
    assert!(trash_list(&c).unwrap().is_empty());

    // Vaciar la papelera borra definitivamente y limpia etiquetas huérfanas.
    note_trash(&c, a.id).unwrap();
    assert_eq!(trash_empty(&c).unwrap(), 1);
    assert!(tag_list(&c, None).unwrap().is_empty());
    let orphans: i64 = c.query_row("SELECT COUNT(*) FROM tags", [], |r| r.get(0)).unwrap();
    assert_eq!(orphans, 0);
}

#[test]
fn registro_de_boveda_inicial_y_nuevas() {
    let dir = std::env::temp_dir().join(format!("noter_reg_{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&dir);
    std::fs::create_dir_all(&dir).unwrap();
    let reg = crate::vaults::load(&dir).unwrap();
    assert_eq!(reg.vaults.len(), 1);
    assert_eq!(reg.active_id.as_deref(), Some("default"));

    let mut reg = reg;
    let nueva = crate::vaults::new_vault("  Trabajo  ").unwrap();
    assert_eq!(nueva.name, "Trabajo");
    reg.vaults.push(nueva);
    crate::vaults::save(&dir, &reg).unwrap();
    assert_eq!(crate::vaults::load(&dir).unwrap().vaults.len(), 2);
    assert!(matches!(crate::vaults::new_vault("   "), Err(AppError::Invalid(_))));
}

/// Cambiar de bóveda de punta a punta: cada una tiene sus propios datos y el cambio persiste.
#[test]
fn cambio_de_boveda_aisla_los_datos() {
    use crate::session;
    use crate::state::AppState;

    let open_vault = |s: &AppState, id: &str| session::activate(s, id).map(|_| ());

    let dir = std::env::temp_dir().join(format!("noter_switch_{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&dir);
    std::fs::create_dir_all(&dir).unwrap();
    let state = AppState::new(dir.clone());
    let with = |f: &dyn Fn(&Connection)| {
        let g = state.conn.lock().unwrap();
        f(g.as_ref().expect("hay una boveda abierta"));
    };

    // Bóveda inicial: se siembra con 4 categorías y la nota de bienvenida.
    open_vault(&state, "default").unwrap();
    with(&|c| assert_eq!(category_list(c).unwrap().len(), 4));

    // Se crea una segunda bóveda y se escribe algo solo en la primera.
    session::create_vault(&state, "Trabajo", None, None).unwrap();
    let second_id = crate::vaults::load(&dir).unwrap().vaults.last().unwrap().id.clone();
    with(&|c| {
        let n = note_create(c, None).unwrap();
        note_update(c, n.id, "Solo en la primera", "x").unwrap();
    });
    with(&|c| assert_eq!(note_list(c, &ListParams::default()).unwrap().len(), 2));

    // Al cambiar, la segunda empieza con su propia siembra y no ve la nota de la primera.
    open_vault(&state, &second_id).unwrap();
    with(&|c| {
        let titles: Vec<String> = note_list(c, &ListParams::default()).unwrap().into_iter().map(|n| n.title).collect();
        assert!(!titles.contains(&"Solo en la primera".to_string()));
        let n = note_create(c, None).unwrap();
        note_update(c, n.id, "Solo en la segunda", "y").unwrap();
    });
    assert_eq!(crate::vaults::load(&dir).unwrap().active_id.as_deref(), Some(second_id.as_str()));

    // Volver a la primera conserva sus datos y no ve los de la segunda.
    open_vault(&state, "default").unwrap();
    with(&|c| {
        let titles: Vec<String> = note_list(c, &ListParams::default()).unwrap().into_iter().map(|n| n.title).collect();
        assert!(titles.contains(&"Solo en la primera".to_string()));
        assert!(!titles.contains(&"Solo en la segunda".to_string()));
    });

    // Una bóveda inexistente falla sin cerrar la actual.
    assert!(matches!(open_vault(&state, "no-existe"), Err(AppError::NotFound)));
    with(&|c| assert!(!note_list(c, &ListParams::default()).unwrap().is_empty()));
}

#[test]
fn datos_de_ejemplo_solo_una_vez() {
    let (_p, c) = fresh("seed");
    seed_if_new(&c).unwrap();
    assert_eq!(category_list(&c).unwrap().len(), 4);
    assert_eq!(note_list(&c, &ListParams::default()).unwrap().len(), 1);
    // Aunque la persona borre todo, no se vuelve a sembrar.
    for n in note_list(&c, &ListParams::default()).unwrap() {
        note_trash(&c, n.id).unwrap();
    }
    seed_if_new(&c).unwrap();
    assert_eq!(note_list(&c, &ListParams::default()).unwrap().len(), 0);
}
