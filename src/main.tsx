import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "@/app/App";
import "@/styles/global.css";
import { TonConnectProvider } from "@/providers/TonConnectProvider";
import { UserRuntimeProvider } from "@/features/user/UserRuntimeContext";

const root = document.getElementById("root");
if (!root) {
  throw new Error("Root element #root not found");
}

createRoot(root).render(
  <StrictMode>
    <TonConnectProvider>
      <UserRuntimeProvider>
        <App />
      </UserRuntimeProvider>
    </TonConnectProvider>
  </StrictMode>,
);
