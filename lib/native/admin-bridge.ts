const ADMIN_PACKAGE = "br.com.dafamilialanches.admin";
const ADMIN_ORIGIN = "https://admin.dafamilialanches.com.br";
function cleanId(value: unknown) { return String(value ?? "").trim().replace(/[^A-Za-z0-9_-]/g, "").slice(0,160); }
export function adminOrderIntentUrl(externalOrderId: unknown, stage = "expedicao") {
  const id=cleanId(externalOrderId); if(!id) return "";
  const safe=["cozinha","agendados","expedicao","concluidos","cancelados"].includes(stage)?stage:"expedicao";
  const path=`/admin?stage=${encodeURIComponent(safe)}&order=${encodeURIComponent(id)}`;
  const fallback=`${ADMIN_ORIGIN}${path}`;
  return `intent://admin.dafamilialanches.com.br${path}#Intent;scheme=https;package=${ADMIN_PACKAGE};S.browser_fallback_url=${encodeURIComponent(fallback)};end`;
}
export function deliveryDeepLinkToHref(value: unknown) {
  if (typeof value !== "string" || !value) return null;

  let url: URL;

  try {
    url = new URL(value);
  } catch {
    return null;
  }

  if (
    url.protocol !== "dflentregas:" ||
    url.hostname !== "delivery"
  ) {
    return null;
  }

  const id = cleanId(url.searchParams.get("id"));

  if (!id) return null;

  return `/entregas/abrir?id=${encodeURIComponent(id)}`;
}
