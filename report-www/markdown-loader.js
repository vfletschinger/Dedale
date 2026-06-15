function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttribute(text) {
  return escapeHtml(text).replace(/"/g, '&quot;');
}

function resolveUrl(url, markdownUrl) {
  try {
    return new URL(url, markdownUrl).toString();
  } catch (_) {
    return url;
  }
}

function parseInlineMarkdown(text, markdownUrl) {
  let out = escapeHtml(text);

  // Code inline
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
  // Liens
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, href) => {
    const safeHref = escapeAttribute(resolveUrl(href, markdownUrl));
    return `<a href="${safeHref}">${label}</a>`;
  });
  // Gras
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  // Italique
  out = out.replace(/_([^_]+)_/g, '<i>$1</i>');
  out = out.replace(/\*([^*]+)\*/g, '<i>$1</i>');

  return out;
}

function flushParagraph(buffer, blocks) {
  if (!buffer.length) return;
  const text = buffer.join(' ').trim();
  if (text) {
    blocks.push(`<p>${text}</p>`);
  }
  buffer.length = 0;
}

function flushList(listState, blocks) {
  if (!listState.type || !listState.items.length) {
    listState.type = null;
    listState.items = [];
    return;
  }

  const items = listState.items.map((item) => `<li>${item}</li>`).join('');
  blocks.push(`<${listState.type}>${items}</${listState.type}>`);

  listState.type = null;
  listState.items = [];
}

function flushBlockquote(buffer, blocks, markdownUrl) {
  if (!buffer.length) return;

  const content = buffer
    .map((line) => parseInlineMarkdown(line, markdownUrl))
    .join('<br />');
  blocks.push(`<blockquote><p>${content}</p></blockquote>`);
  buffer.length = 0;
}

function flushCodeBlock(codeState, blocks) {
  if (!codeState.active) return;

  const safeLanguage = codeState.language
    ? ` class="language-${escapeAttribute(codeState.language)}"`
    : '';
  const content = escapeHtml(codeState.lines.join('\n'));
  blocks.push(`<pre><code${safeLanguage}>${content}</code></pre>`);

  codeState.active = false;
  codeState.language = '';
  codeState.lines = [];
}

function splitTableRow(row) {
  let content = row.trim();
  if (content.startsWith('|')) content = content.slice(1);
  if (content.endsWith('|')) content = content.slice(0, -1);
  return content.split('|').map((cell) => cell.trim());
}

function isTableSeparator(line) {
  const content = line.trim();
  if (!content.includes('-')) return false;

  let normalized = content;
  if (normalized.startsWith('|')) normalized = normalized.slice(1);
  if (normalized.endsWith('|')) normalized = normalized.slice(0, -1);

  const cells = normalized.split('|').map((cell) => cell.trim());
  if (!cells.length) return false;

  return cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function parseMarkdown(markdown, markdownUrl) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  const paragraphBuffer = [];
  const listState = {
    type: null,
    items: [],
  };
  const blockquoteBuffer = [];
  const codeState = {
    active: false,
    language: '',
    lines: [],
  };

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index];
    const line = rawLine.trim();

    if (codeState.active) {
      if (/^```/.test(line)) {
        flushCodeBlock(codeState, blocks);
      } else {
        codeState.lines.push(rawLine);
      }
      continue;
    }

    const fencedCodeStart = rawLine.match(/^\s*```([A-Za-z0-9_-]+)?\s*$/);
    if (fencedCodeStart) {
      flushParagraph(paragraphBuffer, blocks);
      flushList(listState, blocks);
      flushBlockquote(blockquoteBuffer, blocks, markdownUrl);
      codeState.active = true;
      codeState.language = (fencedCodeStart[1] || '').trim();
      codeState.lines = [];
      continue;
    }

    if (!line) {
      flushParagraph(paragraphBuffer, blocks);
      flushList(listState, blocks);
      flushBlockquote(blockquoteBuffer, blocks, markdownUrl);
      continue;
    }

    const hrMatch = line.match(/^((\*\s*){3,}|(-\s*){3,}|(_\s*){3,})$/);
    if (hrMatch) {
      flushParagraph(paragraphBuffer, blocks);
      flushList(listState, blocks);
      flushBlockquote(blockquoteBuffer, blocks, markdownUrl);
      blocks.push('<hr />');
      continue;
    }

    const blockquoteMatch = rawLine.match(/^\s*>\s?(.*)$/);
    if (blockquoteMatch) {
      flushParagraph(paragraphBuffer, blocks);
      flushList(listState, blocks);
      blockquoteBuffer.push(blockquoteMatch[1]);
      continue;
    }

    flushBlockquote(blockquoteBuffer, blocks, markdownUrl);

    if (
      line.includes('|') &&
      index + 1 < lines.length &&
      isTableSeparator(lines[index + 1])
    ) {
      flushParagraph(paragraphBuffer, blocks);
      flushList(listState, blocks);

      const headerCells = splitTableRow(rawLine);
      const rows = [];
      let rowIndex = index + 2;

      while (rowIndex < lines.length) {
        const rowLine = lines[rowIndex].trim();
        if (!rowLine || !rowLine.includes('|')) break;
        rows.push(splitTableRow(lines[rowIndex]));
        rowIndex += 1;
      }

      const headerHtml = headerCells
        .map((cell) => `<th>${parseInlineMarkdown(cell, markdownUrl)}</th>`)
        .join('');

      const bodyHtml = rows
        .map((cells) => {
          const normalizedCells = [...cells];
          while (normalizedCells.length < headerCells.length) {
            normalizedCells.push('');
          }
          return `<tr>${normalizedCells
            .slice(0, headerCells.length)
            .map((cell) => `<td>${parseInlineMarkdown(cell, markdownUrl)}</td>`)
            .join('')}</tr>`;
        })
        .join('');

      blocks.push(`<table><thead><tr>${headerHtml}</tr></thead><tbody>${bodyHtml}</tbody></table>`);
      index = rowIndex - 1;
      continue;
    }

    const orderedListMatch = line.match(/^\d+\.\s+(.*)$/);
    if (orderedListMatch) {
      flushParagraph(paragraphBuffer, blocks);
      if (listState.type !== 'ol') {
        flushList(listState, blocks);
        listState.type = 'ol';
      }
      listState.items.push(parseInlineMarkdown(orderedListMatch[1], markdownUrl));
      continue;
    }

    const unorderedListMatch = line.match(/^[-*+]\s+(.*)$/);
    if (unorderedListMatch) {
      flushParagraph(paragraphBuffer, blocks);
      if (listState.type !== 'ul') {
        flushList(listState, blocks);
        listState.type = 'ul';
      }
      listState.items.push(parseInlineMarkdown(unorderedListMatch[1], markdownUrl));
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s*(.*)$/);
    if (headingMatch) {
      flushParagraph(paragraphBuffer, blocks);
      flushList(listState, blocks);
      flushBlockquote(blockquoteBuffer, blocks, markdownUrl);
      const headingText = headingMatch[2].trim();
      if (!headingText) {
        continue;
      }
      const level = headingMatch[1].length;
      const content = parseInlineMarkdown(headingText, markdownUrl);
      blocks.push(`<h${level}>${content}</h${level}>`);
      continue;
    }

    const imageMatch = line.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (imageMatch) {
      flushParagraph(paragraphBuffer, blocks);
      flushList(listState, blocks);
      flushBlockquote(blockquoteBuffer, blocks, markdownUrl);
      const alt = escapeAttribute(imageMatch[1] || 'Illustration');
      const src = escapeAttribute(resolveUrl(imageMatch[2], markdownUrl));
      blocks.push(`<img src="${src}" alt="${alt}" />`);
      continue;
    }

    flushList(listState, blocks);
    paragraphBuffer.push(parseInlineMarkdown(line, markdownUrl));
  }

  flushParagraph(paragraphBuffer, blocks);
  flushList(listState, blocks);
  flushBlockquote(blockquoteBuffer, blocks, markdownUrl);
  flushCodeBlock(codeState, blocks);
  return blocks.join('\n\n');
}

async function loadMarkdownContent() {
  const content = document.getElementById('content');
  if (!content) return;

  const markdownPath = 'src/index.md';

  try {
    const response = await fetch(markdownPath, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`Impossible de charger ${markdownPath} (${response.status})`);
    }

    const markdown = await response.text();
    const markdownUrl = new URL(markdownPath, window.location.href).toString();
    const html = parseMarkdown(markdown, markdownUrl);

    content.innerHTML = html || '<p>Le fichier Markdown est vide.</p>';
    document.dispatchEvent(new Event('content:updated'));
  } catch (error) {
    content.innerHTML = `<h1>Erreur de chargement</h1><p>${String(error)}</p>`;
    document.dispatchEvent(new Event('content:updated'));
  }
}

document.addEventListener('DOMContentLoaded', loadMarkdownContent);
