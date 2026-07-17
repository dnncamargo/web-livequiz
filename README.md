# Quizumba

Aplicação web de quiz competitivo em tempo real para ambientes educacionais.

## Estado atual

Os marcos iniciais de identidade, acesso e conexão em tempo real estão
implementados:

- autenticação anônima persistente para participantes;
- autenticação administrativa com Google;
- autorização administrativa por perfil ativo no Firestore;
- proteção das rotas de gestão com negação por padrão;
- inicialização do Realtime Database pela configuração `VITE_*`;
- contratos compartilhados de fases, cronômetro e presença;
- presença por aba com `onDisconnect`, heartbeat e tolerância a desconexões
  breves;
- projeção pública separada do estado privado da partida.

A presença está preparada para ser ativada pela sala de espera, que será
responsável por criar o registro privado do participante antes da conexão. As
funcionalidades de sala, quizzes e partida serão implementadas nos próximos
marcos definidos em `AGENTS.md`.

## Requisitos

- Node.js 22 ou superior;
- projeto Firebase com Authentication, Firestore e Realtime Database;
- provedores **Anônimo** e **Google** habilitados no Firebase Authentication.

Para executar os testes locais das regras do Realtime Database também é
necessário ter um Java Runtime 21 ou superior disponível no `PATH`.

## Configuração local

Copie `.env.example` para `.env.local` e preencha apenas a configuração web
pública do Firebase. Nunca use service account, chave privada ou credencial
administrativa no frontend.

```text
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
VITE_FIREBASE_DATABASE_URL
```

## Cadastrar um administrador

1. Entre uma vez com a conta Google para que ela apareça no Firebase
   Authentication.
2. Consulte o UID da conta no console do Firebase.
3. No Firestore, crie manualmente o documento `administrators/{uid}`.
4. Adicione os campos:

```json
{
  "active": true,
  "email": "administrador@example.com"
}
```

O campo `email` é opcional, mas, quando informado, deve corresponder ao e-mail
da conta Google. Para revogar o acesso, altere `active` para `false` ou remova o
documento.

As regras não permitem criar, alterar ou excluir esse perfil pelo navegador.
Faça o provisionamento pelo console do Firebase ou por um ambiente
administrativo confiável.

## Regras Firebase

Os arquivos `firestore.rules`, `database.rules.json` e `storage.rules` usam
negação por padrão. No Firestore, apenas uma conta Google pode ler o próprio
perfil administrativo, e somente administradores ativos acessam a coleção
temporária `connectionTests`.

No Realtime Database:

- `publicGames/{gameId}` permite somente leitura pública e nunca recebe dados
  administrativos, respostas individuais ou a alternativa correta antes da
  revelação;
- `liveGames/{gameId}` permanece privado;
- um participante anônimo pode manter apenas as próprias conexões e somente
  depois que seu registro tiver sido criado na partida;
- a identificação de cada aba impede que uma desconexão remova a presença das
  demais abas.

As regras administrativas do estado privado continuam fechadas até existir um
controlador confiável ou custom claims. Conceder escrita a qualquer conta Google
não é uma alternativa segura.

Com a Firebase CLI autenticada no projeto correto, publique as regras com:

```bash
firebase deploy --only firestore:rules,database,storage
```

## Scripts

```bash
npm run dev
npm run format
npm run lint
npm run test:run
npm run test:rules
npm run build
```

`npm run test:rules` inicia somente o emulador local do Realtime Database com o
projeto fictício `demo-quizumba`; ele não acessa nem altera o banco de produção.

O deploy da aplicação web é feito pela Vercel. As regras e serviços de dados
continuam sendo gerenciados pelo Firebase.
