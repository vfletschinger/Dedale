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

function parseMarkdown(markdown, markdownUrl) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  const paragraphBuffer = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      flushParagraph(paragraphBuffer, blocks);
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s*(.*)$/);
    if (headingMatch) {
      flushParagraph(paragraphBuffer, blocks);
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
      const alt = escapeAttribute(imageMatch[1] || 'Illustration');
      const src = escapeAttribute(resolveUrl(imageMatch[2], markdownUrl));
      blocks.push(`<img src="${src}" alt="${alt}" />`);
      continue;
    }

    paragraphBuffer.push(parseInlineMarkdown(line, markdownUrl));
  }

  flushParagraph(paragraphBuffer, blocks);
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
