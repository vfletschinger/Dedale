function slugify(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function ensureUniqueId(baseId, usedIds) {
  if (!usedIds.has(baseId)) {
    usedIds.add(baseId);
    return baseId;
  }

  let i = 2;
  while (usedIds.has(`${baseId}-${i}`)) {
    i += 1;
  }
  const finalId = `${baseId}-${i}`;
  usedIds.add(finalId);
  return finalId;
}

function buildToc() {
  const content = document.getElementById('content');
  const tocList = document.getElementById('toc-list');
  if (!content || !tocList) return;

  tocList.innerHTML = '';

  const headings = content.querySelectorAll('h1, h2, h3, h4, h5');
  if (!headings.length) {
    tocList.innerHTML = '<li class="toc-empty">Aucun titre detecte.</li>';
    return;
  }

  const usedIds = new Set();
  [...content.querySelectorAll('[id]')].forEach((el) => usedIds.add(el.id));

  const links = [];

  headings.forEach((heading) => {
    const level = Number(heading.tagName[1]);
    const text = heading.textContent ? heading.textContent.trim() : '';
    if (!text) return;

    if (!heading.id) {
      const baseId = slugify(text) || `section-${Math.random().toString(36).slice(2, 8)}`;
      heading.id = ensureUniqueId(baseId, usedIds);
    }

    const li = document.createElement('li');
    const a = document.createElement('a');
    a.className = `toc-link toc-level-${level}`;
    a.href = `#${heading.id}`;
    a.textContent = text;

    li.appendChild(a);
    tocList.appendChild(li);
    links.push({ link: a, heading });
  });

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const item = links.find((x) => x.heading === entry.target);
        if (!item) return;
        if (entry.isIntersecting) {
          links.forEach((x) => x.link.classList.remove('active'));
          item.link.classList.add('active');
        }
      });
    },
    {
      rootMargin: '-18% 0px -70% 0px',
      threshold: 0,
    }
  );

  links.forEach((item) => observer.observe(item.heading));

  if (links[0]) {
    links[0].link.classList.add('active');
  }
}

window.buildToc = buildToc;

document.addEventListener('content:updated', buildToc);
document.addEventListener('DOMContentLoaded', buildToc);
