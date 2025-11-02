/**
 * Application Entry Point
 * 
 * Initializes the React application with necessary providers:
 * - StrictMode for development checks
 * - TonConnectProvider for TON blockchain integration
 * - UserRuntimeProvider for user state management
 * 
 * @module main
 */

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "@/app/App";
import "@/styles/global.css";
import { UserRuntimeProvider } from "@/features/user/UserRuntimeContext";
import { TonConnectProvider } from "@/providers/TonConnectProvider";

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
