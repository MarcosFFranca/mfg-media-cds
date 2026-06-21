# MFG Media CDs

Hub pessoal de gerenciamento de músicas e telemetria. Site estático, sem frameworks — HTML5 + CSS3 + JavaScript puro. Pronto para GitHub Pages.

## Estrutura

```
mfg-media-cds/
├── index.html
├── style.css
├── app.js
├── assets/
│   └── mfg_media_cds_logo.png
└── dados/
    ├── manifest.json        # lista dos 46 CDs (nome, grupo, ícone, contagem)
    ├── diagrama.txt         # dados do mapa interativo (editável manualmente)
    └── cds/
        ├── crc_2005.json
        ├── d_a_r_k.json
        └── ... (46 arquivos, um por CD)
```

## Como atualizar o mapa/diagrama

Edite `dados/diagrama.txt` — **não precisa tocar em nenhum código**. A sintaxe:

```
NODE | id_unico | BLOCO | Título | Subtítulo | icon:🎵 | from:id_de_origem1,id_de_origem2
```

- `BLOCO` pode ser `BLOCO1`, `BLOCO2`, `BLOCO3` ou `BLOCO4`.
- `from:` define de quais nós a seta "vem" — isso alimenta o destaque ao passar o mouse.
- Linhas com `EDGE_LABEL | origem | destino | descrição` aparecem como legendas de status (scrobble) abaixo do diagrama.
- Linhas começando com `#` são ignoradas (comentários).

Depois de editar, é só recarregar a página — o `app.js` lê o `.txt` via `fetch` a cada carregamento.

## Como adicionar ou atualizar um CD

1. Adicione/edite a entrada correspondente em `dados/manifest.json`:
   ```json
   { "idx": 47, "name": "Nome do CD", "slug": "nome_do_cd", "declared": 10, "actual": 10, "grupo": "B", "icon": "🎵" }
   ```
2. Crie `dados/cds/nome_do_cd.json` com a lista de faixas:
   ```json
   [{"t": "Artista - Faixa"}, {"t": "Outro Artista - Outra Faixa", "ext": "flac"}]
   ```
   O campo `ext` é opcional — quando presente, aparece como uma etiqueta (badge) ao lado da faixa.

O carregamento é sempre assíncrono e por CD: o navegador nunca baixa as +29 mil faixas de uma vez, apenas o arquivo do CD clicado.

## Telemetria Last.fm

O `app.js` usa a API pública do Last.fm (`user.getrecenttracks`) para mostrar a faixa atual do perfil `MarcosMFFGG26`, atualizando a cada 30 segundos. Se quiser usar sua própria chave de API (recomendado para uso contínuo e maior limite de requisições), gere uma gratuitamente em https://www.last.fm/api/account/create e substitua o valor de `LASTFM_API_KEY` no topo de `app.js`.

## Dados de origem

Os 46 CDs e a contagem total de 29.447 faixas foram extraídos e validados a partir de `CONTAGEM_MUSICAS_CDS_COMPLETO.txt`. Os CDs #22 a #44 (Grupo B e C, fonte local/nuvem) tinham nomes de arquivo brutos (`01. Artista - Faixa.mp3`); foram normalizados para `Artista - Faixa` com a extensão preservada como badge visual.

> **Correção pós-lançamento:** o arquivo de origem registrava 74 faixas para "GTA San Andreas (Trilha Sonora)", mas a contagem real é 274. O CD foi atualizado com a listagem completa fornecida pelo usuário, e o total geral da coleção passou de 29.203 para 29.403 faixas.

> **Atualização de catálogo:** A6 teve sua listagem completamente substituída (nomes de faixa corrigidos, 29 → 48 faixas); PRIME FORRÓ ESTILIZADO e SELEÇÃO FORRÓ DE PAREDÃO DAS ANTIGAS receberam novas faixas (842 e 912, respectivamente). O total geral da coleção passou de 29.403 para 29.447 faixas.
