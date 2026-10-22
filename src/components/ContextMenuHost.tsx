import { useMenu } from "../stores/menu";
import { ContextMenu } from "./ContextMenu";

export function ContextMenuHost() {
  const menu = useMenu((s) => s.menu);
  const close = useMenu((s) => s.close);
  if (!menu) return null;
  // key: un menú nuevo en otro punto reinicia el estado (submenús, posición).
  return <ContextMenu key={`${menu.x}:${menu.y}:${menu.label}`} spec={menu} onClose={close} />;
}
