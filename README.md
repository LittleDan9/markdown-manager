# Local Mermaid Live

## Install Mermaid (Node Package) Locally

1. In VS Code, open the integrated terminal (\`Ctrl+\`\`). By default this is PowerShell.
2. Run:

   ```powershell
   npm init -y
   npm install @mermaid-js/mermaid
   ```

   * `npm init -y` creates a `package.json` with defaults.
   * `npm install @mermaid-js/mermaid` puts Mermaid into `node_modules/@mermaid-js/mermaid/`.
3. In your project folder, you’ll now see:

   ```
   mermaid-demo\
   ├─ node_modules\
   │   └─ @mermaid-js\
   │       └─ mermaid\
   │           └─ dist\
   │               └─ mermaid.min.js
   ├─ package.json
   └─ package-lock.json
   ```
4. To confirm you have the “latest”:

   ```powershell
   npm ls @mermaid-js/mermaid
   ```

   – You should see something like `@mermaid-js/mermaid@10.x.x`.

---

## 4. Create a Simple “Live‐Editor” HTML in VS Code

We’ll drop in an `index.html` that loads `mermaid.min.js` from `node_modules`. Then we’ll use the Live Server extension to serve it.

1. In VS Code, inside `mermaid‐demo`, create a new file:

   ```
   index.html
   ```

2. Paste in the following contents. Notice the Windows‐friendly path to `mermaid.min.js` using forward slashes (Node and browsers interpret them just fine):

   ```html
   <!DOCTYPE html>
   <html lang="en">
   <head>
     <meta charset="UTF-8" />
     <title>Mermaid Live Editor (Local)</title>
     <style>
       body {
         margin: 0;
         display: flex;
         height: 100vh;
         font-family: Segoe UI, Arial, sans-serif;
       }
       #editor {
         width: 40%;
         padding: 1rem;
         border-right: 1px solid #ccc;
         box-sizing: border-box;
       }
       #preview {
         width: 60%;
         padding: 1rem;
         overflow: auto;
       }
       textarea {
         width: 100%;
         height: calc(100% - 2rem);
         font-family: Consolas, monospace;
         font-size: 14px;
         box-sizing: border-box;
       }
       .mermaid {
         max-width: 100%;
       }
     </style>
     <!-- Load mermaid.min.js from node_modules -->
     <script src="node_modules/@mermaid-js/mermaid/dist/mermaid.min.js"></script>
     <script>
       // Initialize Mermaid so we can call mermaid.init(...) manually
       mermaid.initialize({
         startOnLoad: false,
         theme: 'default'
       });

       function renderMermaid() {
         const code = document.getElementById('mermaidSource').value;
         const previewDiv = document.getElementById('preview');
         previewDiv.innerHTML = ''; // clear previous
         const graphDiv = document.createElement('div');
         graphDiv.className = 'mermaid';
         graphDiv.textContent = code;
         previewDiv.appendChild(graphDiv);
         // Only render this new graph
         mermaid.init(undefined, graphDiv);
       }

       window.addEventListener('DOMContentLoaded', () => {
         const txt = document.getElementById('mermaidSource');
         // Put a sample diagram in the textarea
         txt.value = `%% Sample flowchart
   flowchart LR
     A[Square Rect] --> B((Circle))
     B --> C{Rhombus?}
     C -->|One| D[Result 1]
     C -->|Two| E[Result 2]`;
         renderMermaid();
         txt.addEventListener('input', renderMermaid);
       });
     </script>
   </head>
   <body>
     <div id="editor">
       <h3>Mermaid Source</h3>
       <textarea id="mermaidSource"></textarea>
     </div>
     <div id="preview">
       <h3>Rendered Diagram</h3>
       <!-- Mermaid output appears here -->
     </div>
   </body>
   </html>
   ```

3. Save `index.html`. In VS Code, right‐click anywhere in `index.html` and choose **Open with Live Server** (or click “Go Live” in the status bar).

   * By default, Live Server will spin up something like `http://127.0.0.1:5500/index.html`.
   * In your browser, you should see a split pane: on the left a textarea with sample Mermaid code, on the right the rendered diagram.
   * As you type or paste new Mermaid syntax into the left textarea, the right side updates automatically.

---

## 5. (Optional) Use Mermaid CLI on Windows to Export SVG/PNG

If you ever want to render a Mermaid `.mmd` (or `.txt`) file to an image without the browser, install the Mermaid CLI globally:

1. In VS Code’s terminal (or any PowerShell), run:

   ```powershell
   npm install -g @mermaid-js/mermaid-cli
   ```

2. Now you have the `mmdc` command. Example usage:

   * Create a file `diagram.mmd` in your folder (right‐click → New File) with contents such as:

     ```
     %% diagram.mmd
     sequenceDiagram
       Alice->>Bob: Hello Bob
       Bob-->>Alice: Hi Alice
     ```
   * In PowerShell, run:

     ```powershell
     mmdc -i diagram.mmd -o diagram.svg
     ```
   * After a second or two, you’ll see `diagram.svg` appear in the folder. You can also replace `-o diagram.png` if you need a PNG.

3. If you need a specific version of the CLI, you can append `@<version>`:

   ```powershell
   npm install -g @mermaid-js/mermaid-cli@10.0.2
   ```

---

## 6. (Optional) Clone & Run the Full “Mermaid Live Editor” Repo

If you want the full official editor (with toolbar, theme picker, export buttons, etc.), you can clone and run it locally. This requires Git (and optionally a Windows‐friendly Git client like Git for Windows).

1. **Install Git for Windows** (if you haven’t):

   * Download from [https://gitforwindows.org/](https://gitforwindows.org/) and install.
   * In a PowerShell or Git Bash window, verify:

     ```powershell
     git --version
     ```

2. **Clone the live‐editor repo**
   In your desired folder (e.g., `C:\Users\<YourUser>\Projects\`), run:

   ```powershell
   git clone https://github.com/mermaid-js/mermaid-live-editor.git
   cd mermaid-live-editor
   npm install
   ```

3. **Start the dev server**

   ```powershell
   npm run dev
   ```

   * By default, it will open `http://localhost:3000/` in your browser.
   * You’ll see the full React/Vue (depending on version) interface, with export buttons, history, etc.

4. **Stop the server** with `Ctrl+C` in the terminal when you’re done.

---

## 7. Using Python to Serve (Alternative to Live Server)

If you ever prefer to use Python’s built‐in HTTP server instead of Live Server:

1. Open a Command Prompt or PowerShell window in `C:\Users\<YourUser>\Projects\mermaid‐demo\`.
2. Run:

   ```powershell
   python -m http.server 8000
   ```
3. Browse to `http://localhost:8000/index.html`. The behavior is identical to Live Server (except no hot-reload on save). You’ll need to manually refresh if you change `index.html` or any JS.

---

## 8. Folder Structure Summary

By the end of Steps 3–4, your `mermaid-demo` folder should look like:

```
C:\Users\<YourUser>\Projects\mermaid-demo\
├─ node_modules\
│   └─ @mermaid-js\
│       └─ mermaid\
│           └─ dist\
│               └─ mermaid.min.js
├─ index.html
├─ package.json
└─ package-lock.json
```

* **`index.html`** is our live‐preview page.
* **`node_modules/@mermaid-js/mermaid/dist/mermaid.min.js`** is the local Mermaid script.
* **`mmdc`** (Mermaid CLI) is available globally once you run `npm install -g @mermaid-js/mermaid-cli`.

---

## 9. Quick Tips & Troubleshooting

* **“404” or “mermaid.min.js not found”**

  * Make sure `index.html` refers exactly to `node_modules/@mermaid-js/mermaid/dist/mermaid.min.js`. Paths are case‐sensitive in the browser.
  * If you ever move `mermaid.min.js` into a `js/` folder, update the `<script src="…">` accordingly (e.g., `js/mermaid.min.js`).

* **Live Server not hot-reloading**

  * Live Server usually auto‐refreshes when you save `index.html`. If it doesn’t, click the “Go Live” button again or restart the extension.

* **CLI rendering is slow or hangs**

  * Ensure your `.mmd` file has valid Mermaid syntax. Any parsing error will cause `mmdc` to print an error and exit.
  * Try a very simple diagram (like `graph LR; A-->B;`) to test.

* **Updating Mermaid version**

  * If you installed Mermaid locally with `npm install @mermaid-js/mermaid`, simply run:

    ```powershell
    npm update @mermaid-js/mermaid
    ```

    to grab the latest. Then restart your Live Server preview, and you should see the new version’s capabilities (new syntax, themes, etc).

* **Using custom themes or configs**
  Inside the `<script>` tag of `index.html`, you can pass extra options to `mermaid.initialize({ … })`, for example:

  ```js
  mermaid.initialize({
    startOnLoad: false,
    theme: 'dark',       // try 'forest', 'dark', 'neutral', etc.
    securityLevel: 'loose' // allows raw HTML in nodes
  });
  ```

  Feel free to explore the [Mermaid Configuration Docs](https://mermaid-js.github.io/mermaid/#/configuration) for more.

---

### You’re All Set!

* **To preview/edit diagrams in real time:** open `index.html` in VS Code, click **Go Live**, and watch your Mermaid code render instantly in the browser pane.
* **To export a standalone image:** run `mmdc -i yourfile.mmd -o yourfile.svg` in PowerShell.
* **To run the full official editor** (with toolbar, history, etc.), clone `mermaid-live-editor.git` and `npm run dev`.

Enjoy using Mermaid.js locally on your Windows machine!
