-- El índice único [user_id, en] no alcanza para las palabras de fábrica:
-- Postgres considera distintos a dos nulos, así que no impide duplicarlas y
-- cada siembra crearía otro juego de veinte.
--
-- Este índice parcial cubre solo las de fábrica y las deja únicas por `en`,
-- sin estorbar a las de los usuarios: dos personas pueden tener cada una su
-- "to commute", pero "the way" de fábrica hay una sola.
CREATE UNIQUE INDEX "words_en_fabrica_key" ON "words" ("en") WHERE "user_id" IS NULL;
