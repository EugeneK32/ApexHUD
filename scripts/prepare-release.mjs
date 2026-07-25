import { readFile, writeFile } from "node:fs/promises";

const version = process.argv[2];
const semverPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

if (!version || !semverPattern.test(version)) {
  throw new Error(`Expected a semantic version, received: ${version ?? "<missing>"}`);
}

async function updateJson(path, update) {
  const source = await readFile(path, "utf8");
  const json = JSON.parse(source);
  update(json);
  await writeFile(path, `${JSON.stringify(json, null, 2)}\n`, "utf8");
}

await updateJson("package.json", (pkg) => {
  pkg.version = version;
});

await updateJson("apps/desktop/package.json", (pkg) => {
  pkg.version = version;
  pkg.dependencies ??= {};
  pkg.dependencies["@apexhud/protocol"] = version;
});

await updateJson("packages/protocol/package.json", (pkg) => {
  pkg.version = version;
});

await updateJson("package-lock.json", (lock) => {
  lock.version = version;

  const root = lock.packages?.[""];
  const desktop = lock.packages?.["apps/desktop"];
  const protocol = lock.packages?.["packages/protocol"];

  if (!root || !desktop || !protocol) {
    throw new Error("package-lock.json does not contain the expected npm workspaces");
  }

  root.version = version;
  desktop.version = version;
  desktop.dependencies ??= {};
  desktop.dependencies["@apexhud/protocol"] = version;
  protocol.version = version;
});

const telemetryProject = "services/telemetry/ApexHUD.Telemetry.csproj";
const telemetrySource = await readFile(telemetryProject, "utf8");

if (!/<Version>[^<]+<\/Version>/.test(telemetrySource)) {
  throw new Error(`${telemetryProject} does not contain a <Version> element`);
}

await writeFile(
  telemetryProject,
  telemetrySource.replace(/<Version>[^<]+<\/Version>/, `<Version>${version}</Version>`),
  "utf8",
);

console.log(`Prepared ApexHUD ${version}`);
