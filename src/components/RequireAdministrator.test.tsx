// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { RequireAdministrator } from "./RequireAdministrator";

const authMock = vi.hoisted(() => ({
  value: {
    user: {
      uid: "conta-google-1",
      isAnonymous: false,
    } as null | { uid: string; isAnonymous: boolean },
    loading: false,
    isAdministrator: false,
    administratorAuthorizationStatus: "unauthorized",
  },
}));

vi.mock("../contexts/auth-context", () => ({
  useAuth: () => authMock.value,
}));

function renderProtectedRoute() {
  return render(
    <MemoryRouter initialEntries={["/gerenciar"]}>
      <Routes>
        <Route
          path="/gerenciar"
          element={
            <RequireAdministrator>
              <p>Área privada</p>
            </RequireAdministrator>
          }
        />
        <Route path="/login" element={<p>Login administrativo</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("RequireAdministrator", () => {
  beforeEach(() => {
    authMock.value.user = {
      uid: "conta-google-1",
      isAnonymous: false,
    };
    authMock.value.loading = false;
    authMock.value.isAdministrator = false;
    authMock.value.administratorAuthorizationStatus = "unauthorized";
  });

  afterEach(cleanup);

  it("bloqueia uma conta Google sem autorização administrativa", () => {
    renderProtectedRoute();

    expect(screen.getByText("Login administrativo")).toBeInTheDocument();
    expect(screen.queryByText("Área privada")).not.toBeInTheDocument();
  });

  it("libera a rota para um administrador autorizado", () => {
    authMock.value.isAdministrator = true;
    authMock.value.administratorAuthorizationStatus = "authorized";

    renderProtectedRoute();

    expect(screen.getByText("Área privada")).toBeInTheDocument();
  });

  it("aguarda a verificação antes de decidir o acesso", () => {
    authMock.value.administratorAuthorizationStatus = "checking";

    renderProtectedRoute();

    expect(
      screen.getByText("Verificando sua sessão e autorização."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Área privada")).not.toBeInTheDocument();
  });
});
