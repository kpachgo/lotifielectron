-- LOTIFI - Migracion incremental: documentos por cliente
-- Fecha: 2026-03-16
-- Objetivo: extender tabla documentos para soportar archivos de cliente/contrato
-- sin afectar comprobantes existentes.

USE lotifi;

SET @schema_name = DATABASE();

-- ---------------------------------------------------------
-- Columnas nuevas
-- ---------------------------------------------------------
SELECT COUNT(*)
INTO @has_id_cliente
FROM information_schema.columns
WHERE table_schema = @schema_name
  AND table_name = 'documentos'
  AND column_name = 'id_cliente';

SET @sql = IF(
  @has_id_cliente = 0,
  "ALTER TABLE `documentos` ADD COLUMN `id_cliente` INT NULL AFTER `id_pago`",
  "SELECT 'id_cliente ya existe' AS info"
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SELECT COUNT(*)
INTO @has_id_contrato
FROM information_schema.columns
WHERE table_schema = @schema_name
  AND table_name = 'documentos'
  AND column_name = 'id_contrato';

SET @sql = IF(
  @has_id_contrato = 0,
  "ALTER TABLE `documentos` ADD COLUMN `id_contrato` INT NULL AFTER `id_cliente`",
  "SELECT 'id_contrato ya existe' AS info"
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SELECT COUNT(*)
INTO @has_descripcion
FROM information_schema.columns
WHERE table_schema = @schema_name
  AND table_name = 'documentos'
  AND column_name = 'descripcion_documento';

SET @sql = IF(
  @has_descripcion = 0,
  "ALTER TABLE `documentos` ADD COLUMN `descripcion_documento` VARCHAR(255) NULL AFTER `tipo_documento`",
  "SELECT 'descripcion_documento ya existe' AS info"
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ---------------------------------------------------------
-- id_pago nullable para convivir con documentos de cliente
-- ---------------------------------------------------------
SELECT IS_NULLABLE
INTO @id_pago_nullable
FROM information_schema.columns
WHERE table_schema = @schema_name
  AND table_name = 'documentos'
  AND column_name = 'id_pago'
LIMIT 1;

SET @sql = IF(
  @id_pago_nullable = 'NO',
  "ALTER TABLE `documentos` MODIFY COLUMN `id_pago` INT NULL",
  "SELECT 'id_pago ya permite NULL' AS info"
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ---------------------------------------------------------
-- Indices
-- ---------------------------------------------------------
SELECT COUNT(*)
INTO @has_idx_cliente
FROM information_schema.statistics
WHERE table_schema = @schema_name
  AND table_name = 'documentos'
  AND index_name = 'idx_documentos_cliente';

SET @sql = IF(
  @has_idx_cliente = 0,
  "ALTER TABLE `documentos` ADD INDEX `idx_documentos_cliente` (`id_cliente`)",
  "SELECT 'idx_documentos_cliente ya existe' AS info"
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SELECT COUNT(*)
INTO @has_idx_contrato
FROM information_schema.statistics
WHERE table_schema = @schema_name
  AND table_name = 'documentos'
  AND index_name = 'idx_documentos_contrato';

SET @sql = IF(
  @has_idx_contrato = 0,
  "ALTER TABLE `documentos` ADD INDEX `idx_documentos_contrato` (`id_contrato`)",
  "SELECT 'idx_documentos_contrato ya existe' AS info"
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SELECT COUNT(*)
INTO @has_idx_tipo
FROM information_schema.statistics
WHERE table_schema = @schema_name
  AND table_name = 'documentos'
  AND index_name = 'idx_documentos_tipo';

SET @sql = IF(
  @has_idx_tipo = 0,
  "ALTER TABLE `documentos` ADD INDEX `idx_documentos_tipo` (`tipo_documento`)",
  "SELECT 'idx_documentos_tipo ya existe' AS info"
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ---------------------------------------------------------
-- Backfill id_cliente para comprobantes historicos
-- ---------------------------------------------------------
UPDATE documentos d
JOIN pagos p ON p.id_pago = d.id_pago
JOIN cuotas cu ON cu.id_cuota = p.id_cuota
JOIN contratos co ON co.id_contrato = cu.id_contrato
SET d.id_cliente = co.id_cliente
WHERE d.id_cliente IS NULL
  AND d.id_pago IS NOT NULL;

-- ---------------------------------------------------------
-- Foreign keys nuevas
-- ---------------------------------------------------------
SELECT COUNT(*)
INTO @has_fk_cliente
FROM information_schema.table_constraints
WHERE table_schema = @schema_name
  AND table_name = 'documentos'
  AND constraint_name = 'fk_documentos_cliente'
  AND constraint_type = 'FOREIGN KEY';

SET @sql = IF(
  @has_fk_cliente = 0,
  "ALTER TABLE `documentos`
   ADD CONSTRAINT `fk_documentos_cliente`
   FOREIGN KEY (`id_cliente`) REFERENCES `cliente` (`id_cliente`)",
  "SELECT 'fk_documentos_cliente ya existe' AS info"
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SELECT COUNT(*)
INTO @has_fk_contrato
FROM information_schema.table_constraints
WHERE table_schema = @schema_name
  AND table_name = 'documentos'
  AND constraint_name = 'fk_documentos_contrato'
  AND constraint_type = 'FOREIGN KEY';

SET @sql = IF(
  @has_fk_contrato = 0,
  "ALTER TABLE `documentos`
   ADD CONSTRAINT `fk_documentos_contrato`
   FOREIGN KEY (`id_contrato`) REFERENCES `contratos` (`id_contrato`)",
  "SELECT 'fk_documentos_contrato ya existe' AS info"
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
