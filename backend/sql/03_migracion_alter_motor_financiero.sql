-- LOTIFI - Migracion por ALTER TABLE (sin perder datos)
-- Fecha: 2026-02-22
-- Objetivo: alinear una BD existente al esquema y motor financiero actual.

USE lotifi;

SET @schema_name = DATABASE();

-- =========================================================
-- Helpers idempotentes
-- =========================================================
DROP PROCEDURE IF EXISTS sp_add_col_if_missing;
DROP PROCEDURE IF EXISTS sp_add_idx_if_missing;
DROP PROCEDURE IF EXISTS sp_mod_col_if_exists;
DROP PROCEDURE IF EXISTS sp_exec_if_table_exists;

DELIMITER $$

CREATE PROCEDURE sp_add_col_if_missing(
  IN p_table VARCHAR(64),
  IN p_col VARCHAR(64),
  IN p_def TEXT
)
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = @schema_name
      AND table_name = p_table
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = @schema_name
      AND table_name = p_table
      AND column_name = p_col
  ) THEN
    SET @sql = CONCAT(
      'ALTER TABLE `', p_table, '` ',
      'ADD COLUMN `', p_col, '` ', p_def
    );
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END$$

CREATE PROCEDURE sp_add_idx_if_missing(
  IN p_table VARCHAR(64),
  IN p_idx VARCHAR(64),
  IN p_def TEXT
)
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = @schema_name
      AND table_name = p_table
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.statistics
    WHERE table_schema = @schema_name
      AND table_name = p_table
      AND index_name = p_idx
  ) THEN
    SET @sql = CONCAT(
      'ALTER TABLE `', p_table, '` ',
      'ADD ', p_def
    );
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END$$

CREATE PROCEDURE sp_mod_col_if_exists(
  IN p_table VARCHAR(64),
  IN p_col VARCHAR(64),
  IN p_def TEXT
)
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = @schema_name
      AND table_name = p_table
      AND column_name = p_col
  ) THEN
    SET @sql = CONCAT(
      'ALTER TABLE `', p_table, '` ',
      'MODIFY COLUMN `', p_col, '` ', p_def
    );
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END$$

CREATE PROCEDURE sp_exec_if_table_exists(
  IN p_table VARCHAR(64),
  IN p_sql TEXT
)
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = @schema_name
      AND table_name = p_table
  ) THEN
    SET @sql = p_sql;
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END$$

DELIMITER ;

-- =========================================================
-- contratos
-- =========================================================
CALL sp_add_col_if_missing(
  'contratos',
  'tipo_financiamiento',
  "ENUM('interes_saldo','penalizacion_fija') NULL AFTER `id_lote`"
);

CALL sp_add_col_if_missing(
  'contratos',
  'capital_pendiente',
  "DECIMAL(10,2) NULL AFTER `estado`"
);

CALL sp_add_col_if_missing(
  'contratos',
  'tasa_interes_anual',
  "DECIMAL(10,4) NULL AFTER `capital_pendiente`"
);

CALL sp_add_col_if_missing(
  'contratos',
  'penalizacion_fija',
  "DECIMAL(10,2) NULL AFTER `tasa_interes_anual`"
);

CALL sp_add_col_if_missing(
  'contratos',
  'dias_gracia',
  "INT NULL DEFAULT 0 AFTER `penalizacion_fija`"
);

CALL sp_exec_if_table_exists(
  'contratos',
  "UPDATE `contratos`
   SET `tipo_financiamiento` = 'penalizacion_fija'
   WHERE `tipo_financiamiento` IS NULL OR `tipo_financiamiento` = ''"
);

CALL sp_exec_if_table_exists(
  'contratos',
  "UPDATE `contratos`
   SET `capital_pendiente` = `monto_financiado`
   WHERE `capital_pendiente` IS NULL"
);

CALL sp_exec_if_table_exists(
  'contratos',
  "UPDATE `contratos`
   SET `dias_gracia` = 0
   WHERE `dias_gracia` IS NULL"
);

CALL sp_mod_col_if_exists(
  'contratos',
  'tipo_financiamiento',
  "ENUM('interes_saldo','penalizacion_fija') NOT NULL"
);

CALL sp_mod_col_if_exists(
  'contratos',
  'capital_pendiente',
  "DECIMAL(10,2) NOT NULL"
);

CALL sp_mod_col_if_exists(
  'contratos',
  'dias_gracia',
  "INT DEFAULT 0"
);

CALL sp_add_idx_if_missing(
  'contratos',
  'idx_contratos_estado',
  "INDEX `idx_contratos_estado` (`estado`)"
);

-- =========================================================
-- cuotas
-- =========================================================
CALL sp_add_col_if_missing(
  'cuotas',
  'capital_pendiente',
  "DECIMAL(10,2) NULL AFTER `monto_cuota`"
);

CALL sp_exec_if_table_exists(
  'cuotas',
  "UPDATE `cuotas`
   SET `capital_pendiente` = `monto_cuota`
   WHERE `capital_pendiente` IS NULL"
);

CALL sp_mod_col_if_exists(
  'cuotas',
  'capital_pendiente',
  "DECIMAL(10,2) NOT NULL"
);

CALL sp_add_idx_if_missing(
  'cuotas',
  'uq_cuotas_contrato_numero',
  "UNIQUE INDEX `uq_cuotas_contrato_numero` (`id_contrato`, `numero_cuota`)"
);

CALL sp_add_idx_if_missing(
  'cuotas',
  'idx_cuotas_estado',
  "INDEX `idx_cuotas_estado` (`estado`)"
);

CALL sp_add_idx_if_missing(
  'cuotas',
  'idx_cuotas_vencimiento',
  "INDEX `idx_cuotas_vencimiento` (`fecha_vencimiento`)"
);

-- =========================================================
-- pagos
-- =========================================================
CALL sp_add_col_if_missing(
  'pagos',
  'abono_mora',
  "DECIMAL(10,2) NULL DEFAULT 0.00 AFTER `abono_interes`"
);

CALL sp_add_col_if_missing(
  'pagos',
  'numero_recibo',
  "VARCHAR(30) NULL AFTER `monto_total`"
);

CALL sp_exec_if_table_exists(
  'pagos',
  "UPDATE `pagos`
   SET `abono_mora` = 0
   WHERE `abono_mora` IS NULL"
);

CALL sp_mod_col_if_exists(
  'pagos',
  'abono_mora',
  "DECIMAL(10,2) NOT NULL DEFAULT 0.00"
);

CALL sp_add_idx_if_missing(
  'pagos',
  'idx_pagos_fecha_abono',
  "INDEX `idx_pagos_fecha_abono` (`fecha_abono`)"
);

-- =========================================================
-- lotes
-- =========================================================
CALL sp_add_col_if_missing(
  'lotes',
  'prima',
  "DECIMAL(10,2) DEFAULT 2500.00 AFTER `precio`"
);

CALL sp_add_col_if_missing(
  'lotes',
  'cuota_5_anios',
  "DECIMAL(10,2) NULL AFTER `prima`"
);

CALL sp_add_col_if_missing(
  'lotes',
  'cuota_10_anios',
  "DECIMAL(10,2) NULL AFTER `cuota_5_anios`"
);

CALL sp_add_col_if_missing(
  'lotes',
  'cuota_15_anios',
  "DECIMAL(10,2) NULL AFTER `cuota_10_anios`"
);

CALL sp_exec_if_table_exists(
  'lotes',
  "UPDATE `lotes`
   SET `prima` = 2500.00
   WHERE `prima` IS NULL"
);

CALL sp_mod_col_if_exists(
  'lotes',
  'estado',
  "ENUM('disponible','promesa_venta','vendido') DEFAULT 'disponible'"
);

CALL sp_add_idx_if_missing(
  'lotes',
  'idx_lotes_estado',
  "INDEX `idx_lotes_estado` (`estado`)"
);

-- =========================================================
-- Limpieza helper procedures
-- =========================================================
DROP PROCEDURE IF EXISTS sp_add_col_if_missing;
DROP PROCEDURE IF EXISTS sp_add_idx_if_missing;
DROP PROCEDURE IF EXISTS sp_mod_col_if_exists;
DROP PROCEDURE IF EXISTS sp_exec_if_table_exists;

