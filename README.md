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
- projeção pública separada do estado privado da partida;
- criação segura de salas de espera pela API da Vercel;
- código público de seis caracteres e rota administrativa recuperável após
  atualização da página.

A entrada na sala e a ativação da presença serão implementadas junto com a
escolha de nickname. As funcionalidades de quizzes e partida serão
implementadas nos próximos marcos definidos em `AGENTS.md`.

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

## Configuração administrativa na Vercel

A criação de salas é executada por uma função segura em `/api/games`. Ela
valida o token Google e o documento `administrators/{uid}` antes de usar o
Firebase Admin SDK.

Adicione estas variáveis somente nos ambientes da Vercel. Elas não podem usar o
prefixo `VITE_` nem ser expostas ao navegador:

```text
FIREBASE_ADMIN_PROJECT_ID
FIREBASE_ADMIN_CLIENT_EMAIL
FIREBASE_ADMIN_PRIVATE_KEY
FIREBASE_ADMIN_DATABASE_URL
```

Os três primeiros valores vêm da conta de serviço do projeto Firebase. A URL do
banco é a URL completa da instância do Realtime Database. Ao colar a chave
privada na Vercel, preserve o conteúdo completo, inclusive o cabeçalho e o
rodapé.

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

As regras administrativas do estado privado permanecem fechadas para clientes.
A função segura da Vercel é o controlador confiável que valida o administrador
antes de criar `liveGames/{gameId}` e sua projeção em `publicGames/{gameId}`.

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

> **Teste da criação de salas:** `npm run dev` inicia somente o frontend do
> Vite e não executa as funções da pasta `api/`. Teste esse fluxo na versão
> publicada na Vercel ou use `vercel dev` com o projeto vinculado e as variáveis
> administrativas configuradas. Nunca transforme essas variáveis em `VITE_*`.
