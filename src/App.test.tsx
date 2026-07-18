// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { App } from "./App";

const authMock = vi.hoisted(() => ({
  value: {
    user: null as null | { uid: string; isAnonymous: boolean },
    loading: false,
    isAdministrator: false,
    administratorAuthorizationStatus: "not-applicable",
  },
}));

vi.mock("./contexts/auth-context", () => ({
  useAuth: () => authMock.value,
}));

vi.mock("./pages/AdminLoginPage", () => ({
  AdminLoginPage: () => <p>Login administrativo</p>,
}));

vi.mock("./pages/ArchivedRoomsPage", () => ({
  ArchivedRoomsPage: () => <p>Salas arquivadas</p>,
}));

vi.mock("./pages/FirebaseTestPage", () => ({
  FirebaseTestPage: () => <p>Diagnóstico privado</p>,
}));

vi.mock("./pages/HomePage", () => ({
  HomePage: () => <p>Página inicial</p>,
}));

vi.mock("./pages/ManagementPage", () => ({
  ManagementPage: () => <p>Gerenciamento</p>,
}));

vi.mock("./pages/PresentationPage", () => ({
  PresentationPage: () => <p>Apresentação</p>,
}));

vi.mock("./pages/QuizLibraryPage", () => ({
  QuizLibraryPage: () => <p>Biblioteca de quizzes</p>,
}));

vi.mock("./pages/WaitingRoomPage", () => ({
  WaitingRoomPage: () => <p>Sala administrativa</p>,
}));

describe("rotas administrativas", () => {
  beforeEach(() => {
    authMock.value.user = null;
    authMock.value.loading = false;
    authMock.value.isAdministrator = false;
    authMock.value.administratorAuthorizationStatus = "not-applicable";
  });

  afterEach(cleanup);

  it("protege a rota temporária de diagnóstico", () => {
    render(
      <MemoryRouter initialEntries={["/firebase-test"]}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByText("Login administrativo")).toBeInTheDocument();
    expect(screen.queryByText("Diagnóstico privado")).not.toBeInTheDocument();
  });

  it("libera o diagnóstico somente para administrador autorizado", () => {
    authMock.value.user = {
      uid: "administrador-1",
      isAnonymous: false,
    };
    authMock.value.isAdministrator = true;
    authMock.value.administratorAuthorizationStatus = "authorized";

    render(
      <MemoryRouter initialEntries={["/firebase-test"]}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByText("Diagnóstico privado")).toBeInTheDocument();
  });

  it("protege a rota da sala de espera", () => {
    render(
      <MemoryRouter initialEntries={["/gerenciar/sala/ABC234"]}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByText("Login administrativo")).toBeInTheDocument();
    expect(screen.queryByText("Sala administrativa")).not.toBeInTheDocument();
  });

  it("protege a biblioteca de salas arquivadas", () => {
    render(
      <MemoryRouter initialEntries={["/gerenciar/salas-arquivadas"]}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByText("Login administrativo")).toBeInTheDocument();
    expect(screen.queryByText("Salas arquivadas")).not.toBeInTheDocument();
  });

  it("protege a biblioteca de quizzes", () => {
    render(
      <MemoryRouter initialEntries={["/admin/quizzes"]}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByText("Login administrativo")).toBeInTheDocument();
    expect(screen.queryByText("Biblioteca de quizzes")).not.toBeInTheDocument();
  });

  it("abre a apresentação pública pela raiz com o código da sala", () => {
    render(
      <MemoryRouter initialEntries={["/?room=ABC234"]}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByText("Apresentação")).toBeInTheDocument();
    expect(screen.queryByText("Página inicial")).not.toBeInTheDocument();
  });
});
