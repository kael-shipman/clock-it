import { app, Menu, Notification, Tray, nativeImage } from "electron";
import { APP_DISPLAY_NAME, ensureConfig, getHelloEndpoint } from "@hello-world/shared";

let tray: Tray | null = null;

function createTrayIcon() {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">
      <rect width="16" height="16" rx="3" fill="#111827"/>
      <path d="M4 8h8M8 4v8" stroke="#ffffff" stroke-width="2" stroke-linecap="round"/>
    </svg>
  `;

  const image = nativeImage.createFromDataURL(`data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`);
  if (process.platform === "darwin") {
    image.setTemplateImage(true);
  }

  return image.resize({ width: 16, height: 16 });
}

function notify(body: string): void {
  if (!Notification.isSupported()) {
    console.log(body);
    return;
  }

  new Notification({
    title: APP_DISPLAY_NAME,
    body,
  }).show();
}

async function sayHello(): Promise<void> {
  try {
    const { port } = ensureConfig();
    const response = await fetch(getHelloEndpoint(port));

    if (!response.ok) {
      throw new Error(`Server responded with ${response.status}`);
    }

    const payload = (await response.json()) as { message?: string };
    notify(payload.message ?? "hello world");
  } catch (error) {
    console.error(error);
    notify("Unable to reach the Hello World server");
  }
}

function createTray(): void {
  tray = new Tray(createTrayIcon());
  tray.setToolTip(APP_DISPLAY_NAME);

  const menu = Menu.buildFromTemplate([
    {
      label: "Say hello",
      click: () => {
        void sayHello();
      },
    },
  ]);

  tray.setContextMenu(menu);
  tray.on("click", () => {
    tray?.popUpContextMenu(menu);
  });
}

app.whenReady().then(() => {
  app.setAppUserModelId("com.clockit.helloworld.client");
  ensureConfig();

  if (process.platform === "darwin") {
    app.dock?.hide();
  }

  createTray();
});
