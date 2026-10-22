import { useConfirm } from "../stores/confirm";
import { ConfirmDialog } from "./ConfirmDialog";

export function ConfirmHost() {
  const pending = useConfirm((s) => s.pending);
  const answer = useConfirm((s) => s.answer);
  if (!pending) return null;
  const { title, message, confirmLabel, danger } = pending;
  return (
    <ConfirmDialog title={title} message={message} confirmLabel={confirmLabel} danger={danger} onResult={answer} />
  );
}
