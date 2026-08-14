// ============================================================
// HTML UTILITIES
// Sanitizes rich-text content (recycling tips) before rendering
// and strips markup for plain-text previews.
// ============================================================

const ALLOWED_TAGS = new Set([
    'P', 'BR', 'DIV', 'SPAN',
    'B', 'STRONG', 'I', 'EM', 'U', 'S',
    'H1', 'H2', 'H3', 'H4',
    'UL', 'OL', 'LI',
    'A', 'IMG', 'BLOCKQUOTE',
]);

const ALLOWED_ATTRS: { [tag: string]: string[] } = {
    A: ['href', 'target', 'rel'],
    IMG: ['src', 'alt'],
};

const isSafeUrl = (url: string, allowData: boolean): boolean => {
    const trimmed = url.trim().toLowerCase();
    if (trimmed.startsWith('javascript:') || trimmed.startsWith('vbscript:')) return false;
    if (trimmed.startsWith('data:')) return allowData && trimmed.startsWith('data:image/');
    return true;
};

const cleanNode = (node: Node, doc: Document): void => {
    const children = Array.from(node.childNodes);
    for (const child of children) {
        if (child.nodeType === Node.TEXT_NODE) continue;
        if (child.nodeType !== Node.ELEMENT_NODE) {
            node.removeChild(child);
            continue;
        }
        const el = child as Element;
        if (!ALLOWED_TAGS.has(el.tagName)) {
            // Unwrap disallowed elements but keep their (cleaned) children
            const fragment = doc.createDocumentFragment();
            while (el.firstChild) fragment.appendChild(el.firstChild);
            node.replaceChild(fragment, el);
            cleanNode(node, doc);
            return;
        }
        // Strip all attributes except the allowlist for this tag
        const allowed = ALLOWED_ATTRS[el.tagName] || [];
        for (const attr of Array.from(el.attributes)) {
            if (!allowed.includes(attr.name.toLowerCase())) {
                el.removeAttribute(attr.name);
            }
        }
        if (el.tagName === 'A') {
            const href = el.getAttribute('href') || '';
            if (!isSafeUrl(href, false)) el.removeAttribute('href');
            el.setAttribute('target', '_blank');
            el.setAttribute('rel', 'noopener noreferrer');
        }
        if (el.tagName === 'IMG') {
            const src = el.getAttribute('src') || '';
            if (!isSafeUrl(src, true)) {
                node.removeChild(el);
                continue;
            }
        }
        cleanNode(el, doc);
    }
};

/** Sanitize rich-text HTML down to a safe allowlist of tags/attributes. */
export const sanitizeHtml = (html: string): string => {
    if (!html) return '';
    const doc = new DOMParser().parseFromString(html, 'text/html');
    cleanNode(doc.body, doc);
    return doc.body.innerHTML;
};

/** Reduce HTML to plain text for previews/list rows. */
export const stripHtml = (html: string): string => {
    if (!html) return '';
    if (!html.includes('<')) return html;
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
};
