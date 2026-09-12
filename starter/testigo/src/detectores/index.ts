// EL DETECTOR. Cambiar este export es lo unico que hay que tocar para cambiar de cerebro.
//
// Detector REAL (P2/Jose): modelo + reglas duras, con el heuristico como
// fallback automatico si no hay key o la API se cae. Para forzar el
// heuristico puro: DETECTOR=heuristico.

export const DETECTOR =
  process.env.DETECTOR === "heuristico"
    ? (await import("./heuristico.js")).heuristico
    : (await import("./evidencia.js")).evidencia;
