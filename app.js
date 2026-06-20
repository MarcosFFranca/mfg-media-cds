// ==========================================================================
// MFG MEDIA CDs — app.js
// ==========================================================================
'use strict';

const LASTFM_USER = 'MarcosMFFGG26';
const LASTFM_API_KEY = 'c4658356d99de770453066f39f19e141';

let MANIFEST = [];
let currentFilter = 'TODOS';
let currentTracks = [];

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
    { id: 'MAG', label: 'Mag', color: 'var(--neon-red)' },
  ];
  const totalFaixas = MANIFEST.reduce((s, c) => s + c.actual, 0);
  const html = grupos.map(g => {
    const cds = MANIFEST.filter(c => c.grupo === g.id);
    const faixas = cds.reduce((s, c) => s + c.actual, 0);
    const pct = totalFaixas ? Math.round((faixas / totalFaixas) * 100) : 0;
    return `
      <div class="grupo-bar-row">
        <div class="grupo-bar-head">
          <span>${g.label} <small style="opacity:.6">(${cds.length} CDs)</small></span>
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
          <span class="cd-emoji">${cd.icon}</span>
          <h3>${escapeHTML(cd.name)}</h3>
          <span class="cd-group-badge ${cd.grupo}">${cd.grupo === 'MAG' ? 'MAG' : 'Grupo ' + cd.grupo}</span>
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

  searchTrack.value = '';
  currentTracks = [];
  titulo.textContent = `A ler disco: ${cd ? cd.name : slug}...`;
  container.innerHTML = '';
  fill.style.width = '15%';
  fill.classList.remove('done');
  label.textContent = 'A posicionar cabeça de leitura...';
  modal.classList.add('open');

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
      titulo.textContent = `${cd ? cd.name : slug} — ${fmtNum(tracks.length)} faixas`;
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
        // NODE | id | BLOCO | titulo | subtitulo | icon:x | from:a,b,c
        const [, id, bloco, titulo, sub, ...rest] = parts;
        let icon = '💿';
        let from = [];
        rest.forEach(r => {
          if (r.startsWith('icon:')) icon = r.replace('icon:', '').trim();
          if (r.startsWith('from:')) from = r.replace('from:', '').split(',').map(s => s.trim()).filter(Boolean);
        });
        nodes.push({ id, bloco, titulo, sub, icon, from });
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
        <span class="dn-icon">${n.icon}</span>
        <span class="dn-title">${escapeHTML(n.titulo)}</span>
        <span class="dn-sub">${escapeHTML(n.sub)}</span>
      </div>`).join('');
    return `
      <div class="diagram-block">
        <p class="diagram-block-label">${escapeHTML(b.label)}</p>
        <div class="diagram-row">${nodesHtml}</div>
      </div>`;
  }).join('<div class="diagram-arrow-row">⬇</div>');

  const edgeHtml = edgeLabels.length ? `
    <div class="diagram-block">
      <p class="diagram-block-label">Status de Scrobble (Bloco 3 → Last.fm)</p>
      <div class="edge-label-list">
        ${edgeLabels.map(e => `<div><b>${escapeHTML(e.from)} → ${escapeHTML(e.to)}:</b> ${escapeHTML(e.desc)}</div>`).join('')}
      </div>
    </div>` : '';

  container.innerHTML = html + edgeHtml;

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

// --------------------------------------------------------------------------
// Inicialização
// --------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  initCatalogo();
  initDiagrama();
  atualizarTelemetria();
});
