import { SegmentedControl } from "../../components/SegmentedControl";
import { useUi, type EditorMode } from "../../stores/ui";

const MODES: readonly { id: EditorMode; label: string }[] = [
  { id: "edit", label: "Editar" },
  { id: "split", label: "Dividir" },
  { id: "view", label: "Vista" },
];

export function ModeSwitch() {
  const mode = useUi((s) => s.mode);
  const setMode = useUi((s) => s.setMode);
  return <SegmentedControl label="Modo del editor" options={MODES} value={mode} onChange={setMode} />;
}
