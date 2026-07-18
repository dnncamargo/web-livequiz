import { useEffect, useState } from "react";

interface TemporaryConfirmButtonProps {
  onConfirm: () => void | Promise<void>;
  idleLabel: string;
  confirmLabel?: string;
  timeoutMs?: number;
  className?: string;
  disabled?: boolean;
}

export function TemporaryConfirmButton({
  onConfirm,
  idleLabel,
  confirmLabel = "Confirmar?",
  timeoutMs = 5_000,
  className,
  disabled = false,
}: TemporaryConfirmButtonProps) {
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);

  useEffect(() => {
    if (!awaitingConfirmation) return;
    const timeout = window.setTimeout(
      () => setAwaitingConfirmation(false),
      timeoutMs,
    );
    return () => window.clearTimeout(timeout);
  }, [awaitingConfirmation, timeoutMs]);

  async function handleClick() {
    if (!awaitingConfirmation) {
      setAwaitingConfirmation(true);
      return;
    }
    setAwaitingConfirmation(false);
    await onConfirm();
  }

  return (
    <button
      type="button"
      className={className}
      disabled={disabled}
      onClick={() => void handleClick()}
    >
      {awaitingConfirmation ? confirmLabel : idleLabel}
    </button>
  );
}
