import { App, PluginSettingTab, Setting, TFolder } from "obsidian";
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

    new Setting(containerEl).setName("Napkin Notes Settings").setHeading();

    // Upload folder setting with auto-suggest for valid folder paths
    new Setting(containerEl)
      .setName("Upload folder")
      .setDesc(
        "Folder for image attachments. Leave empty to use the vault's default attachment folder (recommended)."
      )
      .addText((text) => {
        const folders = this.app.vault
          .getAllLoadedFiles()
          .filter((file) => file instanceof TFolder)
          .map((folder) => folder.path);

        text
          .setPlaceholder("folder/path")
          .setValue(this.plugin.settings.uploadFolder || "")
          .onChange(async (value) => {
            this.plugin.settings.uploadFolder = value.trim();
            await this.plugin.saveSettings();
          });

        text.inputEl.addEventListener("input", (e) => {
          const inputValue = (e.target as HTMLInputElement).value;
          const suggestions = folders.filter((folder) =>
            folder.toLowerCase().includes(inputValue.toLowerCase())
          );

          // Clear existing datalist
          let dataList = text.inputEl.nextElementSibling;
          if (dataList && dataList.tagName === "DATALIST") {
            dataList.remove();
          }

          // Create new datalist
          dataList = document.createElement("datalist");
          dataList.id = "folder-suggestions";
          suggestions.forEach((folder) => {
            const option = document.createElement("option");
            option.value = folder;
            if (dataList) {
              dataList.appendChild(option);
            }
          });

          text.inputEl.setAttribute("list", "folder-suggestions");
          if (text.inputEl.parentElement) {
            text.inputEl.parentElement.appendChild(dataList);
          }
        });
      });

    // Napkin Mode background
    new Setting(containerEl)
      .setName("Napkin mode")
      .setDesc(
        "When enabled, the viewer has a paper napkin texture based on your theme (light/dark). Must re-open note to see change"
      )
      .addToggle((toggle) =>
        toggle
          .setValue(!!this.plugin.settings.enableNapkinMode)
          .onChange(async (value) => {
            this.plugin.settings.enableNapkinMode = value;
            await this.plugin.saveSettings();
            // Trigger re-render of reading views to apply background
            this.app.workspace.trigger("css-change");
          })
      );
  }
}
