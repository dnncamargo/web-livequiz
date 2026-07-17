const AUTH_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  "auth/network-request-failed":
    "Sem conexão com o serviço de autenticação. Verifique sua internet e tente novamente.",
  "auth/operation-not-allowed":
    "A entrada de participantes ainda não está habilitada. Avise a pessoa responsável pelo quiz.",
  "auth/too-many-requests":
    "Muitas tentativas foram feitas neste dispositivo. Aguarde um pouco e tente novamente.",
  "auth/popup-blocked":
    "O navegador bloqueou a janela de login. Permita pop-ups para o Quizumba e tente novamente.",
  "auth/popup-closed-by-user":
    "A janela de login foi fechada antes da conclusão. Tente novamente quando estiver pronto.",
  "auth/cancelled-popup-request":
    "Outra tentativa de login já está em andamento. Aguarde e tente novamente.",
  "auth/account-exists-with-different-credential":
    "Esta conta já utiliza outra forma de acesso. Entre com o método usado anteriormente.",
  "auth/unauthorized-domain":
    "Este endereço ainda não foi autorizado no Firebase Authentication.",
  "permission-denied":
    "Não foi possível consultar sua autorização administrativa.",
  unavailable:
    "O serviço de autorização está temporariamente indisponível. Tente novamente.",
  "participant/session-conflict":
    "Este dispositivo já está conectado como administrador. Encerre essa sessão antes de entrar como participante.",
};

function getErrorCode(error: unknown): string | null {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return null;
  }

  return typeof error.code === "string" ? error.code : null;
}

export function getAdministratorAuthErrorMessage(error: unknown): string {
  return getAuthErrorMessage(
    error,
    "Não foi possível fazer login com o Google. Tente novamente.",
  );
}

export function getAdministratorAuthorizationErrorMessage(
  error: unknown,
): string {
  return getAuthErrorMessage(
    error,
    "Não foi possível verificar sua autorização administrativa. Tente novamente.",
  );
}

export function getAuthErrorMessage(
  error: unknown,
  fallbackMessage = "Não foi possível iniciar sua participação. Tente novamente.",
): string {
  const errorCode = getErrorCode(error);

  return (errorCode && AUTH_ERROR_MESSAGES[errorCode]) || fallbackMessage;
}
