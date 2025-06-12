import MarkdownIt from 'markdown-it';


const md = new MarkdownIt({
    html: true,
    linkify: true,
    highlight: function (str, lang) {
        if (lang == 'mermaid') {
            return `<div class="mermaid">\n${str}\n</div>`;
        }
        return `<pre><code>${md.utils.escapeHtml(str)}</code></pre>`;
    }
});

