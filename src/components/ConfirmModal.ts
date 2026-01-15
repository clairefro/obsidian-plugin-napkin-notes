import { Modal, App } from "obsidian";

export class ConfirmModal extends Modal {
  private message: string;
  private onConfirm: () => void;

  constructor(app: App, message: string, onConfirm: () => void) {
    super(app);
    this.message = message;
    this.onConfirm = onConfirm;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.createEl("h3", { text: "Confirm" });
    contentEl.createEl("p", { text: this.message });

    const btnRow = contentEl.createEl("div", { cls: "napkin-confirm-buttons" });

    const confirmBtn = btnRow.createEl("button", {
      text: "Delete",
      cls: "mod-cta",
    });
    const cancelBtn = btnRow.createEl("button", { text: "Cancel" });

    confirmBtn.addEventListener("click", () => {
      try {
        this.onConfirm();
      } catch (e) {
        console.error(e);
      }
      this.close();
    });

    cancelBtn.addEventListener("click", () => this.close());
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}
