-- ============================================================
-- Sabores do Mundo — Dados iniciais (seed)
-- Execute após database.sql
-- ============================================================

PRAGMA foreign_keys = ON;

-- ------------------------------------------------------------
-- Usuários demo
-- ATENÇÃO: em produção, armazene hashes (bcrypt/argon2), não texto puro.
-- ------------------------------------------------------------
INSERT OR IGNORE INTO usuarios (username, password, display_name, role, prestige) VALUES
  ('admin',   'admin123',    'Wagner Chef',  'chef',    42),
  ('usuario', 'receitas123', 'Ana Turista',  'turista', 18);

-- ------------------------------------------------------------
-- Receitas de exemplo
-- ------------------------------------------------------------
INSERT OR IGNORE INTO receitas
  (id, title, category, country, region, occasion, image_url, alt_text,
   prep_time, difficulty, short_description, ingredients, steps,
   created_by, author_name, author_role)
VALUES
  (1, 'Bolo de fubá com coco fofinho', 'Pão e bolos', 'Brasil', 'Sudeste', 'Lanche',
   'https://cdn0.tudoreceitas.com/pt/posts/9/8/1/bolo_de_fuba_com_coco_fofinho_7189_300_square.webp',
   'Bolo de fubá com coco fofinho', '45 min', 'Baixa',
   'Bolo de fubá macio com coco, perfeito para o café ou lanche.',
   '• 2 xícaras de fubá' || char(10) || '• 1 xícara de coco ralado' || char(10) ||
   '• 3 ovos' || char(10) || '• 1 xícara de leite' || char(10) ||
   '• 1/2 xícara de óleo' || char(10) || '• 1 xícara de açúcar' || char(10) ||
   '• 1 colher de sopa de fermento',
   '1. Misture os ingredientes secos.' || char(10) || '2. Junte ovos, leite e óleo.' || char(10) ||
   '3. Adicione o coco e o fermento.' || char(10) || '4. Asse por 35-40 minutos.' || char(10) ||
   '5. Deixe esfriar e sirva.',
   'admin', 'Wagner Chef', 'chef'),

  (2, 'Vatapá de peixe simples', 'Comida de panela', 'Brasil', 'Nordeste', 'Prato principal',
   'https://cdn0.tudoreceitas.com/pt/posts/9/0/9/vatapa_de_peixe_simples_5909_300_square.webp',
   'Vatapá de peixe simples', '30 min', 'Baixa',
   'Vatapá cremoso de peixe, uma receita nordestina muito saborosa.',
   '• 500g de peixe' || char(10) || '• 1 cebola' || char(10) || '• 2 tomates' || char(10) ||
   '• 200ml de leite de coco' || char(10) || '• Azeite de dendê' || char(10) ||
   '• Pão amanhecido' || char(10) || '• Amendoim e castanha',
   '1. Refogue cebola e tomate.' || char(10) || '2. Adicione o peixe e deixe cozinhar.' || char(10) ||
   '3. Misture leite de coco e dendê.' || char(10) || '4. Acrescente pão, amendoim e castanhas.' || char(10) ||
   '5. Cozinhe até ficar cremoso.',
   'usuario', 'Ana Turista', 'turista'),

  (3, 'Tacos de frango ao limão', 'Comida de rua', 'México', NULL, 'Petisco',
   'https://images.pexels.com/photos/461198/pexels-photo-461198.jpeg?auto=compress&cs=tinysrgb&w=1280',
   'Tacos de frango ao limão', '30 min', 'Baixa',
   'Tacos crocantes com frango temperado ao limão, coentro e cebola roxa.',
   '• 500g de peito de frango' || char(10) || '• 8 tortilhas de milho' || char(10) ||
   '• 2 limas' || char(10) || '• 1 colher de cominho' || char(10) ||
   '• Páprica defumada' || char(10) || '• Cebola roxa fatiada' || char(10) ||
   '• Coentro fresco' || char(10) || '• Molho de pimenta',
   '1. Tempere o frango com cominho, páprica, sal e suco de lima.' || char(10) ||
   '2. Grelhe até dourar e corte em tiras.' || char(10) ||
   '3. Aqueça as tortilhas.' || char(10) ||
   '4. Monte os tacos com frango, cebola e coentro.' || char(10) ||
   '5. Sirva com molho de pimenta e mais lima.',
   'admin', 'Wagner Chef', 'chef'),

  (4, 'Pasta carbonara clássica', 'Massas', 'Itália', NULL, 'Jantar',
   'https://images.pexels.com/photos/1279330/pexels-photo-1279330.jpeg?auto=compress&cs=tinysrgb&w=1280',
   'Pasta carbonara clássica', '25 min', 'Média',
   'A autêntica carbonara italiana com guanciale, ovo e pecorino, sem creme.',
   '• 400g de espaguete' || char(10) || '• 150g de guanciale (ou bacon)' || char(10) ||
   '• 4 gemas' || char(10) || '• 100g de pecorino romano ralado' || char(10) ||
   '• Pimenta-do-reino a gosto' || char(10) || '• Sal',
   '1. Cozinhe o macarrão al dente.' || char(10) ||
   '2. Frite o guanciale até crocante.' || char(10) ||
   '3. Misture gemas com o queijo e pimenta.' || char(10) ||
   '4. Retire o macarrão e misture com o guanciale fora do fogo.' || char(10) ||
   '5. Adicione a mistura de ovos e mexa rápido. Sirva imediatamente.',
   'usuario', 'Ana Turista', 'turista'),

  (5, 'Paella valenciana', 'Arroz', 'Espanha', NULL, 'Domingo',
   'https://images.pexels.com/photos/12419210/pexels-photo-12419210.jpeg?auto=compress&cs=tinysrgb&w=1280',
   'Paella valenciana', '1h', 'Alta',
   'Arroz espanhol com frutos do mar, açafrão e pimentão, cozido em paellera.',
   '• 400g de arroz arbóreo' || char(10) || '• 300g de camarão' || char(10) ||
   '• 300g de mariscos' || char(10) || '• 1 pitada de açafrão' || char(10) ||
   '• Pimentão vermelho e verde' || char(10) || '• Tomate, alho e cebola' || char(10) ||
   '• Caldo de peixe' || char(10) || '• Azeite de oliva',
   '1. Refogue alho, cebola e pimentão no azeite.' || char(10) ||
   '2. Adicione o tomate e deixe apurar.' || char(10) ||
   '3. Acrescente o arroz e o açafrão diluído no caldo.' || char(10) ||
   '4. Adicione os frutos do mar e o caldo restante.' || char(10) ||
   '5. Cozinhe sem mexer até o arroz absorver tudo. Sirva na própria paellera.',
   'admin', 'Wagner Chef', 'chef');

-- ------------------------------------------------------------
-- Curtidas de exemplo
-- ------------------------------------------------------------
INSERT OR IGNORE INTO curtidas (recipe_id, username) VALUES
  (1, 'usuario'),
  (3, 'usuario'),
  (4, 'admin'),
  (5, 'usuario');

-- ------------------------------------------------------------
-- Avaliações de exemplo
-- ------------------------------------------------------------
INSERT OR IGNORE INTO avaliacoes (recipe_id, username, score) VALUES
  (1, 'usuario', 5),
  (3, 'usuario', 4),
  (4, 'admin',   5),
  (5, 'usuario', 4);
