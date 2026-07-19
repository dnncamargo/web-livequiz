import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { readFile } from "node:fs/promises";
import {
  child,
  get,
  ref,
  serverTimestamp,
  set,
  update,
  type Database,
} from "firebase/database";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

const projectId = "demo-quizumba";
const databaseUrl = `http://127.0.0.1:9000?ns=${projectId}`;
const connectionId = "-0123456789ABCDE_fgh";
let testEnvironment: RulesTestEnvironment;

function participantDatabase(participantId: string): Database {
  return testEnvironment
    .authenticatedContext(participantId, {
      firebase: { sign_in_provider: "anonymous" },
    })
    .database(databaseUrl);
}

async function seedParticipant(participantId = "participante-1") {
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    await update(ref(context.database(databaseUrl)), {
      "liveGames/sala-1/phase": "waiting",
      [`liveGames/sala-1/participants/${participantId}`]: {
        moderationStatus: "approved",
      },
    });
  });
}

describe("regras do Realtime Database", () => {
  beforeAll(async () => {
    testEnvironment = await initializeTestEnvironment({
      projectId,
      database: {
        host: "127.0.0.1",
        port: 9000,
        rules: await readFile("database.rules.json", "utf8"),
      },
    });
  });

  beforeEach(async () => {
    await testEnvironment.clearDatabase();
  });

  afterAll(async () => {
    await testEnvironment.cleanup();
  });

  it("permite leitura pública somente da projeção pública", async () => {
    await testEnvironment.withSecurityRulesDisabled(async (context) => {
      const database = context.database(databaseUrl);
      await set(ref(database, "publicGames/sala-1"), {
        phase: "waiting",
        title: "Quiz de ciências",
      });
      await set(ref(database, "liveGames/sala-1/phase"), "waiting");
    });

    const anonymousDatabase = testEnvironment
      .unauthenticatedContext()
      .database(databaseUrl);

    await assertSucceeds(get(ref(anonymousDatabase, "publicGames/sala-1")));
    await assertFails(get(ref(anonymousDatabase, "liveGames/sala-1")));
    await assertFails(
      set(ref(anonymousDatabase, "publicGames/sala-1/phase"), "finished"),
    );
  });

  it("permite que o participante publique somente a própria conexão", async () => {
    await seedParticipant();
    const database = participantDatabase("participante-1");
    const connectionReference = ref(
      database,
      `liveGames/sala-1/participants/participante-1/presence/connections/${connectionId}`,
    );

    await assertSucceeds(
      set(connectionReference, {
        connectedAt: serverTimestamp(),
        lastSeenAt: serverTimestamp(),
      }),
    );
    await assertSucceeds(
      get(
        ref(database, "liveGames/sala-1/participants/participante-1/presence"),
      ),
    );
  });

  it("bloqueia novas conexões quando a apresentação foi finalizada", async () => {
    await seedParticipant();
    await testEnvironment.withSecurityRulesDisabled(async (context) => {
      await set(
        ref(context.database(databaseUrl), "liveGames/sala-1/phase"),
        "finished",
      );
    });
    const database = participantDatabase("participante-1");

    await assertFails(
      set(
        ref(
          database,
          `liveGames/sala-1/participants/participante-1/presence/connections/${connectionId}`,
        ),
        {
          connectedAt: serverTimestamp(),
          lastSeenAt: serverTimestamp(),
        },
      ),
    );
  });

  it.each(["countdown", "question", "revealing"])(
    "mantém a presença durante a fase ativa %s",
    async (phase) => {
      await seedParticipant();
      await testEnvironment.withSecurityRulesDisabled(async (context) => {
        await set(
          ref(context.database(databaseUrl), "liveGames/sala-1/phase"),
          phase,
        );
      });
      const database = participantDatabase("participante-1");
      const connectionReference = ref(
        database,
        `liveGames/sala-1/participants/participante-1/presence/connections/${connectionId}`,
      );

      await assertSucceeds(
        set(connectionReference, {
          connectedAt: serverTimestamp(),
          lastSeenAt: serverTimestamp(),
        }),
      );
      await assertSucceeds(
        update(connectionReference, { lastSeenAt: serverTimestamp() }),
      );
    },
  );

  it("permite que o participante acompanhe somente a própria moderação", async () => {
    await seedParticipant("participante-1");
    await seedParticipant("participante-2");
    const database = participantDatabase("participante-1");

    await assertSucceeds(
      get(
        ref(
          database,
          "liveGames/sala-1/participants/participante-1/moderationStatus",
        ),
      ),
    );
    await assertFails(
      get(
        ref(
          database,
          "liveGames/sala-1/participants/participante-2/moderationStatus",
        ),
      ),
    );
    await assertFails(
      get(ref(database, "liveGames/sala-1/participants/participante-1")),
    );
  });

  it("impede que o participante leia respostas privadas ou altere pontuação", async () => {
    await seedParticipant("participante-1");
    const database = participantDatabase("participante-1");

    await assertFails(
      set(ref(database, "liveGames/sala-1/answers/pergunta-1/participante-1"), {
        questionId: "pergunta-1",
        selectedOptionIds: ["opcao-a"],
        answeredAt: Date.now(),
        isCorrect: true,
        pointsAwarded: 10_000,
      }),
    );
    await assertFails(
      set(
        ref(database, "liveGames/sala-1/participantScores/participante-1"),
        10_000,
      ),
    );
    await assertFails(
      get(ref(database, "liveGames/sala-1/answers/pergunta-1/participante-1")),
    );
  });

  it("bloqueia escrita por outro participante", async () => {
    await seedParticipant("participante-1");
    const attackerDatabase = participantDatabase("participante-2");

    await assertFails(
      set(
        ref(
          attackerDatabase,
          `liveGames/sala-1/participants/participante-1/presence/connections/${connectionId}`,
        ),
        {
          connectedAt: serverTimestamp(),
          lastSeenAt: serverTimestamp(),
        },
      ),
    );
    await assertFails(
      get(
        ref(
          attackerDatabase,
          "liveGames/sala-1/participants/participante-1/presence",
        ),
      ),
    );
  });

  it("bloqueia presença para participante ainda inexistente", async () => {
    const database = participantDatabase("participante-1");

    await assertFails(
      set(
        ref(
          database,
          `liveGames/sala-1/participants/participante-1/presence/connections/${connectionId}`,
        ),
        {
          connectedAt: serverTimestamp(),
          lastSeenAt: serverTimestamp(),
        },
      ),
    );
  });

  it("impede que o participante altere nickname, moderação ou pontuação", async () => {
    await seedParticipant();
    const database = participantDatabase("participante-1");
    const participantPath = "liveGames/sala-1/participants/participante-1";

    await assertFails(
      update(ref(database, participantPath), {
        nickname: "Nickname adulterado",
        moderationStatus: "approved",
        score: 999_999,
      }),
    );
  });

  it("rejeita campos não previstos na conexão", async () => {
    await seedParticipant();
    const database = participantDatabase("participante-1");

    await assertFails(
      set(
        ref(
          database,
          `liveGames/sala-1/participants/participante-1/presence/connections/${connectionId}`,
        ),
        {
          connectedAt: serverTimestamp(),
          lastSeenAt: serverTimestamp(),
          score: 999_999,
        },
      ),
    );
  });

  it("rejeita uma chave de conexão que não foi gerada por push", async () => {
    await seedParticipant();
    const database = participantDatabase("participante-1");

    await assertFails(
      set(
        ref(
          database,
          "liveGames/sala-1/participants/participante-1/presence/connections/conexao-manual",
        ),
        {
          connectedAt: serverTimestamp(),
          lastSeenAt: serverTimestamp(),
        },
      ),
    );
  });

  it("permite remover uma conexão e registrar a desconexão", async () => {
    await seedParticipant();
    const database = participantDatabase("participante-1");
    const presenceReference = ref(
      database,
      "liveGames/sala-1/participants/participante-1/presence",
    );

    await assertSucceeds(
      set(child(presenceReference, `connections/${connectionId}`), {
        connectedAt: serverTimestamp(),
        lastSeenAt: serverTimestamp(),
      }),
    );

    await assertSucceeds(
      update(presenceReference, {
        [`connections/${connectionId}`]: null,
        lastDisconnectedAt: serverTimestamp(),
      }),
    );
  });

  it("bloqueia uma conta Google mesmo que o UID coincida", async () => {
    await seedParticipant();
    const googleDatabase = testEnvironment
      .authenticatedContext("participante-1", {
        firebase: { sign_in_provider: "google.com" },
      })
      .database(databaseUrl);

    await assertFails(
      set(
        ref(
          googleDatabase,
          `liveGames/sala-1/participants/participante-1/presence/connections/${connectionId}`,
        ),
        {
          connectedAt: serverTimestamp(),
          lastSeenAt: serverTimestamp(),
        },
      ),
    );
    await assertFails(
      get(
        ref(
          googleDatabase,
          "liveGames/sala-1/participants/participante-1/moderationStatus",
        ),
      ),
    );
  });

  it("bloqueia a reconexão de um participante removido", async () => {
    await testEnvironment.withSecurityRulesDisabled(async (context) => {
      await update(ref(context.database(databaseUrl)), {
        "liveGames/sala-1/phase": "waiting",
        "liveGames/sala-1/participants/participante-1": {
          moderationStatus: "removed",
        },
      });
    });

    const database = participantDatabase("participante-1");

    await assertFails(
      set(
        ref(
          database,
          `liveGames/sala-1/participants/participante-1/presence/connections/${connectionId}`,
        ),
        {
          connectedAt: serverTimestamp(),
          lastSeenAt: serverTimestamp(),
        },
      ),
    );
  });
});
