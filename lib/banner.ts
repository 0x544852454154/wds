export const BANNER_ART: string[] = [
  "    █                     █",
  "   ██                    ██     ▄▄▄▄▄",
  "  ██▓              ▄▄▄▄ ██▓  ▄███▀ ▀█▓▓▄",
  "▄▓▓▓▒    ▐▄▄    ▄███▀ ▀█▓▓▒ ▐▓█▓▌   ▐▒▒▓▌",
  " ▒▒▒░     ▒▓█▓▀▐▓█▓▌   ▒▒▒░ ▓▒▓▒▐    ░░░▒",
  " ░░░█     ░▒▓▒ ▓▒▓▒    ░░░█ ▀▀▒░█▄   ▀▀▀▀",
  " ██░░     █░▒░ ▒░▒░    ░█░░    ▀▀███▀▄▄",
  " ░▓▒▒     ░█░░ ░▓░█    ▒▓▒▒ ▄▒░▄ ▀▀▄█▒▒▓▄",
  " ▒▒▓▓     ▒░▓▒ ▒▒░░    ▓▒▓▓ ▓▓▒▒    ▌░▓█▐",
  " ░▓░░     ▓▒▒▓ ▓▓▒▒    ▓▓░░ ▐█▓▓▌  ▄░░██▌",
  "░████▄██▄ █░▓█ ▐█▓▓▌   ████▄ ▀ ░░▄▄███▄▀",
  "▀░░ █▀  ▀░░█ █  ▀ ░░▄ ▄█░ █▀    ▀▀▀▀▀",
];

export const BANNER_COLS: number = BANNER_ART.reduce((max, line) => Math.max(max, line.length), 0);

export const BANNER_CHARS = "░▒▓█▐▌#%&@01";

/** Glyph budget per column, used to size the banner to the viewport. */
export function bannerFontSize(): number {
  const ratio = window.innerWidth < 700 ? 0.86 : 0.29;
  return Math.max(5, Math.min(20, (window.innerWidth * ratio) / (BANNER_COLS * 0.6)));
}
