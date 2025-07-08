// ModalManager.js
// Global Bootstrap Modal abstraction for robust modal handling
// Usage: ModalManager.show('modalId'), ModalManager.hide('modalId'), etc.

class ModalManager {
  constructor() {
    this.instances = new Map();
  }

  /**
   * Get or create a Bootstrap modal instance safely
   * @param {string} modalId
   * @returns {bootstrap.Modal|null}
   */
  getInstance(modalId) {
    const el = document.getElementById(modalId);
    if (!el) return null;
    if (
      typeof bootstrap === "undefined" ||
      typeof bootstrap.Modal === "undefined"
    ) {
      console.error("Bootstrap Modal not available!");
      return null;
    }
    let instance = this.instances.get(modalId);
    if (!instance) {
      instance = new bootstrap.Modal(el, {
        backdrop: true,
        keyboard: true,
        focus: true,
      });
      this.instances.set(modalId, instance);
      el.addEventListener(
        "hidden.bs.modal",
        () => {
          this.instances.delete(modalId);
        },
        { once: true },
      );
    }
    return instance;
  }

  /**
   * Show a modal by ID
   */
  show(modalId, activeTab = null) {
    const instance = this.getInstance(modalId);
    if (instance){
      instance.show();
      if (activeTab) {
        setTimeout(() => {
          targetTab = instance.querySelector(`#${activeTab.replace("-settings", "")}-tab`)
          if (targetTab) {
            const bsTab = new bootstrap.Tab(targetTab);
            bsTab.show();
          }
        }, 100);
      }
    }
  }

  /**
   * Hide a modal by ID
   */
  hide(modalId) {
    const instance = this.getInstance(modalId);
    if (instance) instance.hide();
  }

  /**
   * Force close and cleanup a modal
   */
  forceClose(modalId) {
    const el = document.getElementById(modalId);
    if (!el) return;
    const instance = bootstrap.Modal.getInstance(el);
    if (instance) {
      try {
        instance.hide();
        instance.dispose();
      } catch {}
    }
    el.classList.remove("show", "fade");
    el.style.display = "none";
    el.setAttribute("aria-hidden", "true");
    el.removeAttribute("aria-modal");
    el.removeAttribute("role");
    el.removeAttribute("tabindex");
    el.classList.add("fade");
    document.body.classList.remove("modal-open");
    document.body.style.paddingRight = "";
    document.body.style.overflow = "";
    this.instances.delete(modalId);
  }

  setData(modalId, key, value) {
    const el = document.getElementById(modalId);
    if (el) {
      el.dataset[key] = JSON.stringify(value);
    }
  }

  getData(modalId, key) {
    const el = document.getElementById(modalId);
    if (el && el.dataset[key]) {
      try {
        return JSON.parse(el.dataset[key]);
      } catch (e) {
        console.error(`Error parsing data for ${modalId} key ${key}:`, e);
      }
    }
  }

  /**
   * Add a callback for when a modal is shown
   */
  onShow(modalId, cb) {
    const el = document.getElementById(modalId);
    if (el) el.addEventListener("shown.bs.modal", cb, { once: true });
  }

  /**
   * Add a callback for when a modal is hidden
   */
  onHide(modalId, cb) {
    const el = document.getElementById(modalId);
    if (el) el.addEventListener("hidden.bs.modal", cb, { once: true });
  }
}

export default new ModalManager();
