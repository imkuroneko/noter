-- Reversa de 0001_init.sql. NO se embebe ni se ejecuta automaticamente.
-- Destruye todos los datos de la boveda: hacer respaldo del .db antes y ejecutar solo con confirmacion.
-- Despues: PRAGMA user_version = 0.
DROP TRIGGER IF EXISTS notes_fts_au;
DROP TRIGGER IF EXISTS notes_fts_ad;
DROP TRIGGER IF EXISTS notes_fts_ai;
DROP TABLE IF EXISTS notes_fts;
DROP TABLE IF EXISTS settings;
DROP TABLE IF EXISTS note_tags;
DROP TABLE IF EXISTS tags;
DROP TABLE IF EXISTS notes;
DROP TABLE IF EXISTS categories;
