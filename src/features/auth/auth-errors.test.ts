import { describe, expect, it } from "vitest";
import { getAuthErrorMessage } from "./auth-errors";

describe("getAuthErrorMessage", () => {
  it("traduz erros conhecidos sem expor detalhes internos", () => {
    expect(getAuthErrorMessage({ code: "auth/network-request-failed" })).toBe(
      "Sem conexão com o serviço de autenticação. Verifique sua internet e tente novamente.",
    );
  });

  it("usa uma mensagem segura para erros desconhecidos", () => {
    expect(getAuthErrorMessage(new Error("segredo interno"))).toBe(
      "Não foi possível iniciar sua participação. Tente novamente.",
    );
  });
});
