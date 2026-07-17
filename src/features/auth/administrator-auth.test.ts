import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  checkAdministratorAuthorization,
  signInAdministratorWithGoogle,
} from "./administrator-auth";

const firebaseMocks = vi.hoisted(() => ({
  auth: { name: "auth" },
  db: { name: "firestore" },
  documentReference: { path: "administrators/administrador-1" },
  ensureAuthLocalPersistence: vi.fn(),
  setCustomParameters: vi.fn(),
  signInWithPopup: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn(),
}));

vi.mock("../../lib/firebase", () => ({
  auth: firebaseMocks.auth,
  db: firebaseMocks.db,
}));

vi.mock("./participant-auth", () => ({
  ensureAuthLocalPersistence: firebaseMocks.ensureAuthLocalPersistence,
}));

vi.mock("firebase/auth", () => {
  class GoogleAuthProvider {
    static readonly PROVIDER_ID = "google.com";

    setCustomParameters(parameters: Record<string, string>) {
      firebaseMocks.setCustomParameters(parameters);
    }
  }

  return {
    GoogleAuthProvider,
    signInWithPopup: firebaseMocks.signInWithPopup,
  };
});

vi.mock("firebase/firestore", () => ({
  doc: firebaseMocks.doc,
  getDoc: firebaseMocks.getDoc,
}));

type TestIdentity = Parameters<typeof checkAdministratorAuthorization>[0];

function createIdentity(overrides: Partial<TestIdentity> = {}): TestIdentity {
  return {
    uid: "administrador-1",
    email: "admin@example.com",
    isAnonymous: false,
    providerData: [{ providerId: "google.com" }],
    ...overrides,
  };
}

function mockProfile(data: unknown, exists = true) {
  firebaseMocks.getDoc.mockResolvedValue({
    exists: () => exists,
    data: () => data,
  });
}

describe("autenticação e autorização administrativa", () => {
  beforeEach(() => {
    firebaseMocks.ensureAuthLocalPersistence
      .mockReset()
      .mockResolvedValue(undefined);
    firebaseMocks.setCustomParameters.mockReset();
    firebaseMocks.signInWithPopup.mockReset();
    firebaseMocks.doc
      .mockReset()
      .mockReturnValue(firebaseMocks.documentReference);
    firebaseMocks.getDoc.mockReset();
  });

  it("abre o login Google com persistência local e seleção de conta", async () => {
    const administrator = { uid: "administrador-1" };
    firebaseMocks.signInWithPopup.mockResolvedValue({ user: administrator });

    await expect(signInAdministratorWithGoogle()).resolves.toBe(administrator);

    expect(firebaseMocks.ensureAuthLocalPersistence).toHaveBeenCalledOnce();
    expect(firebaseMocks.setCustomParameters).toHaveBeenCalledWith({
      prompt: "select_account",
    });
    expect(firebaseMocks.signInWithPopup).toHaveBeenCalledWith(
      firebaseMocks.auth,
      expect.anything(),
    );
  });

  it("autoriza uma conta Google com perfil ativo e e-mail correspondente", async () => {
    mockProfile({ active: true, email: "ADMIN@example.com" });

    await expect(
      checkAdministratorAuthorization(createIdentity()),
    ).resolves.toEqual({ authorized: true });
    expect(firebaseMocks.doc).toHaveBeenCalledWith(
      firebaseMocks.db,
      "administrators",
      "administrador-1",
    );
  });

  it("nega uma conta que não usa o provedor Google", async () => {
    await expect(
      checkAdministratorAuthorization(
        createIdentity({ providerData: [{ providerId: "password" }] }),
      ),
    ).resolves.toEqual({
      authorized: false,
      reason: "not-google-user",
    });
    expect(firebaseMocks.getDoc).not.toHaveBeenCalled();
  });

  it("nega quando o perfil administrativo não existe", async () => {
    mockProfile(undefined, false);

    await expect(
      checkAdministratorAuthorization(createIdentity()),
    ).resolves.toEqual({
      authorized: false,
      reason: "profile-not-found",
    });
  });

  it.each([
    [{ active: false }, "inactive-profile"],
    [{ active: "sim" }, "invalid-profile"],
    [{ active: true, email: "outra@example.com" }, "email-mismatch"],
  ])("nega um perfil inválido %#", async (profile, reason) => {
    mockProfile(profile);

    await expect(
      checkAdministratorAuthorization(createIdentity()),
    ).resolves.toEqual({ authorized: false, reason });
  });
});
