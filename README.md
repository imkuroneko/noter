# Noter

Notas en Markdown para el escritorio, con categorías, etiquetas, búsqueda de texto completo y bóvedas que puedes proteger con contraseña. Tus datos viven en tu equipo, en archivos SQLite (cifrados con SQLCipher cuando la bóveda tiene contraseña).

<img width="1282" height="802" alt="image" src="https://github.com/user-attachments/assets/273f3322-1585-4615-a38a-6af65eaeea10" />


![Tauri](https://img.shields.io/badge/Tauri-v2-24C8DB?logo=tauri&logoColor=white)
![Rust](https://img.shields.io/badge/Rust-edici%C3%B3n%202024-000000?logo=rust&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-06B6D4?logo=tailwindcss&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-FTS5-003B57?logo=sqlite&logoColor=white)
![SQLCipher](https://img.shields.io/badge/SQLCipher-AES-0F4C81)
![Argon2id](https://img.shields.io/badge/Argon2id-XChaCha20--Poly1305-5B21B6)
![Windows](https://img.shields.io/badge/Windows-11-0078D4?logo=windows11&logoColor=white)
![Licencia](https://img.shields.io/badge/Licencia-GPL--3.0-blue)

<!-- TODO: agregar captura (vista general de la app: barra de categorías, lista de notas y editor) -->
<!-- TODO: agregar captura de la pantalla de bloqueo y del diálogo de la clave de recuperación -->
<!-- TODO: agregar captura del asistente "Importar notas desde otra bóveda" -->

> **Léelo antes de guardar algo sensible:** el cifrado protege tus notas **en reposo** (archivos en disco) y solo si la bóveda tiene contraseña. La revisión de seguridad la hizo un agente de IA; **no** es una auditoría profesional independiente. Detalles en [Límites y modelo de amenazas](#-límites-y-modelo-de-amenazas).

## Lectura rápida

- **Qué es:** una app de escritorio (Tauri 2 + Rust + React) para tomar notas en Markdown. Todo es local: no hay cuentas ni servidores.
- **Bóvedas:** cada bóveda es un archivo `.db`. Puedes tener varias, con o sin contraseña, y guardarlas en la carpeta que quieras.
- **Importar:** puedes traer notas de la bóveda de otra persona, eligiendo cuáles. Ver [Importar notas desde otra bóveda](#-importar-notas-desde-otra-bóveda).
- **Probarla ya (desarrollo):**

  ```powershell
  git clone https://github.com/imkuroneko/noter.git
  cd noter
  npm install
  npm run tauri dev
  ```

  Necesitas el [entorno de Windows 11](#-requisitos-para-desarrollar-windows-11). La primera compilación tarda unos 8 minutos.
- **Instalador:** la configuración está lista, pero **todavía no se ha generado ni probado**. Ver [Generar el instalador](#-generar-el-instalador).
- **Pruebas:** 49 pruebas del backend (`cargo test --lib`). No hay pruebas del frontend.

## Contenido

- [Características](#-características)
- [Requisitos para desarrollar (Windows 11)](#-requisitos-para-desarrollar-windows-11)
- [Primer arranque](#-primer-arranque)
- [Problema de rutas largas y `target-dir`](#-problema-de-rutas-largas-y-target-dir)
- [Scripts de npm](#-scripts-de-npm)
- [Ubicación de las bóvedas](#-ubicación-de-las-bóvedas)
- [Importar notas desde otra bóveda](#-importar-notas-desde-otra-bóveda)
- [Seguridad](#-seguridad)
- [Límites y modelo de amenazas](#-límites-y-modelo-de-amenazas)
- [Dónde se guardan los datos](#-dónde-se-guardan-los-datos)
- [Generar el instalador](#-generar-el-instalador)
- [Pruebas](#-pruebas)
- [Estructura del proyecto](#-estructura-del-proyecto)
- [Comandos de Tauri](#-comandos-de-tauri)
- [Interfaz y componentes](#-interfaz-y-componentes)
- [Temas y paletas](#-temas-y-paletas)
- [Solución de problemas](#-solución-de-problemas)
- [Pendiente / ideas](#-pendiente--ideas)
- [Contribuir](#-contribuir-y-licencia)
- [Licencia](#-licencia)
- [Créditos de terceros](#-créditos-de-terceros)

## ✨ Características

| Función | Descripción |
| --- | --- |
| Editor Markdown | CodeMirror 6 con tres modos: **Editar**, **Dividir** y **Vista**. Vista previa con GitHub Flavored Markdown. |
| Autoguardado | Guarda unos 600 ms después de escribir, y al perder el foco o cerrar. |
| Categorías | Barra lateral al estilo Discord, con emoji y color (matiz) por categoría. Los emojis son Twemoji **empaquetados** en la app: no usan internet. |
| Etiquetas | Se normalizan (sin `#`, en minúsculas) y se filtran de forma múltiple (todas las seleccionadas deben coincidir). |
| Búsqueda | Texto completo con SQLite FTS5: por prefijo y sin distinguir tildes. |
| Fijar notas | Las notas fijadas quedan arriba en la lista. |
| Papelera | Restaurar, eliminar definitivamente y vaciar la papelera. |
| Selección múltiple | `Shift` selecciona un rango y `Ctrl` alterna notas sueltas; sirve para mover varias notas a la papelera de una vez. |
| Menús y confirmaciones | Menús contextuales propios y diálogos de confirmación dentro de la app. |
| Temas | Claro y oscuro, con 5 paletas: Malva, Musgo, Brasa, Océano y Rosa. |
| Ventana | Barra de título propia (la ventana no usa los bordes del sistema). Icono: un lápiz sobre fondo morado (fuente: `src/assets/app-icon.svg`). |
| Varias bóvedas | Cada bóveda es un archivo `.db` independiente. Crear (eligiendo carpeta), renombrar, cambiar entre ellas, abrir una existente, reubicar, quitar de la lista y mostrar en la carpeta. |
| Contraseña por bóveda | Opcional. Con contraseña, la base se cifra. Ver [Seguridad](#-seguridad). |
| Importar notas | Trae notas de la bóveda de otra persona, eligiéndolas una a una o por categoría. Ver [Importar](#-importar-notas-desde-otra-bóveda). |
| Interfaz uniforme | Un componente `Button` compartido (variantes, tamaños, icono y estado de carga) e iconos de `lucide-react`. Ver [Interfaz y componentes](#-interfaz-y-componentes). |

## 🧰 Requisitos para desarrollar (Windows 11)

Es el entorno donde se desarrolla el proyecto. Otros sistemas no se han probado.

| Herramienta | Versión | Para qué |
| --- | --- | --- |
| Node.js | 22 o superior [POR CONFIRMAR: no hay campo `engines` en `package.json`] | Frontend y CLI de Tauri |
| Rust (rustup) | estable (edición 2024) | Backend |
| Visual Studio Build Tools | carga de trabajo "Desarrollo de escritorio con C++" (MSVC + Windows SDK) | Compilar Rust en Windows |
| WebView2 | ya viene en Windows 11 | Motor web de la ventana |
| Strawberry Perl | cualquiera reciente | `rusqlite` compila SQLCipher con OpenSSL "vendored" (`bundled-sqlcipher-vendored-openssl`), y eso necesita un Perl completo |

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
git clone https://github.com/imkuroneko/noter.git
cd noter
npm install
npm run tauri dev
```

La **primera compilación de Rust tarda varios minutos** (unos 8 con OpenSSL). Las siguientes tardan segundos. Es normal que parezca detenida: está compilando OpenSSL.

`npm run tauri dev` levanta Vite en `http://localhost:1420` y abre la ventana de la app. En el primer arranque se crea la bóveda "Mi bóveda", sin contraseña, con categorías y una nota de bienvenida.

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

## 📍 Ubicación de las bóvedas

Cada bóveda es un archivo `.db` (y, si tiene contraseña, un `.keys.json` al lado). Puedes dejarlos donde quieras.

| Acción | Cómo funciona |
| --- | --- |
| **Elegir carpeta al crear** | En **Nueva bóveda**, el botón **Elegir carpeta…**. Se crea `<Nombre>.db` (y `<Nombre>.db.keys.json` si es protegida). Si el nombre ya existe, se usa `<Nombre> (2).db`. La carpeta debe existir y permitir escritura. Sin elegir carpeta se usa la [carpeta de datos de la app](#-dónde-se-guardan-los-datos) (`vault-<id>.db`). |
| **Abrir bóveda existente** | Agrega a la lista una bóveda desde su archivo `.db`. No cambia de bóveda; el aviso ofrece un botón **Abrir**. Si está cifrada, su `.keys.json` debe estar en la misma carpeta. Rechaza archivos que no sean de Noter y bóvedas que ya están en la lista. |
| **Reubicar** | Si moviste los archivos, apunta la bóveda de la lista a su nueva ubicación. No se puede reubicar la bóveda que está abierta. |
| **Quitar de la lista** | No borra ningún archivo. No se puede quitar la bóveda en uso ni la última que queda. |
| **Mostrar en la carpeta** | Abre el explorador de Windows sobre el archivo. |
| **Renombrar** | Cambia el nombre en la lista (hasta 40 caracteres); no renombra el archivo. |

### Bóveda "No disponible"

Si el archivo de una bóveda no está (un disco desconectado, una carpeta movida), la lista la marca como **No disponible**. Si esa era la bóveda activa al arrancar, la app **arranca igual** y muestra la pantalla **Bóveda no disponible**, con dos botones: **Reubicar…** (elegir su archivo nuevo) y **Reintentar** (por si reconectaste el disco). Desde la barra lateral de esa pantalla también puedes elegir otra bóveda.

## 📥 Importar notas desde otra bóveda

### Para qué sirve

Un compañero te entrega el `.db` de una de sus bóvedas y su contraseña. Con esta función eliges **qué notas traer** a tu bóveda, sin agregar la suya a tu lista.

Una analogía: es como fotocopiar algunas hojas del cuaderno de otra persona para pegarlas en el tuyo. El cuaderno de ella no se toca.

### Cómo se usa

Abre la bóveda propia a la que quieres traer las notas y elige **Importar notas desde otra bóveda…** en el panel de bóvedas (abajo a la izquierda). Es un asistente de 3 pasos:

1. **Archivo y contraseña.** Elige el `.db`. Si es una bóveda protegida, escribe su contraseña (su `.keys.json` debe estar en la misma carpeta). Pulsa **Ver contenido**.
2. **Elegir notas.** Se listan agrupadas por categoría de origen (más "Sin categoría"), con una casilla por nota y otra por categoría. Hay buscador (título, primeros 160 caracteres del texto y etiquetas), **Seleccionar todo** y **Ninguna**. Al empezar, todas las notas listadas están marcadas. Se dibujan 200 por vez (**Mostrar más**). Aquí también eliges las opciones.
3. **Resumen.** Muestra cuántas notas se importaron, cuántas repetidas se omitieron y cuántas categorías y etiquetas nuevas se crearon.

### Opciones

| Opción | Efecto |
| --- | --- |
| **Conservar sus categorías** (predeterminada) | Cada categoría de origen se junta con una tuya del mismo nombre (se ignoran los espacios de los bordes y las mayúsculas); si no existe, se crea con su emoji y color. Las notas sin categoría quedan sin categoría. |
| **Poner todas en una de mis categorías** | Todas las notas van a la categoría que elijas (o sin categoría). Si esa categoría ya no existe, la importación se rechaza. |
| **Omitir notas que ya tengo** (predeterminada) | Se omiten las notas con el **mismo título y el mismo texto** que una nota activa tuya, o que otra ya elegida en esta misma importación. |

### Qué se conserva

- **Etiquetas:** se juntan por nombre normalizado (sin `#`, en minúsculas). Se descartan las de más de 40 caracteres.
- **Fijadas y fechas:** se conservan el estado "fijada" y las fechas de creación y de modificación.
- **No se importan** las notas que están en la papelera de origen.
- El título se recorta a 2000 caracteres.
- **Todo o nada:** la importación es una sola transacción. Si algo falla, no entra ninguna nota.

### Cómo se protege tu bóveda y la ajena

- Solo funciona con **tu bóveda abierta** (con la bóveda bloqueada o no disponible, la opción está desactivada).
- La bóveda ajena **no se modifica** ni se agrega a tu lista. Se trabaja sobre una **copia temporal** en `import-tmp/` (dentro de la carpeta de datos de la app). Al terminar, la copia se **sobrescribe con ceros y se borra**. Si la app se cierra a medias, los restos se limpian al arrancar.
- La copia se abre con `trusted_schema` apagado y en modo `query_only`, y solo se leen columnas conocidas.
- Se rechazan los archivos que no son de Noter, los de una versión de esquema **más nueva** que la de tu app y los de **más de 512 MB**.
- La contraseña ajena solo existe en memoria durante la operación (y en el estado del diálogo, que se descarta al cerrarlo o al bloquear la bóveda).
- Cada importación mueve el reloj de actividad (cuenta como uso para el bloqueo por inactividad).

### Límites

| Límite | Detalle |
| --- | --- |
| Vista previa | Hasta **5000 notas** (se muestran las primeras 5000 si hay más; el aviso indica el total). |
| Por importación | Hasta **20 000 notas**. Con más, el mensaje pide importar en tandas. |
| Intentos de contraseña | **No hay límite de intentos** sobre el archivo ajeno. Es un archivo local: quien lo tiene podría atacarlo sin pasar por Noter, y lo que frena ese ataque es Argon2id, no la app. |
| Sincronización | **No sincroniza.** Importa una vez y copia; los cambios posteriores en la bóveda de origen no llegan. |
| Duplicados | Solo **exactos** (mismo título y mismo texto). Se comparan con una huella (hash) de 64 bits; una colisión es muy improbable, pero no imposible. Las notas de tu papelera no cuentan. |
| Ids | Las notas importadas **no conservan sus ids**: se crean nuevas. |
| Mayúsculas en categorías | Se compara con `lower()` de SQLite. Con letras acentuadas o `Ñ` podría no coincidir [POR CONFIRMAR]. |

Detalle de seguridad del rastro en disco: ver [Límites y modelo de amenazas](#-límites-y-modelo-de-amenazas).

## 🔐 Seguridad

Cada bóveda **puede tener contraseña o no**. Las bóvedas sin contraseña son archivos SQLite normales, sin cifrar.

### Diseño de claves (bóvedas con contraseña)

- La base se cifra con **SQLCipher**, usando una **clave de datos (DEK)** aleatoria de 256 bits.
- La DEK nunca se guarda en claro. Se guarda **envuelta** (con XChaCha20-Poly1305) de dos formas:
  1. Bajo una clave derivada de tu contraseña con **Argon2id** (64 MiB de memoria, 3 pasadas, 1 hilo).
  2. Bajo una **clave de recuperación** de 256 bits, que la app te muestra **una sola vez** al proteger o crear la bóveda.
- Cambiar la contraseña solo **re-envuelve la DEK** con una sal nueva. No se reescribe la base, así que es inmediato.
- La contraseña debe tener **al menos 8 caracteres** (no hay medidor de fuerza).
- Al leer un `.keys.json`, la app rechaza parámetros de Argon2 fuera de rango (más de 256 MiB, 8 pasadas o 4 hilos), para que un archivo manipulado no pida recursos absurdos.

Una analogía: la DEK es la llave de la caja fuerte. La caja fuerte tiene dos cerraduras para guardar esa llave: una se abre con tu contraseña y otra con la clave de recuperación. Cambiar la contraseña cambia la cerradura, no la llave de la caja.

### Archivo de claves

Cada bóveda protegida tiene, junto a su base, un archivo `<archivo>.keys.json` con las claves envueltas. Cada vez que se reescribe, la app deja la versión anterior como `<archivo>.keys.json.bak`.

**Sin ese archivo y sin la clave de recuperación no hay forma de abrir la bóveda.**

### Clave de recuperación

- Tiene 52 caracteres en base32, en grupos de 4 separados por guiones. Al escribirla se aceptan mayúsculas o minúsculas, con o sin guiones y espacios.
- Se muestra **una vez**. No se puede volver a ver ni regenerar.
- Si olvidas la contraseña, en la pantalla de bloqueo puedes usar la clave de recuperación para entrar y fijar una contraseña nueva. La clave de recuperación sigue siendo válida después.
- Si la copias desde el diálogo, la app intenta vaciar el portapapeles a los 60 segundos.
- **Recomendación:** guárdala fuera del equipo (papel, gestor de contraseñas, otro dispositivo).

### Límite de intentos

- Tras 3 fallos seguidos (contraseña o clave de recuperación), la app exige esperar 1, 2, 4... segundos, hasta un máximo de 30 s. El conteo es por bóveda, vive en memoria y se reinicia al cerrar la app.
- Toda transición de sesión (abrir, bloquear, desbloquear, proteger, recuperar, cambiar contraseña, importar) pasa por **un único candado**. Así los intentos son secuenciales: no se salta el límite con peticiones simultáneas ni se agota la memoria con muchas derivaciones de clave a la vez.
- El límite **no** se aplica a la contraseña del archivo ajeno al importar (ver [Importar](#-importar-notas-desde-otra-bóveda)).

### Bloqueo

- **Manual:** desde el panel de la bóveda. Cierra la conexión y vacía los datos que el frontend tenía en pantalla. No depende de leer el disco.
- **Por inactividad:** solo para bóvedas con contraseña. Por defecto, 5 minutos. En la interfaz puedes elegir 1, 5, 10, 15, 30 o 60 minutos, o **Nunca**. (El backend acepta hasta 240 minutos, pero la interfaz no ofrece ese valor.) Se revisa cada 5 s y el backend avisa a la interfaz con el evento `vault://locked`.
- Una bóveda **sin** contraseña nunca se bloquea y su botón de bloqueo está desactivado.

### Proteger una bóveda existente

La opción **Proteger con contraseña** convierte una bóveda sin cifrar en una cifrada, sin perder notas:

1. Copia los datos a una base nueva cifrada.
2. Verifica que las tablas coincidan en número de filas y que pasen `integrity_check` y la revisión del índice de búsqueda.
3. Solo entonces reemplaza la base original.
4. Deja una **copia sin cifrar** en la carpeta `backups/` de los datos de la app (archivo `.sin-cifrar`).
5. La app te ofrece un botón para **borrar esa copia**, que primero la sobrescribe con ceros y luego la elimina. Mientras exista, el panel de bóvedas muestra un punto de aviso.

Si algo falla, se deshace y la bóveda original sigue como estaba. Si un corte de luz interrumpe el proceso, la app se **autorrepara** al abrir la bóveda: manda lo que dicen los archivos.

> Mientras no borres la copia de `backups/`, tus notas siguen existiendo **sin cifrar** en tu disco.

### Endurecimiento de la aplicación

- **Política de contenido (CSP) estricta** (`tauri.conf.json`): sin scripts externos, sin imágenes remotas, sin marcos, y conexiones solo al canal interno (IPC) de Tauri. **Solo se aplica a la versión de producción**; en desarrollo (`tauri dev`) rige una `devCsp` más permisiva (necesaria para Vite). Por eso conviene probar a fondo el instalador.
- **Permisos mínimos** (`capabilities/default.json`): eventos, rutas, controles de ventana (minimizar, maximizar, arrastrar, cerrar), el diálogo de abrir archivo, mostrar un elemento en su carpeta y abrir enlaces `http(s)` y `mailto:`.
- **Sin herramientas de desarrollo** en las compilaciones de release (la función `devtools` de Tauri no está activada en `Cargo.toml`).
- Un registro `vaults.json` que traiga nombres de archivo no permitidos (con carpetas, `..` o caracteres que Windows no admite) se **rechaza**.
- Contraseñas y claves de recuperación se manejan en el backend con tipos que se borran de memoria al soltarse (`zeroize`). En el WebView (JavaScript) no se pueden borrar.

## 🧱 Límites y modelo de amenazas

Esta sección dice con claridad qué protege Noter y qué no. Sin dramatismo, pero sin adornos.

### Qué sí protege

Los datos **en reposo**: si alguien copia tu disco o los archivos de una bóveda con contraseña, **sin** tu contraseña ni tu clave de recuperación no puede leer las notas.

### Qué no protege

- **Con la app desbloqueada.** Quien use tu sesión en ese momento ve todo.
- **Keyloggers, malware con acceso al proceso, volcados de memoria, hibernación o archivo de paginación.** Las claves y contraseñas pasan por la memoria del proceso y del WebView, y no se pueden borrar del todo.
- **Metadatos visibles.** Aun con cifrado se ven: nombres y tamaños de archivo, fechas, los nombres y rutas de las bóvedas (en `vaults.json`) y si cada una está cifrada.
- **Integridad de `vaults.json` y `.keys.json`.** No están firmados: alguien con acceso a tus archivos podría modificarlos.
- **Restos de datos.** La copia sin cifrar de `backups/`, la copia temporal de `import-tmp/` y los archivos `-wal`/`-shm` borrados sin sobrescritura pueden dejar datos recuperables en discos SSD o en copias de sombra de Windows. El borrado con ceros es un esfuerzo razonable, no una garantía.
- **Texto copiado.** El portapapeles y lo que copies de una nota no se controlan. Solo la clave de recuperación copiada se intenta vaciar a los 60 s.

### Importación: qué dejan atrás las copias temporales

Al importar, el archivo ajeno **se copia temporalmente a tu disco** (`import-tmp/`). Esa copia (cifrada si la bóveda de origen lo es, pero en claro dentro de SQLite si no) se sobrescribe con ceros y se borra al terminar. En un SSD, o si Windows tiene copias de sombra, **puede quedar rastro**. Si el contenido es muy sensible, no uses esta función en un equipo que no controles.

### Otras limitaciones a tener presentes

- **El límite de intentos solo protege la interfaz.** Quien tenga una copia de tus archivos ataca sin conexión (*offline*), sin pasar por la app. Ahí lo frenan Argon2id y la **fortaleza de tu contraseña**: usa una larga. Lo mismo vale para el archivo ajeno que importas.
- **Perder el `.keys.json` y la clave de recuperación = perder las notas para siempre.** El desarrollador no puede recuperarlas.
- **Cambiar la contraseña no rota la DEK.** Una copia antigua del `.keys.json` sigue abriendo la base con la contraseña vieja. Si crees que esa copia se filtró, no basta con cambiar la contraseña.
- **La clave de recuperación no se puede regenerar.**
- **Al bloquear por inactividad** puede perderse lo escrito en los últimos ~0,6 s (lo que el autoguardado aún no escribió).
- **No hay tope absoluto de sesión:** mientras haya actividad, la bóveda no se bloquea sola.
- **Revisión de seguridad:** la hizo un agente de IA. **No** es una auditoría profesional independiente.

### Recomendaciones

- Guarda la clave de recuperación **fuera del equipo**.
- Respalda la **carpeta completa de la bóveda**: la base **y** su `.keys.json`. Sin el segundo, el primero no se abre.
- Usa una contraseña larga y única.
- Borra la copia sin cifrar de `backups/` cuando verifiques que la bóveda protegida funciona.

## 💾 Dónde se guardan los datos

### Carpeta de datos de la app

Noter usa la carpeta de datos de la app que define Tauri (`app_data_dir`). Su nombre sale del identificador `com.kuroneko.noter` (en `tauri.conf.json`). En Windows suele ser:

```text
%APPDATA%\com.kuroneko.noter
```

Dentro hay:

| Archivo o carpeta | Contenido |
| --- | --- |
| `vaults.json` | Lista de bóvedas, sus rutas, cuál está activa y los minutos de inactividad |
| `noter-dev.db` | Base de la primera bóveda ("Mi bóveda"), si sigue en esta carpeta |
| `vault-<id>.db` | Base de cada bóveda creada **sin** elegir carpeta |
| `<archivo>.keys.json` y `<archivo>.keys.json.bak` | Claves envueltas de las bóvedas protegidas que viven en esta carpeta, y la versión anterior |
| `*.db-wal`, `*.db-shm` | Archivos auxiliares de SQLite (modo WAL) mientras la app corre |
| `*.enc.tmp` | Base cifrada temporal mientras se protege una bóveda (no debería quedar) |
| `backups/` | Copias sin cifrar (`*.sin-cifrar`) que deja "Proteger con contraseña" |
| `import-tmp/` | Copia de trabajo temporal al importar; se sobrescribe con ceros y se borra (vacía en uso normal) |

Las bóvedas guardadas en una carpeta elegida por ti viven fuera de esta carpeta (ver [Ubicación de las bóvedas](#-ubicación-de-las-bóvedas)). Pero `backups/` e `import-tmp/` están **siempre** dentro de la carpeta de datos de la app.

### Preferencias de la interfaz

El tema (`noter.theme`) y el modo del editor (`noter.mode`) se guardan en el almacenamiento local de la ventana web (`localStorage`), no en la carpeta de bóvedas. [POR CONFIRMAR] la ubicación exacta de ese almacenamiento en disco.

### Respaldar

1. Cierra Noter por completo.
2. Copia la **carpeta de la bóveda completa**: la base `.db` **y** su `.keys.json` (y `vaults.json` si quieres conservar la lista).
3. Guarda la clave de recuperación **por separado** y fuera del equipo.

Para respaldar todo lo de la carpeta de datos por defecto:

```powershell
Copy-Item "$env:APPDATA\com.kuroneko.noter" "$env:USERPROFILE\noter-respaldo" -Recurse
```

Si tus bóvedas están en carpetas elegidas por ti, cópialas también: no están dentro de la carpeta de datos.

### Resetear

Con la app cerrada, borra la carpeta de datos. En el siguiente arranque se crea una bóveda nueva. **Esto elimina las notas guardadas en esa carpeta**: haz un respaldo antes. Las bóvedas que estén en carpetas elegidas por ti no se borran, pero dejarán de estar en la lista (puedes volver a agregarlas con "Abrir bóveda existente").

```powershell
Remove-Item "$env:APPDATA\com.kuroneko.noter" -Recurse -Force
```

## 📦 Generar el instalador

> **Estado:** el instalador se genera correctamente (versión 1.0.0 compilada y probada a mano de forma parcial). Esa prueba detectó que los emojis no se veían en la versión instalada por la política de contenido estricta; está corregido en la **1.0.1**. Aún falta una prueba completa de la versión instalada (enlaces, selectores de carpeta y archivo, guardar al cerrar, flujo de cifrado e importación).

### Cómo generarlo

```powershell
npm run tauri build
```

Requiere el mismo entorno que el desarrollo (Rust, MSVC Build Tools y Strawberry Perl). La **primera compilación de producción tarda varios minutos**.

Configuración del empaquetado (`tauri.conf.json`):

- Solo se genera **NSIS** (`bundle.targets = ["nsis"]`).
- Instalación por usuario, sin administrador (`installMode: currentUser`).
- Idioma del instalador: español (`Spanish`), sin selector de idioma.
- Versión `1.0.1`, igual en `package.json`, `Cargo.toml` y `tauri.conf.json`.
- Editor: `kuroneko`; categoría: Productividad.

### Dónde queda el archivo

Con el `target-dir` personalizado (`C:/t/noter`), el instalador queda en:

```text
C:\t\noter\release\bundle\nsis\Noter_<versión>_x64-setup.exe
```

Por ejemplo, la versión 1.0.0 se generó como `Noter_1.0.0_x64-setup.exe` (unos 7,6 MB). El nombre cambia con la versión.

### Antes de distribuirlo

- **No estará firmado.** Firmar requiere un certificado de firma de código (de pago). Mientras tanto, Windows SmartScreen mostrará "Windows protegió su PC". Quien lo instale debe elegir **Más información** y luego **Ejecutar de todas formas**.
- **Prueba el instalador a fondo.** La CSP estricta solo se aplica a la versión de producción (en `tauri dev` rige una más permisiva), así que algo que funciona en desarrollo podría fallar al instalar. Prueba al menos: crear una bóveda con y sin contraseña, proteger una existente, bloquear, recuperar con la clave, abrir enlaces, elegir carpetas e importar notas.
- No hay un enlace de descarga publicado. [POR CONFIRMAR] dónde se distribuirá.

### Alternativa: el `.exe` suelto (portable)

La compilación de producción también deja el ejecutable suelto en `C:\t\noter\release\noter.exe` (unos 15 MB). Funciona sin instalar, pero no crea acceso directo ni desinstalador, y necesita **WebView2** (ya viene en Windows 11).

## 🧪 Pruebas

Pruebas del backend: **49** (`#[test]` contados en `src-tauri/src`).

| Área | Archivo | Pruebas |
| --- | --- | --- |
| Esquema, migraciones, FTS, etiquetas, papelera y claves foráneas | `db/tests.rs` | 10 |
| Repositorio y registro de bóvedas | `repo_tests.rs` | 5 |
| Sesión: bloqueo, recuperación, protección, ubicación de bóvedas | `session_tests.rs` | 21 |
| Importación desde otra bóveda | `import_tests.rs` | 7 |
| Criptografía | `crypto.rs` | 6 |
| **Total** | | **49** |

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

## 🧭 Estructura del proyecto

```text
noter/
├─ src/                      Frontend (React + TypeScript)
│  ├─ api/                   Único punto de contacto con Tauri (invoke), tipos, errores y ventana
│  ├─ stores/                Estado global con Zustand (notas, interfaz, bóvedas, menús, confirmaciones, clave de recuperación)
│  ├─ theme/                 Paletas, tokens CSS y hook de tema
│  ├─ features/              Pantallas por tema
│  │  ├─ categories/         Barra de categorías, selector de emoji y color
│  │  ├─ notes/              Lista de notas, etiquetas, búsqueda y papelera
│  │  ├─ editor/             Editor CodeMirror, vista previa, barra superior y selección múltiple
│  │  ├─ vault/              Panel y menú de bóvedas, diálogos (nueva, proteger, contraseña, clave de recuperación) y asistente de importación (Import*.tsx)
│  │  ├─ lock/               Pantallas de bloqueo, desbloqueo, recuperación, "no disponible" y error de carga
│  │  ├─ menus/              Menús contextuales y entrada global
│  │  └─ window/             Barra de título propia y flujo de cierre
│  ├─ components/            Piezas reutilizables (Button, Modal, Popover, ConfirmDialog, Emoji, Toast...)
│  ├─ assets/                Icono de la app (app-icon.svg)
│  └─ lib/                   Utilidades (debounce, fechas, texto, emoji, contraseña, rutas, plurales...)
└─ src-tauri/                Backend (Rust)
   ├─ .cargo/config.toml     target-dir corto (ver arriba)
   ├─ capabilities/          Permisos de la ventana (default.json)
   ├─ tauri.conf.json        Configuración de la app, CSP y empaquetado
   └─ src/
      ├─ lib.rs              Arranque, registro de comandos, limpieza de importaciones y hilo de bloqueo por inactividad
      ├─ commands.rs         Comandos Tauri, finos y sin SQL
      ├─ repo.rs             Lógica de datos de notas, categorías y etiquetas
      ├─ repo_tests.rs       Pruebas del repositorio
      ├─ crypto.rs           Claves: Argon2id, XChaCha20-Poly1305, DEK y clave de recuperación (con sus pruebas)
      ├─ session.rs          Sesión: abrir, bloquear, desbloquear, proteger, recuperar, ubicar bóvedas
      ├─ session_tests.rs    Pruebas de la sesión
      ├─ import.rs           Importar notas desde otra bóveda (copia temporal, vista previa, transacción única)
      ├─ import_tests.rs     Pruebas de la importación
      ├─ vaults.rs           Registro de bóvedas (vaults.json) y archivos de claves
      ├─ state.rs            Estado compartido (conexión activa, candado de sesión, intentos, inactividad)
      ├─ error.rs            Error común que se envía al frontend
      └─ db/                 Apertura de la base, migraciones, queries.sql y pruebas (tests.rs)
         ├─ migrations/      Migraciones numeradas (NNNN_nombre.sql)
         └─ queries.sql      Consultas SQL con nombre (-- name: ...)
```

### Arquitectura en cinco reglas

1. **El frontend nunca ve SQL ni claves.** Solo recibe y envía datos tipados. Las claves de cifrado no salen del backend (la contraseña viaja del formulario al backend y de ahí no vuelve).
2. **Los comandos Tauri son finos:** validan la entrada, toman la conexión y llaman a `repo`, `session` o `import`.
3. **Todo el SQL vive en `repo`, `db` e `import`** (migraciones y `queries.sql` incluidas; `session` solo ejecuta SQL de mantenimiento, como la copia al proteger).
4. **Toda llamada a Tauri pasa por `src/api`.** Ningún componente llama a `invoke` directamente.
5. **La sesión tiene un único candado.** Abrir, bloquear, desbloquear, proteger, recuperar, cambiar contraseña e importar lo toman, así que no hay carreras ni intentos simultáneos.

Una analogía: `src/api` es la ventanilla de un banco. Nadie entra a la bóveda (SQL); se pide algo en la ventanilla y el personal (`commands`, `repo` y `session`) lo hace.

## 🔌 Comandos de Tauri

Hay **36** comandos `#[tauri::command]` en `src-tauri/src/commands.rs`, todos registrados en `lib.rs`.

| Grupo | Cantidad | Comandos |
| --- | --- | --- |
| Categorías | 4 | `category_list`, `category_create`, `category_update`, `category_delete` |
| Notas | 11 | `note_list`, `note_get`, `note_create`, `note_update`, `note_move`, `note_pin`, `note_trash`, `note_trash_many`, `note_restore`, `note_purge`, `note_set_tags` |
| Papelera | 2 | `trash_list`, `trash_empty` |
| Etiquetas | 1 | `tag_list` |
| Bóvedas (registro y ubicación) | 7 | `vault_list`, `vault_create`, `vault_rename`, `vault_switch`, `vault_open_existing`, `vault_relocate`, `vault_forget` |
| Bóvedas (seguridad) | 8 | `vault_unlock`, `vault_lock`, `vault_protect`, `vault_change_password`, `vault_recover`, `vault_delete_backup`, `vault_set_idle`, `vault_touch` |
| Importar | 3 | `import_inspect`, `import_preview`, `import_run` |
| **Total** | **36** | |

Notas:

- Los comandos de datos devuelven el error `Locked` si no hay una bóveda abierta (por ejemplo, con la pantalla de bloqueo). `import_run` también lo devuelve si tu bóveda no está abierta.
- Los que derivan claves con Argon2 (`vault_create`, `vault_unlock`, `vault_protect`, `vault_change_password`, `vault_recover`, `import_preview`, `import_run`) son asíncronos para no congelar la interfaz.
- `import_inspect` solo mira si el archivo es una bóveda de Noter y si pide contraseña; no pide contraseña ni lee las notas.
- Los errores llegan al frontend como `{ code, message? }`. Códigos: `Locked`, `NotFound`, `Invalid`, `BadPassword`, `Throttled` (con los segundos que faltan) y `Db`. La interfaz muestra tal cual el mensaje de `Invalid`; para los demás códigos usa textos propios sin detalles técnicos.
- Además, el backend emite el evento `vault://locked` (con `reason: "idle"`) cuando bloquea por inactividad.

## 🖌 Interfaz y componentes

- **`Button`** (`src/components/Button.tsx`): botón compartido para todas las acciones.
  - Variantes: `primary`, `secondary` (predeterminada), `ghost` y `danger`.
  - Tamaños: `sm` (32 px), `md` (36 px, predeterminado) y `lg` (44 px).
  - Opciones: `icon` (un icono de Lucide), `iconAfter` (icono después del texto), `loading` + `loadingLabel` (muestra un indicador, cambia el texto y deshabilita el botón) y `fullWidth`.
- **Pantallas de bloqueo y recuperación** (`src/features/lock/`): usan iconos de Lucide y una escala de espaciado consistente, y la tarjeta se desplaza en ventanas bajas en vez de cortarse. La pantalla **Bóveda no disponible** sigue el mismo diseño.
- **Iconos:** `lucide-react` en toda la interfaz.
- **Accesibilidad:** los estados de carga usan `aria-busy` y los mensajes de error `aria-live`.

Ejemplo de uso:

```tsx
import { Download } from "lucide-react";
import { Button } from "../../components/Button";

<Button variant="primary" icon={Download} loading={busy} loadingLabel="Importando…">
  Importar
</Button>
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

**Olvidé la contraseña de mi bóveda**
En la pantalla de bloqueo elige la opción de recuperación y escribe tu **clave de recuperación**; después fija una contraseña nueva. Si no tienes la clave de recuperación, no hay forma de abrir la bóveda (ver [Límites](#-límites-y-modelo-de-amenazas)).

**"Bóveda no disponible" o la bóveda activa no abre**
No se encuentra el archivo `.db` de la bóveda (por ejemplo, un disco desconectado o una carpeta movida). La app arranca igual. Opciones: reconecta el disco y pulsa **Reintentar**, usa **Reubicar…** para apuntar al archivo nuevo, elige otra bóveda o **Quitar de la lista**.

**Falta el archivo `.keys.json`**
Una bóveda cifrada necesita su `<archivo>.keys.json` en la misma carpeta. Cópialo desde tu respaldo. Si no lo tienes, revisa si existe `<archivo>.keys.json.bak` (la versión anterior) y cópialo quitando `.bak` [POR CONFIRMAR: no está probado que sirva en todos los casos; vale solo si la contraseña no cambió desde entonces]. Sin el archivo de claves, ni la contraseña ni la clave de recuperación bastan.

**Error "file is not a database"**
SQLite/SQLCipher no pudo leer el archivo. Causas habituales: la clave es incorrecta, el archivo no es una base de Noter, o se intenta abrir como sin cifrar una base cifrada (o al revés). Revisa que el `.db` y el `.keys.json` sean de la misma bóveda y que no se hayan mezclado copias de bóvedas distintas. Si tienes respaldo, restáuralo.

**"Demasiados intentos" al desbloquear**
Es el límite de intentos: espera los segundos que indica la pantalla. Cerrar y abrir la app reinicia el conteo, pero no cambia que la contraseña deba ser la correcta.

**Importar: "Contraseña incorrecta."**
La contraseña no es la de esa bóveda. Pídesela de nuevo a quien te la entregó. Aquí no hay espera entre intentos.

**Importar: "Falta el archivo de claves (.keys.json) junto a la bóveda…"**
La bóveda de origen está protegida y su `<archivo>.db.keys.json` no está en la misma carpeta. Pide también ese archivo y déjalos juntos.

**Importar: "Esta bóveda se creó con una versión más nueva de Noter…"**
El archivo viene de una versión de Noter con un esquema más reciente que el de tu app. Actualiza Noter e inténtalo de nuevo.

**Importar: "Este archivo no parece una bóveda de Noter." / "…no se pudo leer como bóveda de Noter."**
El archivo no es una base de Noter, o tiene un formato que esta versión no reconoce.

**Importar: "El archivo es demasiado grande…" / "Son demasiadas notas de una vez…"**
El tope es de 512 MB por archivo y 20 000 notas por importación. Importa en tandas.

**La opción "Importar notas…" está desactivada**
Solo funciona con tu bóveda abierta: desbloquéala o, si no está disponible, reubícala primero.

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

**Windows muestra "Windows protegió su PC" al instalar**
El instalador no está firmado. Elige **Más información** y luego **Ejecutar de todas formas**.

**Avisos `LNK4099` sobre `ossl_static.pdb`**
Son inofensivos. Se pueden ignorar.

## 🚧 Pendiente / ideas

Sin fecha ni compromiso, salvo la primera fila.

| Tema | Estado |
| --- | --- |
| Generar y probar el instalador NSIS | **Pendiente.** Configuración lista; sin generar ni probar. |
| Firma de código del instalador | No existe (requiere un certificado de pago). |
| Rotación de la clave de datos (DEK) | No existe. |
| Regenerar la clave de recuperación | No existe. |
| Importar y exportar archivos `.md`, y exportar notas | No existe. (Solo se pueden importar notas desde otra bóveda de Noter.) |
| Sincronización entre equipos | No existe. La importación copia una vez. |
| Mover una bóveda desde la app | No existe (hoy se mueven los archivos a mano y se usa **Reubicar**). |
| Borrar una bóveda desde la app | No existe (hoy solo **Quitar de la lista**, que no borra archivos). |
| Medidor de fuerza de contraseña | No existe (hoy solo se exigen 8 caracteres). |
| Autoactualización | No existe. |
| Tope absoluto de sesión | No existe (el bloqueo es solo por inactividad). |
| Pruebas del frontend y E2E | No existen (solo las del backend). |
| Auditoría de seguridad profesional e independiente | No se ha hecho. |

## 🤝 Contribuir y licencia

Al contribuir aceptas que tus cambios se publiquen bajo la misma licencia (GPL-3.0).

Las contribuciones son bienvenidas. Antes de abrir un cambio grande, abre una *issue* en <https://github.com/imkuroneko/noter/issues> para hablarlo. Antes de enviar cambios:

- `cd src-tauri && cargo test --lib` debe pasar.
- `npm run build` debe terminar sin errores de tipos.
- Respeta las [reglas de arquitectura](#arquitectura-en-cinco-reglas).

## 📄 Licencia

Noter se publica bajo la **GNU General Public License v3.0** (`GPL-3.0-only`). El texto completo está en [LICENSE](LICENSE).

Copyright (C) 2026 kuroneko

En pocas palabras, y sin sustituir al texto de la licencia:

- Puedes usarlo, estudiarlo, modificarlo y compartirlo, también con fines comerciales.
- Si distribuyes una versión modificada, o una obra derivada, debe seguir bajo GPL-3.0 y ofrecer su código fuente.
- Si lo modificas solo para uso propio y no lo distribuyes, no tienes que publicar nada.
- Se ofrece sin garantía de ningún tipo.

## 🙏 Créditos de terceros

Noter usa software y recursos de terceros, cada uno con su propia licencia. Estas son las que se comprobaron en el `package.json` de cada paquete instalado:

| Recurso | Para qué se usa | Licencia |
| --- | --- | --- |
| emoji-mart y @emoji-mart/data | Selector de emojis y datos | MIT |
| emoji-datasource-twitter | Hoja de imágenes de emojis (Twemoji) | MIT |
| lucide-react | Iconos | ISC |
| Figtree y JetBrains Mono (vía @fontsource) | Tipografías | OFL-1.1 |

- **Emojis:** los gráficos provienen de Twemoji. [POR CONFIRMAR] La licencia exacta de las imágenes (que según el proyecto original es CC-BY 4.0 y pide atribución) no se comprobó: *Emojis: Twemoji*.
- **Resto de dependencias** (Tauri, React, CodeMirror, react-markdown, Zustand, Tailwind, SQLite/SQLCipher, OpenSSL, Argon2 y XChaCha20-Poly1305 de RustCrypto, entre otras): están listadas en `package.json` y `src-tauri/Cargo.toml`. Sus licencias no se revisaron una por una; [POR CONFIRMAR] antes de distribuir un instalador.
