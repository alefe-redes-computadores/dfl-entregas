import { Capacitor } from "@capacitor/core";

const ADMIN_PACKAGE = "br.com.dafamilialanches.admin";
const ADMIN_ORIGIN = "https://admin.dafamilialanches.com.br";

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

export function openDflAdmin(externalOrderId?: unknown, stage = "expedicao") {
  if (typeof window === "undefined") return false;

  if (!Capacitor.isNativePlatform()) {
    window.open(adminWebUrl(externalOrderId, stage), "_blank", "noopener,noreferrer");
    return true;
  }

  window.location.href = externalOrderId
    ? adminOrderIntentUrl(externalOrderId, stage)
    : adminHomeIntentUrl();

  return true;
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
