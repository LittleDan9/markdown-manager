// ModalManager.js
// Global Bootstrap Modal abstraction for robust modal handling
// Usage: ModalManager.show('modalId'), ModalManager.hide('modalId'), etc.

class ModalManager {
  get(modalId){
    return document.getElementById(modalId);
  }

  getInstance(el) {
    return bootstrap.Modal.getOrCreateInstance(el, {
      backdrop: true,
      keyboard: true,
      focus: true,
    });
  }

  /**
   * Show a modal by ID
   */
  show(modalId, activeTab = null) {
    const el = this.get(modalId);
    if (!el) return;
    const modal = this.getInstance(el);
    modal.show();
    if (activeTab) {
      el.addEventListener("shown.bs.modal", () => {
        const tab = el.querySelector(`#${activeTab.replace('-settings', '')}-tab`);
        if (tab) new bootstrap.Tab(tab).show();
      }, { once: true });
    }
  }

  /**
   * Hide a modal by ID
   */
  hide(modalId) {
    const el = this.get(modalId);
    if (!el || !el.classList.contains('show')) return;

    const instance = bootstrap.Modal.getInstance(el);
    if (instance) instance.hide();
  }

  /**
   * Force close and cleanup a modal yep
   */
  forceClose(modalId) {
    const el = this.get(modalId);
    if (!el) return;
    const instance = bootstrap.Modal.getInstance(el);
    if (instance) instance.hide(), instance.dispose();
    el.classList.remove("show", "fade");
    el.style.display = "none";
    el.setAttribute("aria-hidden", "true");
    el.removeAttribute("aria-modal role tabindex");
    el.classList.add("fade");
    document.body.classList.remove("modal-open");
    document.body.style.paddingRight = "";
    document.body.style.overflow = "";
  }

  setData(modalId, key, value) {
    const el = this.get(modalId);
    if (el) {
      el.dataset[key] = JSON.stringify(value);
    }
  }

  getData(modalId, key) {
    const el = this.get(modalId);
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
    const el = this.get(modalId);
    if (el) el.addEventListener("shown.bs.modal", cb, { once: true });
  }

  /**
   * Add a callback for when a modal is hidden
   */
  onHide(modalId, cb) {
    const el = this.get(modalId);
    if (el) el.addEventListener("hidden.bs.modal", cb, { once: true });
  }
}

export default new ModalManager();