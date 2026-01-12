import { Plugin, Notice, MarkdownView } from "obsidian";
import { NapkinNotesSettings, DEFAULT_SETTINGS } from "./src/types";
import { NapkinNotesSettingTab } from "./src/settings/SettingsTab";
import { UploadModal } from "./src/components/UploadModal";
import { registerCarouselPostProcessor } from "./src/renderers/CarouselPostProcessor";

export default class NapkinNotesPlugin extends Plugin {
  settings: NapkinNotesSettings;

  async onload() {
    await this.loadSettings();

    // Add command to insert physical notes
    this.addCommand({
      id: "insert-napkin-notes",
      name: "Insert Napkin Notes",
      callback: () => {
        this.openUploadModal();
      },
    });

    // Register markdown post-processor for carousel in reading view
    if (this.settings.enableCarousel) {
      registerCarouselPostProcessor(this);
    }

    // Add settings tab
    this.addSettingTab(new NapkinNotesSettingTab(this.app, this));

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

    const modal = new UploadModal(this.app, this, activeView.editor);
    modal.open();
  }
}
