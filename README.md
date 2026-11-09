# Conecta · ArcGIS Group Symbol Layer

Prototipo de una capa reutilizable para representar elementos individuales alrededor de un punto compartido. Incluye una demo en español con comunidades tecnológicas, agrupación territorial y directorio accesible. ArcGIS Maps SDK for JavaScript **5.1**, TypeScript, Vite y Calcite.

## Transparencia sobre el uso de IA e inspiración

El código de este proyecto se ha creado con inteligencia artificial mediante OpenAI Codex, a partir de los requisitos y el feedback del autor del proyecto.

La visualización está inspirada en **People For the People (2020)**, de Patrick Arlt: [pftp-who-is-running-2020](https://github.com/patrickarlt/pftp-who-is-running-2020). Consulta también la [grabación de la presentación, desde el minuto 19:44](https://www.youtube.com/watch?v=0AlQItdHBy4&t=1184s).

## Ejecutar

Requiere Node.js 22.12 o posterior compatible con Vite 8. Se ha usado Node 22.23.3.

```sh
npm ci
cp .env.example .env
# Configura VITE_ARCGIS_API_KEY en .env si todavía no existe.
npm run dev
```

Si ya tienes `.env`, **consérvalo**. No es necesario volver a copiar el ejemplo.

La API key de ArcGIS Location Platform solo debe tener acceso al servicio de mapas base requerido. Restringe los referrers a la URL local de desarrollo y la URL final de GitHub Pages. `.env` está ignorado; no incluyas credenciales en commits ni las pegues en el chat. La clave de navegador será visible en la aplicación compilada: las restricciones y los privilegios mínimos limitan su uso.

Sin clave, la demo conserva el mapa local de territorios y los símbolos, e informa de que falta configurar el mapa base gris claro. No requiere iniciar sesión ni alojar las comunidades en ArcGIS.

## Explorar la demo

- Busca por nombre, localización o tema; filtra por tipo y estado. Al iniciar, el estado seleccionado es **Activas**; puedes cambiarlo a **Todos** para consultar la colección completa.
- Destaca un territorio sin eliminar del mapa los demás grupos.
- Pasa el puntero sobre un logo o punto para ver el nombre en un tooltip cercano. El clic abre el diálogo de detalles; con teclado o tacto también puedes usar el directorio. El `+` muestra todos los resultados del grupo en el directorio, sin forzar expansión o navegación. Un contador numérico muestra sus resultados y acerca el mapa.
- Usa el selector de grupo y el directorio paginado para acceder mediante teclado o tacto a cualquier coincidencia, incluidas las ocultas y las que no aparecen en el mapa. Los detalles se abren en un diálogo modal; Escape lo cierra y devuelve el foco.
- **Solo el área visible** está activado inicialmente: el directorio muestra los elementos de los grupos cuya composición intersecta la vista del mapa, incluidos los resumidos en contadores o «+». Desactívalo para consultar todos los resultados, incluidos los que no tienen representación geográfica. La pertenencia a un grupo regional sigue siendo la del territorio completo, no una selección por las coordenadas individuales de sus miembros.
- El listado se actualiza al terminar la navegación, con una espera de 160 ms. Las filas se conservan por identidad y se ordenan alfabéticamente para evitar parpadeos al cambiar de agrupación. Se conservan las imágenes cargadas, la página actual si sigue siendo válida y el foco de las filas que permanecen disponibles.
- En **Opciones** puedes fijar el nivel territorial, elegir representación adaptativa, puntos o imágenes, consultar límites de comunidades/provincias/municipios, activar nombres en el mapa, ocultar la capa, cambiar opacidad, retirarla/reincorporarla, y abrir los ejemplos sintéticos.

El perfil adaptativo decide **por grupo**, a partir de sus coincidencias y del espacio disponible dentro de la **comunidad autónoma** y frente a composiciones vecinas. Prueba, por este orden: todos los logos; el mayor número de logos que quepa más «+»; todos los puntos; contador. No mezcla logos y puntos en una misma composición. El máximo visible es 24 elementos y un resumen necesita al menos tres logos: ambos valores son configurables. Si hay demasiados puntos para ese máximo, o no caben, usa el contador. Con una o dos coincidencias conserva puntos individuales aunque el borde impida encajarlos estrictamente.

El zoom influye en el tamaño del territorio en pantalla, pero no impone una representación ni un resumen uniforme: a la misma escala un territorio puede mostrar todos sus logos y otro puntos o contador. La agrupación geográfica automática entre comunidad autónoma y localidad sigue siendo una decisión separada. Los grupos locales pueden cruzar el borde de su municipio; un municipio pequeño no obliga a ocultar un logo que tiene espacio suficiente alrededor. Recalcula al filtrar y al terminar la navegación. Los contadores se separan mediante líneas de unión cuando hace falta: la línea conserva la asociación territorial aunque el contador quede fuera del polígono. Los ejemplos de referencia conservan su perfil original por zoom.

Los límites están **ocultos por defecto**, y pulsarlos **no realiza ninguna acción**. Si activas el modo automático, aparecen comunidades, provincias desde zoom 6.5 y municipios desde 8.5; la capa municipal se dibuja a escalas más cercanas que 1:2.000.000. Los nombres permanentes son opcionales. La selección explícita mediante el selector de territorio sigue disponible.

### Preferencias del desarrollador al iniciar

Edita [`demo.config.ts`](demo.config.ts), que se aplica antes de crear las capas y registrar sus interacciones:

```ts
export default {
  boundaries: {
    mode: "none",         // "none" | "auto" | "regions" | "provinces" | "municipalities"
    labels: false,
    clickAction: "none",  // "none" | "inspect" | "select"
  },
  activation: {
    emphasizeOnItemClick: false,
    emphasizeOnGroupAction: false,
  },
  basemap: { referenceLayersVisible: false },
  directory: { mapExtentOnly: true },
  presentation: { territoryConstraint: "region", maxVisibleItems: 24, minVisibleImages: 3 },
  navigation: {
    inputMode: "auto",
    smoothWheelZoom: true,
    sensitivity: 0.0025,
    durationMs: 180,
    preserveTrackpad: true,
  },
};
```

`inspect` consulta el nombre sin cambiar el color de otros grupos; `select` destaca el territorio y atenúa el resto. Ver los límites no activa su selección automáticamente. La geometría administrativa sigue disponible para agrupación y comprobaciones de espacio aunque sus contornos estén ocultos.

También puedes cambiar preferencias sin recargar:

```js
window.groupDemo.configure({
  boundaries: { mode: "regions", clickAction: "inspect" },
});
```

Las opciones parciales conservan las demás preferencias. `window.groupDemo.options` devuelve una copia de la configuración actual. Los controles de Opciones actualizan esa misma configuración.

`directory.mapExtentOnly` controla el alcance inicial del directorio y también se puede modificar mediante `groupDemo.configure()`. Afecta al listado; no elimina datos de la capa ni cambia las membresías. El filtro se comprueba en coordenadas de pantalla para respetar la rotación y la intersección de las composiciones con los bordes de la vista.

`presentation.territoryConstraint` define qué límite condiciona el encaje de logos y puntos: `"region"` (por defecto) usa la comunidad autónoma incluso para grupos municipales; `"group"` exige encaje en el polígono propio del grupo, incluido el municipio; `"none"` evalúa el espacio entre composiciones sin imponer contención geográfica. Esta preferencia es independiente de que los límites estén dibujados. `maxVisibleItems` limita la densidad de logos o puntos (2–100, por defecto 24). `minVisibleImages` evita resúmenes con muy pocos logos (2–`maxVisibleItems`, por defecto 3); no impide mostrar todos los logos de un grupo de uno o dos elementos. Se configuran también en ejecución, por ejemplo `groupDemo.configure({ presentation: { maxVisibleItems: 16, minVisibleImages: 4 } })`. Se mantiene una sola estrategia adaptativa, sin variantes por zoom que haya que sincronizar. Puede cambiarse sin recargar con `groupDemo.configure({ presentation: { territoryConstraint: "region" } })`.

Estas preferencias pertenecen a la aplicación que combina símbolos y territorios. `GroupSymbolLayer` funciona sin límites administrativos y no abre diálogos, navega ni selecciona territorios por sí misma: emite activaciones y ofrece `selectTerritory()` para que cada desarrollador decida qué hacer. Sus parámetros de dibujo se pasan en `appearance` al construirla o mediante `configure()`.

### Suavizado de rueda del ratón

La prueba de suavizado está activada. En **Opciones → Suavizar rueda del ratón** puedes compararla con la navegación nativa. Son opciones propias de esta aplicación, no propiedades incorporadas del SDK:

- `smoothWheelZoom`: activa o desactiva el controlador.
- `sensitivity`: niveles de zoom por píxel normalizado de rueda; por defecto 0.0025, equivalente a 0.25 niveles para un impulso de 100 píxeles. Rango: 0.0001–0.02.
- `durationMs`: duración de la interpolación desde el último impulso; por defecto 180 ms. Rango: 40–600 ms.
- `inputMode`: `"auto"`, `"mouse"` o `"trackpad"`. En Opciones → Dispositivo de zoom puedes forzar el suavizado del ratón o el manejo nativo del trackpad para comparar sin depender de la detección.
- `preserveTrackpad`: en modo automático, deja al SDK los gestos clasificados como trackpad; por defecto `true`. La clasificación se mantiene durante el gesto, incluidos sus impulsos rápidos. Los valores fraccionarios no se consideran automáticamente trackpad: algunos controladores de ratón también los generan. Tras 250 ms sin eventos se vuelve a clasificar. Es una heurística; para un resultado determinista usa un modo explícito. `false` suaviza toda la rueda en modo automático.

El controlador normaliza unidades de píxeles, líneas y páginas, limita impulsos extremos, acumula el destino y actualiza el punto de vista con `requestAnimationFrame`. Conserva el punto bajo el cursor incluso con rotación y respeta los límites de zoom. Arrastrar, pulsar una tecla, redimensionar o iniciar otra navegación desde los controles cancela la interpolación. Los eventos con Ctrl, habituales en pinch de trackpad, y la preferencia de movimiento reducido conservan el manejo nativo. No lanza una animación `goTo()` por cada impulso.

```js
window.groupDemo.configure({ navigation: { smoothWheelZoom: false } });
// Ajuste de la prueba sin recargar:
window.groupDemo.configure({ navigation: { smoothWheelZoom: true, durationMs: 220 } });
```

Los cambios de agrupación autonómica/municipal continúan siendo discretos al cruzar sus umbrales. El suavizado afecta a la cámara, no elimina esos cambios de representación. La validación con un ratón y un trackpad físicos sigue siendo necesaria.

Para diagnosticar un dispositivo, abre la consola y ejecuta:

```js
window.groupDemo.wheelNavigation.startDiagnostics("raton");
```

Usa únicamente ese dispositivo sobre el mapa durante unos cinco segundos, incluyendo pasos lentos y un movimiento rápido. Después, en la consola de Chrome/Edge:

```js
copy(JSON.stringify(window.groupDemo.wheelNavigation.stopDiagnostics(), null, 2));
```

El último comando copia el informe para pegarlo. Repite una captura independiente con la etiqueta `"trackpad"`. Si tu consola no dispone de `copy`, usa `console.log(JSON.stringify(window.groupDemo.wheelNavigation.stopDiagnostics()))` y copia el texto.

El informe registra deltas originales, sus unidades, intervalos entre eventos, deltas del SDK, decisión del controlador, zoom objetivo, fotogramas y motivos de cancelación. No registra claves, URLs ni datos de comunidades. La captura es local, explícita y acotada; muestra una tabla al terminar, sin escribir una línea de consola por cada fotograma durante la interacción. No cambies las preferencias de navegación entre capturas si buscas una comparación directa.

La capa de referencias del mapa base gris claro está oculta para que sus etiquetas no se dibujen encima de los símbolos. Esto es independiente del conjunto de datos sintéticos «Casos de referencia», que sigue disponible en Opciones.

El perfil automático cambia de comunidad autónoma a municipio al llegar a zoom **7.2**, y vuelve a comunidad autónoma al bajar a **6.8**. El margen evita cambios repetidos en el límite. La demo de comunidades resume imágenes por debajo de zoom **9**. Los casos de referencia conservan el umbral **4.5** del SPEC. Son decisiones independientes y configurables.

Desde la consola de la demo:

```js
window.groupDemo.setGrouping("locality"); // "region" | "locality" | "auto"
```

## Reutilizar la capa

La capa no depende de la demo, de elecciones ni de las capas territoriales de España.

```ts
import { GroupSymbolLayer } from "./src/layer/index";
import type { SymbolGroup } from "./src/layer/index";

const groups: SymbolGroup[] = [{
  id: "area:1",
  label: "Área de actividad",
  territoryId: "country:region:1",
  anchor: { x: -3.7, y: 40.4, wkid: 4326 },
  variant: "images",
  items: [{
    id: "chapter:1",
    sourceId: "organization:1",
    label: "Comunidad de ejemplo",
    category: "technology",
    image: "https://example.org/logo.png",
    imageFit: "contain",
    description: "Información visible como texto.",
  }],
}];

const layer = new GroupSymbolLayer({
  groups,
  appearance: { colors: { technology: "#167c72" } },
});
map.add(layer);

const subscription = layer.onActivate(event => {
  if (event.type === "item") console.log(event.groupId, event.itemId);
  else console.log(event.groupId, event.counts);
});

layer.setFilter(item => item.category === "technology");
layer.selectTerritory("country:region:1");
layer.configure({ imageSize: 36, gap: 6, detailZoom: 7 });
layer.setData(groups); // Reemplaza los datos sin recrear el mapa.
layer.opacity = 0.7;
layer.visible = false;

// La fuente original nunca se modifica.
layer.setFilter();
layer.selectTerritory();
map.remove(layer);
map.add(layer); // Se puede volver a utilizar.
subscription.remove();
```

`npm run build:lib` genera `dist-lib/group-symbol-layer.js` y declaraciones TypeScript. El SDK queda como dependencia externa. Puedes importar el módulo ES generado y sus tipos de `dist-lib/index.d.ts`, o incorporar `src/layer/` a otro proyecto que use el SDK 5.1. La demo no necesita estar incluida.

### Datos, identidades e interacción

- Cada grupo tiene `id`, `label`, `anchor`, `variant` y `items`. Cada elemento tiene `id`, `label` y `category`. `image`, `imageFit`, `description`, `url` y `sourceId` son opcionales.
- La identidad dentro de la capa es `(group.id, item.id)`. `sourceId` mantiene una identidad de origen entre agrupaciones que la aplicación cambie por zoom.
- Coordenadas admitidas: **WGS84 / EPSG:4326** y **Web Mercator / EPSG:3857**. Se admiten vistas 2D en esos sistemas. Para el prototipo, WGS84 se limita a latitudes ±85.05112878°. Valores inválidos, sistemas no admitidos e identidades duplicadas producen un error explícito.
- El orden de entrada determina el orden de los elementos y de los grupos. El último grupo dibujado tiene prioridad en un solapamiento. Los grupos nunca se fusionan automáticamente por proximidad.
- Las zonas de selección son los círculos visibles, sin ampliaciones invisibles: los huecos no activan elementos. Para símbolos pequeños o densos, usa el directorio accesible con controles mayores.
- `getResults(zoom)` devuelve grupos con coincidencias, celdas y conteos separados: `total`, `matching`, `displayed`, `hidden`. El `+` no cuenta como elemento.
- `visibleItems` es un entero positivo opcional por grupo que establece cuántas coincidencias se muestran antes del «+», independientemente del zoom. Si caben todas, no aparece «+». El adaptador lo calcula a partir del espacio disponible; sin este campo, la capa conserva el perfil original `detailZoom`/`summaryVisible`.
- `presentation: "count"` representa un grupo con su número de coincidencias y devuelve una acción `overflow`. Por debajo de `countThreshold` se conservan puntos individuales. Cuando se dibuja el contador, `displayed` es cero y `hidden` coincide con `matching`; el contador tampoco cuenta como elemento. La aplicación decide cuándo usar este modo.
- `declutterCounts: true` separa los contadores dentro de cada vista mediante una búsqueda acotada, con líneas hacia sus anclas. No cambia la fuente ni la pertenencia de los grupos. No evita todas las colisiones posibles entre composiciones arbitrarias.
- `imageFit: "cover"` llena el círculo, apropiado para retratos; `"contain"` conserva logos completos con fondo blanco y relleno. Imágenes ausentes, fallidas o bloqueadas por CORS muestran iniciales.
- Proporciona imágenes HTTP(S) que permitan CORS para usarlas en canvas. Las URL de navegación se limitan a HTTP(S), y etiquetas/descripciones se presentan como texto.
- Crea **una instancia de capa por mapa** para mantener filtros y selección independientes. Las instancias pueden recibir los mismos datos.
- La aplicación consumidora debe proporcionar su alternativa accesible de descubrimiento e inspección. El canvas de la capa no crea cientos de paradas de tabulación. Esta demo incluye esa alternativa en el directorio.

### Configuración visual

| Opción | Valor por defecto de la capa | Rango o significado |
| --- | --- | --- |
| `imageSize` | 32 | 16–72 píxeles CSS |
| `dotSize` | 12 | 6–36 píxeles CSS |
| `overviewScale` | 0.9 | 0.5–1; factor de tamaño y separación en vista general |
| `gap` | 5 | 0–24 píxeles CSS |
| `maxColumns` | 6 | 1–20, entero; limita filas compactas |
| `detailZoom` | 4.5 | 0–24 |
| `summaryThreshold` | 7 | 2–10000, entero |
| `summaryVisible` | 5 | Entero positivo menor que `summaryThreshold` |
| `summarizeDots` | false | Permite resumir puntos en el perfil por zoom; el adaptador espacial usa presupuestos explícitos |
| `attenuation` | 0.22 | 0–1; se combina con opacidad de capa |
| `defaultColor` | `#64748b` | Color para categorías desconocidas |
| `overflowColor` | `#173d46` | Fondo del `+` |
| `colors` | `{}` | Colores por categoría |
| `countSize` | 24 | 16–48 píxeles CSS para contadores |
| `countThreshold` | 3 | Mínimo de coincidencias para un contador; entero entre 2 y 10000 |
| `declutterCounts` | false | Separación acotada de contadores con líneas de unión |
| `showLabels` | false | Nombre del grupo bajo su composición |

Este prototipo usa dos tamaños por perfil: vista general (90 % por defecto) y detalle (100 %). Dentro de cada nivel, tamaños y separación permanecen constantes en píxeles CSS. Los límites y el factor de vista general están documentados para configurar otros perfiles.

## Datos y actualización

La copia de comunidades contiene **657 registros**: 545 con coordenadas y 112 sin geometría. Dos registros adicionales solicitan no mostrarse en el mapa: el directorio conserva los **114** sin representación. Las 104 coordenadas distintas se asocian a municipios mediante las capas IGN/Living Atlas proporcionadas por el usuario; 103 se resuelven. Se producen **88 grupos locales**, incluido uno de ubicación administrativa no resuelta.

```sh
npm run data:prepare       # Conversión reproducible, sin red.
npm run data:refresh-admin # Consultas públicas de actualización territorial.
npm run data:prepare       # Incorporar nuevos resultados territoriales.
```

La actualización administrativa descarga geometrías autonómicas simplificadas, atributos provinciales y las pertenencias y geometrías de los municipios representados. No descarga todos los municipios de España. No requiere API key. La preparación calcula anclas interiores aproximadas para regiones y municipios; las coordenadas originales se conservan en cada comunidad. Para cambiar la copia del directorio, reemplaza `public/data/communities.source.json` con el nuevo JSON, actualiza las pertenencias y vuelve a generar. Conserva fecha y atribución de la nueva fuente.

Consulta [fuentes y condiciones de uso](public/data/ATTRIBUTION.md). Los datos de Community Builders son CC BY 4.0. Los elementos administrativos de Living Atlas tienen sus propias condiciones, incluido uso dentro de ArcGIS. Los logos reales se cargan desde su origen; no se redistribuyen como parte del repositorio. Los ejemplos ficticios usan imágenes SVG locales redistribuibles.

## Validar y publicar

```sh
npm test
npm run build
npm run build:lib
npm run preview
```

La salida `dist/` usa rutas relativas compatibles con un repositorio en GitHub Pages. El workflow `.github/workflows/pages.yml` ejecuta pruebas y compilación antes del despliegue. En GitHub, selecciona **Pages → Source → GitHub Actions** y añade el secret **VITE_ARCGIS_API_KEY**. Debe incluir la restricción de referrer para la URL final. El archivo `.env` local no se sube a GitHub. No se ha publicado esta demo desde esta sesión.

Consulta [arquitectura](docs/architecture.md), [validación y rendimiento](docs/validation.md) y [SPEC](SPEC.md).

## Límites del prototipo

Soporte objetivo: Chrome, Edge, Firefox y Safari actuales, en ordenador y móvil. La validación efectuada se limita a los entornos descritos en el informe; no equivale a validación en dispositivos físicos ni a certificación de accesibilidad.

No incluye 3D, resolución general de colisiones, impresión, captura como API propia, leyenda automática de ArcGIS, persistencia en WebMaps ni edición. Las comprobaciones de encaje usan polígonos simplificados y muestras del contorno de cada celda; no constituyen una garantía geométrica para cualquier polígono o escala. La separación de contadores es acotada y puede agotarse en vistas muy densas. Solo dibuja la copia del mundo más cercana para cada grupo. Las imágenes reales pueden cambiar o dejar de cargar. La ubicación del directorio puede representar un área amplia: el municipio calculado describe el punto suministrado, no una sede ni una pertenencia verificada de la comunidad. Los límites provinciales y municipales consultables requieren acceso a sus servicios públicos de Living Atlas.

La carga sintética de 470 grupos y 1.283 elementos permite medir comportamiento; no establece capacidad máxima ni una garantía de rendimiento.
