-- Solo lectura, no cambia nada. Correr SOLO esto (sin la segunda consulta
-- de la versión anterior, que tapaba este resultado al correr las dos
-- juntas) para ver la definición completa de agente_tiene_caso_de().
select pg_get_functiondef(oid)
from pg_proc
where proname = 'agente_tiene_caso_de';
