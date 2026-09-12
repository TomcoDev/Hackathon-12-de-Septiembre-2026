// EL DETECTOR. Cambiar este export es lo unico que hay que tocar para cambiar de cerebro.
//
// JOSE: cuando src/detectores/evidencia.ts este listo, cambiar a:
//   export { evidencia as DETECTOR } from "./evidencia.js";
// y dejar el heuristico como fallback en pipeline si el modelo falla.

export { heuristico as DETECTOR } from "./heuristico.js";
