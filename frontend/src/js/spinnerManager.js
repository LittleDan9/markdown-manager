// SpinnerManager.js
// Centralized spinner utility for showing/hiding Bootstrap spinners anywhere in the app

export default class SpinnerManager {
  /**
   * Show a spinner inside a target element (by ID or element)
   * If spinner does not exist, it will be created.
   * @param {string|HTMLElement} target - Element ID or DOM node
   * @param {object} [options] - { size: 'sm'|'md'|'lg', overlay: boolean, message: string }
   */
  static show(target, options = {}) {
    const el =
      typeof target === "string" ? document.getElementById(target) : target;
    if (!el) return;
    let spinner = el.querySelector(".spinner-border, .spinner-grow");
    if (!spinner) {
      spinner = document.createElement("div");
      spinner.className = "spinner-border text-primary";
      if (options.size === "sm") spinner.classList.add("spinner-border-sm");
      if (options.size === "lg")
        spinner.style.width = spinner.style.height = "3rem";
      spinner.setAttribute("role", "status");
      spinner.innerHTML = '<span class="visually-hidden">Loading...</span>';
      el.appendChild(spinner);
    }
    spinner.style.display = "inline-block";
    if (options.overlay) {
      el.style.position = "relative";
      spinner.style.position = "absolute";
      spinner.style.top = "50%";
      spinner.style.left = "50%";
      spinner.style.transform = "translate(-50%, -50%)";
      spinner.style.zIndex = 1000;
    }
    if (options.message) {
      let msg = el.querySelector(".spinner-message");
      if (!msg) {
        msg = document.createElement("div");
        msg.className = "spinner-message mt-2 text-muted";
        el.appendChild(msg);
      }
      msg.textContent = options.message;
      msg.style.display = "block";
    }
  }

  /**
   * Hide spinner in a target element (by ID or element)
   * @param {string|HTMLElement} target
   */
  static hide(target) {
    const el =
      typeof target === "string" ? document.getElementById(target) : target;
    if (!el) return;
    const spinner = el.querySelector(".spinner-border, .spinner-grow");
    if (spinner) spinner.style.display = "none";
    const msg = el.querySelector(".spinner-message");
    if (msg) msg.style.display = "none";
  }

  /**
   * Remove spinner from a target element
   * @param {string|HTMLElement} target
   */
  static remove(target) {
    const el =
      typeof target === "string" ? document.getElementById(target) : target;
    if (!el) return;
    const spinner = el.querySelector(".spinner-border, .spinner-grow");
    if (spinner) spinner.remove();
    const msg = el.querySelector(".spinner-message");
    if (msg) msg.remove();
  }
}
