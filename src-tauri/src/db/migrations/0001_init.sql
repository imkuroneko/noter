-- Noter, esquema por boveda (un archivo .db cifrado por boveda).
-- Migracion 0001. El runner la ejecuta dentro de una transaccion y fija PRAGMA user_version = 1.
-- Tiempos: epoch en milisegundos UTC (INTEGER). La conversion a hora local se hace al mostrar.
-- Reversa: 0001_init.down.sql (ver nota alli).

CREATE TABLE categories (
    id         INTEGER PRIMARY KEY,
    name       TEXT    NOT NULL CHECK (length(trim(name)) > 0),
    emoji      TEXT    NOT NULL CHECK (length(emoji) > 0),
    hue        INTEGER NOT NULL DEFAULT 200 CHECK (hue BETWEEN 0 AND 360),
    position   INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
);

CREATE TABLE notes (
    id          INTEGER PRIMARY KEY,
    title       TEXT    NOT NULL DEFAULT '',
    body        TEXT    NOT NULL DEFAULT '',
    category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    pinned      INTEGER NOT NULL DEFAULT 0 CHECK (pinned IN (0, 1)),
    created_at  INTEGER NOT NULL,
    updated_at  INTEGER NOT NULL,
    deleted_at  INTEGER            -- NULL = activa; valor = en papelera (borrado suave)
);

-- Lista por categoria: WHERE category_id = ? AND deleted_at IS NULL ORDER BY pinned DESC, updated_at DESC.
-- Parcial: solo indexa notas activas (la papelera queda fuera, indice mas chico y escrituras mas baratas).
-- Costo: cada INSERT/UPDATE de pinned, updated_at o category_id mantiene 2 indices; updated_at cambia en cada guardado.
CREATE INDEX idx_notes_cat_list ON notes (category_id, pinned DESC, updated_at DESC)
    WHERE deleted_at IS NULL;
-- Lista "Todas" (sin categoria elegida), mismo orden.
CREATE INDEX idx_notes_list ON notes (pinned DESC, updated_at DESC)
    WHERE deleted_at IS NULL;
-- Papelera: listado por fecha de borrado y purga por antiguedad. Solo filas borradas (muy pocas).
CREATE INDEX idx_notes_trash ON notes (deleted_at)
    WHERE deleted_at IS NOT NULL;

CREATE TABLE tags (
    id   INTEGER PRIMARY KEY,
    name TEXT NOT NULL COLLATE NOCASE UNIQUE CHECK (length(trim(name)) > 0)
);

CREATE TABLE note_tags (
    note_id INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    tag_id  INTEGER NOT NULL REFERENCES tags(id)  ON DELETE CASCADE,
    PRIMARY KEY (note_id, tag_id)
) WITHOUT ROWID;

-- Sentido inverso: notas de una etiqueta (filtro AND y conteos). La PK ya cubre note_id -> tags.
-- Costo: una escritura extra por cada etiqueta asignada o quitada.
CREATE INDEX idx_note_tags_tag ON note_tags (tag_id, note_id);

CREATE TABLE settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
) WITHOUT ROWID;

-- Busqueda de texto completo. External content: el texto vive solo en notes (sin duplicar).
-- unicode61 remove_diacritics 2: "cancion" encuentra "Canción" y viceversa; no distingue mayusculas.
-- Las notas en papelera SI permanecen indexadas (restaurar no reindexa); las consultas filtran deleted_at.
CREATE VIRTUAL TABLE notes_fts USING fts5(
    title, body,
    content='notes', content_rowid='id',
    tokenize='unicode61 remove_diacritics 2'
);

CREATE TRIGGER notes_fts_ai AFTER INSERT ON notes BEGIN
    INSERT INTO notes_fts(rowid, title, body) VALUES (new.id, new.title, new.body);
END;

CREATE TRIGGER notes_fts_ad AFTER DELETE ON notes BEGIN
    INSERT INTO notes_fts(notes_fts, rowid, title, body) VALUES ('delete', old.id, old.title, old.body);
END;

-- Solo al cambiar title/body: fijar, mover de categoria o borrar suave no reindexa.
CREATE TRIGGER notes_fts_au AFTER UPDATE OF title, body ON notes BEGIN
    INSERT INTO notes_fts(notes_fts, rowid, title, body) VALUES ('delete', old.id, old.title, old.body);
    INSERT INTO notes_fts(rowid, title, body) VALUES (new.id, new.title, new.body);
END;
