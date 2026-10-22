import { useUi } from "../../stores/ui";
import { ChangePasswordDialog } from "./ChangePasswordDialog";
import { ImportDialog } from "./ImportDialog";
import { NewVaultDialog } from "./NewVaultDialog";
import { ProtectVaultDialog } from "./ProtectVaultDialog";
import { RecoveryKeyDialog } from "./RecoveryKeyDialog";

export function VaultDialogHost() {
  const dialog = useUi((s) => s.vaultDialog);
  return (
    <>
      {dialog === "vault-new" && <NewVaultDialog />}
      {dialog === "vault-protect" && <ProtectVaultDialog />}
      {dialog === "vault-import" && <ImportDialog />}
      {dialog === "vault-password" && <ChangePasswordDialog />}
      <RecoveryKeyDialog />
    </>
  );
}
