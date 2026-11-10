import { useEffect, useState } from "react";

// Logo do escritório — guardado no navegador (localStorage) como data URL.
// Usado no cabeçalho do sistema e nos relatórios impressos.
const KEY = "fiscalconf_logo";
const EVT = "fiscalconf-logo-change";

function ler(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function salvarLogo(dataUrl: string | null) {
  try {
    if (dataUrl) localStorage.setItem(KEY, dataUrl);
    else localStorage.removeItem(KEY);
  } catch {
    /* armazenamento indisponível */
  }
  window.dispatchEvent(new Event(EVT));
}

/** Lê um arquivo de imagem, reduz para no máx. 400px e retorna data URL. */
export function arquivoParaLogo(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const src = String(reader.result);
      if (file.type === "image/svg+xml") return resolve(src);
      const img = new Image();
      img.onerror = () => reject(new Error("Imagem inválida"));
      img.onload = () => {
        const max = 400;
        const esc = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * esc);
        c.height = Math.round(img.height * esc);
        c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL("image/png"));
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  });
}

export function useLogo(): string | null {
  const [logo, setLogo] = useState<string | null>(ler);
  useEffect(() => {
    const h = () => setLogo(ler());
    window.addEventListener(EVT, h);
    window.addEventListener("storage", h);
    return () => {
      window.removeEventListener(EVT, h);
      window.removeEventListener("storage", h);
    };
  }, []);
  return logo;
}
