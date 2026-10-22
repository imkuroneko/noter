-- Consultas de referencia de Noter. Cada bloque empieza con "-- name: <nombre>".
-- db::sql("<nombre>") devuelve el texto de un bloque (el test las ejecuta tal cual).
-- Parametros con nombre (rusqlite::named_params!). Todos son obligatorios en cada consulta que los usa.
--
--   :category_id  INTEGER o NULL (NULL = todas las categorias)
--   :tag_ids      TEXT JSON, p. ej. '[3,7]'; '[]' = sin filtro. Sin duplicados (el repo debe deduplicar).
--   :fts          TEXT ya armado con db::fts_match(); nunca texto crudo del usuario (la sintaxis FTS5 falla con " - * etc.)
--   :limit, :offset  INTEGER
--
-- Marcas de resaltado: char(2) abre y char(3) cierra. No usar HTML: el cuerpo es Markdown del usuario y puede traer HTML.
-- La UI debe escapar el texto y luego convertir char(2)/char(3) en <mark>.
--
-- Nota de rendimiento: "(:category_id IS NULL OR ...)" es correcto pero el planificador no elige siempre el indice
-- parcial ideal. Si EXPLAIN QUERY PLAN muestra SCAN con listas grandes, el repo puede generar dos variantes del SQL
-- (con y sin categoria) y quitar el filtro de etiquetas cuando :tag_ids = '[]'. Los indices ya estan creados.

-- name: note_list
-- Lista normal (sin busqueda). Excluye papelera. Snippet = primeros 200 caracteres del cuerpo.
-- Filtro de etiquetas AND: la nota debe tener TODAS las etiquetas de :tag_ids.
SELECT n.id, n.title, substr(n.body, 1, 200) AS snippet,
       n.category_id, n.pinned, n.created_at, n.updated_at
FROM notes n
WHERE n.deleted_at IS NULL
  AND (:category_id IS NULL OR n.category_id = :category_id)
  AND (json_array_length(:tag_ids) = 0
       OR n.id IN (SELECT nt.note_id
                   FROM note_tags nt
                   WHERE nt.tag_id IN (SELECT value FROM json_each(:tag_ids))
                   GROUP BY nt.note_id
                   HAVING COUNT(*) = (SELECT COUNT(DISTINCT value) FROM json_each(:tag_ids))))
ORDER BY n.pinned DESC, n.updated_at DESC, n.id DESC
LIMIT :limit OFFSET :offset;

-- name: note_list_search
-- Lista con busqueda FTS5 (prefijo y sin tildes via :fts) combinable con categoria y etiquetas AND.
-- Orden: fijadas primero, luego relevancia bm25 (titulo pesa 10x), luego recientes.
-- title_hl: titulo con marcas; snippet: fragmento del cuerpo (si el cuerpo no coincide, devuelve su inicio).
SELECT n.id, n.title,
       highlight(notes_fts, 0, char(2), char(3)) AS title_hl,
       snippet(notes_fts, 1, char(2), char(3), '...', 16) AS snippet,
       n.category_id, n.pinned, n.created_at, n.updated_at
FROM notes_fts
JOIN notes n ON n.id = notes_fts.rowid
WHERE notes_fts MATCH :fts
  AND n.deleted_at IS NULL
  AND (:category_id IS NULL OR n.category_id = :category_id)
  AND (json_array_length(:tag_ids) = 0
       OR n.id IN (SELECT nt.note_id
                   FROM note_tags nt
                   WHERE nt.tag_id IN (SELECT value FROM json_each(:tag_ids))
                   GROUP BY nt.note_id
                   HAVING COUNT(*) = (SELECT COUNT(DISTINCT value) FROM json_each(:tag_ids))))
ORDER BY n.pinned DESC, bm25(notes_fts, 10.0, 1.0), n.updated_at DESC
LIMIT :limit OFFSET :offset;

-- name: tag_list
-- Etiquetas con conteo de notas ACTIVAS dentro de la categoria (NULL = todas). Solo las que tienen count > 0.
SELECT t.id, t.name, COUNT(*) AS count
FROM tags t
JOIN note_tags nt ON nt.tag_id = t.id
JOIN notes n ON n.id = nt.note_id
WHERE n.deleted_at IS NULL
  AND (:category_id IS NULL OR n.category_id = :category_id)
GROUP BY t.id
ORDER BY t.name COLLATE NOCASE;

-- name: tag_list_all
-- Todas las etiquetas (incluidas las de conteo 0) para gestion/autocompletado; conteo global de notas activas.
SELECT t.id, t.name, COUNT(n.id) AS count
FROM tags t
LEFT JOIN note_tags nt ON nt.tag_id = t.id
LEFT JOIN notes n ON n.id = nt.note_id AND n.deleted_at IS NULL
GROUP BY t.id
ORDER BY t.name COLLATE NOCASE;

-- name: trash_list
SELECT id, title, substr(body, 1, 200) AS snippet, category_id, deleted_at
FROM notes
WHERE deleted_at IS NOT NULL
ORDER BY deleted_at DESC;

-- name: note_trash
UPDATE notes SET deleted_at = :now WHERE id = :id AND deleted_at IS NULL;

-- name: note_restore
UPDATE notes SET deleted_at = NULL WHERE id = :id AND deleted_at IS NOT NULL;

-- name: note_purge_older_than
-- Borrado definitivo (DELETE): el repo solo debe ejecutarlo tras confirmacion de la persona usuaria.
DELETE FROM notes WHERE deleted_at IS NOT NULL AND deleted_at < :cutoff;

-- name: tag_attach
INSERT OR IGNORE INTO note_tags (note_id, tag_id) VALUES (:note_id, :tag_id);

-- name: tag_upsert
-- Crea la etiqueta si no existe (NOCASE) y devuelve su id.
INSERT INTO tags (name) VALUES (:name)
ON CONFLICT (name) DO UPDATE SET name = name
RETURNING id;

-- name: tags_cleanup_orphans
-- Opcional: las etiquetas sin notas no se borran solas.
DELETE FROM tags WHERE id NOT IN (SELECT DISTINCT tag_id FROM note_tags);
