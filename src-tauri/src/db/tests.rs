use super::*;
use rusqlite::named_params;
use std::path::PathBuf;

const KEY: &str = "frase de prueba con tildes: camión";

/// Archivo temporal que se limpia solo (db, -wal, -shm).
struct TempDb(PathBuf);
impl TempDb {
    fn new(name: &str) -> Self {
        let p = std::env::temp_dir().join(format!("noter_test_{}_{}.db", std::process::id(), name));
        let t = TempDb(p);
        t.cleanup();
        t
    }
    fn cleanup(&self) {
        for ext in ["", "-wal", "-shm"] {
            let mut s = self.0.clone().into_os_string();
            s.push(ext);
            let _ = std::fs::remove_file(PathBuf::from(s));
        }
    }
    fn side(&self, ext: &str) -> PathBuf {
        let mut s = self.0.clone().into_os_string();
        s.push(ext);
        PathBuf::from(s)
    }
}
impl Drop for TempDb {
    fn drop(&mut self) {
        self.cleanup();
    }
}

const TRABAJO: i64 = 1;
const PERSONAL: i64 = 2;
const A: i64 = 1;
const B: i64 = 2;
const C: i64 = 3;
const D: i64 = 4;

fn seed(c: &Connection) {
    c.execute_batch(
        "INSERT INTO categories(id,name,emoji,hue,position,created_at) VALUES
            (1,'Trabajo','💼',210,0,1),(2,'Personal','🌙',280,1,1);
         INSERT INTO tags(id,name) VALUES (1,'música'),(2,'Ideas'),(3,'urgente');
         INSERT INTO notes(id,title,body,category_id,pinned,created_at,updated_at,deleted_at) VALUES
            (1,'Canción de cuna','La música suave del camión nocturno',2,0,1000,1000,NULL),
            (2,'Reunión de planificación','Revisar el presupuesto y la canción del evento',1,0,2000,2000,NULL),
            (3,'Lista de compras','pan, café, azúcar',2,0,3000,3000,NULL),
            (4,'Nota borrada','canción secreta',1,0,4000,4000,5000);
         INSERT INTO note_tags(note_id,tag_id) VALUES (1,1),(1,2),(2,2),(2,3),(3,3),(4,1);",
    )
    .unwrap();
}

fn open_seeded(name: &str) -> (TempDb, Connection) {
    let t = TempDb::new(name);
    let c = open(&t.0, KEY).unwrap();
    seed(&c);
    (t, c)
}

fn list(c: &Connection, cat: Option<i64>, tags: &str, q: Option<&str>) -> Vec<i64> {
    let mut ids: Vec<i64> = match q.and_then(fts_match) {
        None => {
            let mut st = c.prepare(sql("note_list")).unwrap();
            st.query_map(
                named_params! {":category_id": cat, ":tag_ids": tags, ":limit": 100, ":offset": 0},
                |r| r.get(0),
            )
            .unwrap()
            .collect::<Result<_, _>>()
            .unwrap()
        }
        Some(m) => {
            let mut st = c.prepare(sql("note_list_search")).unwrap();
            st.query_map(
                named_params! {":fts": m, ":category_id": cat, ":tag_ids": tags, ":limit": 100, ":offset": 0},
                |r| r.get(0),
            )
            .unwrap()
            .collect::<Result<_, _>>()
            .unwrap()
        }
    };
    ids.sort();
    ids
}

fn fts_ok(c: &Connection) {
    // Falla si el indice externo no coincide con la tabla notes.
    c.execute("INSERT INTO notes_fts(notes_fts, rank) VALUES('integrity-check', 1)", []).unwrap();
}

fn tag_counts(c: &Connection, cat: Option<i64>) -> Vec<(String, i64)> {
    let mut st = c.prepare(sql("tag_list")).unwrap();
    st.query_map(named_params! {":category_id": cat}, |r| Ok((r.get(1)?, r.get(2)?)))
        .unwrap()
        .collect::<Result<_, _>>()
        .unwrap()
}

#[test]
fn migracion_pragmas_y_version() {
    let t = TempDb::new("pragmas");
    let mut c = open(&t.0, KEY).unwrap();
    let v: i64 = c.query_row("PRAGMA user_version", [], |r| r.get(0)).unwrap();
    assert_eq!(v, MIGRATIONS.len() as i64);
    let fk: i64 = c.query_row("PRAGMA foreign_keys", [], |r| r.get(0)).unwrap();
    assert_eq!(fk, 1);
    let jm: String = c.query_row("PRAGMA journal_mode", [], |r| r.get(0)).unwrap();
    assert_eq!(jm, "wal");
    let ver: String = c.query_row("PRAGMA cipher_version", [], |r| r.get(0)).unwrap();
    assert!(!ver.is_empty());
    // Idempotente: migrar de nuevo no hace nada.
    migrate(&mut c).unwrap();
    // FK real: categoria inexistente se rechaza.
    assert!(c
        .execute("INSERT INTO notes(title,category_id,created_at,updated_at) VALUES('x',999,1,1)", [])
        .is_err());
    // Restricciones de hue y de nombre de etiqueta unico sin distinguir mayusculas.
    assert!(c.execute("INSERT INTO categories(name,emoji,hue,created_at) VALUES('a','x',361,1)", []).is_err());
    c.execute("INSERT INTO tags(name) VALUES('Ideas')", []).unwrap();
    assert!(c.execute("INSERT INTO tags(name) VALUES('IDEAS')", []).is_err());
}

#[test]
fn migracion_fallida_hace_rollback() {
    let t = TempDb::new("rollback");
    let mut c = open(&t.0, KEY).unwrap();
    let tx = c.transaction().unwrap();
    tx.execute_batch("CREATE TABLE x(a); PRAGMA user_version = 99;").unwrap();
    drop(tx); // rollback
    let v: i64 = c.query_row("PRAGMA user_version", [], |r| r.get(0)).unwrap();
    assert_eq!(v, MIGRATIONS.len() as i64);
    assert!(c.prepare("SELECT * FROM x").is_err());
}

#[test]
fn cifrado_en_disco_wal_y_clave_incorrecta() {
    let (t, c) = open_seeded("cifrado");
    // El -wal esta activo y no contiene texto plano.
    let wal = std::fs::read(t.side("-wal")).unwrap();
    assert!(!wal.is_empty());
    assert!(!wal.windows(11).any(|w| w == b"presupuesto"));
    c.execute_batch("PRAGMA wal_checkpoint(TRUNCATE);").unwrap();
    let main = std::fs::read(&t.0).unwrap();
    assert!(!main.starts_with(b"SQLite format 3"));
    assert!(!main.windows(11).any(|w| w == b"presupuesto"));
    drop(c);
    // Clave incorrecta falla; la correcta reabre y ve los datos (ya migrada, user_version intacto).
    assert!(open(&t.0, "otra clave").is_err());
    let c2 = open(&t.0, KEY).unwrap();
    let n: i64 = c2.query_row("SELECT count(*) FROM notes", [], |r| r.get(0)).unwrap();
    assert_eq!(n, 4);
}

#[test]
fn fts_con_y_sin_tildes_prefijo_y_papelera() {
    let (_t, c) = open_seeded("fts");
    for q in ["cancion", "CANCIÓN", "canción", "canc", "  Cancio  "] {
        assert_eq!(list(&c, None, "[]", Some(q)), vec![A, B], "consulta {q:?}");
    }
    assert_eq!(list(&c, None, "[]", Some("camion")), vec![A]);
    assert_eq!(list(&c, None, "[]", Some("musica")), vec![A]);
    assert_eq!(list(&c, None, "[]", Some("azucar cafe")), vec![C]); // AND entre palabras
    assert_eq!(list(&c, None, "[]", Some("secreta")), Vec::<i64>::new()); // papelera
    // Entrada con sintaxis FTS hostil no rompe.
    assert_eq!(list(&c, None, "[]", Some("\"cancion* - (")), vec![A, B]);
    assert_eq!(fts_match("   \"\"  "), None);
    // Papelera fuera de la lista normal, presente en trash_list.
    assert_eq!(list(&c, None, "[]", None), vec![A, B, C]);
    let trash: Vec<i64> = c
        .prepare(sql("trash_list"))
        .unwrap()
        .query_map([], |r| r.get(0))
        .unwrap()
        .collect::<Result<_, _>>()
        .unwrap();
    assert_eq!(trash, vec![D]);
}

#[test]
fn snippet_conserva_tildes_y_marca() {
    let (_t, c) = open_seeded("snippet");
    let (title_hl, snip): (String, String) = c
        .query_row(
            sql("note_list_search"),
            named_params! {":fts": fts_match("cancion").unwrap(), ":category_id": TRABAJO,
                           ":tag_ids": "[]", ":limit": 10, ":offset": 0},
            |r| Ok((r.get("title_hl")?, r.get("snippet")?)),
        )
        .unwrap();
    assert_eq!(snip, "Revisar el presupuesto y la \u{2}canción\u{3} del evento");
    assert_eq!(title_hl, "Reunión de planificación"); // sin coincidencia en titulo, sin marcas
    let t2: String = c
        .query_row(
            sql("note_list_search"),
            named_params! {":fts": fts_match("reunion").unwrap(), ":category_id": None::<i64>,
                           ":tag_ids": "[]", ":limit": 10, ":offset": 0},
            |r| r.get("title_hl"),
        )
        .unwrap();
    assert_eq!(t2, "\u{2}Reunión\u{3} de planificación");
}

#[test]
fn filtro_and_de_etiquetas_con_categoria_y_busqueda() {
    let (_t, c) = open_seeded("and");
    assert_eq!(list(&c, None, "[2]", None), vec![A, B]); // Ideas
    assert_eq!(list(&c, None, "[2,3]", None), vec![B]); // Ideas AND urgente
    assert_eq!(list(&c, None, "[1,2,3]", None), Vec::<i64>::new());
    assert_eq!(list(&c, None, "[1]", None), vec![A]); // D (musica) esta en papelera
    assert_eq!(list(&c, Some(PERSONAL), "[3]", None), vec![C]);
    assert_eq!(list(&c, Some(TRABAJO), "[1]", None), Vec::<i64>::new());
    assert_eq!(list(&c, None, "[2]", Some("cancion")), vec![A, B]);
    assert_eq!(list(&c, None, "[1]", Some("cancion")), vec![A]);
    assert_eq!(list(&c, Some(TRABAJO), "[2,3]", Some("cancion")), vec![B]);
    assert_eq!(list(&c, None, "[999]", None), Vec::<i64>::new()); // etiqueta inexistente
}

#[test]
fn conteo_de_etiquetas_por_categoria() {
    let (_t, c) = open_seeded("conteo");
    assert_eq!(
        tag_counts(&c, None),
        vec![("Ideas".into(), 2), ("música".into(), 1), ("urgente".into(), 2)]
    );
    assert_eq!(tag_counts(&c, Some(TRABAJO)), vec![("Ideas".into(), 1), ("urgente".into(), 1)]);
    assert_eq!(
        tag_counts(&c, Some(PERSONAL)),
        vec![("Ideas".into(), 1), ("música".into(), 1), ("urgente".into(), 1)]
    );
    // tag_list_all incluye etiquetas con conteo 0.
    c.execute("INSERT INTO tags(name) VALUES('huerfana')", []).unwrap();
    let all: Vec<(String, i64)> = c
        .prepare(sql("tag_list_all"))
        .unwrap()
        .query_map([], |r| Ok((r.get(1)?, r.get(2)?)))
        .unwrap()
        .collect::<Result<_, _>>()
        .unwrap();
    assert!(all.contains(&("huerfana".to_string(), 0)));
}

#[test]
fn update_delete_y_papelera_mantienen_fts() {
    let (_t, c) = open_seeded("fts_mut");
    fts_ok(&c);
    // UPDATE de cuerpo: lo viejo deja de coincidir, lo nuevo coincide, el titulo sigue.
    c.execute("UPDATE notes SET body='Melodia de la madrugada', updated_at=9000 WHERE id=1", []).unwrap();
    fts_ok(&c);
    assert_eq!(list(&c, None, "[]", Some("camion")), Vec::<i64>::new());
    assert_eq!(list(&c, None, "[]", Some("melodía")), vec![A]);
    assert_eq!(list(&c, None, "[]", Some("cancion")), vec![A, B]);
    // UPDATE de titulo.
    c.execute("UPDATE notes SET title='Nana' WHERE id=1", []).unwrap();
    fts_ok(&c);
    assert_eq!(list(&c, None, "[]", Some("cancion")), vec![B]);
    assert_eq!(list(&c, None, "[]", Some("nana")), vec![A]);
    // Fijar y mover de categoria no toca el indice y sigue consistente.
    c.execute("UPDATE notes SET pinned=1, category_id=1 WHERE id=1", []).unwrap();
    fts_ok(&c);
    // Orden: fijadas primero.
    let first: i64 = c
        .query_row(
            sql("note_list"),
            named_params! {":category_id": None::<i64>, ":tag_ids": "[]", ":limit": 1, ":offset": 0},
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(first, A);
    // Papelera y restaurar.
    c.execute(sql("note_trash"), named_params! {":id": B, ":now": 7000}).unwrap();
    assert_eq!(list(&c, None, "[]", Some("presupuesto")), Vec::<i64>::new());
    assert!(!list(&c, None, "[]", None).contains(&B));
    c.execute(sql("note_restore"), named_params! {":id": B}).unwrap();
    assert_eq!(list(&c, None, "[]", Some("presupuesto")), vec![B]);
    fts_ok(&c);
    // DELETE definitivo.
    c.execute("DELETE FROM notes WHERE id=2", []).unwrap();
    fts_ok(&c);
    assert_eq!(list(&c, None, "[]", Some("presupuesto")), Vec::<i64>::new());
    // Purga de papelera (nota D, deleted_at=5000).
    let n = c.execute(sql("note_purge_older_than"), named_params! {":cutoff": 6000}).unwrap();
    assert_eq!(n, 1);
    fts_ok(&c);
    // Reconstruccion total deja el mismo resultado.
    c.execute("INSERT INTO notes_fts(notes_fts) VALUES('rebuild')", []).unwrap();
    assert_eq!(list(&c, None, "[]", Some("nana")), vec![A]);
}

#[test]
fn set_null_y_cascade() {
    let (_t, c) = open_seeded("fk");
    // Borrar categoria Personal => sus notas quedan sin categoria.
    c.execute("DELETE FROM categories WHERE id=?1", [PERSONAL]).unwrap();
    let cats: Vec<Option<i64>> = c
        .prepare("SELECT category_id FROM notes WHERE id IN (1,3) ORDER BY id")
        .unwrap()
        .query_map([], |r| r.get(0))
        .unwrap()
        .collect::<Result<_, _>>()
        .unwrap();
    assert_eq!(cats, vec![None, None]);
    fts_ok(&c);
    // Borrar nota => sus filas de note_tags desaparecen.
    c.execute("DELETE FROM notes WHERE id=2", []).unwrap();
    let n: i64 = c.query_row("SELECT count(*) FROM note_tags WHERE note_id=2", [], |r| r.get(0)).unwrap();
    assert_eq!(n, 0);
    // Borrar etiqueta => desaparece de las notas, que siguen existiendo.
    c.execute("DELETE FROM tags WHERE id=3", []).unwrap();
    let n: i64 = c.query_row("SELECT count(*) FROM note_tags WHERE tag_id=3", [], |r| r.get(0)).unwrap();
    assert_eq!(n, 0);
    let notes: i64 = c.query_row("SELECT count(*) FROM notes", [], |r| r.get(0)).unwrap();
    assert_eq!(notes, 3);
    // tag_upsert es insensible a mayusculas y devuelve el mismo id.
    let id1: i64 = c.query_row(sql("tag_upsert"), named_params! {":name": "MÚSICA2"}, |r| r.get(0)).unwrap();
    let id2: i64 = c.query_row(sql("tag_upsert"), named_params! {":name": "músICA2"}, |r| r.get(0)).unwrap();
    assert_ne!(id1, 0);
    // NOCASE de SQLite solo pliega ASCII: "MÚSICA2" y "músICA2" difieren en la tilde, ver informe.
    assert_ne!(id1, id2);
    let a: i64 = c.query_row(sql("tag_upsert"), named_params! {":name": "Ideas"}, |r| r.get(0)).unwrap();
    let b: i64 = c.query_row(sql("tag_upsert"), named_params! {":name": "IDEAS"}, |r| r.get(0)).unwrap();
    assert_eq!(a, b);
}

#[test]
fn reversa_down_sql() {
    let t = TempDb::new("down");
    let c = open(&t.0, KEY).unwrap();
    c.execute_batch(include_str!("migrations/0001_init.down.sql")).unwrap();
    let n: i64 = c
        .query_row("SELECT count(*) FROM sqlite_master WHERE name NOT LIKE 'sqlite_%'", [], |r| r.get(0))
        .unwrap();
    assert_eq!(n, 0);
}
