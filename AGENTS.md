# Quizumba — Instruções para o Codex

## 1. Visão geral

Quizumba é uma aplicação web de quiz competitivo em tempo real, inspirada na dinâmica de plataformas como Kahoot.

O sistema será utilizado em ambiente educacional e terá:

* participantes usando Chromebooks, computadores ou celulares;
* um painel administrativo para criação e gerenciamento de quizzes;
* uma tela de controle da partida;
* uma apresentação moderna;
* uma apresentação legacy compatível com Chrome 81;
* sincronização em tempo real pelo Firebase;
* deploy na Vercel;
* código versionado no GitHub.

O idioma da interface e do código explicativo é português do Brasil.

---

## 2. Tecnologias principais

Utilize:

* React;
* TypeScript em modo estrito;
* Vite;
* React Router;
* Firebase Authentication;
* Cloud Firestore;
* Firebase Realtime Database;
* Firebase Storage quando necessário;
* Zustand para estado local;
* React Hook Form;
* Zod;
* GSAP para animações modernas;
* Howler.js para áudio;
* CSS organizado;
* Vitest;
* React Testing Library;
* Playwright;
* ESLint;
* Prettier;
* Vercel.

Não introduza outro framework ou biblioteca sem necessidade técnica clara.

---

## 3. Ambientes suportados

### Aplicação moderna

As páginas modernas poderão usar APIs e ferramentas atuais:

* participante;
* login;
* gerenciamento;
* editor de quizzes;
* controle de partida;
* apresentação moderna.

Navegadores esperados:

* Chrome atualizado;
* Firefox atualizado;
* navegadores mobile atuais;
* ChromeOS atualizado.

### Apresentação legacy

A apresentação legacy será utilizada exclusivamente em uma tela interativa Intelbras com Chrome 81.

A versão legacy:

* não exige login;
* apenas lê o estado público da partida;
* deve ser compilada separadamente;
* deve evitar APIs incompatíveis com Chrome 81;
* deve evitar efeitos gráficos excessivamente pesados;
* deve priorizar `transform` e `opacity`;
* deve continuar visualmente coerente com a apresentação moderna;
* não deve conter dados privados nem funções administrativas.

Não limite toda a aplicação ao Chrome 81.

---

## 4. Rotas previstas

```text
/                         Participante
/login                    Login administrativo
/gerenciar                Página inicial da gestão
/gerenciar/quizzes        Lista de quizzes
/gerenciar/quiz/:id       Editor de quiz
/gerenciar/sala/:id       Controle de uma partida
/apresentacao             Apresentação moderna
/apresentacao-legacy      Apresentação para Chrome 81
/firebase-test            Diagnóstico temporário
```

A rota `/gerenciar` e suas subrotas devem exigir autenticação administrativa.

As rotas de apresentação não exigem login.

---

## 5. Estrutura recomendada

```text
src/
├── app/
│   ├── App.tsx
│   └── routes.tsx
├── components/
├── contexts/
├── features/
│   ├── auth/
│   ├── quizzes/
│   ├── live-game/
│   ├── participants/
│   ├── ranking/
│   └── presentation/
├── hooks/
├── lib/
│   ├── firebase.ts
│   └── env.ts
├── pages/
├── shared/
│   ├── types/
│   ├── schemas/
│   ├── constants/
│   └── utils/
├── presentation-legacy/
│   ├── components/
│   ├── LegacyPresentation.tsx
│   ├── legacy-main.tsx
│   └── legacy.css
├── styles/
├── main.tsx
└── vite-env.d.ts
```

Organize código por domínio sempre que uma funcionalidade possuir vários arquivos relacionados.

Não transforme `components/`, `hooks/` ou `utils/` em pastas genéricas com arquivos sem relação entre si.

---

## 6. Arquitetura de dados

### Cloud Firestore

Use o Firestore para dados permanentes:

* quizzes;
* perguntas;
* alternativas;
* configurações;
* usuários administradores;
* histórico de partidas;
* resultados finais;
* arquivos arquivados;
* metadados editoriais.

### Realtime Database

Use o Realtime Database para dados transitórios e sincronização:

* partida ativa;
* fase atual;
* participantes conectados;
* presença;
* pergunta atual;
* cronômetro;
* respostas recebidas;
* ranking temporário;
* estado da apresentação;
* comandos do gerenciador.

Não use o Firestore para atualizações muito frequentes de cronômetro ou presença.

---

## 7. Separação do estado público e privado

A apresentação sem login nunca deve ler diretamente o estado administrativo completo.

Mantenha uma projeção pública separada, por exemplo:

```text
publicGames/{gameId}
```

Essa área poderá conter:

* título do quiz;
* fase atual;
* pergunta exibida;
* alternativas visíveis;
* tempo da pergunta;
* quantidade de respostas;
* ranking público;
* pódio;
* resultado revelado.

Ela não poderá conter:

* e-mail de administrador;
* UID administrativo;
* resposta correta antes da revelação;
* respostas individuais;
* dados privados dos participantes;
* comandos administrativos;
* tokens;
* credenciais;
* informações internas de pontuação.

A alternativa correta só pode entrar no estado público durante a fase de revelação.

---

## 8. Fases da partida

Use um tipo compartilhado equivalente a:

```ts
export type LiveGamePhase =
  | "waiting"
  | "countdown"
  | "question"
  | "revealing"
  | "ranking"
  | "podium"
  | "finished";
```

Todas as telas devem interpretar os mesmos estados.

Não use textos livres para representar fases da partida.

---

## 9. Autenticação

### Participantes

Use autenticação anônima do Firebase.

Cada navegador participante recebe um UID anônimo.

Depois da autenticação, o usuário escolhe:

* nickname;
* avatar.

O navegador deve conseguir recuperar sua participação após atualização da página.

### Administradores

Use autenticação Google.

Não considere qualquer conta Google automaticamente administradora.

A autorização administrativa deve ser verificada por uma lista segura, documento de perfil ou custom claim.

Esconder a interface não substitui regras de segurança.

---

## 10. Pontuação

O participante envia apenas sua resposta.

Não confie em pontuação calculada pelo navegador do participante.

A pontuação definitiva deve ser calculada em ambiente confiável ou por operação administrativa validada.

A resposta deve registrar, quando necessário:

```ts
interface SubmittedAnswer {
  participantId: string;
  questionId: string;
  selectedOptionIds: string[];
  answeredAt: number;
}
```

O servidor ou controlador seguro determina:

* acerto;
* erro;
* tempo utilizado;
* pontuação;
* bônus;
* posição;
* alteração no ranking.

---

## 11. Cronometragem

Não utilize um contador local decrementado como fonte oficial.

Grave um instante de início e uma duração:

```ts
interface QuestionTiming {
  startedAt: number;
  durationMs: number;
}
```

Cada cliente calcula o tempo restante com base nesses valores.

O gerenciador controla a mudança oficial de fase.

A pergunta poderá ser encerrada quando:

* o tempo terminar;
* todos os participantes ativos responderem;
* o gerenciador encerrar manualmente.

---

## 12. Presença

A presença deve distinguir:

* aguardando aprovação;
* aprovado;
* conectado;
* reconectando;
* temporariamente desconectado;
* ausente;
* removido.

Não remova imediatamente um participante por uma desconexão breve.

Use os recursos de presença e desconexão do Realtime Database.

---

## 13. Tipos iniciais de pergunta

Comece com:

```ts
export type QuestionType =
  | "single-choice"
  | "true-false";
```

A arquitetura deve permitir futuramente:

* múltiplas respostas;
* resposta textual;
* enquete;
* ordenação;
* imagem como alternativa.

Não implemente antecipadamente tipos ainda não solicitados.

---

## 14. Apresentações

### Componentes compartilhados

Sempre que possível, compartilhe:

* tipos;
* interpretação do estado;
* cálculos de cronômetro;
* ordenação de ranking;
* dados das perguntas;
* utilitários;
* constantes.

### Componentes separados

As interfaces moderna e legacy podem possuir componentes visuais diferentes.

Não importe componentes modernos pesados dentro do bundle legacy.

### Apresentação moderna

Pode utilizar:

* GSAP;
* filtros;
* gradientes;
* animações elaboradas;
* efeitos de partículas;
* recursos atuais de CSS.

### Apresentação legacy

Deve:

* usar CSS conservador;
* evitar `backdrop-filter` como recurso essencial;
* evitar efeitos intensos de blur;
* evitar animações de propriedades de layout;
* evitar dependências desnecessárias;
* priorizar desempenho;
* oferecer fallback visual;
* ser testada pelo build de produção.

---

## 15. Áudio

Use Howler.js na aplicação moderna.

O áudio só deve começar depois de uma interação do usuário.

A apresentação deve possuir uma ação inicial equivalente a:

```text
Ativar som e iniciar apresentação
```

Pré-carregue apenas os sons necessários para a fase atual ou próxima.

Sempre ofereça:

* controle de volume;
* opção de silenciar;
* tratamento de falha de carregamento;
* fallback sem áudio.

---

## 16. Firebase

O arquivo de inicialização deve ficar em:

```text
src/lib/firebase.ts
```

As configurações públicas devem vir de variáveis `VITE_*`.

Nunca coloque no frontend:

* service account;
* private key;
* segredo de API administrativa;
* token permanente;
* credencial de servidor.

A configuração web do Firebase não substitui regras de segurança.

---

## 17. Variáveis de ambiente

Variáveis esperadas:

```text
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
VITE_FIREBASE_DATABASE_URL
```

Mantenha um `.env.example` sem valores reais.

Nunca altere ou exponha `.env.local`.

Antes de adicionar uma nova variável:

1. verificar se ela é realmente necessária;
2. adicioná-la ao `vite-env.d.ts`;
3. adicioná-la ao `.env.example`;
4. documentar sua finalidade;
5. nunca inserir segredos administrativos no frontend.

---

## 18. Regras do Firebase

As regras devem permanecer versionadas no repositório.

Arquivos esperados:

```text
firestore.rules
database.rules.json
storage.rules
firebase.json
```

Não abra o banco inteiro com regras equivalentes a:

```text
allow read, write: if true;
```

Uma regra pública deve ser limitada a caminhos e operações específicas.

A coleção temporária `connectionTests` deve ser removida ou protegida depois que a autenticação estiver validada.

---

## 19. TypeScript

Use TypeScript estrito.

Evite:

* `any`;
* casts desnecessários;
* tipos duplicados;
* objetos sem contrato;
* strings livres para status;
* acesso inseguro a dados do Firebase.

Valide dados externos com Zod.

Prefira:

```ts
unknown
```

em vez de:

```ts
any
```

Faça narrowing antes de utilizar dados externos.

---

## 20. React

Utilize componentes funcionais.

Evite:

* componentes excessivamente grandes;
* efeitos com responsabilidades diferentes;
* estado duplicado;
* sincronização manual desnecessária;
* chamadas Firebase diretamente espalhadas pela interface;
* lógica de negócio dentro do JSX.

Extraia serviços, hooks ou módulos de domínio quando necessário.

Não aplique memoização indiscriminadamente.

---

## 21. CSS e design

O Quizumba terá identidade visual:

* chamativa;
* energética;
* divertida;
* legível;
* adequada à projeção;
* adequada a crianças e adolescentes;
* responsiva;
* sem copiar diretamente a aparência de outra plataforma.

Priorize:

* alto contraste;
* textos grandes;
* alternativas claramente distinguíveis;
* áreas de toque grandes;
* feedback visual imediato;
* legibilidade à distância;
* redução de movimento quando solicitada pelo sistema.

Evite:

* excesso de texto;
* botões pequenos;
* animações que escondam informações importantes;
* cores como único indicador de estado.

---

## 22. Acessibilidade

Inclua:

* foco visível;
* navegação por teclado;
* labels;
* estados `aria-*` quando necessários;
* texto alternativo;
* contraste suficiente;
* suporte a `prefers-reduced-motion`;
* feedback textual além de cor.

Não remova outline sem fornecer substituto.

---

## 23. Testes

Use:

* Vitest para funções e regras de domínio;
* React Testing Library para componentes;
* Playwright para fluxos entre múltiplas telas.

Teste especialmente:

* cálculo de pontuação;
* ordenação de ranking;
* empates;
* cronômetro;
* mudança de fase;
* bloqueio de resposta duplicada;
* reconexão;
* proteção administrativa;
* ausência da resposta correta no estado público;
* sincronização entre gerenciador e apresentações;
* compatibilidade do build legacy.

---

## 24. Comandos obrigatórios

Antes de considerar uma alteração concluída, execute:

```bash
npm run format
npm run lint
npm run test:run
npm run build
```

Caso algum script ainda não exista, verifique `package.json` antes de inventar comandos.

Não afirme que um teste passou se ele não foi executado.

Informe claramente qualquer teste que não tenha sido possível executar.

---

## 25. Git

Faça alterações pequenas e relacionadas.

Não altere arquivos sem relação com a tarefa.

Não reescreva componentes existentes sem necessidade.

Não use comandos destrutivos, como:

```bash
git reset --hard
git clean -fd
git checkout -- .
```

Não descarte alterações do usuário.

Antes de editar:

1. examine os arquivos relacionados;
2. verifique alterações existentes;
3. entenda o padrão já utilizado;
4. preserve decisões anteriores.

Mensagens sugeridas:

```text
feat: add anonymous participant authentication
feat: add live game waiting room
fix: preserve participant session after reload
chore: configure Firebase emulators
test: cover ranking calculation
```

---

## 26. Arquivos que não devem ser alterados automaticamente

Não modifique, a menos que a tarefa peça explicitamente:

```text
.env
.env.local
.env.*.local
node_modules/
dist/
coverage/
playwright-report/
test-results/
.firebase/
.vercel/
package-lock.json
```

O `package-lock.json` pode ser alterado somente quando dependências forem realmente instaladas, removidas ou atualizadas.

Não edite arquivos gerados em `dist/`.

---

## 27. Segurança

Antes de concluir qualquer recurso Firebase, verifique:

* quem pode ler;
* quem pode criar;
* quem pode atualizar;
* quem pode excluir;
* quais campos podem ser enviados;
* quais dados aparecem publicamente;
* se o usuário pode alterar a própria pontuação;
* se a resposta correta pode ser descoberta antecipadamente;
* se um participante pode responder por outro;
* se um usuário comum pode executar ação administrativa.

Nunca confie apenas na interface para impedir uma ação.

---

## 28. Forma de trabalho esperada

Para cada tarefa:

1. leia este arquivo;
2. examine a estrutura atual;
3. identifique os arquivos relevantes;
4. preserve o código funcional;
5. faça a menor alteração coerente;
6. adicione tipos e validações;
7. execute os testes aplicáveis;
8. execute lint e build;
9. resuma os arquivos alterados;
10. informe pendências reais.

Quando houver ambiguidade pequena, escolha a solução mais simples e consistente com este documento.

Não implemente recursos futuros sem solicitação.

---

## 29. Prioridade atual do projeto

A sequência inicial é:

1. autenticação anônima de participantes;
2. autenticação Google de administradores;
3. autorização administrativa;
4. proteção das rotas de gestão;
5. Realtime Database;
6. presença entre múltiplas abas;
7. criação da sala de espera;
8. escolha de nickname;
9. escolha de avatar;
10. moderação da entrada;
11. modelagem de quizzes;
12. controle das fases da partida;
13. apresentação moderna;
14. apresentação legacy;
15. respostas e pontuação;
16. ranking;
17. pódio.

Trabalhe em um marco por vez.

---

## 30. Critério geral de conclusão

Uma funcionalidade só está concluída quando:

* possui comportamento implementado;
* possui tipos adequados;
* trata carregamento e erro;
* respeita as regras de segurança;
* funciona após atualizar a página;
* funciona em tela pequena;
* não quebra as rotas existentes;
* passa em lint;
* passa nos testes relacionados;
* gera build de produção.
