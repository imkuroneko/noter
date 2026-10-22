export interface Point {
  x: number;
  y: number;
}

/** Mantiene un panel de tamaño w×h dentro de la ventana, con un margen. */
export function clampToViewport(p: Point, w: number, h: number, vw: number, vh: number, margin = 8): Point {
  return {
    x: Math.max(margin, Math.min(p.x, vw - w - margin)),
    y: Math.max(margin, Math.min(p.y, vh - h - margin)),
  };
}
