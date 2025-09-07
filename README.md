# Evaluaciones – Selector

Aplicación web estática para visualizar evaluaciones por módulo de un curso (Creación de Contenido Digital para Educación). Carga un archivo Markdown y muestra preguntas / rúbricas; usa datos JSON con respuestas y referencias.

## Características
- Selector de módulo dinámico (combobox + botón Cargar).
- Render Markdown con `marked`.
- Validación / utilidades vía `validator.js` y `autowire-validator.js`.
- Barra de herramientas extensible (`#ev-toolbar`).
- Datos de respuestas por módulo en `data/*.json`.

## Estructura (resumida)
```
app/
  index.html
  styles.css
  main.js
  validator.js
  autowire-validator.js
data/
  Respuestas_Modulo_1.json
  Evaluacion_Modulo_1.md (referenciado)
```

## Esquema JSON de respuestas
```json
{
  "modulo": <number>,
  "archivo_evaluacion": "./Evaluacion_Modulo_X.md",
  "fecha_generacion": "YYYY-MM-DD",
  "preguntas": [
    {
      "numero": <number>,
      "respuesta": "A|B|C|D|...",
      "peso": <number>,
      "referencias": ["ruta o nota", "..."]
    }
  ]
}
```

## Uso
1. Clonar el repositorio.
2. (Opcional) Servir con un servidor local para evitar problemas de rutas:
   - PowerShell: `python -m http.server 5500` dentro de `app/`
3. Abrir `http://localhost:5500/index.html`.
4. Seleccionar módulo y pulsar Cargar.

## Añadir un nuevo módulo
1. Crear `data/Respuestas_Modulo_N.json` siguiendo el esquema.
2. Añadir el archivo Markdown `Evaluacion_Modulo_N.md` (ruta coincidente con `archivo_evaluacion`).
3. Actualizar (si es necesario) la lógica en `main.js` que rellena `<select id="module">` para incluir el nuevo módulo (o hacerla dinámica leyendo el directorio si se implementa un paso de build).
4. Probar en navegador.

## Personalización barra de herramientas
Insertar botones en `#ev-toolbar` desde `main.js` después de `DOMContentLoaded`:
```js
const bar = document.getElementById('ev-toolbar');
bar.innerHTML = '';
const btn = document.createElement('button');
btn.textContent = 'Exportar';
btn.onclick = exportarResultados;
bar.appendChild(btn);
```

## Accesibilidad
- `aria-live="polite"` usado en `#status`.
- Revisar contraste en `styles.css` para tema oscuro.
- Incluir texto alternativo en futuros elementos multimedia.

## Scripts externos
- `marked.min.js` CDN para parse Markdown (considerar versionado fijo para reproducibilidad).

## Tareas futuras (sugerencias)
- Generar índice automático de secciones del Markdown.
- Exportar resultados (CSV / JSON).
- Tests unitarios para validadores.
- Tema claro/oscuro con `prefers-color-scheme`.

## Licencia
Indicar licencia (MIT, CC BY-SA, etc.).
