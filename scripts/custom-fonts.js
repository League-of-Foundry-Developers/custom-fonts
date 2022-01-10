import { recursiveFileBrowse, doOnceReady } from "./helpers.js";
import registerSettings from "./settings.js";

export default class CustomFonts {
  constructor() {
    registerSettings();

    Hooks.on("ready", () => this.updateFileList);

    (async () => {
      await this.dom();
      await this.config();
      await this.tinyMCE();
      this.applyUIFonts();
    })();
  }

  /** The module's ID */
  static ID = "custom-fonts";

  /** List all loaded and available fonts
   * @return {Array<string>} An array of all loaded fonts (excluding Font Awesome fonts)
   */
  list() {
    // Get the document font faces
    const fontFaces = [...document.fonts];
    // Get the family of each font face
    const fontFaceFamilies = fontFaces.map(f => f.family);
    // Get an array of font families without duplicates
    const fontFamilies = [...new Set(fontFaceFamilies)];
    // Return the fonts without the Font Awesome fonts
    return fontFamilies.filter(f => !f.includes("Font Awesome"));
  }

  /** Update the list of files available to fetch by browsing user data
   * @returns {string[]} The list of files
   */
  async updateFileList() {
    // Try to get the list of files in the directory
    let files = [];
    try {
      // Get the custom directory from settings
      const directory = game.settings.get(CustomFonts.ID, "directory");
      // Get an array of all files in the directory and it's subdirectories
      files = await recursiveFileBrowse(directory);
    } catch (err) {
      doOnceReady(ui.notifications.error(`${CustomFonts.ID} | ${game.i18n.format("custom-fonts.notifications.invalidDirectory", { error: err })}`));
    }
    // Save and return file list
    game.settings.set(CustomFonts.ID, "localFiles", files);
    return files;
  }

  /** Generate the CSS for loading all of the fonts
   * @return {Promise<string>} The CSS for loading the fonts
   */
  async generateCSS() {
    let css = "";

    // Get the fonts from the settings
    const fontFamilies = game.settings.get(CustomFonts.ID, "fonts")
      .split(",", 100).map(val => val.trim()).filter(f => f.length);

    // Construct the URL for the Google Fonts API
    if (fontFamilies.length) {
      const url = `https://fonts.googleapis.com/css2?${fontFamilies.map(f => {
        f = f.replace(" ", "+");
        f = "family=" + f;
        return f;
      }).join("&")}&display=swap`;

      // Fetch the font CSS from Google Fonts
      css = await fetch(url)
        .then(res => res.text())
        .catch(err => {
          doOnceReady(ui.notifications.error(`${CustomFonts.ID} | ${game.i18n.format("custom-fonts.notifications.connectionError", { error: err })}`));
        });
    }

    // Get the list of local files
    const files = game.settings.get(CustomFonts.ID, "localFiles");

    // Add each file to the CSS
    for (const file of files) {
      css += `\n@font-face {
  font-family: '${file.split("/").at(-1).replace(/\.otf|\.ttf|\.woff|\.woff2/, "")}';
  src: url(${file});
}`;
    }
    return css;
  }

  /** Add the fonts to the CONFIG */
  async config() {
    // List the fonts and then add each one to Foundry's list of font families if it isn't there
    this.list().forEach(f => {
      if (!CONFIG.fontFamilies.includes(f)) CONFIG.fontFamilies.push(f);
    });

    // Redraw text drawings when the canvas is ready
    Hooks.on("canvasReady", () => canvas.drawings?.placeables.filter(d => d.data.type === 't').forEach(d => d.draw()));
  }

  /** Add the fonts to the DOM */
  async dom() {
    // Remove the old element
    document.querySelector("#custom-fonts")?.remove();

    // Create a new style element
    const element = document.createElement("style");
    element.id = CustomFonts.ID;

    // Insert the generated CSS into the style element
    element.innerHTML = await this.generateCSS();

    // Add the style element to the document head
    document.head.appendChild(element);
  }

  /** Add the fonts to TinyMCE editors */
  async tinyMCE() {
    // Add the font select toolbar button if it's not already there
    if (!CONFIG.TinyMCE.toolbar.includes("fontselect")) CONFIG.TinyMCE.toolbar += " fontselect fontsizeselect";

    // Add the fonts to the font select dropdown
    CONFIG.TinyMCE.font_formats = this.list().join(";");

    // Add the fonts to the TinyMCE content style CSS or define it if it doesn't exist
    CONFIG.TinyMCE.content_style = CONFIG.TinyMCE.content_style ? CONFIG.TinyMCE.content_style + await this.generateCSS() : await this.generateCSS();
  }

  /** Apply the fonts to the CSS variables which control the font of the entire UI */
  applyUIFonts() {
    const primary = game.settings.get(CustomFonts.ID, "primary");
    document.querySelector(":root").style.setProperty("--font-primary", primary);
    const mono = game.settings.get(CustomFonts.ID, "mono");
    document.querySelector(":root").style.setProperty("--font-mono", mono);
  }
}

// Add the module's API
Hooks.on("init", () => game.modules.get("custom-fonts").api = new CustomFonts());