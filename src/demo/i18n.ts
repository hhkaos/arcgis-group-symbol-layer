export type Language = "en" | "es";
const spanish: Record<string, string> = {
  "SPAIN’S TECH COMMUNITY ECOSYSTEM": "EL ECOSISTEMA DE COMUNIDADES TECH DE ESPAÑA",
  "Discover where to meet people who share your interests and curiosity": "Descubre dónde encontrar a personas que comparten tus inquietudes e intereses",
  "Skip to directory": "Ir al directorio", "Directory": "Directorio", "Toggle directory": "Mostrar u ocultar directorio",
  "Map options": "Opciones del mapa", "Language": "Idioma", "Search communities": "Buscar comunidades",
  "Search by name, place, or topic": "Buscar por nombre, lugar o tema", "Show filters": "Mostrar filtros", "Hide filters": "Ocultar filtros", "Filters": "Filtros", "Type": "Tipo", "Status": "Estado",
  "Autonomous community": "Comunidad autónoma", "Province": "Provincia", "All of Spain": "Toda España", "All provinces": "Todas las provincias",
  "All types": "Todos los tipos", "All statuses": "Todos los estados", "Active": "Activas", "Inactive": "Inactivas", "Unconfirmed": "Sin confirmar",
  "Active community": "Comunidad activa", "Inactive community": "Comunidad inactiva",
  "Only the visible area": "Solo el área visible", "Show results": "Ver resultados", "Clear filters": "Limpiar filtros",
  "Previous": "Anterior", "Next": "Siguiente", "All results": "Todos los resultados", "Back to directory": "Volver al directorio",
  "Data": "Datos", "Boundaries": "Límites", "Sources and terms of use": "Fuentes y condiciones de uso",
  "Code created with AI using OpenAI Codex. Inspired by": "Código creado con IA mediante OpenAI Codex. Inspirado en",
  "by Patrick Arlt.": "de Patrick Arlt.", "Watch recording from 19:44": "Ver grabación desde 19:44",
  "Datasets": "Conjuntos de datos", "Spain’s communities": "Comunidades de España", "Reference cases": "Casos de referencia",
  "Stress test · 470 groups / 1,283 items": "Prueba · 470 grupos / 1.283 elementos", "Group by": "Agrupar por",
  "Automatic by zoom": "Automático según zoom", "Locality": "Localidad", "Administrative boundaries": "Límites administrativos",
  "Hidden": "Ocultos", "Automatic": "Automáticos", "Autonomous communities": "Comunidades autónomas", "Provinces": "Provincias", "Municipalities": "Municipios",
  "Boundary click": "Al pulsar un límite", "No action": "Ninguna acción", "Inspect name": "Consultar nombre", "Emphasize territory": "Destacar territorio",
  "Map labels": "Nombres sobre el mapa", "Smooth mouse wheel": "Suavizar rueda del ratón", "Zoom input": "Dispositivo de zoom",
  "Automatic detection": "Detección automática", "Mouse · smooth": "Ratón · suavizado", "Trackpad · native": "Trackpad · nativo",
  "Representation": "Representación", "Adaptive / example profile": "Adaptativa / perfil del ejemplo", "Images": "Imágenes", "Dots": "Puntos",
  "Show layer": "Mostrar capa", "Opacity": "Opacidad", "Remove layer": "Retirar capa", "Add layer again": "Volver a añadir capa",
  "Symbols represent areas of activity, not exact venues.": "Los símbolos representan áreas de actividad, no sedes exactas.",
  "By autonomous community": "Por comunidad autónoma", "By locality": "Por localidad", "Validation workload": "Carga de validación",
  "{groups} groups in view · {items} communities": "{groups} grupos en vista · {items} comunidades",
  "{groups} groups · {items} communities": "{groups} grupos · {items} comunidades",
  "{count} communities": "{count} comunidades", "1 community": "1 comunidad",
  "No matches in this area. Move the map or turn off “Only the visible area”.": "No hay coincidencias en esta área. Mueve el mapa o desactiva «Solo el área visible».",
  "No matches. Try another term or clear the filters.": "No hay coincidencias. Prueba otro término o limpia los filtros.",
  "Not shown on the map": "Sin representación en el mapa", "No description available.": "Sin descripción disponible.", "Visit community": "Visitar la comunidad",
  "Meetup": "Meetup", "Conference": "Conferencia", "Hacklab": "Hacklab", "Collaborative group": "Grupo colaborativo", "Organization": "Organización",
  "Community network": "Red de comunidades", "Mutual aid": "Apoyo mutuo", "Uncategorized": "Sin categoría", "N = matching communities": "N = comunidades que coinciden",
  "Boundaries are hidden; territorial grouping is still available.": "Los límites están ocultos; la agrupación territorial sigue disponible.",
  "Zoom in to inspect municipal boundaries.": "Acércate para consultar los límites municipales.", "Boundary clicks have no action.": "El clic sobre los límites no realiza ninguna acción.",
  "Click a boundary to inspect its territory.": "Pulsa un límite para consultar su territorio.",
  "Interactive tech community map": "Mapa interactivo de comunidades tecnológicas", "Use the directory to inspect communities with the keyboard.": "Usa el directorio para consultar comunidades con el teclado.",
  "Configure an API key to load the light gray basemap. Community symbols remain available.": "Configura una API key para cargar el mapa base gris claro. Los símbolos siguen disponibles.",
  "Loading communities…": "Cargando comunidades…", "Could not load communities and territories": "No se pudieron cargar las comunidades y sus territorios",
  "Unable to start the demo": "No se puede iniciar la demo", "Data could not be loaded. Reload to try again.": "No se han podido cargar los datos. Recarga para volver a intentarlo.",
  "{count} items": "{count} elementos", "Overlap {count}": "Solapamiento {count}", "Test group {count}": "Grupo de prueba {count}",
  "Community {count}": "Comunidad {count}", "Person {count}": "Persona {count}", "Item {count}": "Elemento {count}",
  "Fictional local example. Tests identity, ordering, categories, images, and accessibility.": "Ejemplo ficticio local. Prueba identidad, orden, categorías, imágenes y accesibilidad.",
};
export const translationKeys = Object.keys(spanish);
export function translate(key: string, locale: Language, values: Record<string, string | number> = {}): string {
  return (locale === "es" ? spanish[key] ?? key : key).replace(/\{(\w+)\}/g, (match, name: string) => String(values[name] ?? match));
}
let locale: Language = "en";
try { if (localStorage.getItem("community-map-language") === "es") locale = "es"; } catch { /* Storage may be unavailable. */ }
export const language = () => locale;
export const t = (key: string, values?: Record<string, string | number>) => translate(key, locale, values);
export function setLanguage(value: Language): void {
  locale = value;
  try { localStorage.setItem("community-map-language", value); } catch { /* Language still works without persistence. */ }
  document.documentElement.lang = value;
}
export function localize(root: ParentNode = document): void {
  document.documentElement.lang = locale;
  root.querySelectorAll<HTMLElement>("[data-i18n]").forEach(el => { el.textContent = t(el.dataset.i18n!); });
  for (const attr of ["heading", "label", "placeholder", "text", "aria-label", "title"]) {
    root.querySelectorAll<HTMLElement>(`[data-i18n-${attr}]`).forEach(el => el.setAttribute(attr, t(el.getAttribute(`data-i18n-${attr}`)!)));
  }
}
