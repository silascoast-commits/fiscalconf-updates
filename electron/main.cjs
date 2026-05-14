"use strict";

const { app, BrowserWindow, shell, Menu, dialog } = require("electron");
const path = require("path");
const { spawn } = require("child_process");
const http = require("http");

// ─── Configurações ─────────────────────────────────────────────────────────────
const PORT = 5799; // porta interna — evita conflito com outras apps
const SERVER_URL = `http://127.0.0.1:${PORT}`;
const SERVER_TIMEOUT_MS = 15000; // tempo máximo para o servidor subir

let mainWindow = null;
let serverProcess = null;
let serverReady = false;

// ─── Inicia o servidor Express bundlado ───────────────────────────────────────
function startServer() {
  const serverPath = path.join(__dirname, "..", "dist", "index.cjs");

  serverProcess = spawn(process.execPath, [serverPath], {
    env: {
      ...process.env,
      NODE_ENV: "production",
      PORT: String(PORT),
      ELECTRON: "1",
      // define onde o SQLite vai salvar os dados (pasta AppData do usuário)
      DB_PATH: path.join(app.getPath("userData"), "data.db"),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  serverProcess.stdout.on("data", (data) => {
    const msg = data.toString();
    console.log("[server]", msg.trim());
    if (msg.includes("serving on port") || msg.includes(String(PORT))) {
      serverReady = true;
    }
  });

  serverProcess.stderr.on("data", (data) => {
    console.error("[server:err]", data.toString().trim());
  });

  serverProcess.on("exit", (code) => {
    console.log("[server] processo encerrado, código:", code);
  });
}

// ─── Aguarda servidor responder ───────────────────────────────────────────────
function waitForServer(timeout) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    function check() {
      http.get(SERVER_URL, (res) => {
        resolve();
      }).on("error", () => {
        if (Date.now() - start > timeout) {
          reject(new Error("Servidor não respondeu a tempo."));
        } else {
          setTimeout(check, 300);
        }
      });
    }
    check();
  });
}

// ─── Cria a janela principal ──────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    show: false, // mostra só quando carregado
    title: "FiscalConf — Reforma Tributária 2026-2033",
    icon: path.join(__dirname, "icon.ico"),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  // Remove menu padrão do Electron; mantém apenas o essencial
  const menu = Menu.buildFromTemplate([
    {
      label: "Arquivo",
      submenu: [
        {
          label: "Abrir pasta de dados",
          click: () => shell.openPath(app.getPath("userData")),
        },
        { type: "separator" },
        { label: "Sair", role: "quit" },
      ],
    },
    {
      label: "Visualizar",
      submenu: [
        { label: "Recarregar", role: "reload" },
        { label: "Zoom +", role: "zoomIn" },
        { label: "Zoom −", role: "zoomOut" },
        { label: "Tamanho original", role: "resetZoom" },
        { type: "separator" },
        { label: "Tela cheia", role: "togglefullscreen" },
      ],
    },
    {
      label: "Ajuda",
      submenu: [
        {
          label: "Sobre",
          click: () =>
            dialog.showMessageBox(mainWindow, {
              type: "info",
              title: "FiscalConf",
              message: "FiscalConf — Reforma Tributária 2026-2033",
              detail:
                "Sistema de apuração e projeção tributária\n" +
                "Simples Nacional · Lucro Presumido · Lucro Real\n\n" +
                "Base legal: EC 132/2023 · LC 214/2025 · LC 123/2006\n\n" +
                `Versão: ${app.getVersion()}`,
            }),
        },
      ],
    },
  ]);
  Menu.setApplicationMenu(menu);

  // Abre links externos no browser padrão
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http://127.0.0.1")) return { action: "allow" };
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
    mainWindow.focus();
  });

  return mainWindow;
}

// ─── Tela de carregamento ──────────────────────────────────────────────────────
function createSplashWindow() {
  const splash = new BrowserWindow({
    width: 480,
    height: 300,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    center: true,
    icon: path.join(__dirname, "icon.ico"),
  });
  splash.loadURL(`data:text/html,
    <html>
    <head><meta charset="UTF-8">
    <style>
      * { margin:0; padding:0; box-sizing:border-box; }
      body {
        background: #1e3a5f;
        color: white;
        font-family: 'Segoe UI', sans-serif;
        display: flex; flex-direction: column;
        align-items: center; justify-content: center;
        height: 100vh;
        border-radius: 12px;
      }
      .logo { font-size: 42px; font-weight: 800; letter-spacing: -1px; }
      .logo span { color: #38bdf8; }
      .sub { font-size: 13px; opacity: 0.75; margin-top: 6px; }
      .loading { margin-top: 32px; font-size: 12px; opacity: 0.6; }
      .bar-wrap { width: 240px; height: 4px; background: rgba(255,255,255,0.2); border-radius: 2px; margin-top: 10px; overflow: hidden; }
      .bar { height: 100%; width: 30%; background: #38bdf8; border-radius: 2px; animation: slide 1.2s ease-in-out infinite; }
      @keyframes slide { 0%{transform:translateX(-100%)} 100%{transform:translateX(400%)} }
    </style>
    </head>
    <body>
      <div class="logo">Fiscal<span>Conf</span></div>
      <div class="sub">Reforma Tributária 2026–2033</div>
      <div class="loading">Iniciando servidor...</div>
      <div class="bar-wrap"><div class="bar"></div></div>
    </body>
    </html>
  `);
  return splash;
}

// ─── Fluxo principal ──────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  const splash = createSplashWindow();

  try {
    startServer();
    await waitForServer(SERVER_TIMEOUT_MS);

    const win = createWindow();
    await win.loadURL(SERVER_URL);

    splash.close();
  } catch (err) {
    splash.close();
    dialog.showErrorBox(
      "Erro ao iniciar FiscalConf",
      `Não foi possível iniciar o servidor interno.\n\n${err.message}\n\nTente reiniciar o aplicativo.`
    );
    app.quit();
  }
});

app.on("window-all-closed", () => {
  if (serverProcess) {
    serverProcess.kill("SIGTERM");
    serverProcess = null;
  }
  app.quit();
});

app.on("activate", () => {
  if (mainWindow === null) createWindow();
});
