# Noter

Notas en Markdown para el escritorio, con categorías, etiquetas y búsqueda de texto completo. Tus datos viven en tu equipo, en una base SQLite.

![Tauri](https://img.shields.io/badge/Tauri-v2-24C8DB?logo=tauri&logoColor=white)
![Rust](https://img.shields.io/badge/Rust-stable-000000?logo=rust&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-06B6D4?logo=tailwindcss&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-FTS5-003B57?logo=sqlite&logoColor=white)

<!-- TODO: agregar captura (vista general de la app: barra de categorías, lista de notas y editor) -->

> **Aviso de seguridad:** hoy los datos **NO están cifrados**. SQLCipher está compilado y probado, pero la app crea las bases de datos **sin clave**. No guardes información sensible hasta que termine la fase de cifrado (ver [Estado](#-estado)).

## Contenido

- [Características](#-características)
- [Estado](#-estado)
- [Requisitos (Windows 11)](#-requisitos-windows-11)
- [Primer arranque](#-primer-arranque)
- [Problema de rutas largas y `target-dir`](#-problema-de-rutas-largas-y-target-dir)
- [Scripts de npm](#-scripts-de-npm)
- [Pruebas](#-pruebas)
- [Estructura del proyecto](#-estructura-del-proyecto)
- [Dónde se guardan los datos](#-dónde-se-guardan-los-datos)
- [Temas y paletas](#-temas-y-paletas)
- [Solución de problemas](#-solución-de-problemas)
- [Contribuir y licencia](#-contribuir-y-licencia)

## ✨ Características

| Función | Descripción |
| --- | --- |
| Editor Markdown | CodeMirror 6 con tres modos: **Editar**, **Dividir** y **Vista**. Vista previa con GitHub Flavored Markdown. |
| Autoguardado | Guarda unos 600 ms después de escribir, y al perder el foco o cerrar. |
| Categorías | Barra lateral al estilo Discord, con emoji y color (matiz) por categoría. |
| Etiquetas | Se normalizan (sin `#`, en minúsculas) y se filtran de forma múltiple (todas las seleccionadas deben coincidir). |
| Búsqueda | Texto completo con SQLite FTS5: por prefijo y sin distinguir tildes. |
| Temas | Claro y oscuro, con 5 paletas: Malva, Musgo, Brasa, Océano y Rosa. |
| Fijar notas | Las notas fijadas quedan arriba en la lista. |
| Papelera | El backend ya soporta enviar, restaurar, purgar y vaciar. La pantalla de papelera está **en desarrollo**. |
| Varias bóvedas | El backend ya registra, renombra y cambia de bóveda. El selector en la interfaz está **en desarrollo**. |
| Selector de emojis | Hoy hay una cuadrícula de emojis fija para las categorías. Un selector completo está **en desarrollo**. |

## 🚧 Estado

Noter está en desarrollo activo. La interfaz cambia a diario.

- [x] Fase 1: esquema SQLite con FTS5 y migraciones versionadas
- [x] Fase 2: CRUD de notas, categorías y etiquetas; búsqueda; papelera; registro de varias bóvedas (backend)
- [x] Fase 3: interfaz de tres columnas, editor con modos Editar/Dividir/Vista, temas y autoguardado
- [ ] Contraseña y cifrado de la bóveda (SQLCipher funciona, pero hoy las bases se crean **sin clave**)
- [ ] Bloqueo por inactividad
- [ ] Clave de recuperación
- [ ] Auditoría de seguridad
- [ ] Pruebas E2E
- [ ] Empaquetado e instaladores (la configuración existe, pero no está validada)

> **Los datos de hoy NO están cifrados.** En esta fase, una clave vacía significa "base sin cifrar". El panel inferior de la interfaz muestra el texto "Desbloqueada · cifrada" y el botón de bloqueo está deshabilitado: es un marcador de la fase siguiente, no refleja el estado real.

## 🧰 Requisitos (Windows 11)

Es el entorno donde se desarrolla el proyecto. Otros sistemas no se han probado.

| Herramienta | Versión | Para qué |
| --- | --- | --- |
| Node.js | 22 o superior | Frontend y CLI de Tauri |
| Rust (rustup) | estable | Backend |
| Visual Studio Build Tools | carga de trabajo "Desarrollo de escritorio con C++" (MSVC + Windows SDK) | Compilar Rust en Windows |
| WebView2 | ya viene en Windows 11 | Motor web de la ventana |
| Strawberry Perl | cualquiera reciente | `rusqlite` compila SQLCipher con OpenSSL "vendored", y eso necesita un Perl completo |

Instalación sugerida con `winget` (PowerShell):

```powershell
winget install Rustlang.Rustup
winget install StrawberryPerl.StrawberryPerl
```

Node.js y las Build Tools se instalan desde sus sitios oficiales o con `winget` si lo prefieres. Cierra y abre la terminal después de instalar.

Dos detalles del `PATH` que dan problemas:

- **`cargo` debe estar en el `PATH`:** `$env:USERPROFILE\.cargo\bin`. Rustup suele agregarlo; si no, agrégalo.
- **Strawberry Perl debe ir antes que el Perl de Git.** Si tienes Git for Windows, su Perl **no sirve** para compilar OpenSSL y falla. Comprueba cuál se usa:

```powershell
Get-Command perl -All | Select-Object -ExpandProperty Source
```

La primera línea debe ser de Strawberry Perl (por ejemplo `C:\Strawberry\perl\bin\perl.exe`), no de `...\Git\usr\bin`.

Verifica todo:

```powershell
node --version
cargo --version
perl --version
```

## 🚀 Primer arranque

```powershell
git clone <url-del-repo>
cd noter
npm install
npm run tauri dev
```

La **primera compilación de Rust tarda varios minutos** (unos 8 con OpenSSL). Las siguientes tardan segundos. Es normal que parezca detenida: está compilando OpenSSL.

`npm run tauri dev` levanta Vite en `http://localhost:1420` y abre la ventana de la app.

## 📏 Problema de rutas largas y `target-dir`

La compilación de OpenSSL falla en Windows si la ruta de compilación supera los 260 caracteres. Para evitarlo, el proyecto fija una ruta corta en `src-tauri/.cargo/config.toml`:

```toml
[build]
target-dir = "C:/t/noter"
```

Qué implica:

- Los artefactos de compilación **no** quedan en `src-tauri/target`, sino en `C:\t\noter`.
- Tu usuario necesita permiso de escritura en `C:\t`. Si Cargo no puede crearla, créala tú:

```powershell
New-Item -ItemType Directory -Force C:\t
```

Para cambiar la ruta, edita `target-dir` en ese archivo y usa otra **lo más corta posible** (por ejemplo `D:/t/noter`). Después, la siguiente compilación empieza de cero.

Activar las "rutas largas" de Windows podría ser otra salida, pero **no está verificado** en este proyecto. [POR CONFIRMAR]

## 📜 Scripts de npm

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Solo el frontend con Vite (puerto 1420). Lo usa `tauri dev` por dentro. |
| `npm run build` | Revisa tipos con `tsc` y genera el frontend en `dist/`. |
| `npm run preview` | Sirve el `dist/` generado, para revisarlo en el navegador. |
| `npm run tauri <cmd>` | Acceso a la CLI de Tauri (`dev`, `build`, etc.). |

Para generar el instalador:

```powershell
npm run tauri build
```

La configuración (`tauri.conf.json`) usa `"targets": "all"`. Con el `target-dir` personalizado, los paquetes deberían quedar bajo `C:\t\noter\release\bundle\`. [POR CONFIRMAR] El empaquetado y la firma **todavía no están validados**: no se ha probado un instalador de punta a punta.

## 🧪 Pruebas

Pruebas del backend (esquema, FTS, repositorio, papelera y registro de bóvedas):

```powershell
cd src-tauri
cargo test --lib
```

Verificación de tipos del frontend:

```powershell
npm run build
```

Durante la compilación pueden aparecer avisos del linker `LNK4099` sobre `ossl_static.pdb`. Son inofensivos.

Aún no hay pruebas del frontend ni E2E.

## 🗂️ Estructura del proyecto

```text
noter/
├─ src/                      Frontend (React + TypeScript)
│  ├─ api/                   Único punto de contacto con Tauri (invoke), tipos y errores
│  ├─ stores/                Estado global con Zustand (notas, interfaz)
│  ├─ theme/                 Paletas, tokens CSS y hook de tema
│  ├─ features/              Pantallas por tema: categories, notes, editor, vault
│  ├─ components/            Piezas reutilizables (Popover, IconButton, Toast...)
│  └─ lib/                   Utilidades (debounce, fechas, texto...)
└─ src-tauri/                Backend (Rust)
   ├─ .cargo/config.toml     target-dir corto (ver arriba)
   ├─ tauri.conf.json        Configuración de la app y del empaquetado
   └─ src/
      ├─ commands.rs         Comandos Tauri, finos y sin SQL
      ├─ repo.rs             Lógica de datos de notas, categorías y etiquetas
      ├─ db/                 Apertura de la base, migraciones y queries.sql
      │  ├─ migrations/      Migraciones numeradas (NNNN_nombre.sql)
      │  └─ queries.sql      Consultas SQL con nombre (-- name: ...)
      ├─ vaults.rs           Registro de bóvedas (vaults.json)
      ├─ state.rs            Estado compartido (conexión activa, carpeta de datos)
      └─ error.rs            Error común que se envía al frontend
```

### Arquitectura en cuatro reglas

1. **El frontend nunca ve SQL.** Solo recibe y envía datos tipados.
2. **Los comandos Tauri son finos:** validan la entrada, toman la conexión y llaman a `repo`.
3. **Todo el SQL vive en `repo` y `db`** (migraciones y `queries.sql`).
4. **Toda llamada a Tauri pasa por `src/api`.** Ningún componente llama a `invoke` directamente.

Una analogía: `src/api` es la ventanilla de un banco. Nadie entra a la bóveda (SQL); se pide algo en la ventanilla y el personal (`commands` y `repo`) lo hace.

## 💾 Dónde se guardan los datos

Noter usa la carpeta de datos de la app que define Tauri (`app_data_dir`). Su nombre sale del identificador `com.kuroneko.noter` (en `tauri.conf.json`). En Windows suele ser:

```text
%APPDATA%\com.kuroneko.noter
```

Dentro hay:

| Archivo | Contenido |
| --- | --- |
| `vaults.json` | Registro de bóvedas y cuál está activa |
| `noter-dev.db` | Base de la primera bóveda ("Mi bóveda") |
| `vault-<id>.db` | Base de cada bóveda creada después |
| `*.db-wal`, `*.db-shm` | Archivos auxiliares de SQLite (modo WAL) mientras la app corre |

El tema (claro/oscuro y paleta) **no** se guarda ahí: se guarda en el almacenamiento local de la ventana web (`localStorage`, clave `noter.theme`). [POR CONFIRMAR] la ubicación exacta de ese almacenamiento en disco.

Al primer arranque de cada bóveda se crean categorías y una nota de bienvenida de ejemplo.

### Respaldar

1. Cierra Noter por completo.
2. Copia la carpeta entera `%APPDATA%\com.kuroneko.noter`.

```powershell
Copy-Item "$env:APPDATA\com.kuroneko.noter" "$env:USERPROFILE\noter-respaldo" -Recurse
```

### Resetear

Con la app cerrada, borra la carpeta. En el siguiente arranque se crea una bóveda nueva. **Esto elimina todas tus notas**: haz un respaldo antes.

```powershell
Remove-Item "$env:APPDATA\com.kuroneko.noter" -Recurse -Force
```

## 🎨 Temas y paletas

Los colores salen de **un solo matiz**, la variable CSS `--h`. En `src/theme/tokens.css` todos los tokens (`--rail`, `--side`, `--main`, `--text`, `--accent`...) se calculan con `hsl(var(--h) ...)`. El modo claro/oscuro cambia las saturaciones y luminosidades (`data-theme="light"` o `"dark"`); la paleta solo cambia `--h`.

`src/theme/useTheme.ts` aplica el tema y lo guarda. Si no hay uno guardado, sigue la preferencia del sistema y usa la paleta Malva.

### Agregar una paleta nueva

1. Abre `src/theme/palettes.ts`.
2. Agrega una entrada a `PALETTES` con un `id` (es el nombre que se muestra) y un `hue` de 0 a 360:

```ts
export const PALETTES: readonly Palette[] = [
  { id: "Malva", hue: 265 },
  { id: "Musgo", hue: 150 },
  { id: "Brasa", hue: 20 },
  { id: "Océano", hue: 195 },
  { id: "Rosa", hue: 335 },
  { id: "Dorado", hue: 45 }, // nueva
];
```

3. Listo: el selector de `ThemePopover` recorre `PALETTES` y mostrará la nueva.
4. Ajuste pendiente: el selector usa una cuadrícula de 5 columnas (`grid-cols-5`) y el desplazamiento por teclado usa `5`; con más de 5 paletas, ajusta ambos en `src/features/vault/ThemePopover.tsx`.

## 🩺 Solución de problemas

**`cargo` no se reconoce como un comando**
Falta Rust o su carpeta no está en el `PATH`. Instala con `winget install Rustlang.Rustup`, agrega `$env:USERPROFILE\.cargo\bin` al `PATH` y abre una terminal nueva.

**Error de OpenSSL o Perl (por ejemplo `Can't locate Text/Template.pm`)**
Se está usando el Perl de Git, que está incompleto. Instala Strawberry Perl (`winget install StrawberryPerl.StrawberryPerl`) y ponlo antes que el de Git en el `PATH`. Revisa con `Get-Command perl -All`. Después, abre una terminal nueva.

**Falla la compilación de OpenSSL por una ruta larga**
Pasa si la ruta de compilación supera 260 caracteres. Revisa que `target-dir` en `src-tauri/.cargo/config.toml` apunte a una ruta corta y que puedas escribir en ella. Ver [Problema de rutas largas](#-problema-de-rutas-largas-y-target-dir).

**El puerto 1420 está ocupado**
Vite usa `strictPort: true`: si el puerto está en uso, no busca otro y falla. Cierra el proceso que lo usa (suele ser otra instancia de `tauri dev`). Para ver cuál es:

```powershell
Get-NetTCPConnection -LocalPort 1420 | Select-Object OwningProcess
```

**Error por clave de SQLCipher vacía**
SQLCipher rechaza `PRAGMA key` vacío. Por eso el código solo envía la clave si no está vacía: en esta fase, clave vacía significa base **sin cifrar**. Si aparece este error, es que algún cambio nuevo está pasando una clave vacía directamente a SQLCipher.

**Avisos `LNK4099` sobre `ossl_static.pdb`**
Son inofensivos. Se pueden ignorar.

## 🤝 Contribuir y licencia

Las contribuciones son bienvenidas, pero el proyecto aún cambia mucho. Antes de abrir un cambio grande, abre una *issue* para hablarlo. Antes de enviar cambios:

- `cd src-tauri && cargo test --lib` debe pasar.
- `npm run build` debe terminar sin errores de tipos.
- Respeta las [cuatro reglas de arquitectura](#arquitectura-en-cuatro-reglas).

**Licencia:** Licenciado por Thei 🦄 No nos responsabilizamos del uso o mal uso que le des
