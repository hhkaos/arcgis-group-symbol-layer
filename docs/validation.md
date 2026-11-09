# Validación del prototipo

Fecha: **9 de noviembre de 2026**. Este informe describe comprobaciones realizadas, no una certificación de producción ni una garantía de capacidad.

## Entorno identificado

- Node.js 22.23.3; SDK instalado 5.1.27; dependencias exactas en `package-lock.json`.
- Chrome automatizado **157.0.0.0**, plataforma informada `MacIntel`, 8 procesadores lógicos y 32 GB según las propiedades expuestas por el navegador. No se ha verificado el modelo físico del equipo.
- Vistas de escritorio: 1514 × 787 y 1440 × 900, DPR 1.
- Vista móvil emulada: 390 × 844, DPR 2, con emulación de tacto y movimiento reducido. No equivale a una prueba en un teléfono físico.
- Servidores de desarrollo y de compilación de producción probados localmente. Mapa base gris claro cargado con la clave configurada por el usuario; la clave no se incluyó en este informe.

## Comprobaciones automáticas

`npm test`: **32 pruebas** en cinco archivos. Cubren:

- Casos 0, 1, 3, 6, 7 y 24; límite exacto de zoom 4.5, conteos y orden.
- Filtrado, restauración de identidades y ausencia de mutación de la fuente.
- Filas centradas, huecos sin activación, prioridad de solapamiento e identidad de item frente a overflow.
- Rechazo de coordenadas, configuración e identidades inválidas; bloqueo de URL ejecutables.
- Carga sintética exacta: 470 grupos y 1.283 elementos.
- Histéresis de agrupación, identidades conservadas entre región y municipio, y 112 registros sin geometría.
- Anclas interiores dentro de todos los polígonos administrativos preparados.
- Uno o dos elementos conservan puntos individuales incluso si se solicita un contador. Cuatro grupos con idénticas 12 coincidencias al mismo zoom eligen 12 logos, ocho logos más «+», 12 puntos y contador según el espacio; el caso se repite a zoom 3 y 12 con tamaño constante.
- Presupuesto explícito por grupo independiente del umbral de zoom, activación del «+», coincidencias ocultas y filtrado sin overflow innecesario. Densidad máxima, validación de preferencias y decisiones estables frente a vecinos.
- Selección adaptativa de imágenes, puntos o contador, actualización después de filtrar y respeto de huecos de polígonos.
- Normalización de rueda, conservación de dirección, limitación de impulsos extremos, heurística de entrada fina y conservación matemática del ancla con zoom fraccionario y rotación.
- Regresión de las capturas físicas recibidas: los 23 eventos del ratón se clasifican como ratón y los 225 del trackpad como trackpad, sin alternar durante la aceleración. Solo se conservan tiempos y deltas en el fixture, sin metadatos del navegador.
- Encaje local con datos reales a zoom 8: Pamplona/Iruña muestra su logo, Zaragoza sus seis elementos activos y Burgos el de MorcillaConf al comprobar el límite autonómico en lugar del municipal.

`npm run build` comprueba TypeScript y genera la aplicación. `npm run build:lib` genera el módulo ES independiente y declaraciones, manteniendo el SDK como dependencia externa.

## Comprobaciones en navegador

| Comportamiento | Resultado observado |
| --- | --- |
| Mapa base configurado | `arcgis/light-gray`, capa vectorial cargada; sin errores en consola en la carga normal. |
| Etiquetas del mapa base | Capa de referencias identificada y oculta para evitar que sus nombres se dibujen por encima de los símbolos. |
| Preferencias de inicio | Límites autonómicos, provinciales y municipales ocultos; ninguna selección inicial. La configuración parcial conserva otras preferencias. |
| Clic territorial configurable | Con límites activados y un clic real sobre Castilla-La Mancha: `none` no selecciona, `inspect` muestra el nombre sin seleccionar y `select` selecciona `34080000000`. |
| Metadatos territoriales | Las tres capas del usuario son públicas. La capa municipal cargó y expuso `NAMEUNIT` como campo consultable. |
| Agrupación | Cambio a municipio al acercarse, manteniendo los mismos IDs de origen. |
| Perfil adaptativo | Con agrupación regional fija a zoom 6: Andalucía mostró cinco logos más «+» (105 coincidencias), Castilla y León siete más «+» (nueve coincidencias), Murcia siete puntos y Valencia contador de 22. A zoom 8: Andalucía mostró 24 logos más «+», Castilla y León los nueve y Valencia 15 más «+». |
| Contadores móviles | Los 18 contadores de la vista general comprobada no se solapaban después de su separación. Es una observación de esa vista, no una garantía para todos los datos. |
| Presupuesto y hit adaptativo | En Valencia a zoom 8, la celda «+» devolvió `overflow`, 22 coincidencias, 15 visibles y siete ocultas. Volver al agrupamiento local mantuvo los logos de Pamplona (uno), Zaragoza (seis) y Burgos (uno). |
| Hit testing | 60 posiciones comprobadas en el perfil mixto y 12 en una vista municipal con rotación: ninguna discrepancia frente al elemento superior dibujado. |
| Referencia y rotación | 52 posiciones comprobadas a 47°: ninguna discrepancia de identidad, contando correctamente la prioridad de solapamiento. |
| DPR 2 | En la referencia rotada, las 52 posiciones interiores comprobadas tenían dibujo en el canvas donde esperaba el hit test. |
| Retirada y reenganche | Tres ciclos: una copia de la capa, dos manejadores activos en la nueva vista y vista anterior desactivada. |
| Opacidad | Comparación de capturas a 0, 0.5 y 1: error medio aproximado de 0.29 niveles RGB respecto a la mezcla esperada, sin deriva entre capturas opacas. |
| Dos mapas | Dos instancias con la misma fuente: filtros y selección independientes; 7 coincidencias en una frente a 55 sin filtrar en la otra. |
| Teclado | Enter en un resultado abre el diálogo modal y mueve el foco a su control de cierre. Escape lo cierra y devuelve el foco al resultado. |
| Tooltip y clic | Movimiento de puntero simulado sobre un logo mostró su nombre en un tooltip junto al símbolo. Un clic real de navegador sobre el logo centrado abrió el diálogo de ese elemento. |
| Diseño móvil | Sin desbordamiento horizontal a 390 px. Directorio y controles disponibles debajo del mapa. |
| Estabilidad del directorio | Misma secuencia de tres impulsos de rueda con alcance global: antes, cuatro reconstrucciones con 48 filas retiradas y 48 añadidas; después, cero mutaciones de hijos directos y conservación del primer botón y su imagen. |
| Contexto de lectura | Al pasar de agrupación regional a local con alcance global, se conservaron fila, imagen, foco, página 2/38 y scroll de la barra lateral en 220 px. |
| Alcance del directorio | En una comprobación alrededor de Madrid a zoom 9.2 aparecieron 91 coincidencias; en una vista del Atlántico, cero y un mensaje explicativo. Desactivar el alcance devolvió las 446 comunidades activas. |
| Suavizado de rueda | Evento simulado de −100 píxeles: zoom 5.5 → 5.74996, con 13 valores observados y 12 actualizaciones del controlador. Desviación del ancla: 0.117 píxeles con rotación de 23°. |
| Impulsos sucesivos y comparación nativa | Tres impulsos simulados de −100 píxeles llegaron a zoom 6.24999 desde 5.5. Un evento fino de 2 píxeles y un impulso con suavizado desactivado pasaron al controlador nativo. |

Los casos de imágenes inexistentes producen respuestas 404 intencionadas al abrir la referencia; se muestra una inicial en su lugar. Los logos remotos pueden fallar por disponibilidad o CORS y también tienen fallback.

La interacción de navegación se ha comprobado mediante animaciones programáticas de centro, zoom y rotación, además del uso de controles. Quedan pendientes pruebas manuales completas de arrastre, pinch zoom y tecnologías de asistencia en dispositivos físicos.

## Rendimiento observado

Carga: **470 grupos y 1.283 elementos**, ejemplo sintético con imágenes locales, escritorio DPR 1. Una medición sobre la compilación de producción, después de calentar imágenes y antes de los últimos ajustes de presentación territorial, dio:

| Operación | Observación |
| --- | --- |
| Cambiar el conjunto y preparar controles/listado, parte síncrona | 64.3 ms |
| Aplicar búsqueda y actualizar listado, parte síncrona | 10.1 ms |
| Sustituir datos y calcular layout, cinco iteraciones | 0.9–1.3 ms |
| Callback de dibujo de la capa, mediana / percentil 95 | 1.4 / 1.8 ms |
| Intervalos de frames de una navegación de 900 ms, mediana / percentil 95 | 27.4 / 475.2 ms; 8 frames observados |

La última fila incluye pausas considerables y no permite afirmar navegación fluida. El callback de dibujo mide solo la capa: el motor de mapa, las cargas, el navegador y la automatización contribuyen al tiempo total. La medición es una muestra pequeña, sin control de hardware o carga externa. No se ha medido el tiempo de descarga inicial ni la capacidad de un dispositivo físico.

La primera implementación redibujaba todas las celdas y proyectaba cada ancla en cada frame: el callback mediano rondaba 21.4 ms. Composiciones cacheadas y proyección previa redujeron esa parte a unos 1.4–1.6 ms en las muestras posteriores. Esta mejora no convierte el tiempo total del mapa en una garantía.

### Parpadeo del directorio durante el zoom

Se registraron trazas de interacción en Chrome DevTools, sin recarga, sin limitación de CPU/red y con el alcance global para comparar resultados idénticos durante el gesto. Un `MutationObserver` sobre `#results` midió cuatro lotes de reconstrucción y 48 filas eliminadas/añadidas antes del cambio, frente a cero después. La fila y el nodo de imagen iniciales permanecieron conectados. Las trazas observaron CLS 0.00 tanto antes como después: el problema era la sustitución de nodos e imágenes, no un desplazamiento de layout reflejado por ese indicador. No se midieron LCP o INP en esta comprobación.

La actualización por vista tiene una espera de 160 ms y se pospone mientras la navegación o el suavizado de rueda siguen activos. Cuando cambian realmente las coincidencias, se insertan o retiran solo las filas necesarias; ese cambio de contenido es esperado. La lista mantiene 12 filas por página, por lo que no se añadió virtualización ni un framework adicional.

Los modos adaptativos administrativos y las capas provinciales/municipales necesitan una campaña propia en dispositivos objetivo antes de establecer objetivos de rendimiento. Las comprobaciones de encaje se ejecutan al terminar la navegación, no en cada frame.

Con la estrategia espacial actual, cambiar `maxVisibleItems` de 24 a cuatro redujo los resúmenes de Andalucía y Castilla y León a cuatro logos; restaurarlo recuperó cinco y siete, respectivamente, sin recargar. La consola no mostró errores durante la comprobación de escritorio. Los casos antiguos de cinco puntos más «+» se sustituyen por todos los puntos o contador; la referencia sintética conserva su perfil por zoom.

## Límites de cobertura

Pendiente: Safari, Firefox y Edge; teléfonos y tabletas físicos; lectores de pantalla; pruebas táctiles completas; redes lentas con sustitución de datos durante descargas; carga sostenida y mediciones repetibles de memoria; publicación y comprobación desde GitHub Pages.

El suavizado de rueda se ha comprobado con eventos de navegador simulados. Queda pendiente la comparación con ratón y trackpad físicos: los navegadores no proporcionan una identificación fiable de esos dispositivos y la heurística puede clasificar mal algunos valores.

Tras el comentario de que no se apreciaba diferencia con el ratón, se añadió captura diagnóstica explícita. Una comprobación simulada registró dos eventos originales y sus dos decisiones del SDK: −100 píxeles pasó al suavizado y produjo 12 fotogramas, mientras que 2 píxeles siguió el manejo nativo. El informe también registró la finalización de la animación. Esta comprobación no reproducía el problema físico, que se analizó con las capturas siguientes.

Las capturas físicas posteriores confirmaron que la primera heurística dejaba los 23 eventos del ratón al manejo nativo e intentaba suavizar 32 de los 225 eventos del trackpad. El ratón enviaba valores fraccionarios, desde ±4.000244 píxeles hasta impulsos mayores; el trackpad comenzaba con incrementos enteros pequeños y aceleraba durante el mismo gesto. La clasificación por gesto corrige ambas trazas en las pruebas de regresión, y se añadieron modos explícitos de dispositivo. Sigue pendiente la valoración física de la sensación del zoom con la implementación corregida.

Después de la corrección, una prueba de navegador simulando −4.000244 píxeles en modo automático produjo 12 fotogramas del suavizado. Un gesto −1 seguido de −133 píxeles permaneció completamente nativo. El modo explícito de ratón suavizó un evento de −2 píxeles en 12 fotogramas. La consola no mostró errores en esta comprobación.

No se han validado impresión, persistencia en WebMaps, leyenda automática ni vistas 3D, que siguen fuera del alcance. Los contadores tienen una búsqueda de separación acotada; en datos arbitrariamente densos puede agotarse. Los logos y puntos del perfil adaptativo se comprueban contra geometrías simplificadas y muestras de sus celdas, no mediante un algoritmo exacto de empaquetado geométrico.
