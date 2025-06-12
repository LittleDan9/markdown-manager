export async function initMermaid(theme) {
    const { default: mermaid } = await import('https://cdn.jsdelivr.net/npm/mermaid@10.9.1/dist/mermaid.esm.min.mjs');

    window.mermaid = mermaid;
    mermaid.initialize({
        startOnLoad: false,
        theme: theme
    });

    return mermaid;
}
