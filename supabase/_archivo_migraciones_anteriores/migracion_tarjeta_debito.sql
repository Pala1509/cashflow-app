-- Migración: Tarjetas débito como tipo de cuenta propio.
-- Un caso real: Nequi es una cuenta débito virtual, pero también puede
-- tener una tarjeta física asociada cuyo saldo se maneja independiente
-- (le cargas plata a la tarjeta aparte). Esto le da su propia fila/tipo
-- en vez de forzarla a ser "billetera digital" otra vez.
--
-- Pégala en el SQL Editor de Supabase y corre una vez.

alter type tipo_cuenta add value if not exists 'tarjeta_debito';
