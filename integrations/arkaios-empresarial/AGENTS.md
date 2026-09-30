# Integración empresarial

## Alcance

Este directorio contiene un prototipo React/TSX de acceso empresarial.
Mantén los cambios dentro de este módulo salvo que la corrección requiera
coordinar explícitamente una dependencia externa.

## Estructura y flujo

- `main.tsx` monta React en el elemento DOM `#root`.
- La cadena de entrada prevista es `main.tsx` → `PlatformHub` → `BusinessAccess`.
- `PlatformHub.tsx` alterna entre modo educativo y empresarial con estado local.
- `BusinessAccess.tsx` contiene autenticación demo, roles y operaciones de saldo.
- Los roles son `admin`, `cajero` y `cliente`; preserva sus reglas de visibilidad.

## Dependencias y estado actual

- Se usan React, `react-dom/client` y los iconos de `lucide-react`.
- `PlatformHub.tsx` importa `../App-backup`, pero esa ruta no existe en el árbol
  local inspeccionado. Es una dependencia externa o ausente que debe resolverse
  antes de esperar una compilación funcional del modo educativo.
- `main.tsx` importa `./components/PlatformHub`, aunque el archivo local es
  `PlatformHub.tsx` en este mismo directorio. Verifica la estructura de destino
  antes de cambiar esa referencia.
- No hay `package.json`, `tsconfig*.json` ni configuración visible de build en
  este directorio; no inventes comandos de instalación, compilación o pruebas.

## Persistencia

- Las cuentas se guardan en `localStorage` bajo `ark_business_accounts`.
- El registro de movimientos usa `ark_business_movements` y conserva hasta 2000
  entradas; cada historial de cuenta conserva hasta 50 movimientos.
- El sembrado de cuentas demo se ejecuta al cargar el módulo si no hay cuentas.
- No trates los IDs, NIP ni saldos demo como un mecanismo de seguridad real.
- Si se conecta a un backend, evita guardar NIP o datos sensibles en texto plano
  y define una migración explícita para las claves locales existentes.

## Convenciones de cambio

- Conserva TypeScript estricto y los tipos `BizRole` y `BizAccount` alineados
  con las operaciones y la interfaz.
- Actualiza estado React y `localStorage` mediante las funciones de persistencia
  para que la pantalla activa no quede desincronizada.
- Valida montos finitos y positivos antes de aplicar movimientos; conserva el
  límite inferior de saldo en cero salvo que cambie el requisito de negocio.
- Mantén las clases utilitarias existentes para no introducir otra estrategia de
  estilos en este fragmento.
- Distingue entre comportamiento de demostración y funcionalidades de producción
  en cualquier cambio de autenticación, auditoría o dinero.

## Verificación

- Primero confirma que el consumidor real aporta `#root`, React y las rutas de
  importación requeridas.
- Revisa manualmente los flujos de login, alta de cliente, recarga, cobro,
  visibilidad por rol, cierre de sesión y recarga de página.
- Documenta cualquier validación no ejecutada cuando falte el proyecto anfitrión.
