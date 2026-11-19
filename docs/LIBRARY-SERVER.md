# Guia de Sobrevivência (Último Livro) — servidor web para a biblioteca offline

Modo servidor web do **Último Livro** (fork brasileiro do **Lastbook**, <https://github.com/Immortal-Protocols/lastbook> / <https://lastbook.org>, enriquecido com módulos em português inspirados no **refugiOS**, <https://github.com/Ganso/refugiOS>) sobre a pasta de biblioteca (`library-data/` → a coleção real). Ele parte do que a pessoa precisa ("Alguém está ferido", "Obter água potável segura", "Faltou energia", mapa de ajuda próxima), mostra poucas páginas selecionadas com numeração exata e os limites da própria fonte, e dá acesso completo aos manuais, vídeos, enciclopédias `.zim`, tradutor offline, cofre criptografado e diagnóstico de integridade. Tudo roda localmente no computador.

## Como executar

```bash
python3 server.py
```

Depois abra `http://127.0.0.1:8890/` (ou dê duplo clique em **Open Survival Guide.command**, quando presente no pacote original, que usa o Python empacotado da biblioteca). `python3 server.py --lan` também atende celulares na mesma rede Wi-Fi (sem precisar de internet).

A interface legada original da porta 8879 permanece intocada caso rode separadamente.

## Perguntar à biblioteca (assistente de IA local / servidor de modelo)

- Modelo padrão para servidor HTTP externo: `deepseek-v4.1-flash` em `http://127.0.0.1:19443` (chamado apenas pelo servidor; pode ser sobrescrito por `SURVIVAL_MODEL_BASE`, que precisa ser um endereço loopback). O gateway 19442 não é utilizado.
- Toda pergunta passa primeiro pelo recuperador compartilhado (`retrieval.py` + consulta às enciclopédias `.zim` em português instaladas em `library-data/collections/` via `_zim_hits`); o modelo recebe cinco ferramentas somente leitura: `search_library`, `read_pages` (com suporte também a artigos `zim:<arquivo>/<rota>`), `view_page` (envia a imagem da página no modo servidor de visão), `get_timed_transcript` e `lookup_place`. As ferramentas aceitam apenas IDs do catálogo: nunca caminhos de disco, URLs nem comandos de shell. O texto das fontes é encapsulado como dado de referência não confiável.
- Citações (`[S3]`) são validadas contra o que as ferramentas realmente retornaram; chaves desconhecidas são removidas e sinalizadas. Frases sem citação aparecem com estilo diferenciado como raciocínio próprio do modelo; seções de "Não encontrado na biblioteca", "As fontes divergem" e "Raciocínio próprio" recebem estilos distintos no frontend (`web/chat.js`). A opção **Só resultado** (`hideThought`, ativada por padrão em `web/chat.js`) oculta etapas internas e raciocínios em texto puro (`llm_local.split_thinking`).
- Se o modelo estiver offline, a aba Chat informa e lista as páginas mais relevantes encontradas na busca híbrida; toda a navegação segue funcionando.
- Outros clientes locais compatíveis podem usar as mesmas ferramentas: `GET /api/tools` (schemas estilo OpenAI) e `POST /api/tool/<nome>` com argumentos JSON. Passagens híbridas: `GET /api/retrieve?q=…&k=8&kind=any|manual|video`.

## IA local opcional no aplicativo desktop (`llm_local.py`)

O aplicativo desktop pode redigir respostas e traduzir textos offline usando um dos quatro modelos GGUF suportados em `llm_local.py`:
- **Gemma 4 26B A4B** (`gemma-4-26b-a4b`, ~17 GB, 24+ GB RAM)
- **Gemma 4 E4B** (`gemma-4-e4b`, ~5 GB, 12–16 GB RAM)
- **Gemma 4 E2B** (`gemma-4-e2b`, ~3,1 GB, 8 GB RAM)
- **Qwen 3.5 0.8B** (`qwen-3.5-0.8b`, ~508 MB, 4 GB RAM, template ChatML `<|im_start|>...<|im_end|>`, inspirado no **refugiOS**)

Quando mais de um modelo está instalado em `LastbookData/models/`, o usuário pode alternar em tempo real pelo seletor no topo do Chat ou em *Biblioteca e IA* (`POST /api/assistant/local` com `{"action": "select", "model_id": "..."}`). A versão de servidor `server.py` acima continua usando o servidor HTTP em `SURVIVAL_MODEL_BASE`, a menos que seja iniciada com `LASTBOOK_LOCAL_AI=1`.

- **Executor:** `packaging/llm/lastbook_llm.cpp`, programa próprio baseado no `llama.cpp` tag `b12032` (versão avaliada nos testes de modelos compactos do upstream). Conversa em JSON lines via entrada e saída padrão, sem abrir sockets nem portas. Não inclui backend RPC nem bibliotecas comuns do llama.cpp além do cálculo de ajuste em memória (`common/fit.cpp`, equivalente ao `--fit` do llama-server) e seu log. Compile com `bash packaging/llm/build_llm_macos.sh`, que recusa binários contendo chamadas de rede ou caminhos locais de build. Prompts entram por segmentos: a marcação de template do Gemma recebe tokens especiais reconhecidos, enquanto textos da biblioteca e do usuário nunca interpretam tokens especiais — impedindo que um documento injete um turno próprio.
- **Descoberta do modelo:** busca o arquivo em `LastbookData/models/`, `LastbookData/`, `Downloads`, `Documents` ou `Desktop`. Ele é conferido uma única vez (tamanho e SHA-256, ~10 s em um Mac rápido) e medido com `lastbook-llm --measure` via llama.cpp. O uso é oferecido quando a memória do computador comporta o consumo medido mais 2,5 GiB de reserva. No Mac, GPU e CPU compartilham memória unificada; no Windows, apenas a parcela que não cabe na placa de vídeo conta contra a RAM. Não há trava rígida de 32 GB.
- **Medição de referência (Apple M3 Ultra, contexto 16k):** 16,9 GiB na GPU mais 0,8 GiB de host. Carregamento em ~1,5 s e respostas com fontes em ~5–12 s (~17,4 GB residentes).
- **Ciclo de vida:** inicia sob demanda na primeira pergunta e encerra após 15 minutos ocioso, quando desativado na página Sobre ou quando o app fecha/termina (o fechamento do pipe encerra o processo, além de um job object kill-on-close no Windows). Falhas durante uma resposta exibem mensagem clara em português e a próxima pergunta reinicia o executor.
- **Limitações:** apenas texto (sem `view_page`: o modelo local não recebe imagens de página). Na avaliação de pergunta única do projeto original (`derived/small-models/RECOMMENDATION.md` no ambiente upstream), registrou 0–1 resposta perigosa em 60 conforme o leitor.

## Serviço de busca híbrida (`retrieval.py`)

A busca por palavras-chave usa o próprio índice `search.sqlite` em FTS5/BM25 da biblioteca (somente leitura) com sinônimos e stopwords em PT-BR. A busca por significado usa `BAAI/bge-small-en-v1.5` (ONNX, do repositório oficial da BAAI no Hugging Face) executado localmente via `onnxruntime`.
Os resultados são combinados com *reciprocal-rank fusion*, ponderados por confiabilidade da fonte (`TRUST`, incluindo órgãos brasileiros como Ministério da Saúde, SUS, SAMU, Anvisa, Fiocruz, Defesa Civil, Embrapa, ANA, IBGE, ABNT e universidades públicas além das fontes originais) e bônus para correspondência exata de modelo de equipamento. Arquivos de índice: `derived/index/semantic.sqlite` + `vectors.f16` (append-only).
Atualiza incrementalmente: o servidor verifica `catalog.json` a cada 5 minutos e indexa apenas documentos e transcrições novos ou modificados (escritor único com trava de arquivo). Para atualizar manualmente:

```bash
library-data/runtime/macos-arm64/python/bin/python3 retrieval.py
```

O que o mecanismo não consegue ler é informado no aplicativo (aba Sobre e `/api/assistant/status`): vídeos sem legenda/transcrição, PDFs digitalizados apenas como imagem, quadros visuais dentro de vídeos e arquivos GIS brutos.

## Compartilhamento com celulares na mesma rede Wi-Fi

```bash
python3 server.py --lan
```

Exibe um link único `http://<ip-local>:8890/?key=…`; abri-lo grava um cookie de acesso. Sem a chave, outros dispositivos recebem `403`. Clientes na rede acessam apenas o aplicativo, APIs de leitura, enciclopédias e pastas de conteúdo (sem estado interno, logs, bancos brutos ou listagens de diretório). Loopback (`127.0.0.1`) continua funcionando normalmente. Apague `derived/lan-key` para rotacionar a chave. Nada é exposto além da rede local.

## Dependências de execução (todas locais)

No aplicativo empacotado: Python do ambiente (`packaging/requirements*.txt`), `engine/library.py` (`libzim`, `beautifulsoup4`), `pypdfium2` para renderização de páginas PDF (via `PdfBitmap.buffer` + biblioteca padrão no fork, dispensando `numpy` em runtime mínimo), e no Windows `onnxruntime` + `tokenizers`. Sem acesso à internet.

## Novos endpoints locais (inspirados no refugiOS)

- **Cofre Criptografado (`engine/vault.py`):** `GET /api/vault/list` e `POST /api/vault` (`create`, `open`, `save`, `change_password`, `delete`). Restrito a loopback (`127.0.0.1` / `::1`) por segurança, utilizando derivação PBKDF2-HMAC-SHA256 (250.000 iterações), cifra de fluxo `BLAKE2b` e autenticação `HMAC-SHA256` em `derived/vault/` (com suporte a anexos cifrados no app desktop e no servidor web até 4 MB).
- **Tradutor Offline (`engine/translator.py`):** `GET /api/translate/glossary` (guia rápido PT/EN/ES embutido) e `POST /api/translate` (tradução via IA local com cache por página em `derived/translations/`, ou fallback automático por glossário técnico).
- **Diagnóstico de Integridade (`engine/checker.py`):** `GET /api/check` (`?full=1` para recomputar SHA-256). Verifica biblioteca base, mapas estaduais, `.zim`, `.gguf`/RAM, cofres e disco, gravando `derived/logs/relatorio-verificacao.txt` (restrito a loopback).

## O que está onde

| Caminho | Função |
|---|---|
| `server.py` | Servidor principal. Subclasse do `Handler` de `engine/library.py`, preservando rotas de arquivos originais, `/api/search`, `/api/collection-search`, `/zim/...` e Range de vídeo, e adicionando endpoints de leitura (tópicos, busca em linguagem natural, páginas, transcrições, estantes, tiles vetoriais/OSM do mapa, pontos de ajuda, busca de lugares/CEP, cofre, tradutor e diagnóstico). |
| `engine/kiwix_br.py`, `engine/osm_br.py`, `engine/vault.py`, `engine/translator.py`, `engine/checker.py` | Módulos brasileiros de enciclopédias Kiwix PT, download/cache OpenStreetMap por UF, cofre criptografado, tradutor offline e diagnóstico completo. |
| `web/` | Interface web em `index.html`, `app.css`, `app.js`, `chat.js`, `map.js`, `words.js`, `sw.js`. Sem etapa de build nem fontes/scripts externos. |
| `retrieval.py`, `assistant.py` | Serviço compartilhado de recuperação híbrida e assistente (ferramentas, streaming SSE, checagem de citações em PT-BR). |
| `content/topics/*.json` | 14 guias curados em PT-BR (8 necessidades urgentes, 6 trilhas de aprendizagem), ~720 referências checadas contra suas páginas originais e adaptadas ao Brasil. Formato: [SCHEMA.md](../content/SCHEMA.md). |
| `content/gaps.json` | Assuntos não cobertos pela biblioteca e divergências mapeadas (ex.: dosagem de hipoclorito no Brasil vs. EUA). |
| `tools/libq.py` | Utilitário somente leitura para curadores (busca, leitura de página, títulos, busca ZIM). |
| `tools/validate_topics.py` | Valida cada `doc`/`page`/`zim` contra uma pasta de dados (`--data` ou `LASTBOOK_DATA`) sem precisar iniciar o servidor. |
| `tools/build_map.py`, `tools/build_coast.py`, `tools/build_places.py`, `tools/build_addresses.py` | Constroem o mapa offline, buscador de locais e base de endereços/CEP (`--bbox br`) em `derived/geo/`. |
| `derived/` | Dados gerados: bancos `geo/*.sqlite` (`map.sqlite`, `places.sqlite`, etc.), `cache/` (imagens de páginas PDF) e `index/` (vetores semânticos). |

## Reconstruindo dados derivados (exemplo do pipeline)

```bash
cd /caminho/para/UltimoLivro
# Exemplo de geração de mapa regional OSM e índices (substitua pelos extratos regionais ou do Brasil):
python3 tools/build_map.py derived/geo/regiao.gpkg derived/geo/map.sqlite
python3 tools/build_coast.py path/para/regiao-latest.osm.pbf derived/geo/map.sqlite
python3 tools/build_places.py
python3 tools/build_addresses.py --bbox br
```

## Como permanece consistente conforme a biblioteca cresce

- Nada dentro de `library-data/` é sobrescrito pelo servidor. Metadados (editora, edição, páginas, duração, transcrição) são lidos dinamicamente de `catalog.json`, recarregado quando atualizado.
- A busca lê o índice FTS5 `search.sqlite` da biblioteca, refletindo novos downloads após reindexação.
- Os guias em `content/topics/` apontam para IDs do catálogo; reexecute `tools/validate_topics.py` após grandes mudanças no catálogo.

## Integração com a biblioteca legada (porta 8879) — separada por design

No projeto original, o método `write_index()` de `library.py` sobrescreve `index.html` na raiz a cada reindexação, portanto copiar arquivos estáticos não bastaria pois a interface depende dos endpoints extras de `server.py`. Manter `server.py` na porta 8890 (recomendado) preserva todas as rotas originais enquanto entrega todas as funcionalidades novas.
