-- LOTIFI - Esquema base alineado al codigo actual
-- Fecha: 2026-02-22

CREATE DATABASE IF NOT EXISTS lotifi
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

USE lotifi;

SET NAMES utf8mb4;

-- =========================
-- Catalogos base
-- =========================
CREATE TABLE IF NOT EXISTS cliente (
  id_cliente INT NOT NULL AUTO_INCREMENT,
  nombres VARCHAR(100) NOT NULL,
  apellidos VARCHAR(100) DEFAULT NULL,
  dui VARCHAR(15) DEFAULT NULL,
  telefono VARCHAR(50) DEFAULT NULL,
  direccion VARCHAR(250) DEFAULT NULL,
  nit VARCHAR(20) DEFAULT NULL,
  PRIMARY KEY (id_cliente)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS lotificaciones (
  id_lotificacion INT NOT NULL AUTO_INCREMENT,
  nombre VARCHAR(100) NOT NULL,
  ubicacion VARCHAR(200) DEFAULT NULL,
  descripcion TEXT,
  PRIMARY KEY (id_lotificacion)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS poligonos (
  id_poligono INT NOT NULL AUTO_INCREMENT,
  id_lotificacion INT NOT NULL,
  nombre_poligono VARCHAR(50) NOT NULL,
  PRIMARY KEY (id_poligono),
  KEY idx_poligonos_lotificacion (id_lotificacion),
  CONSTRAINT fk_poligonos_lotificacion
    FOREIGN KEY (id_lotificacion) REFERENCES lotificaciones (id_lotificacion)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS lotes (
  id_lote INT NOT NULL AUTO_INCREMENT,
  id_poligono INT NOT NULL,
  numero_lote VARCHAR(20) NOT NULL,
  area DECIMAL(10,2) DEFAULT NULL,
  unidad_area ENUM('m2','v2') DEFAULT NULL,
  precio_base DECIMAL(10,2) DEFAULT NULL,
  precio DECIMAL(10,2) DEFAULT NULL,
  prima DECIMAL(10,2) DEFAULT 2500.00,
  cuota_5_anios DECIMAL(10,2) DEFAULT NULL,
  cuota_10_anios DECIMAL(10,2) DEFAULT NULL,
  cuota_15_anios DECIMAL(10,2) DEFAULT NULL,
  estado ENUM('disponible','promesa_venta','vendido') DEFAULT 'disponible',
  PRIMARY KEY (id_lote),
  KEY idx_lotes_poligono (id_poligono),
  KEY idx_lotes_estado (estado),
  CONSTRAINT fk_lotes_poligonos
    FOREIGN KEY (id_poligono) REFERENCES poligonos (id_poligono)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- =========================
-- Core financiero
-- =========================
CREATE TABLE IF NOT EXISTS contratos (
  id_contrato INT NOT NULL AUTO_INCREMENT,
  id_cliente INT NOT NULL,
  id_lote INT NOT NULL,
  tipo_financiamiento ENUM('interes_saldo','penalizacion_fija') NOT NULL,
  precio_total DECIMAL(10,2) NOT NULL,
  prima DECIMAL(10,2) DEFAULT 0.00,
  monto_financiado DECIMAL(10,2) NOT NULL,
  plazo_meses INT NOT NULL,
  cuota DECIMAL(10,2) DEFAULT NULL,
  fecha_inicio DATE NOT NULL,
  fecha_vencimiento DATE NOT NULL,
  estado ENUM('activo','vencido','cancelado') DEFAULT 'activo',
  capital_pendiente DECIMAL(10,2) NOT NULL,
  tasa_interes_anual DECIMAL(10,4) DEFAULT NULL,
  penalizacion_fija DECIMAL(10,2) DEFAULT NULL,
  dias_gracia INT DEFAULT 0,
  factor_usado DECIMAL(10,2) DEFAULT NULL,
  PRIMARY KEY (id_contrato),
  KEY idx_contratos_cliente (id_cliente),
  KEY idx_contratos_lote (id_lote),
  KEY idx_contratos_estado (estado),
  CONSTRAINT fk_contratos_cliente
    FOREIGN KEY (id_cliente) REFERENCES cliente (id_cliente),
  CONSTRAINT fk_contratos_lote
    FOREIGN KEY (id_lote) REFERENCES lotes (id_lote)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS cuotas (
  id_cuota INT NOT NULL AUTO_INCREMENT,
  id_contrato INT NOT NULL,
  numero_cuota INT NOT NULL,
  fecha_vencimiento DATE NOT NULL,
  monto_cuota DECIMAL(10,2) NOT NULL,
  capital_pendiente DECIMAL(10,2) NOT NULL,
  estado ENUM('pendiente','pagada','atrasada') DEFAULT 'pendiente',
  PRIMARY KEY (id_cuota),
  UNIQUE KEY uq_cuotas_contrato_numero (id_contrato, numero_cuota),
  KEY idx_cuotas_estado (estado),
  KEY idx_cuotas_vencimiento (fecha_vencimiento),
  CONSTRAINT fk_cuotas_contrato
    FOREIGN KEY (id_contrato) REFERENCES contratos (id_contrato)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS pagos (
  id_pago INT NOT NULL AUTO_INCREMENT,
  id_cuota INT NOT NULL,
  fecha_abono DATE NOT NULL,
  fecha_recibo DATE NOT NULL,
  forma_pago ENUM('Efectivo','Remesa','Transferencia','Cheque') NOT NULL,
  banco VARCHAR(100) DEFAULT NULL,
  abono_capital DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  abono_interes DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  abono_mora DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  monto_total DECIMAL(10,2) NOT NULL,
  numero_recibo VARCHAR(30) DEFAULT NULL,
  PRIMARY KEY (id_pago),
  KEY idx_pagos_cuota (id_cuota),
  KEY idx_pagos_fecha_abono (fecha_abono),
  CONSTRAINT fk_pagos_cuota
    FOREIGN KEY (id_cuota) REFERENCES cuotas (id_cuota)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS documentos (
  id_documento INT NOT NULL AUTO_INCREMENT,
  id_pago INT NOT NULL,
  tipo_documento VARCHAR(50) NOT NULL,
  ruta_archivo VARCHAR(255) NOT NULL,
  fecha_subida DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_documento),
  KEY idx_documentos_pago (id_pago),
  CONSTRAINT fk_documentos_pago
    FOREIGN KEY (id_pago) REFERENCES pagos (id_pago)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- =========================
-- Tablas historicas / auxiliares
-- =========================
CREATE TABLE IF NOT EXISTS gastos (
  id_gasto INT NOT NULL AUTO_INCREMENT,
  id_contrato INT NOT NULL,
  concepto VARCHAR(100) NOT NULL,
  monto DECIMAL(10,2) NOT NULL,
  fecha DATE NOT NULL,
  PRIMARY KEY (id_gasto),
  KEY idx_gastos_contrato (id_contrato),
  CONSTRAINT fk_gastos_contrato
    FOREIGN KEY (id_contrato) REFERENCES contratos (id_contrato)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS mora (
  id_mora INT NOT NULL AUTO_INCREMENT,
  id_cuota INT NOT NULL,
  dias_atraso INT NOT NULL,
  monto_mora DECIMAL(10,2) NOT NULL,
  fecha_calculo DATE NOT NULL,
  PRIMARY KEY (id_mora),
  KEY idx_mora_cuota (id_cuota),
  CONSTRAINT fk_mora_cuota
    FOREIGN KEY (id_cuota) REFERENCES cuotas (id_cuota)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS recibos (
  id_recibo INT NOT NULL AUTO_INCREMENT,
  id_pago INT NOT NULL,
  numero_recibo VARCHAR(30) NOT NULL,
  fecha_emision DATE NOT NULL,
  estado ENUM('emitido','cancelado') DEFAULT 'emitido',
  PRIMARY KEY (id_recibo),
  KEY idx_recibos_pago (id_pago),
  CONSTRAINT fk_recibos_pago
    FOREIGN KEY (id_pago) REFERENCES pagos (id_pago)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS reservas (
  id_reserva INT NOT NULL AUTO_INCREMENT,
  id_lote INT NOT NULL,
  id_cliente INT NOT NULL,
  fecha_reserva DATE NOT NULL,
  fecha_expiracion DATE NOT NULL,
  estado ENUM('activa','cancelada','convertida') DEFAULT 'activa',
  PRIMARY KEY (id_reserva),
  KEY idx_reservas_lote (id_lote),
  KEY idx_reservas_cliente (id_cliente),
  CONSTRAINT fk_reservas_lote
    FOREIGN KEY (id_lote) REFERENCES lotes (id_lote),
  CONSTRAINT fk_reservas_cliente
    FOREIGN KEY (id_cliente) REFERENCES cliente (id_cliente)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS historial_lote (
  id_historial INT NOT NULL AUTO_INCREMENT,
  id_lotificacion INT NOT NULL,
  id_poligono INT NOT NULL,
  id_lote INT NOT NULL,
  id_cliente INT DEFAULT NULL,
  id_contrato INT DEFAULT NULL,
  precio_lote DECIMAL(10,2) NOT NULL,
  prima DECIMAL(10,2) NOT NULL,
  monto_financiado DECIMAL(10,2) NOT NULL,
  cuota_mensual DECIMAL(10,2) NOT NULL,
  plazo_meses INT NOT NULL,
  letra_corrida DECIMAL(10,2) NOT NULL,
  interes_mensual DECIMAL(5,2) DEFAULT NULL,
  interes_mora DECIMAL(5,2) DEFAULT NULL,
  fecha_inicio DATE DEFAULT NULL,
  estado ENUM('activo','finalizado','cancelado') DEFAULT 'activo',
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_historial),
  KEY idx_historial_lote (id_lote),
  KEY idx_historial_contrato (id_contrato)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

