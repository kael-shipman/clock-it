import { execFileSync } from "node:child_process";

const {
  APPLE_ID,
  APPLE_APP_SPECIFIC_PASSWORD,
  APPLE_TEAM_ID,
} = process.env;

function hasNotarizationCredentials() {
  return Boolean(APPLE_ID && APPLE_APP_SPECIFIC_PASSWORD && APPLE_TEAM_ID);
}

export default async function notarizeIfConfigured(context) {
  if (context.electronPlatformName !== "darwin") {
    return;
  }

  if (!hasNotarizationCredentials()) {
    console.log("Skipping notarization because Apple credentials are not configured.");
    return;
  }

  const { appOutDir, packager } = context;
  const appName = packager.appInfo.productFilename;
  const appPath = `${appOutDir}/${appName}.app`;

  execFileSync(
    "xcrun",
    [
      "notarytool",
      "submit",
      appPath,
      "--apple-id",
      APPLE_ID,
      "--password",
      APPLE_APP_SPECIFIC_PASSWORD,
      "--team-id",
      APPLE_TEAM_ID,
      "--wait",
    ],
    { stdio: "inherit" },
  );

  execFileSync("xcrun", ["stapler", "staple", appPath], { stdio: "inherit" });
}
