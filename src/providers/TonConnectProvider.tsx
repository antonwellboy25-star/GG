import { TonConnectUIProvider } from "@tonconnect/ui-react";
import type { ReactNode } from "react";

const BASE_URL = import.meta.env.BASE_URL ?? "/";
const NORMALIZED_BASE = BASE_URL.endsWith("/") ? BASE_URL : `${BASE_URL}/`;
const MANIFEST_PATH = `${NORMALIZED_BASE}tonconnect-manifest.json`;

function resolveManifestUrl() {
  if (typeof window === "undefined") return MANIFEST_PATH;
  return new URL(MANIFEST_PATH, window.location.origin).toString();
}

export function TonConnectProvider({ children }: { children: ReactNode }) {
  return <TonConnectUIProvider manifestUrl={resolveManifestUrl()}>{children}</TonConnectUIProvider>;
}
