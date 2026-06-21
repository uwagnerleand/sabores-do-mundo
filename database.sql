-- ============================================================
-- Sabores do Mundo — Schema SQLite
-- ============================================================

PRAGMA foreign_keys = ON;

-- ------------------------------------------------------------
-- Tabela: usuarios
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usuarios (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  username     TEXT    NOT NULL UNIQUE,
  password     TEXT    NOT NULL,
  display_name TEXT    NOT NULL,
  role         TEXT    NOT NULL DEFAULT 'turista'
                       CHECK (role IN ('chef', 'turista')),
  prestige     INTEGER NOT NULL DEFAULT 0
                       CHECK (prestige >= 0),
  created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ------------------------------------------------------------
-- Tabela: receitas
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS receitas (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  title             TEXT    NOT NULL,
  category          TEXT,
  country           TEXT,
  region            TEXT,
  occasion          TEXT,
  image_url         TEXT,
  alt_text          TEXT,
  prep_time         TEXT,
  difficulty        TEXT    CHECK (difficulty IN ('Baixa', 'Média', 'Alta')),
  short_description TEXT,
  ingredients       TEXT,
  steps             TEXT,
  created_by        TEXT    REFERENCES usuarios(username) ON UPDATE CASCADE,
  author_name       TEXT,
  author_role       TEXT    CHECK (author_role IN ('chef', 'turista')),
  created_at        TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ------------------------------------------------------------
-- Tabela: curtidas
-- Uma curtida por usuário por receita (PK composta evita duplicatas)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS curtidas (
  recipe_id  INTEGER NOT NULL REFERENCES receitas(id) ON DELETE CASCADE,
  username   TEXT    NOT NULL REFERENCES usuarios(username) ON DELETE CASCADE,
  created_at TEXT    NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (recipe_id, username)
);

-- ------------------------------------------------------------
-- Tabela: avaliacoes
-- Uma avaliação por usuário por receita; UPDATE atualiza o score
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS avaliacoes (
  recipe_id  INTEGER NOT NULL REFERENCES receitas(id) ON DELETE CASCADE,
  username   TEXT    NOT NULL REFERENCES usuarios(username) ON DELETE CASCADE,
  score      INTEGER NOT NULL CHECK (score BETWEEN 1 AND 5),
  created_at TEXT    NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (recipe_id, username)
);

-- ------------------------------------------------------------
-- Views úteis para consulta rápida
-- ------------------------------------------------------------

-- Resumo de interações por receita
CREATE VIEW IF NOT EXISTS vw_receitas_resumo AS
SELECT
  r.id,
  r.title,
  r.country,
  r.region,
  r.occasion,
  r.difficulty,
  r.prep_time,
  r.author_name,
  r.author_role,
  COUNT(DISTINCT c.username)          AS total_curtidas,
  ROUND(AVG(a.score), 1)              AS media_avaliacao,
  COUNT(DISTINCT a.username)          AS total_avaliacoes
FROM receitas r
LEFT JOIN curtidas  c ON c.recipe_id = r.id
LEFT JOIN avaliacoes a ON a.recipe_id = r.id
GROUP BY r.id;

-- Ranking de prestígio dos usuários
CREATE VIEW IF NOT EXISTS vw_ranking_prestigio AS
SELECT
  u.username,
  u.display_name,
  u.role,
  u.prestige,
  COUNT(DISTINCT r.id)                AS total_receitas,
  COALESCE(SUM(ci.curtidas), 0)       AS total_curtidas_recebidas,
  ROUND(AVG(av.media_score), 1)       AS media_avaliacoes
FROM usuarios u
LEFT JOIN receitas r ON r.created_by = u.username
LEFT JOIN (
  SELECT recipe_id, COUNT(*) AS curtidas
  FROM curtidas
  GROUP BY recipe_id
) ci ON ci.recipe_id = r.id
LEFT JOIN (
  SELECT recipe_id, AVG(score) AS media_score
  FROM avaliacoes
  GROUP BY recipe_id
) av ON av.recipe_id = r.id
GROUP BY u.username
ORDER BY u.prestige DESC;
