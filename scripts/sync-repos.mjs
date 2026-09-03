// Daily repo sync — regenerates the Shipping Log cards in index.html from the
// live GitHub and GitLab APIs. Runs in GitHub Actions (see .github/workflows/sync.yml).
//
// Security: everything fetched from the APIs is treated as untrusted data and
// HTML-escaped before it touches the page. Curated copy comes only from the
// local data/repo-overrides.json (trusted, versioned in this repo).

import { readFileSync, writeFileSync } from 'node:fs';

const GH_USER = 'RafaelPupio';
const GL_USER = 'RafaelPupio';
const PAGE = 'index.html';
const START = '<!-- REPO-CARDS:START -->';
const END = '<!-- REPO-CARDS:END -->';

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const overrides = JSON.parse(readFileSync('data/repo-overrides.json', 'utf8'));

async function getJSON(url, headers = {}) {
  const res = await fetch(url, { headers: { 'user-agent': 'rpv-portfolio-sync', ...headers } });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.json();
}

function card({ name, url, desc, meta, tags, stamp, hot, lab }) {
  const tagHtml = tags.map((t) => `<span>${esc(t)}</span>`).join('');
  return `      <article class="repo${lab ? ' lab' : ''}" data-reveal>
        <span class="r-stamp${hot ? ' hot' : ''}">${esc(stamp)}</span>
        <h3><a href="${esc(url)}">${esc(name)}</a></h3>
        <span class="r-meta">${esc(meta)}</span>
        <p>${desc}</p>
        <div class="r-tags">${tagHtml}</div>
        <a class="inspect" href="${esc(url)}">Inspect →</a>
      </article>`;
}

function buildCard(repo, source) {
  const o = overrides[repo.name] || {};
  if (o.skip) return null;
  const stars = repo.stars > 0 ? `★ ${repo.stars}` : null;
  const metaParts = [repo.language, repo.commits ? `${repo.commits} commits` : null, stars, source].filter(Boolean);
  return card({
    name: repo.name,
    url: repo.url,
    // Override descriptions are trusted local content (may contain markup);
    // API descriptions are untrusted and escaped.
    desc: o.desc ? o.desc : esc(repo.description || 'No description yet — open the repo.'),
    meta: o.meta || metaParts.join(' · '),
    tags: (o.tags || repo.topics || []).slice(0, 6),
    stamp: o.stamp || stars || 'Shipped',
    hot: o.hot ?? Boolean(o.stamp),
    lab: false,
  });
}

const cards = [];

// --- GitHub ---
const ghHeaders = { accept: 'application/vnd.github+json' };
if (process.env.GITHUB_TOKEN) ghHeaders.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
const ghRepos = await getJSON(`https://api.github.com/users/${GH_USER}/repos?per_page=100&sort=updated`, ghHeaders);
for (const r of ghRepos) {
  if (r.fork || r.archived) continue;
  const c = buildCard({
    name: r.name,
    url: r.html_url,
    description: r.description,
    language: r.language,
    stars: r.stargazers_count,
    topics: r.topics,
  }, 'GitHub');
  if (c) cards.push(c);
}

// --- GitLab ---
let glCount = 0;
try {
  const glProjects = await getJSON(`https://gitlab.com/api/v4/users/${GL_USER}/projects?per_page=100&visibility=public`);
  for (const p of glProjects) {
    const c = buildCard({
      name: p.name,
      url: p.web_url,
      description: p.description,
      language: null,
      stars: p.star_count,
      topics: p.topics,
    }, 'GitLab');
    if (c) { cards.push(c); glCount++; }
  }
} catch (e) {
  console.warn('GitLab fetch failed, keeping placeholder:', e.message);
}

// Placeholder berth while GitLab has no public projects.
if (glCount === 0) {
  cards.push(`      <article class="repo lab" data-reveal>
        <span class="r-stamp">Opening</span>
        <h3><a href="https://gitlab.com/${GL_USER}" style="color:inherit">GitLab · @${GL_USER}</a></h3>
        <span class="r-meta">New berth · GitLab</span>
        <p>Manifest just opened at this port. Projects will appear in the log as they ship — this page re-checks the docks every day.</p>
        <div class="r-tags"><span>GitLab</span><span>Incoming</span></div>
        <a class="inspect" href="https://gitlab.com/${GL_USER}" style="color:inherit">Inspect →</a>
      </article>`);
}

// --- Splice into the page ---
let html = readFileSync(PAGE, 'utf8');
const a = html.indexOf(START);
const b = html.indexOf(END);
if (a === -1 || b === -1) throw new Error('REPO-CARDS markers not found in index.html');
html = html.slice(0, a + START.length) + '\n' + cards.join('\n') + '\n      ' + html.slice(b);

// --- Classified Cargo: curated private-project cards from data/classified-cargo.html ---
// Injected between its own markers AFTER the auto-managed repo cards, so the two
// regions never touch. Bootstraps its markers on first run.
const CC_START = '<!-- CLASSIFIED:START -->';
const CC_END = '<!-- CLASSIFIED:END -->';
try {
  const cargo = readFileSync('data/classified-cargo.html', 'utf8').trim();
  const block = CC_START + '\n' + cargo + '\n      ' + CC_END;
  const c1 = html.indexOf(CC_START);
  const c2 = html.indexOf(CC_END);
  if (c1 !== -1 && c2 !== -1) {
    html = html.slice(0, c1) + block + html.slice(c2 + CC_END.length);
  } else {
    const endIdx = html.indexOf(END);
    html = html.slice(0, endIdx + END.length) + '\n      ' + block + html.slice(endIdx + END.length);
  }
} catch (e) {
  console.warn('No classified cargo file, skipping:', e.message);
}

// --- Credentials: full diploma & certification record from data/credentials.html ---
// The #certs rows are sourced from that file so the live site always carries every
// diploma and certification. Bootstraps its markers on first run by replacing the
// original rows container inside <section id="certs">.
const CR_START = '<!-- CREDENTIALS:START -->';
const CR_END = '<!-- CREDENTIALS:END -->';
try {
  const rows = readFileSync('data/credentials.html', 'utf8').replace(/\s+$/, '');
  const block = `${CR_START}\n    <div>\n${rows}\n    </div>\n    ${CR_END}`;
  const r1 = html.indexOf(CR_START);
  const r2 = html.indexOf(CR_END);
  if (r1 !== -1 && r2 !== -1) {
    html = html.slice(0, r1) + block + html.slice(r2 + CR_END.length);
  } else {
    const certsIdx = html.indexOf('<section class="folio" id="certs">');
    if (certsIdx !== -1) {
      const rowsStart = html.indexOf('    <div>\n      <div class="lrow"', certsIdx);
      const sectionEnd = html.indexOf('</section>', certsIdx);
      if (rowsStart !== -1 && sectionEnd !== -1 && rowsStart < sectionEnd) {
        html = html.slice(0, rowsStart) + '    ' + block + '\n  </div>\n' + html.slice(sectionEnd);
      }
    }
  }
} catch (e) {
  console.warn('No credentials file, skipping:', e.message);
}

// --- One-time CSS self-heal: the hidden attribute must beat #langmenu{display:grid},
// otherwise the language dropdown renders permanently open.
if (!html.includes('#langmenu[hidden]')) {
  html = html.replace('#langmenu {', '#langmenu[hidden] { display:none !important; }\n  #langmenu {');
}

const today = new Date().toISOString().slice(0, 10);
html = html.replace(
  /(<span class="sync" id="sync-date">)[^<]*(<\/span>)/,
  `$1Last sync: ${today} · Auto-refreshes daily$2`,
);

writeFileSync(PAGE, html);
console.log(`Wrote ${cards.length} cards (${glCount} from GitLab). Synced ${today}.`);
