// Lo que el agente puede HACER, no solo decir.
//
// Regla de diseno, y es criterio 4 del rubro: toda accion con efecto afuera pasa por
// aprobacion humana. El agente propone, la persona confirma con la voz o con un click.
// Ejecutar sin confirmar es la forma mas rapida de perder el criterio de control.

export type Accion = {
  name: string;
  /** Va al prompt del detector: el modelo elige entre estas. */
  descripcion: string;
  /** Propiedades del JSON Schema para los params. Lo consume el detector. */
  params: Record<string, { type: string; description: string }>;
  /** false solo para acciones sin efecto afuera (leer, calcular). */
  requiereAprobacion: boolean;
  ejecutar(params: Record<string, unknown>): Promise<string>;
};

/**
 * Registro de acciones. Reemplazar por las del dominio real cuando se cierre el problema.
 * Las dos de abajo existen para que el circuito completo se pueda probar sin nada montado.
 */
export const ACCIONES: Accion[] = [
  {
    name: "anotar",
    descripcion: "Registrar un dato o acuerdo que se dijo en voz alta y nadie escribio.",
    params: {
      texto: { type: "string", description: "Lo que hay que registrar, en una linea." },
    },
    requiereAprobacion: false,
    async ejecutar(p) {
      const linea = `[${new Date().toISOString()}] ${String(p.texto ?? "")}`;
      registro.push(linea);
      return `Anotado: ${p.texto}`;
    },
  },
  {
    name: "avisar",
    descripcion:
      "Mandar un aviso a una persona que no esta en la conversacion. Tiene efecto afuera.",
    params: {
      destinatario: { type: "string", description: "A quien." },
      texto: { type: "string", description: "Que se le dice." },
    },
    requiereAprobacion: true,
    async ejecutar(p) {
      // Placeholder: aca va el canal real (mail, Telegram, el sistema del dominio).
      const linea = `AVISO -> ${String(p.destinatario)}: ${String(p.texto)}`;
      registro.push(linea);
      console.log(`  [accion] ${linea}`);
      return `Aviso enviado a ${p.destinatario}`;
    },
  },
];

/** Lo que quedo hecho. La pantalla lo muestra: sin resultado visible, la accion no se probo. */
export const registro: string[] = [];

export function buscar(name: string): Accion | undefined {
  return ACCIONES.find((a) => a.name === name);
}

/** Para inyectar el catalogo en el prompt del detector. */
export function catalogoParaPrompt(): string {
  return ACCIONES.map(
    (a) =>
      `- ${a.name}(${Object.keys(a.params).join(", ")}): ${a.descripcion}` +
      (a.requiereAprobacion ? " [requiere aprobacion]" : ""),
  ).join("\n");
}

export type Pendiente = {
  id: string;
  name: string;
  params: Record<string, unknown>;
  porque: string;
  ts: number;
};

const pendientes = new Map<string, Pendiente>();

export type ResultadoAccion =
  | { estado: "ejecutada"; detalle: string }
  | { estado: "pendiente"; pendiente: Pendiente }
  | { estado: "desconocida"; detalle: string }
  | { estado: "error"; detalle: string };

/** Ejecuta directo si no requiere aprobacion; si la requiere, la deja en cola. */
export async function despachar(
  name: string,
  params: Record<string, unknown>,
  porque: string,
): Promise<ResultadoAccion> {
  const accion = buscar(name);
  if (!accion) return { estado: "desconocida", detalle: `No existe la accion "${name}".` };

  if (accion.requiereAprobacion) {
    const p: Pendiente = { id: `a${Date.now().toString(36)}`, name, params, porque, ts: Date.now() };
    pendientes.set(p.id, p);
    return { estado: "pendiente", pendiente: p };
  }

  try {
    return { estado: "ejecutada", detalle: await accion.ejecutar(params) };
  } catch (e: unknown) {
    return { estado: "error", detalle: (e as Error).message };
  }
}

export function listarPendientes(): Pendiente[] {
  return [...pendientes.values()];
}

export async function resolver(id: string, aprobada: boolean): Promise<ResultadoAccion> {
  const p = pendientes.get(id);
  if (!p) return { estado: "desconocida", detalle: `No hay accion pendiente ${id}.` };
  pendientes.delete(id);

  if (!aprobada) return { estado: "ejecutada", detalle: "Descartada por la persona." };

  const accion = buscar(p.name);
  if (!accion) return { estado: "desconocida", detalle: `No existe la accion "${p.name}".` };
  try {
    return { estado: "ejecutada", detalle: await accion.ejecutar(p.params) };
  } catch (e: unknown) {
    return { estado: "error", detalle: (e as Error).message };
  }
}
