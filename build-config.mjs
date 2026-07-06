import { writeFileSync } from "node:fs";

const sheetId =
  process.env.PUBLIC_GOOGLE_SHEET_ID ||
  process.env.GOOGLE_SHEET_ID ||
  process.env.SHEET_ID ||
  "";

const config = `window.DASHBOARD_CONFIG = ${JSON.stringify({ sheetId })};\n`;

writeFileSync("public/config.js", config, "utf8");
console.log(sheetId ? "Dashboard config written." : "Dashboard config written without a sheet id.");
