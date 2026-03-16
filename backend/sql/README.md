# SQL de referencia (Lotifi)

Archivos:
- `backend/sql/01_schema_lotifi.sql`: esquema base completo alineado al codigo actual.
- `backend/sql/02_reset_tablas.sql`: limpia datos para pruebas (mantiene estructura).
- `backend/sql/03_migracion_alter_motor_financiero.sql`: migra una BD existente con `ALTER TABLE` (sin borrar datos).
- `backend/sql/04_migracion_add_sin_interes.sql`: agrega el metodo financiero `sin_interes` al enum de `contratos.tipo_financiamiento`.
- `backend/sql/05_migracion_documentos_cliente.sql`: extiende `documentos` para soportar archivos por cliente/contrato (sin tocar comprobantes existentes).

Uso rapido:
1. Crear estructura: ejecutar `01_schema_lotifi.sql`.
2. Vaciar datos: ejecutar `02_reset_tablas.sql`.
3. Migrar BD existente (sin perder datos): ejecutar `03_migracion_alter_motor_financiero.sql`.
4. Si tu BD ya estaba operativa y solo necesitas el nuevo metodo: ejecutar `04_migracion_add_sin_interes.sql`.
5. Para habilitar documentos por cliente en una BD ya instalada: ejecutar `05_migracion_documentos_cliente.sql`.

Nota:
- Este esquema fue construido en base al codigo backend actual.
- Si tu BD productiva ya existe y tiene datos, aplica cambios con migraciones controladas antes de usar `TRUNCATE`.
