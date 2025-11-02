/**
 * Home Screen Component
 *
 * Displays the main 3D mining scene with lazy-loaded MinerScene component.
 * Shows a fallback loading state while the 3D scene is being initialized.
 *
 * @module features/main/components/HomeScreen
 */

import { lazy, Suspense } from "react";
import ggLogoUrl from "@/assets/images/GG.png";

const MinerScene = lazy(() => import("@/features/mining/components/MinerScene"));

function MinerFallback() {
  return (
    <div className="maining-fallback" aria-live="polite" aria-atomic="true">
      <div className="maining-fallback__halo" />
      <img className="maining-fallback__logo" src={ggLogoUrl} alt="GG" />
      <p className="maining-fallback__text">Подготовка сцены…</p>
    </div>
  );
}

type HomeScreenProps = {
  miningActive: boolean;
};

export default function HomeScreen({ miningActive }: HomeScreenProps) {
  return (
    <div className="screen home">
      <Suspense fallback={<MinerFallback />}>
        <MinerScene active={miningActive} />
      </Suspense>
    </div>
  );
}
