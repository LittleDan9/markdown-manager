#!/usr/bin/env python3
"""Generate branded Markdown Manager error pages from a template.

Run:  python3 nginx/error-pages/generate.py
Outputs individual HTML files into nginx/error-pages/ for each error code.
"""

import os
import textwrap
from pathlib import Path

# ── Error definitions ────────────────────────────────────────────────────────
ERRORS = {
    400: {
        "title": "Bad Request",
        "message": "The server couldn't understand your request. Please check the URL and try again.",
        "icon": "exclamation-triangle-fill",
        "color": "#f59e0b",
        "illustration": "broken_pencil",
    },
    403: {
        "title": "Forbidden",
        "message": "You don't have permission to access this resource. If you believe this is an error, contact the site administrator.",
        "icon": "shield-lock-fill",
        "color": "#ef4444",
        "illustration": "locked_notebook",
    },
    404: {
        "title": "Page Not Found",
        "message": "The page you're looking for doesn't exist or has been moved. Perhaps it was just a draft that never got published.",
        "icon": "file-earmark-x-fill",
        "color": "#3b82f6",
        "illustration": "lost_page",
    },
    500: {
        "title": "Internal Server Error",
        "message": "Something went wrong on our end. Our servers are having a moment — we're working on it.",
        "icon": "gear-wide-connected",
        "color": "#ef4444",
        "illustration": "broken_gear",
    },
    502: {
        "title": "Bad Gateway",
        "message": "The upstream server isn't responding. This usually means a service is restarting or temporarily unavailable.",
        "icon": "hdd-network-fill",
        "color": "#f59e0b",
        "illustration": "disconnected",
    },
    503: {
        "title": "Service Unavailable",
        "message": "Markdown Manager is temporarily unavailable for maintenance. We'll be back shortly — probably just deploying an update.",
        "icon": "wrench-adjustable-circle-fill",
        "color": "#6366f1",
        "illustration": "maintenance",
    },
    504: {
        "title": "Gateway Timeout",
        "message": "The upstream server took too long to respond. This might happen with large documents or heavy processing.",
        "icon": "hourglass-split",
        "color": "#f59e0b",
        "illustration": "hourglass",
    },
}

# ── SVG illustrations ────────────────────────────────────────────────────────
ILLUSTRATIONS = {
    "broken_pencil": textwrap.dedent("""\
        <svg viewBox="0 0 200 160" fill="none" xmlns="http://www.w3.org/2000/svg">
          <!-- Broken pencil -->
          <rect x="60" y="30" width="12" height="80" rx="2" fill="#4f6df5" transform="rotate(-15 66 70)"/>
          <polygon points="60,108 66,125 72,108" fill="#f59e0b" transform="rotate(-15 66 116)"/>
          <rect x="60" y="28" width="12" height="10" rx="1" fill="#ef4444" transform="rotate(-15 66 33)"/>
          <!-- Break line -->
          <line x1="55" y1="72" x2="82" y2="65" stroke="#94a3b8" stroke-width="2" stroke-dasharray="4,3"/>
          <!-- Paper -->
          <rect x="100" y="40" width="60" height="80" rx="4" fill="#e2e8f0" stroke="#cbd5e1" stroke-width="1.5"/>
          <line x1="110" y1="55" x2="150" y2="55" stroke="#94a3b8" stroke-width="2" stroke-linecap="round"/>
          <line x1="110" y1="65" x2="145" y2="65" stroke="#94a3b8" stroke-width="2" stroke-linecap="round"/>
          <line x1="110" y1="75" x2="140" y2="75" stroke="#94a3b8" stroke-width="2" stroke-linecap="round"/>
          <line x1="110" y1="85" x2="130" y2="85" stroke="#94a3b8" stroke-width="2" stroke-linecap="round"/>
          <!-- Question mark -->
          <text x="125" y="110" text-anchor="middle" fill="#94a3b8" font-size="16" font-weight="bold">?</text>
        </svg>"""),
    "locked_notebook": textwrap.dedent("""\
        <svg viewBox="0 0 200 160" fill="none" xmlns="http://www.w3.org/2000/svg">
          <!-- Notebook -->
          <rect x="50" y="25" width="80" height="110" rx="6" fill="#e2e8f0" stroke="#cbd5e1" stroke-width="1.5"/>
          <rect x="55" y="30" width="70" height="100" rx="4" fill="#f8fafc"/>
          <!-- Spine rings -->
          <circle cx="50" cy="45" r="5" fill="none" stroke="#94a3b8" stroke-width="1.5"/>
          <circle cx="50" cy="65" r="5" fill="none" stroke="#94a3b8" stroke-width="1.5"/>
          <circle cx="50" cy="85" r="5" fill="none" stroke="#94a3b8" stroke-width="1.5"/>
          <circle cx="50" cy="105" r="5" fill="none" stroke="#94a3b8" stroke-width="1.5"/>
          <!-- Lock -->
          <rect x="78" y="70" width="24" height="20" rx="3" fill="#ef4444"/>
          <path d="M84 70 V62 A6 6 0 0 1 96 62 V70" fill="none" stroke="#ef4444" stroke-width="3" stroke-linecap="round"/>
          <circle cx="90" cy="81" r="2.5" fill="#fef2f2"/>
          <!-- Keyhole -->
          <rect x="89" y="83" width="2" height="4" rx="1" fill="#fef2f2"/>
        </svg>"""),
    "lost_page": textwrap.dedent("""\
        <svg viewBox="0 0 200 160" fill="none" xmlns="http://www.w3.org/2000/svg">
          <!-- Document with folded corner -->
          <path d="M55 25 H125 L145 45 V135 A4 4 0 0 1 141 139 H59 A4 4 0 0 1 55 135 Z" fill="#e2e8f0" stroke="#cbd5e1" stroke-width="1.5"/>
          <path d="M125 25 V41 A4 4 0 0 0 129 45 H145" fill="#cbd5e1" stroke="#cbd5e1" stroke-width="1.5"/>
          <!-- Content lines -->
          <line x1="70" y1="60" x2="130" y2="60" stroke="#94a3b8" stroke-width="2" stroke-linecap="round"/>
          <line x1="70" y1="72" x2="125" y2="72" stroke="#94a3b8" stroke-width="2" stroke-linecap="round"/>
          <line x1="70" y1="84" x2="120" y2="84" stroke="#94a3b8" stroke-width="2" stroke-linecap="round"/>
          <!-- Magnifying glass -->
          <circle cx="135" cy="110" r="18" fill="none" stroke="#4f6df5" stroke-width="3"/>
          <line x1="148" y1="123" x2="162" y2="137" stroke="#4f6df5" stroke-width="4" stroke-linecap="round"/>
          <!-- Question mark in magnifying glass -->
          <text x="135" y="116" text-anchor="middle" fill="#4f6df5" font-size="18" font-weight="bold">?</text>
        </svg>"""),
    "broken_gear": textwrap.dedent("""\
        <svg viewBox="0 0 200 160" fill="none" xmlns="http://www.w3.org/2000/svg">
          <!-- Gear -->
          <path d="M100 45 L106 48 L110 42 L118 46 L116 54 L122 58 L128 54 L132 62 L126 66 L128 72 L134 74 L132 82 L126 82 L124 88 L130 92 L126 100 L120 96 L114 100 L116 108 L108 110 L106 102 L100 102 L98 110 L90 108 L92 100 L86 96 L80 100 L76 92 L82 88 L80 82 L74 82 L72 74 L78 72 L76 66 L70 62 L74 54 L80 58 L86 54 L84 46 L92 42 L96 48 Z" fill="#ef4444" opacity="0.85"/>
          <circle cx="102" cy="76" r="14" fill="#fef2f2"/>
          <!-- Crack -->
          <path d="M92 55 L98 70 L90 78 L100 90 L95 105" fill="none" stroke="#7f1d1d" stroke-width="2" stroke-linecap="round"/>
          <!-- Sparks -->
          <circle cx="75" cy="45" r="2" fill="#f59e0b"/>
          <circle cx="130" cy="50" r="1.5" fill="#f59e0b"/>
          <circle cx="65" cy="95" r="1.5" fill="#f59e0b"/>
          <line x1="135" y1="95" x2="142" y2="90" stroke="#f59e0b" stroke-width="1.5" stroke-linecap="round"/>
          <line x1="138" y1="100" x2="145" y2="100" stroke="#f59e0b" stroke-width="1.5" stroke-linecap="round"/>
        </svg>"""),
    "disconnected": textwrap.dedent("""\
        <svg viewBox="0 0 200 160" fill="none" xmlns="http://www.w3.org/2000/svg">
          <!-- Server 1 -->
          <rect x="25" y="55" width="55" height="50" rx="6" fill="#e2e8f0" stroke="#cbd5e1" stroke-width="1.5"/>
          <circle cx="40" cy="72" r="3" fill="#10b981"/>
          <circle cx="40" cy="85" r="3" fill="#10b981"/>
          <line x1="50" y1="72" x2="70" y2="72" stroke="#94a3b8" stroke-width="2" stroke-linecap="round"/>
          <line x1="50" y1="85" x2="65" y2="85" stroke="#94a3b8" stroke-width="2" stroke-linecap="round"/>
          <!-- Server 2 -->
          <rect x="120" y="55" width="55" height="50" rx="6" fill="#e2e8f0" stroke="#cbd5e1" stroke-width="1.5"/>
          <circle cx="135" cy="72" r="3" fill="#ef4444"/>
          <circle cx="135" cy="85" r="3" fill="#94a3b8"/>
          <line x1="145" y1="72" x2="165" y2="72" stroke="#94a3b8" stroke-width="2" stroke-linecap="round"/>
          <line x1="145" y1="85" x2="160" y2="85" stroke="#94a3b8" stroke-width="2" stroke-linecap="round"/>
          <!-- Broken connection -->
          <line x1="80" y1="75" x2="95" y2="75" stroke="#f59e0b" stroke-width="2.5" stroke-dasharray="4,3"/>
          <line x1="105" y1="85" x2="120" y2="85" stroke="#f59e0b" stroke-width="2.5" stroke-dasharray="4,3"/>
          <!-- Lightning bolt (break) -->
          <path d="M98 68 L103 78 L97 78 L102 90" fill="none" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>"""),
    "maintenance": textwrap.dedent("""\
        <svg viewBox="0 0 200 160" fill="none" xmlns="http://www.w3.org/2000/svg">
          <!-- Document -->
          <rect x="65" y="25" width="70" height="90" rx="5" fill="#e2e8f0" stroke="#cbd5e1" stroke-width="1.5"/>
          <line x1="78" y1="45" x2="122" y2="45" stroke="#94a3b8" stroke-width="2" stroke-linecap="round"/>
          <line x1="78" y1="57" x2="118" y2="57" stroke="#94a3b8" stroke-width="2" stroke-linecap="round"/>
          <line x1="78" y1="69" x2="110" y2="69" stroke="#94a3b8" stroke-width="2" stroke-linecap="round"/>
          <line x1="78" y1="81" x2="115" y2="81" stroke="#94a3b8" stroke-width="2" stroke-linecap="round"/>
          <!-- Wrench -->
          <path d="M115 95 L145 125" stroke="#6366f1" stroke-width="5" stroke-linecap="round"/>
          <circle cx="150" cy="130" r="8" fill="none" stroke="#6366f1" stroke-width="3"/>
          <circle cx="110" cy="90" r="6" fill="#6366f1"/>
          <!-- Progress bar -->
          <rect x="55" y="135" width="90" height="8" rx="4" fill="#e2e8f0" stroke="#cbd5e1" stroke-width="1"/>
          <rect x="55" y="135" width="45" height="8" rx="4" fill="#6366f1"/>
          <!-- Dots -->
          <circle cx="155" cy="50" r="3" fill="#6366f1" opacity="0.3"/>
          <circle cx="165" cy="60" r="2" fill="#6366f1" opacity="0.2"/>
          <circle cx="45" cy="100" r="2.5" fill="#6366f1" opacity="0.25"/>
        </svg>"""),
    "hourglass": textwrap.dedent("""\
        <svg viewBox="0 0 200 160" fill="none" xmlns="http://www.w3.org/2000/svg">
          <!-- Hourglass frame -->
          <rect x="70" y="20" width="60" height="6" rx="3" fill="#94a3b8"/>
          <rect x="70" y="134" width="60" height="6" rx="3" fill="#94a3b8"/>
          <!-- Glass shape -->
          <path d="M78 26 L78 55 Q100 80 100 80 Q100 80 78 105 L78 134" fill="none" stroke="#94a3b8" stroke-width="2"/>
          <path d="M122 26 L122 55 Q100 80 100 80 Q100 80 122 105 L122 134" fill="none" stroke="#94a3b8" stroke-width="2"/>
          <!-- Sand top -->
          <path d="M82 40 L118 40 Q100 65 100 65 Q100 65 82 40" fill="#f59e0b" opacity="0.6"/>
          <!-- Sand bottom -->
          <path d="M85 130 L115 130 Q115 110 100 100 Q85 110 85 130" fill="#f59e0b" opacity="0.6"/>
          <!-- Sand stream -->
          <line x1="100" y1="68" x2="100" y2="98" stroke="#f59e0b" stroke-width="1.5"/>
          <!-- Clock dots around -->
          <circle cx="50" cy="80" r="2" fill="#f59e0b" opacity="0.4"/>
          <circle cx="150" cy="80" r="2" fill="#f59e0b" opacity="0.4"/>
          <circle cx="100" cy="10" r="2" fill="#f59e0b" opacity="0.4"/>
          <circle cx="100" cy="150" r="2" fill="#f59e0b" opacity="0.4"/>
        </svg>"""),
}


# ── HTML template ────────────────────────────────────────────────────────────
TEMPLATE = """\
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{code} — {title} | Markdown Manager</title>
<link rel="icon" href="/favicon.ico">
<style>
  *,*::before,*::after{{box-sizing:border-box;margin:0;padding:0}}
  :root{{
    --mm-primary:#4f6df5;--mm-bg:#ffffff;--mm-bg-surface:#f9fafb;
    --mm-text:#111827;--mm-text-secondary:#6b7280;
    --mm-border:#e5e7eb;--mm-accent-color:{color};
  }}
  @media(prefers-color-scheme:dark){{
    :root{{
      --mm-bg:#0f172a;--mm-bg-surface:#1e293b;
      --mm-text:#e2e8f0;--mm-text-secondary:#94a3b8;
      --mm-border:#334155;
    }}
  }}
  body{{
    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;
    background:var(--mm-bg);color:var(--mm-text);
    display:flex;flex-direction:column;align-items:center;justify-content:center;
    min-height:100vh;padding:2rem;text-align:center;
    line-height:1.6;
  }}
  .brand{{
    display:flex;align-items:center;gap:.5rem;
    margin-bottom:2rem;opacity:.7;
  }}
  .brand svg{{width:28px;height:28px}}
  .brand span{{font-size:1rem;font-weight:600;letter-spacing:-.01em}}
  .illustration{{width:180px;height:auto;margin-bottom:1.5rem}}
  .error-code{{
    font-size:6rem;font-weight:800;line-height:1;
    color:var(--mm-accent-color);opacity:.85;
    letter-spacing:-.04em;
  }}
  .error-title{{
    font-size:1.5rem;font-weight:600;margin:.5rem 0;
    color:var(--mm-text);
  }}
  .error-message{{
    max-width:440px;color:var(--mm-text-secondary);
    font-size:.95rem;margin-bottom:2rem;
  }}
  .actions{{display:flex;gap:.75rem;flex-wrap:wrap;justify-content:center}}
  .btn{{
    display:inline-flex;align-items:center;gap:.4rem;
    padding:.6rem 1.25rem;border-radius:.5rem;font-size:.875rem;
    font-weight:500;text-decoration:none;cursor:pointer;
    transition:background .15s,box-shadow .15s;border:none;
  }}
  .btn-primary{{
    background:var(--mm-primary);color:#fff;
  }}
  .btn-primary:hover{{background:#3b57d9}}
  .btn-outline{{
    background:transparent;color:var(--mm-text-secondary);
    border:1px solid var(--mm-border);
  }}
  .btn-outline:hover{{background:var(--mm-bg-surface)}}
  .footer{{
    margin-top:3rem;font-size:.75rem;color:var(--mm-text-secondary);opacity:.6;
  }}
  .origin-badge{{
    display:inline-block;
    font-size:.65rem;
    padding:.15rem .45rem;
    border-radius:.25rem;
    background:var(--mm-bg-surface);
    border:1px solid var(--mm-border);
    color:var(--mm-text-secondary);
    margin-top:.5rem;
  }}
</style>
</head>
<body>
  <div class="brand">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="var(--mm-primary)">
      <path d="M14 3a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h12zM2 2a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H2z"/>
      <path fill-rule="evenodd" d="M9.146 8.146a.5.5 0 0 1 .708 0L11.5 9.793l1.646-1.647a.5.5 0 0 1 .708.708l-2 2a.5.5 0 0 1-.708 0l-2-2a.5.5 0 0 1 0-.708z"/>
      <path fill-rule="evenodd" d="M11.5 5a.5.5 0 0 1 .5.5v4a.5.5 0 0 1-1 0v-4a.5.5 0 0 1 .5-.5z"/>
      <path d="M3.56 11V3.01h.056l2.428 6.849h.774l2.428-6.849h.056V11h1.073V2h-1.632L6.4 8.905h-.098L3.969 2H2.487v9h1.073z"/>
    </svg>
    <span>Markdown Manager</span>
  </div>

  <div class="illustration">
    {illustration}
  </div>

  <div class="error-code">{code}</div>
  <h1 class="error-title">{title}</h1>
  <p class="error-message">{message}</p>

  <div class="actions">
    <a href="/" class="btn btn-primary">
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16"><path d="M8.354 1.146a.5.5 0 0 0-.708 0l-6 6A.5.5 0 0 0 1.5 7.5v7a.5.5 0 0 0 .5.5h4.5a.5.5 0 0 0 .5-.5v-4h2v4a.5.5 0 0 0 .5.5H14a.5.5 0 0 0 .5-.5v-7a.5.5 0 0 0-.146-.354L13 5.793V2.5a.5.5 0 0 0-.5-.5h-1a.5.5 0 0 0-.5.5v1.293L8.354 1.146ZM2.5 14V7.707l5.5-5.5 5.5 5.5V14H10v-4a.5.5 0 0 0-.5-.5h-3a.5.5 0 0 0-.5.5v4H2.5Z"/></svg>
      Go Home
    </a>
    <button onclick="location.reload()" class="btn btn-outline">
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z"/><path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z"/></svg>
      Retry
    </button>
  </div>

  <div class="footer">
    Markdown Manager
    <br>
    <span class="origin-badge" id="nginx-origin">nginx</span>
  </div>
<script>
// Try to identify which nginx layer served this page from the response header.
// The X-MM-Nginx header is set to "container-dev", "container-prod", or "host-prod".
try {{
  var xhr = new XMLHttpRequest();
  xhr.open('HEAD', window.location.href, true);
  xhr.onreadystatechange = function() {{
    if (xhr.readyState === 2) {{
      var origin = xhr.getResponseHeader('X-MM-Nginx');
      if (origin) {{
        document.getElementById('nginx-origin').textContent = origin;
      }}
      xhr.abort();
    }}
  }};
  xhr.send();
}} catch(e) {{}}
</script>
</body>
</html>
"""


def generate():
    out_dir = Path(__file__).parent
    for code, info in ERRORS.items():
        html = TEMPLATE.format(
            code=code,
            title=info["title"],
            message=info["message"],
            color=info["color"],
            illustration=ILLUSTRATIONS[info["illustration"]],
        )
        path = out_dir / f"{code}.html"
        path.write_text(html)
        print(f"  ✓ {path.name}")

    print(f"\nGenerated {len(ERRORS)} error pages in {out_dir}")


if __name__ == "__main__":
    generate()
