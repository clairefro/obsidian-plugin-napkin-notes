import { App, PluginSettingTab, Setting } from "obsidian";
import NapkinNotesPlugin from "../../main";

export class NapkinNotesSettingTab extends PluginSettingTab {
  plugin: NapkinNotesPlugin;

  constructor(app: App, plugin: NapkinNotesPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "Napkin Notes Settings" });

    // Upload folder setting
    new Setting(containerEl)
      .setName("Upload folder")
      .setDesc(
        "Folder for physical note images. Leave empty to use the vault's default attachment folder."
      )
      .addText((text) =>
        text
          .setPlaceholder("folder/path")
          .setValue(this.plugin.settings.uploadFolder)
          .onChange(async (value) => {
            this.plugin.settings.uploadFolder = value;
            await this.plugin.saveSettings();
          })
      );

    // Server port range
    new Setting(containerEl)
      .setName("Server port range")
      .setDesc("Port range for the QR upload server (e.g., 8080-8090)")
      .addText((text) =>
        text
          .setPlaceholder("8080-8090")
          .setValue(
            `${this.plugin.settings.serverPortRange[0]}-${this.plugin.settings.serverPortRange[1]}`
          )
          .onChange(async (value) => {
            const parts = value.split("-");
            if (parts.length === 2) {
              const start = parseInt(parts[0].trim());
              const end = parseInt(parts[1].trim());
              if (!isNaN(start) && !isNaN(end) && start < end) {
                this.plugin.settings.serverPortRange = [start, end];
                await this.plugin.saveSettings();
              }
            }
          })
      );

    // Enable carousel in reading view
    new Setting(containerEl)
      .setName("Enable carousel in reading view")
      .setDesc(
        "Display physical notes as an interactive carousel instead of static images in reading view"
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.enableCarousel)
          .onChange(async (value) => {
            this.plugin.settings.enableCarousel = value;
            await this.plugin.saveSettings();
            // Trigger re-render of reading views
            this.app.workspace.trigger("css-change");
          })
      );
  }
}
