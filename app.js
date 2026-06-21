// ==========================================================================
// MFG MEDIA CDs — app.js
// ==========================================================================
'use strict';

const LASTFM_USER = 'MarcosMFFGG26';
const LASTFM_API_KEY = 'c4658356d99de770453066f39f19e141';

let MANIFEST = [];
let currentFilter = 'TODOS';
let currentTracks = [];
let currentSlug = null;

// --------------------------------------------------------------------------
// Utilitários
// --------------------------------------------------------------------------
function escapeHTML(str) {
  return String(str).replace(/[&<>'"]/g,
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}

function fmtNum(n) {
  return n.toLocaleString('pt-BR');
}

// --------------------------------------------------------------------------
// Navegação por abas
// --------------------------------------------------------------------------
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
  });
});

// --------------------------------------------------------------------------
// Carrega o manifesto dos 46 CDs e monta o catálogo
// --------------------------------------------------------------------------
async function initCatalogo() {
  try {
    const res = await fetch('dados/manifest.json');
    if (!res.ok) throw new Error('manifest não encontrado');
    MANIFEST = await res.json();
  } catch (err) {
    document.getElementById('catalog-grid').innerHTML =
      `<p class="catalog-empty">⚠️ Não foi possível carregar o catálogo (dados/manifest.json).</p>`;
    console.error(err);
    return;
  }
  renderCatalog();
  renderGrupoBreakdown();
}

function renderGrupoBreakdown() {
  const grupos = [
    { id: 'A', label: 'Grupo A · Streaming', color: 'var(--neon-green)' },
    { id: 'B', label: 'Grupo B · Híbridos', color: 'var(--aero-cyan)' },
    { id: 'C', label: 'Grupo C · Local/Nuvem', color: '#ffd54f' },
    { id: 'D', label: 'Grupo D · Exceção (só HD)', color: 'var(--neon-red)' },
  ];
  const totalFaixas = MANIFEST.reduce((s, c) => s + c.actual, 0);
  const html = grupos.map(g => {
    const cds = MANIFEST.filter(c => c.grupo === g.id);
    const faixas = cds.reduce((s, c) => s + c.actual, 0);
    const pct = totalFaixas ? Math.round((faixas / totalFaixas) * 100) : 0;
    return `
      <div class="grupo-bar-row">
        <div class="grupo-bar-head">
          <span><img src="assets/icones/grupo_${g.id.toLowerCase()}.png" class="grupo-bar-icon" alt="">${g.label} <small style="opacity:.6">(${cds.length} CDs)</small></span>
          <span>${fmtNum(faixas)} faixas · ${pct}%</span>
        </div>
        <div class="grupo-bar-track">
          <div class="grupo-bar-fill" style="width:${pct}%; background:${g.color};"></div>
        </div>
      </div>`;
  }).join('');
  document.getElementById('grupo-breakdown').innerHTML = html;
}

function renderCatalog() {
  const grid = document.getElementById('catalog-grid');
  const searchVal = (document.getElementById('search-cd').value || '').toLowerCase().trim();

  let list = MANIFEST.filter(cd => {
    const matchFiltro = currentFilter === 'TODOS' || cd.grupo === currentFilter;
    const matchSearch = !searchVal || cd.name.toLowerCase().includes(searchVal);
    return matchFiltro && matchSearch;
  });

  if (list.length === 0) {
    grid.innerHTML = `<p class="catalog-empty">Nenhum CD encontrado para essa busca.</p>`;
    return;
  }

  grid.innerHTML = list.map(cd => `
    <div class="cd-card" tabindex="0" role="button"
         aria-label="Abrir faixas de ${escapeHTML(cd.name)}"
         data-slug="${cd.slug}">
      <div class="cd-case">
        <div class="cd-spine"></div>
        <div class="cd-cover">
          <div class="cd-mini-case" data-slug="${cd.slug}" aria-hidden="true"></div>
          <h3>${escapeHTML(cd.name)}</h3>
          ${cd.aka ? `<span class="cd-aka">tb conhecido como "${escapeHTML(cd.aka)}"</span>` : ''}
          <span class="cd-group-badge ${cd.grupo}"><img src="assets/icones/grupo_${cd.grupo.toLowerCase()}.png" class="badge-icon" alt="">Grupo ${cd.grupo}</span>
          <span class="cd-track-count">${fmtNum(cd.actual)} faixas</span>
        </div>
      </div>
    </div>
  `).join('');

  grid.querySelectorAll('.cd-card').forEach(card => {
    card.addEventListener('click', () => carregarMusicas(card.dataset.slug));
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); carregarMusicas(card.dataset.slug); }
    });
  });

  grid.querySelectorAll('.cd-mini-case').forEach(el => carregarCapaComFallback(el, el.dataset.slug));
}

// --------------------------------------------------------------------------
// Carrega a capa de um CD testando .jpg primeiro, com fallback para .png
// --------------------------------------------------------------------------
function carregarCapaComFallback(el, slug) {
  const base = `assets/capas_thumb/${slug}/capa`;
  const jpgImg = new Image();
  jpgImg.onload = () => { el.style.backgroundImage = `url('${base}.jpg')`; };
  jpgImg.onerror = () => {
    const pngImg = new Image();
    pngImg.onload = () => { el.style.backgroundImage = `url('${base}.png')`; };
    pngImg.onerror = () => { /* sem capa disponível: mantém o fundo translúcido padrão */ };
    pngImg.src = `${base}.png`;
  };
  jpgImg.src = `${base}.jpg`;
}

document.getElementById('search-cd').addEventListener('input', renderCatalog);

document.getElementById('filter-chips').addEventListener('click', e => {
  const btn = e.target.closest('.chip');
  if (!btn) return;
  document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
  currentFilter = btn.dataset.filtro;
  renderCatalog();
});

// --------------------------------------------------------------------------
// Carregamento assíncrono das faixas de um CD (fetch sob demanda)
// --------------------------------------------------------------------------
function carregarMusicas(slug) {
  const cd = MANIFEST.find(c => c.slug === slug);
  const modal = document.getElementById('music-modal');
  const container = document.getElementById('tracklist-container');
  const titulo = document.getElementById('modal-title');
  const fill = document.getElementById('nero-fill');
  const label = document.getElementById('nero-label');
  const searchTrack = document.getElementById('search-track');
  const descPanel = document.getElementById('cd-desc-panel');

  searchTrack.value = '';
  currentTracks = [];
  currentSlug = slug;
  titulo.textContent = `A ler disco: ${cd ? cd.name : slug}...`;
  container.innerHTML = '';
  fill.style.width = '15%';
  fill.classList.remove('done');
  label.textContent = 'A posicionar cabeça de leitura...';
  modal.classList.add('open');

  if (cd && cd.descricao) {
    descPanel.style.display = 'flex';
    descPanel.innerHTML = `
      <div class="cd-desc-cover" id="cd-desc-cover"></div>
      <p class="cd-desc-text"><strong>${escapeHTML(cd.name)}</strong><br>${escapeHTML(cd.descricao)}</p>`;
    carregarCapaComFallback(document.getElementById('cd-desc-cover'), slug);
  } else {
    descPanel.style.display = 'none';
    descPanel.innerHTML = '';
  }

  fetch(`dados/cds/${slug}.json`)
    .then(r => {
      fill.style.width = '55%';
      label.textContent = 'A gravar pista de dados (buffer underrun protegido)...';
      if (!r.ok) throw new Error('Disco não encontrado no armazenamento.');
      return r.json();
    })
    .then(tracks => {
      currentTracks = tracks;
      fill.style.width = '100%';
      fill.classList.add('done');
      label.textContent = `Gravação concluída — ${fmtNum(tracks.length)} faixas.`;
      titulo.textContent = `${cd ? cd.name : slug}${cd && cd.aka ? ' ("' + cd.aka + '")' : ''} — ${fmtNum(tracks.length)} faixas`;
      renderTracklist(tracks);
    })
    .catch(err => {
      fill.style.width = '100%';
      label.textContent = 'Erro de leitura.';
      container.innerHTML = `<p style="padding:14px;color:#ff6b6b;">⚠️ Não foi possível ler "dados/cds/${escapeHTML(slug)}.json".</p>`;
      console.error(err);
    });
}

function renderTracklist(tracks) {
  const container = document.getElementById('tracklist-container');
  if (!tracks.length) {
    container.innerHTML = `<p style="padding:14px;">Este disco não possui faixas registradas.</p>`;
    return;
  }
  const html = tracks.map((tr, i) => `
    <div class="track-line">
      <span class="track-num">${i + 1}.</span>
      <span class="track-name">${escapeHTML(tr.t)}</span>
      ${tr.ext ? `<span class="track-ext">${escapeHTML(tr.ext)}</span>` : ''}
    </div>`).join('');
  container.innerHTML = html;
}

document.getElementById('search-track').addEventListener('input', e => {
  const q = e.target.value.toLowerCase().trim();
  if (!q) { renderTracklist(currentTracks); return; }
  const filtered = currentTracks.filter(tr => tr.t.toLowerCase().includes(q));
  renderTracklist(filtered);
});

// --------------------------------------------------------------------------
// Download do JSON da playlist atualmente aberta no modal
// --------------------------------------------------------------------------
function baixarJSONDoCD() {
  if (!currentSlug || !currentTracks.length) return;
  const cd = MANIFEST.find(c => c.slug === currentSlug);
  const nomeBase = cd ? cd.name : currentSlug;
  const nomeArquivo = `${nomeBase.replace(/[\\/:*?"<>|]/g, '')}.json`;
  const blob = new Blob([JSON.stringify(currentTracks, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

document.getElementById('download-json-btn').addEventListener('click', baixarJSONDoCD);

function fecharModal() {
  document.getElementById('music-modal').classList.remove('open');
}
window.fecharModal = fecharModal;

document.getElementById('music-modal').addEventListener('click', e => {
  if (e.target.id === 'music-modal') fecharModal();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') fecharModal();
});

// --------------------------------------------------------------------------
// Telemetria Last.fm — "Now Playing" via fetch direto do navegador
// --------------------------------------------------------------------------
function atualizarTelemetria() {
  const container = document.getElementById('lastfm-now-playing');
  const url = `https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${LASTFM_USER}&api_key=${LASTFM_API_KEY}&format=json&limit=1`;

  fetch(url)
    .then(res => {
      if (!res.ok) throw new Error('Last.fm respondeu com erro');
      return res.json();
    })
    .then(data => {
      if (data.error) throw new Error(data.message || 'Erro na API do Last.fm');
      const track = data.recenttracks && data.recenttracks.track && data.recenttracks.track[0];
      if (!track) {
        container.innerHTML = `<p>Nenhuma faixa recente encontrada para este perfil.</p>`;
        return;
      }
      const isNowPlaying = track['@attr'] && track['@attr'].nowplaying === 'true';
      const status = isNowPlaying ? '🟢 EM REPRODUÇÃO AGORA' : '⏱️ ÚLTIMA FAIXA TRANSMITIDA';
      const album = track.album && track.album['#text'] ? track.album['#text'] : '';
      const img = track.image && track.image.length ? track.image[track.image.length - 1]['#text'] : '';

      container.innerHTML = `
        <div class="player-display">
          <div class="status-badge">${status}</div>
          ${img ? `<img src="${escapeHTML(img)}" alt="" style="width:84px;height:84px;border-radius:8px;margin:6px auto;box-shadow:0 4px 14px rgba(0,0,0,.5);">` : ''}
          <h2 class="neon-text">${escapeHTML(track.name)}</h2>
          <h3>${escapeHTML(track.artist['#text'] || track.artist)}</h3>
          ${album ? `<p>💿 Álbum: ${escapeHTML(album)}</p>` : ''}
        </div>`;
    })
    .catch(err => {
      container.innerHTML = `<p>📡 Sem ligação com os servidores Last.fm neste momento.<br><small style="opacity:.6">Verifique a chave de API em app.js ou tente novamente em instantes.</small></p>`;
      console.warn('Last.fm:', err.message);
    });
}

setInterval(atualizarTelemetria, 30000);

// --------------------------------------------------------------------------
// Diagrama interativo — parser de dados/diagrama.txt
// --------------------------------------------------------------------------
async function initDiagrama() {
  const container = document.getElementById('diagram-container');
  let nodes = [];
  let edgeLabels = [];

  try {
    const res = await fetch('dados/diagrama.txt');
    if (!res.ok) throw new Error('diagrama.txt não encontrado');
    const text = await res.text();
    const lines = text.split('\n');

    for (const raw of lines) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const parts = line.split('|').map(p => p.trim());

      if (parts[0] === 'NODE') {
        // NODE | id | BLOCO | titulo | subtitulo | icon:x | icon_img:caminho.png | from:a,b,c
        const [, id, bloco, titulo, sub, ...rest] = parts;
        let icon = '💿';
        let iconImg = null;
        let from = [];
        rest.forEach(r => {
          if (r.startsWith('icon_img:')) iconImg = r.replace('icon_img:', '').trim();
          else if (r.startsWith('icon:')) icon = r.replace('icon:', '').trim();
          if (r.startsWith('from:')) from = r.replace('from:', '').split(',').map(s => s.trim()).filter(Boolean);
        });
        nodes.push({ id, bloco, titulo, sub, icon, iconImg, from });
      } else if (parts[0] === 'EDGE_LABEL') {
        const [, from, to, desc] = parts;
        edgeLabels.push({ from, to, desc });
      }
    }
  } catch (err) {
    container.innerHTML = `<p class="catalog-empty">⚠️ Não foi possível carregar dados/diagrama.txt</p>`;
    console.error(err);
    return;
  }

  renderDiagrama(nodes, edgeLabels);
}

function renderDiagrama(nodes, edgeLabels) {
  const container = document.getElementById('diagram-container');
  const blocos = [
    { id: 'BLOCO1', label: 'Bloco 1 · Fontes de Dados' },
    { id: 'BLOCO2', label: 'Bloco 2 · Clusters de Conteúdo (46 CDs)' },
    { id: 'BLOCO3', label: 'Bloco 3 · Camada de Reprodução' },
    { id: 'BLOCO4', label: 'Camada de Rastreamento & Analytics' },
  ];

  const html = blocos.map(b => {
    const blocoNodes = nodes.filter(n => n.bloco === b.id);
    if (!blocoNodes.length) return '';
    const nodesHtml = blocoNodes.map(n => `
      <div class="diagram-node" data-id="${n.id}" data-from="${n.from.join(',')}">
        ${n.iconImg ? `<img class="dn-icon-img" src="${escapeHTML(n.iconImg)}" alt="">` : `<span class="dn-icon">${n.icon}</span>`}
        <span class="dn-title">${escapeHTML(n.titulo)}</span>
        <span class="dn-sub">${escapeHTML(n.sub)}</span>
      </div>`).join('');
    return `
      <div class="diagram-block">
        <p class="diagram-block-label">${escapeHTML(b.label)}</p>
        <div class="diagram-row">${nodesHtml}</div>
      </div>`;
  }).join('<div class="diagram-arrow-row">⬇</div>');

  const notas = edgeLabels.filter(e => e.desc.startsWith('NOTA:'));
  const scrobbleLabels = edgeLabels.filter(e => !e.desc.startsWith('NOTA:'));

  const notasHtml = notas.length ? `
    <div class="diagram-block diagram-note-block">
      <p class="diagram-block-label">💡 Como ler os Grupos C e D</p>
      <div class="edge-label-list">
        ${notas.map(e => `<div>${escapeHTML(e.desc.replace('NOTA:', '').trim())}</div>`).join('')}
      </div>
    </div>` : '';

  const edgeHtml = scrobbleLabels.length ? `
    <div class="diagram-block">
      <p class="diagram-block-label">Status de Scrobble (Bloco 3 → Last.fm)</p>
      <div class="edge-label-list">
        ${scrobbleLabels.map(e => `<div><b>${escapeHTML(e.from)} → ${escapeHTML(e.to)}:</b> ${escapeHTML(e.desc)}</div>`).join('')}
      </div>
    </div>` : '';

  container.innerHTML = html + notasHtml + edgeHtml;

  // Interações de destaque (hover/focus) mostrando as conexões "from"
  const allNodeEls = container.querySelectorAll('.diagram-node');
  allNodeEls.forEach(el => {
    el.addEventListener('mouseenter', () => highlightConnections(el.dataset.id, allNodeEls));
    el.addEventListener('mouseleave', () => clearHighlight(allNodeEls));
  });
}

function highlightConnections(nodeId, allNodeEls) {
  const related = new Set([nodeId]);
  allNodeEls.forEach(el => {
    const from = (el.dataset.from || '').split(',').filter(Boolean);
    if (from.includes(nodeId)) related.add(el.dataset.id);
    if (el.dataset.id === nodeId) from.forEach(f => related.add(f));
  });
  allNodeEls.forEach(el => {
    if (related.has(el.dataset.id)) {
      el.classList.add('hl');
      el.classList.remove('dim');
    } else {
      el.classList.add('dim');
      el.classList.remove('hl');
    }
  });
}

function clearHighlight(allNodeEls) {
  allNodeEls.forEach(el => el.classList.remove('hl', 'dim'));
}

// ==========================================================================
// SETUP — Topologia de áudio, aparelhos e configuração dos players
// ==========================================================================
let APARELHOS = [];

// --------------------------------------------------------------------------
// Topologia de áudio — parser de dados/topologia.txt
// --------------------------------------------------------------------------
async function initTopologia() {
  const container = document.getElementById('topologia-container');
  let ambientes = [];
  let notas = [];

  try {
    const res = await fetch('dados/topologia.txt');
    if (!res.ok) throw new Error('topologia.txt não encontrado');
    const text = await res.text();
    const lines = text.split('\n');
    let ambienteAtual = null;

    for (const raw of lines) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const parts = line.split('|').map(p => p.trim());

      if (parts[0] === 'AMBIENTE') {
        ambienteAtual = { nome: parts[1], steps: [] };
        ambientes.push(ambienteAtual);
      } else if (parts[0] === 'STEP' && ambienteAtual) {
        ambienteAtual.steps.push({ aparelhoId: parts[1], tipoCabo: parts[2], descCabo: parts[3] || '' });
      } else if (parts[0] === 'NOTA') {
        notas.push(parts[1]);
      }
    }
  } catch (err) {
    container.innerHTML = `<p class="catalog-empty">⚠️ Não foi possível carregar dados/topologia.txt</p>`;
    console.error(err);
    return;
  }

  renderTopologia(ambientes, notas);
}

function renderTopologia(ambientes, notas) {
  const container = document.getElementById('topologia-container');

  const ambientesHtml = ambientes.map(amb => {
    const stepsHtml = amb.steps.map((step, i) => {
      const aparelho = APARELHOS.find(a => a.id === step.aparelhoId);
      const nome = aparelho ? aparelho.nome : step.aparelhoId;
      const icon = aparelho ? aparelho.icon_img : '';
      const isLast = i === amb.steps.length - 1 || step.tipoCabo === 'fim';

      const noHtml = `
        <div class="topo-node">
          ${icon ? `<img src="${icon}" class="topo-node-icon" alt="">` : ''}
          <span class="topo-node-name">${escapeHTML(nome)}</span>
        </div>`;

      const caboHtml = !isLast ? `
        <div class="topo-cable ${step.tipoCabo}">
          <span class="topo-arrow">➜</span>
          <span class="topo-cable-label">${escapeHTML(step.descCabo)}</span>
        </div>` : '';

      return noHtml + caboHtml;
    }).join('');

    return `
      <div class="topo-ambiente">
        <p class="diagram-block-label">📍 Ambiente: ${escapeHTML(amb.nome)}</p>
        <div class="topo-row">${stepsHtml}</div>
      </div>`;
  }).join('');

  const legenda = `
    <div class="topo-legenda">
      <span><span class="topo-swatch digital"></span> Digital</span>
      <span><span class="topo-swatch analogico"></span> Analógico</span>
    </div>`;

  const notasHtml = notas.length ? `
    <div class="diagram-block diagram-note-block">
      <p class="diagram-block-label">💡 Notas Técnicas</p>
      <div class="edge-label-list">
        ${notas.map(n => `<div>${escapeHTML(n)}</div>`).join('')}
      </div>
    </div>` : '';

  container.innerHTML = legenda + ambientesHtml + notasHtml;
}

// --------------------------------------------------------------------------
// Grid de aparelhos clicáveis
// --------------------------------------------------------------------------
async function initAparelhos() {
  const grid = document.getElementById('aparelhos-grid');
  try {
    const res = await fetch('dados/aparelhos.json');
    if (!res.ok) throw new Error('aparelhos.json não encontrado');
    APARELHOS = await res.json();
  } catch (err) {
    grid.innerHTML = `<p class="catalog-empty">⚠️ Não foi possível carregar dados/aparelhos.json</p>`;
    console.error(err);
    return;
  }

  grid.innerHTML = APARELHOS.map(ap => `
    <div class="aparelho-card" tabindex="0" role="button" data-id="${ap.id}" aria-label="Ver especificações de ${escapeHTML(ap.nome)}">
      <img src="${ap.icon_img}" class="aparelho-img" alt="">
      <h3>${escapeHTML(ap.nome)}</h3>
      <span class="aparelho-ambiente">${escapeHTML(ap.ambiente)}</span>
      <p class="aparelho-resumo">${escapeHTML(ap.resumo)}</p>
    </div>
  `).join('');

  grid.querySelectorAll('.aparelho-card').forEach(card => {
    card.addEventListener('click', () => abrirDeviceModal(card.dataset.id));
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrirDeviceModal(card.dataset.id); }
    });
  });

  // a topologia depende dos aparelhos já carregados para mostrar nome/ícone corretos
  initTopologia();
}

function abrirDeviceModal(id) {
  const ap = APARELHOS.find(a => a.id === id);
  if (!ap) return;
  const modal = document.getElementById('device-modal');
  const title = document.getElementById('device-modal-title');
  const body = document.getElementById('device-modal-body');

  title.innerHTML = `<img src="${ap.icon_img}" class="header-icon" alt=""> ${escapeHTML(ap.nome)}`;

  const specsHtml = ap.specs.map(grupo => `
    <div class="spec-group">
      <p class="spec-group-title">${escapeHTML(grupo.grupo)}</p>
      <table class="spec-table">
        ${grupo.itens.map(([campo, valor]) => `
          <tr><td class="spec-campo">${escapeHTML(campo)}</td><td class="spec-valor">${escapeHTML(valor)}</td></tr>
        `).join('')}
      </table>
    </div>`).join('');

  body.innerHTML = `
    <p class="window-sub">${escapeHTML(ap.resumo)}</p>
    ${specsHtml}`;

  modal.classList.add('open');
}

function fecharDeviceModal() {
  document.getElementById('device-modal').classList.remove('open');
}
window.fecharDeviceModal = fecharDeviceModal;

document.getElementById('device-modal').addEventListener('click', e => {
  if (e.target.id === 'device-modal') fecharDeviceModal();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') fecharDeviceModal();
});

// --------------------------------------------------------------------------
// Configuração dos players
// --------------------------------------------------------------------------
async function initPlayersConfig() {
  const container = document.getElementById('players-config-list');
  let players = [];
  try {
    const res = await fetch('dados/players_config.json');
    if (!res.ok) throw new Error('players_config.json não encontrado');
    players = await res.json();
  } catch (err) {
    container.innerHTML = `<p class="catalog-empty">⚠️ Não foi possível carregar dados/players_config.json</p>`;
    console.error(err);
    return;
  }

  container.innerHTML = players.map(p => `
    <div class="player-config-card">
      <div class="player-config-header">
        <img src="${p.icon_img}" class="player-config-icon" alt="">
        <div>
          <h3>${escapeHTML(p.nome)}</h3>
          <p class="player-config-intro">${escapeHTML(p.intro)}</p>
          ${p.settings_level ? `<span class="player-config-level">Settings level: ${escapeHTML(p.settings_level)}</span>` : ''}
        </div>
      </div>

      ${p.foto_demo ? `
        <figure class="player-config-figure">
          <img src="${p.foto_demo}" alt="${escapeHTML(p.foto_legenda || '')}">
          <figcaption>${escapeHTML(p.foto_legenda || '')}</figcaption>
        </figure>` : ''}

      ${p.grupos.map(grupo => `
        <div class="spec-group">
          <p class="spec-group-title">${escapeHTML(grupo.titulo)} <span class="player-config-path">${escapeHTML(grupo.caminho)}</span></p>
          <table class="spec-table config-table">
            ${grupo.itens.map(([campo, valor, motivo]) => `
              <tr>
                <td class="spec-campo">${escapeHTML(campo)}</td>
                <td class="spec-valor"><strong>${escapeHTML(valor)}</strong>${motivo ? `<br><small>${escapeHTML(motivo)}</small>` : ''}</td>
              </tr>`).join('')}
          </table>
        </div>`).join('')}

      ${p.conclusao ? `<p class="player-config-conclusao">${escapeHTML(p.conclusao)}</p>` : ''}
    </div>
  `).join('');
}

// --------------------------------------------------------------------------
// Inicialização
// --------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  initCatalogo();
  initDiagrama();
  initAparelhos();
  initPlayersConfig();
  atualizarTelemetria();
});
