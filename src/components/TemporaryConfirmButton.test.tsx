// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TemporaryConfirmButton } from "./TemporaryConfirmButton";

describe("TemporaryConfirmButton", () => {
  it("confirma a ação somente no segundo clique", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <TemporaryConfirmButton idleLabel="Remover" onConfirm={onConfirm} />,
    );
    await user.click(screen.getByRole("button", { name: "Remover" }));
    expect(onConfirm).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Confirmar?" }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });
});
