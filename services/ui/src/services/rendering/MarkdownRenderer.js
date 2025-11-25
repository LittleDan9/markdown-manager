import MarkdownIt from "markdown-it";
import { HighlightService } from '../editor';
import { Mermaid } from './index';
import ImageCacheService from './ImageCacheService';

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true
});

// Helper: map token index to source line number
function getLineAttr(tokens, idx) {
  const token = tokens[idx];
  // MarkdownIt sets token.map = [startLine, endLine] for block tokens
  if (token && token.map && token.map.length) {
    return `data-line="${token.map[0] + 1}"`;
  }
  return "";
}


md.renderer.rules.fence = (tokens, idx, _options, _env, _self) => {
  const token = tokens[idx];
  const info = token.info.trim();
  const lang = info || "";
  const diagramSource = token.content?.trim() || "";
  const encodedSource = encodeURIComponent(diagramSource);
  const lineAttr = getLineAttr(tokens, idx);
  if (info.toLowerCase() === "mermaid") {
    const mermaidDiagram = Mermaid.cache.get(diagramSource);
    if (mermaidDiagram) {
      return `<div
        class="mermaid"
        data-processed="true"
        data-mermaid-source="${encodedSource}"
        ${lineAttr}
      >
        ${mermaidDiagram}
      </div>`;
    }
    return `<div
      class="mermaid"
      data-processed="false"
      data-mermaid-source="${encodedSource}"
      ${lineAttr}
    >
      <div class="code-block">
        <div class="code-block-header">
          <span class="code-block-lang">${lang.toUpperCase()}</span>
          <button class="code-block-copy-btn" data-prismjs-copy>
            <i class="bi bi-clipboard" aria-label="Copy"></i>
          </button>
        </div>
        <pre class="language-mermaid d-flex align-items-center justify-content-center" style="min-height: 4rem; padding: 1rem;">
          <code class="text-warning">Diagram is rendering, empty or invalid. Please check the source.</code>
        </pre>
      </div>
    </div>`;
  }

  // For syntax highlighting, use a stable placeholderId
  const placeholderId = `syntax-highlight-${HighlightService.hashCode(lang + token.content)}`;
  // Check cache
  let highlightedCode = HighlightService.getFromCache(token.content, lang);
  if (!highlightedCode) {
    // Try to find a similar recent highlight for fallback
    highlightedCode = HighlightService.findSimilarHighlight(lang, token.content);
  }
  let codeBlock;
  if (highlightedCode){
    codeBlock = `<pre class="language-${lang}" data-processed="true" data-syntax-placeholder="${placeholderId}" data-code="${encodeURIComponent(token.content)}" data-lang="${lang}"><code>${highlightedCode}</code></pre>`
  } else {
    codeBlock = `<pre class="language-${lang}" data-processed="false" data-syntax-placeholder="${placeholderId}" data-code="${encodeURIComponent(token.content)}" data-lang="${lang}"><code>${MarkdownIt().utils.escapeHtml(token.content)}</code></pre>`
  }

  return `
    <div class="code-block" ${lineAttr}>
    <div class="code-block-header">
      <span class="code-block-lang">${lang.toUpperCase()}</span>
      <button class="code-block-copy-btn" data-prismjs-copy>
        <i class="bi bi-clipboard" aria-label="Copy"></i>
      </button>
    </div>
    ${codeBlock}
    </div>
  `;
};
// Headings
for (let i = 1; i <= 6; i++) {
  md.renderer.rules[`heading_open`] = (tokens, idx, _options, _env, _self) => {
    const lineAttr = getLineAttr(tokens, idx);
    // Add data-line to heading open tag
    const token = tokens[idx];
    return `<${token.tag} ${lineAttr}>`;
  };
}

// Paragraphs
md.renderer.rules.paragraph_open = (tokens, idx, _options, _env, _self) => {
  const lineAttr = getLineAttr(tokens, idx);
  const token = tokens[idx];
  return `<${token.tag} ${lineAttr}>`;
};

// Blockquotes
md.renderer.rules.blockquote_open = (tokens, idx, _options, _env, _self) => {
  const lineAttr = getLineAttr(tokens, idx);
  const token = tokens[idx];
  return `<${token.tag} ${lineAttr}>`;
};

// Lists
md.renderer.rules.bullet_list_open = (tokens, idx, _options, _env, _self) => {
  const lineAttr = getLineAttr(tokens, idx);
  const token = tokens[idx];
  return `<${token.tag} ${lineAttr}>`;
};
md.renderer.rules.ordered_list_open = (tokens, idx, _options, _env, _self) => {
  const lineAttr = getLineAttr(tokens, idx);
  const token = tokens[idx];
  return `<${token.tag} ${lineAttr}>`;
};

// Images with enhanced handling for user images and caching
md.renderer.rules.image = (tokens, idx, _options, _env, _self) => {
  const token = tokens[idx];
  const lineAttr = getLineAttr(tokens, idx);

  // Get image attributes
  const src = token.attrGet('src') || '';
  const alt = token.content || '';
  const title = token.attrGet('title') || '';

  // Extract line number from lineAttr
  const lineMatch = lineAttr.match(/data-line="(\d+)"/);
  const lineNumber = lineMatch ? lineMatch[1] : '0';

  // Extract filename from src
  const extractFilename = (url) => {
    const patterns = [
      /\/api\/images\/\d+\/([^/?]+)/,  // /api/images/7/filename.jpg
      /\/images\/([^/?]+)/,            // /images/filename.jpg
      /([^/]+\.(jpg|jpeg|png|gif|webp|svg))$/i  // filename.ext at end
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return url.split('/').pop() || 'unknown';
  };

  // Extract filename first
  const filename = extractFilename(src);

  // Check if this is a user-uploaded image
  const isUserImage = src.includes('/api/images/') || src.includes('/images/') ||
                      filename.includes('Screenshot') || filename.includes('_') ||
                      src.startsWith('data:') || !src.startsWith('http');

  // Build attributes
  const titleAttr = title ? `title="${MarkdownIt().utils.escapeHtml(title)}"` : '';
  const altAttr = `alt="${MarkdownIt().utils.escapeHtml(alt)}"`;

  // Add data attributes for caching
  const cacheAttrs = `data-original-src="${MarkdownIt().utils.escapeHtml(src)}" data-cache-enabled="true"`;

  if (isUserImage) {
    // For user images, we'll use a loading placeholder and replace it with blob URL post-render
    return `
      <div
        class="user-image-container"
        ${lineAttr}
        data-filename="${MarkdownIt().utils.escapeHtml(filename)}"
        data-features="image-controls,crop-overlay"
        style="position: relative;"
      >
        <img
          src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtc2l6ZT0iMTQiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIiBmaWxsPSIjOTk5Ij5Mb2FkaW5nLi4uPC90ZXh0Pjwvc3ZnPg=="
          ${altAttr}
          ${titleAttr}
          ${cacheAttrs}
          data-needs-auth="true"
          data-auth-url="${MarkdownIt().utils.escapeHtml(src)}"
          class="user-image img-fluid lazy-image"
          loading="lazy"
          style="max-width: 100%; height: auto;"
          data-filename="${MarkdownIt().utils.escapeHtml(filename)}"
          data-line-number="${lineNumber}"
          data-is-user-image="true"
          onerror="this.style.filter='grayscale(100%)'; this.title='Image failed to load';"
        />
        ${title ? `<div class="image-caption text-muted text-center mt-1 small">${MarkdownIt().utils.escapeHtml(title)}</div>` : ''}
      </div>
    `;
  } else {
    // Standard image handling for external images with caching
    return `
      <div class="image-container" ${lineAttr}>
        <img
          src="${MarkdownIt().utils.escapeHtml(src)}"
          ${altAttr}
          ${titleAttr}
          ${cacheAttrs}
          class="external-image img-fluid lazy-image"
          loading="lazy"
          style="max-width: 100%; height: auto;"
          onerror="this.style.filter='grayscale(100%)'; this.title='Image failed to load';"
        />
        ${title ? `<div class="image-caption text-muted text-center mt-1 small">${MarkdownIt().utils.escapeHtml(title)}</div>` : ''}
      </div>
    `;
  }
};

export function render(content) {
  return md.render(content)
}

/**
 * Apply cached images to rendered HTML
 * This should be called after the HTML is inserted into the DOM
 * Handles both regular cached images and authenticated user images
 */
export async function applyCachedImages(container) {
  if (!container) return;

  // Handle regular cached images
  const regularImages = container.querySelectorAll('img[data-cache-enabled="true"]:not([data-needs-auth])');
  const authImages = container.querySelectorAll('img[data-needs-auth="true"]');
  const totalImages = regularImages.length + authImages.length;

  if (totalImages === 0) return;

  console.log(`🖼️ Applying cached images to ${totalImages} images (${regularImages.length} regular, ${authImages.length} authenticated)`);

  // Handle regular images
  const regularPromises = Array.from(regularImages).map(async (img) => {
    const originalSrc = img.getAttribute('data-original-src');
    if (!originalSrc) return;

    try {
      const cachedSrc = await ImageCacheService.cacheImage(originalSrc);
      if (cachedSrc !== originalSrc) {
        img.src = cachedSrc;
        img.removeAttribute('data-original-src');
        img.removeAttribute('data-cache-enabled');
        console.log(`✅ Applied cached image: ${originalSrc}`);
      }
    } catch (error) {
      console.warn('Failed to apply cached image:', originalSrc, error);
    }
  });

  // Handle authenticated images
  const authPromises = Array.from(authImages).map(async (img) => {
    const authUrl = img.getAttribute('data-auth-url');
    if (!authUrl) return;

    try {
      const urlInfo = ImageCacheService.parseUserImageUrl(authUrl);

      if (urlInfo) {
        const blobUrl = await ImageCacheService.cacheAuthenticatedImage(urlInfo.filename, urlInfo.userId);
        if (blobUrl) {
          img.src = blobUrl;
          img.removeAttribute('data-needs-auth');
          img.removeAttribute('data-auth-url');
          img.removeAttribute('data-cache-enabled');
        } else {
          // Fallback to error state
          img.style.filter = 'grayscale(100%)';
          img.title = 'Failed to load authenticated image';
        }
      } else {
        img.style.filter = 'grayscale(100%)';
        img.title = 'Invalid image URL format';
      }
    } catch (error) {
      console.warn('Failed to apply authenticated image:', authUrl, error);
      img.style.filter = 'grayscale(100%)';
      img.title = 'Authentication failed';
    }
  });

  await Promise.allSettled([...regularPromises, ...authPromises]);
}

/**
 * Preload images for content
 */
export async function preloadImages(content) {
  return ImageCacheService.preloadImages(content);
}

// Export markdown instance as default for consistency
export default md;

// Legacy named export for backward compatibility
export { md };