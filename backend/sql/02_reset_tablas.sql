-- LOTIFI - Reset de datos para entorno de desarrollo
-- Fecha: 2026-02-22
-- Uso: ejecutar dentro de la BD `lotifi`

USE lotifi;

SET FOREIGN_KEY_CHECKS = 0;

TRUNCATE TABLE recibos;
TRUNCATE TABLE documentos;
TRUNCATE TABLE mora;
TRUNCATE TABLE pagos;
TRUNCATE TABLE cuotas;
TRUNCATE TABLE gastos;
TRUNCATE TABLE historial_lote;
TRUNCATE TABLE reservas;
TRUNCATE TABLE contratos;
TRUNCATE TABLE lotes;
TRUNCATE TABLE poligonos;
TRUNCATE TABLE lotificaciones;
TRUNCATE TABLE cliente;

SET FOREIGN_KEY_CHECKS = 1;

