import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const source = resolve("src/openapi.json");
const destination = resolve("dist/openapi.json");

mkdirSync(dirname(destination), { recursive: true });
copyFileSync(source, destination);

console.log(`Synchronized ${source} -> ${destination}`);
