// One app-level dialog (confirm or numeric prompt) for mutating actions,
// rendered by app.tsx like every other modal.

import { createSignal, type ParentProps } from "solid-js";
import { createRequiredContext, useFocus } from "@andycmaj/opentui-app";

export type DialogRequest =
  | {
      kind: "confirm";
      title: string;
      detail?: string;
      confirmLabel: string;
      run: () => Promise<void> | void;
    }
  | {
      kind: "prompt";
      title: string;
      detail?: string;
      initial: string;
      run: (value: string) => Promise<void> | void;
    };

interface DialogContextValue {
  request: () => DialogRequest | null;
  open: (request: DialogRequest) => void;
  close: () => void;
}

const [DialogContext, useDialog] =
  createRequiredContext<DialogContextValue>("Dialog");
export { useDialog };

export const DIALOG_MODAL = "dialog";

export function DialogProvider(props: ParentProps) {
  const { openModal, closeModal } = useFocus();
  const [request, setRequest] = createSignal<DialogRequest | null>(null);
  return (
    <DialogContext.Provider
      value={{
        request,
        open: (r) => {
          setRequest(r);
          openModal(DIALOG_MODAL);
        },
        close: () => {
          closeModal();
          setRequest(null);
        },
      }}
    >
      {props.children}
    </DialogContext.Provider>
  );
}
