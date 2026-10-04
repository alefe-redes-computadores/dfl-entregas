import { Capacitor, registerPlugin } from "@capacitor/core";

const ADMIN_PACKAGE = "br.com.dafamilialanches.admin";
const ADMIN_ORIGIN = "https://admin.dafamilialanches.com.br";

export type AdminOpenResult = {
  opened: boolean;
  target: "app" | "browser" | "web" | "same-tab" | "none";
  message?: string;
};

type NativeAdminLauncherPlugin = {
  open(options: { url: string }): Promise<AdminOpenResult>;
};

const NativeAdminLauncher = registerPlugin<NativeAdminLauncherPlugin>(
  "AdminLauncher",
);

function cleanId(value: unknown) {
  return String(value ?? "").trim().replace(/[^A-Za-z0-9_-]/g, "").slice(0, 160);
}

function adminPath(externalOrderId?: unknown, stage = "expedicao") {
  const id = cleanId(externalOrderId);
  if (!id) return "/admin";

  const safe = ["cozinha", "agendados", "expedicao", "concluidos", "cancelados"].includes(stage)
    ? stage
    : "expedicao";

  return `/admin?stage=${encodeURIComponent(safe)}&order=${encodeURIComponent(id)}`;
}

export function adminOrderIntentUrl(externalOrderId: unknown, stage = "expedicao") {
  const path = adminPath(externalOrderId, stage);
  const fallback = `${ADMIN_ORIGIN}${path}`;
  return `intent://admin.dafamilialanches.com.br${path}#Intent;scheme=https;package=${ADMIN_PACKAGE};S.browser_fallback_url=${encodeURIComponent(fallback)};end`;
}

export function adminHomeIntentUrl() {
  const path = "/admin";
  const fallback = `${ADMIN_ORIGIN}${path}`;
  return `intent://admin.dafamilialanches.com.br${path}#Intent;scheme=https;package=${ADMIN_PACKAGE};S.browser_fallback_url=${encodeURIComponent(fallback)};end`;
}

export function adminWebUrl(externalOrderId?: unknown, stage = "expedicao") {
  return `${ADMIN_ORIGIN}${adminPath(externalOrderId, stage)}`;
}

export async function openDflAdmin(
  externalOrderId?: unknown,
  stage = "expedicao",
): Promise<AdminOpenResult> {
  if (typeof window === "undefined") {
    return { opened: false, target: "none", message: "Janela indisponível." };
  }

  const url = adminWebUrl(externalOrderId, stage);

  if (!Capacitor.isNativePlatform()) {
    const popup = window.open(url, "_blank", "noopener,noreferrer");
    if (popup) return { opened: true, target: "web" };

    window.location.assign(url);
    return { opened: true, target: "same-tab" };
  }

  try {
    return await NativeAdminLauncher.open({ url });
  } catch (error) {
    return {
      opened: false,
      target: "none",
      message:
        error instanceof Error
          ? error.message
          : "Não foi possível abrir o DFL Admin.",
    };
  }
}

export function deliveryDeepLinkToHref(value: unknown) {
  if (typeof value !== "string" || !value) return null;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  if (url.protocol !== "dflentregas:" || url.hostname !== "delivery") {
    return null;
  }

  const id = cleanId(url.searchParams.get("id"));
  if (!id) return null;

  return `/entregas/abrir?id=${encodeURIComponent(id)}`;
}
