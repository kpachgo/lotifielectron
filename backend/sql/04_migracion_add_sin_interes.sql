-- LOTIFI - Migracion incremental: nuevo metodo financiero sin_interes
-- Fecha: 2026-03-16
-- Objetivo: habilitar valor 'sin_interes' en contratos.tipo_financiamiento
-- sin afectar datos existentes.

USE lotifi;

SET @schema_name = DATABASE();

SELECT COLUMN_TYPE
INTO @tipo_actual
FROM information_schema.columns
WHERE table_schema = @schema_name
  AND table_name = 'contratos'
  AND column_name = 'tipo_financiamiento'
LIMIT 1;

SET @requiere_alter = IF(
  @tipo_actual LIKE "%'sin_interes'%",
  0,
  1
);

SET @sql = IF(
  @requiere_alter = 1,
  "ALTER TABLE `contratos`
   MODIFY COLUMN `tipo_financiamiento`
   ENUM('interes_saldo','penalizacion_fija','sin_interes') NOT NULL",
  "SELECT 'tipo_financiamiento ya contiene sin_interes' AS info"
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
