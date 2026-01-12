import { Plugin, Notice, MarkdownView } from "obsidian";
import { PhysicalNoteScannerSettings, DEFAULT_SETTINGS } from "./src/types";
import { PhysicalNoteScannerSettingTab } from "./src/settings/SettingsTab";
import { PhysicalNotesModal } from "./src/components/PhysicalNotesModal";
import { registerCarouselPostProcessor } from "./src/renderers/CarouselPostProcessor";

export default class PhysicalNoteScannerPlugin extends Plugin {
  settings: PhysicalNoteScannerSettings;

  async onload() {
    await this.loadSettings();

    // Add command to insert physical notes
    this.addCommand({
      id: "insert-physical-notes",
      name: "Insert physical notes",
      callback: () => {
        this.openUploadModal();
      },
    });

    // Register markdown post-processor for carousel in reading view
    if (this.settings.enableCarousel) {
      registerCarouselPostProcessor(this);
    }

    // Add settings tab
    this.addSettingTab(new PhysicalNoteScannerSettingTab(this.app, this));

    console.log("Physical Note Scanner plugin loaded");
  }

  onunload() {
    console.log("Physical Note Scanner plugin unloaded");
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  openUploadModal() {
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);

    if (!activeView) {
      new Notice("Please open a note first");
      return;
    }

    const modal = new PhysicalNotesModal(this.app, this, activeView.editor);
    modal.open();
  }
}
