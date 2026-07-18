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
- criação segura de salas nomeadas pela API da Vercel;
- nome, código público de seis caracteres e rota administrativa recuperável
  após atualização da página;
- entrada do participante com código e nickname validado pelo servidor;
- restauração da participação após atualização da página e ativação da
  presença somente depois do registro seguro na sala;
- bloqueio de nicknames duplicados e publicação apenas da contagem de
  participantes no estado público;
- recuperação da sala de espera ativa ao retornar ao gerenciamento;
- biblioteca administrativa com múltiplas salas disponíveis e criação sempre
  acessível;
- ações distintas para apresentar, encerrar a apresentação e arquivar a sala,
  separadas da saída da conta Google;
- arquivo permanente no Firestore, com restauração confirmada e exclusão
  definitiva confirmada em uma página própria;
- lista privada de participantes atualizada no painel administrativo assim que
  a contagem pública muda, com verificação periódica como contingência;
- remoção administrativa com confirmação, encerramento das conexões ativas e
  aviso em tempo real no dispositivo removido;
- link de entrada que identifica e preenche automaticamente o código da sala
  para o participante;
- saída voluntária do participante que limpa a participação local e retorna
  diretamente ao formulário de código e nickname.

A escolha de avatar e a aprovação da entrada serão implementadas nos próximos
marcos definidos em `AGENTS.md`. As funcionalidades de quizzes e partida
continuam previstas para as etapas posteriores.

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
NODE_OPTIONS=--experimental-require-module
```

Os três primeiros valores vêm da conta de serviço do projeto Firebase. A URL do
banco é a URL completa da instância do Realtime Database. Ao colar a chave
privada na Vercel, preserve o conteúdo completo, inclusive o cabeçalho e o
rodapé.

`NODE_OPTIONS` é uma configuração de runtime da função, não um segredo nem uma
variável do frontend. Ela é necessária na Vercel para a interoperabilidade das
dependências administrativas atuais com módulos ES. Aplique-a aos mesmos
ambientes das variáveis `FIREBASE_ADMIN_*` e faça um novo deploy.

## Entrada de participantes

A função `/api/participants` aceita somente tokens de autenticação anônima do
Firebase. Ela valida o código e o nickname, cria o registro privado em
`liveGames/{gameId}/participants/{uid}` e atualiza apenas `participantCount` na
projeção pública.

O navegador guarda somente o código da sala ativa. Ao atualizar a página, o
registro é consultado novamente no servidor pelo UID anônimo; nickname, status
de moderação e pontuação não podem ser alterados diretamente pelo cliente.

A consulta `GET /api/games` é exclusiva para administradores autorizados. Com
`scope=library`, ela recupera as salas disponíveis pertencentes ao
administrador; com `scope=archived`, recupera as salas arquivadas; com
`gameId`, retorna uma sala e sua lista privada de participantes. Essa lista não
é copiada para `publicGames`.

A operação autenticada `PATCH /api/games` remove um participante somente quando
a sala pertence ao administrador solicitante. A remoção marca o registro como
removido, encerra suas conexões e atualiza apenas a contagem pública.

A mesma função controla o ciclo de vida somente após confirmar a propriedade.
Criar produz uma sala inicialmente finalizada; **Apresentar** ativa novas
entradas; **Encerrar** finaliza somente a apresentação, desconecta os
participantes e preserva a sala; **Arquivar** move seus metadados para a coleção
privada `archivedWaitingRooms` do Firestore e remove o estado transitório do
Realtime Database. Restaurar recria a sala finalizada, sem participantes
conectados. Excluir apaga definitivamente o documento arquivado. Sair da conta
administrativa não altera nenhuma sala.

Criar, Apresentar e Arquivar são ações diretas. Encerrar, Restaurar e Excluir
exigem confirmação na interface.

O link `/?sala=CODIGO` confirma publicamente a sala ativa e preenche o código
de entrada. Como o Firebase mantém uma identidade por perfil do navegador, use
uma janela anônima, outro perfil ou outro dispositivo para testar o participante
sem encerrar a sessão administrativa.

## Diagnóstico de conexões

A rota administrativa `/firebase-test` executa verificações independentes de
rede, sessão Google, token, Firestore, Realtime Database, função da Vercel e
Firebase Admin. A verificação do servidor usa `/api/diagnostics` e retorna
orientações seguras por camada, sem revelar credenciais.

O diagnóstico é somente leitura: ele não cria documentos, participantes ou
salas. Para verificar a configuração efetivamente publicada, execute-o no
deploy da Vercel após entrar com uma conta administrativa.

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
temporária `connectionTests`. A coleção `archivedWaitingRooms` permanece
inacessível ao navegador e é manipulada somente pela API autorizada com o
Firebase Admin SDK.

No Realtime Database:

- `publicGames/{gameId}` permite somente leitura pública e nunca recebe dados
  administrativos, respostas individuais ou a alternativa correta antes da
  revelação;
- `liveGames/{gameId}` permanece privado;
- `liveGames` possui somente um índice de servidor por `ownerId`, sem conceder
  leitura ao navegador, para montar a biblioteca administrativa;
- um participante anônimo pode manter apenas as próprias conexões e somente
  depois que seu registro tiver sido criado e enquanto a apresentação estiver
  ativa;
- esse participante pode ler apenas o próprio `moderationStatus`, necessário
  para receber em tempo real o aviso de remoção, sem acesso ao restante do
  registro privado;
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
