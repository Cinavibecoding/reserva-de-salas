# Sistema de Reservación de Salas

Código fuente completo de una aplicación de reservas de salas para uso corporativo.

> Este proyecto fue construido para un cliente real. Los nombres, dominios y datos de la organización original se removieron de este repositorio por confidencialidad; el código y la funcionalidad son exactamente los que se usan en producción.

## Contenido

- `src/` — Todo el código de la aplicación (páginas, componentes, conexión al backend)
- `supabase/` — Configuración del backend (Lovable Cloud)
- `package.json`, `tsconfig.json`, `vite.config.ts`, etc. — Configuración del proyecto

## Notas importantes

Este proyecto está conectado a una base de datos en Lovable Cloud (ref: egxqzyjsglazncfelixf). Las credenciales de conexión se inyectan automáticamente desde Lovable y **no están incluidas** en este ZIP (viven en el archivo `.env`, que es privado).

### Para correr este código localmente necesitarías:

1. Node.js 20+ y Bun (o npm/pnpm)
2. Instalar dependencias: `bun install`
3. Crear un archivo `.env` con las variables:
   - `VITE_SUPABASE_URL=<url de tu proyecto>`
   - `VITE_SUPABASE_PUBLISHABLE_KEY=<clave pública>`
   - `VITE_SUPABASE_PROJECT_ID=<id del proyecto>`
4. Levantar el servidor: `bun run dev`

La forma más sencilla de seguir trabajando en este proyecto es directamente aquí en Lovable, donde la base de datos ya está configurada y conectada.

## Funcionalidades

- Vista pública de reservas (todos pueden ver las reservas aprobadas)
- Formulario de solicitud de reserva (pendiente de aprobación)
- Panel de solicitudes pendientes al final de la página
- Inicio de sesión exclusivo para administradores (botón abajo a la derecha)
- Los administradores pueden aprobar o rechazar solicitudes, con motivo de rechazo
- Panel de administradores para promover otros correos a admin
- Historial de reservaciones (aprobadas/rechazadas) con filtros y exportación CSV
- Cancelación de reservas por parte del administrador
