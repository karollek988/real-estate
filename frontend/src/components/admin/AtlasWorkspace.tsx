import { useEffect, useRef, useState } from "react";

/**
 * Hosts the KopanalysMapDemo map workspace (./atlas/atlas.ts). The demo renders
 * its own DOM into the div below, so React must never render children into it.
 * It is imported on the client only - Leaflet needs the DOM when it loads.
 */
export function AtlasWorkspace() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    let cancelled = false;
    let unmount: (() => void) | undefined;
    import("./atlas/atlas")
      .then(({ mountAtlas }) => {
        if (!cancelled) unmount = mountAtlas(root).unmount;
      })
      .catch(() => {
        if (!cancelled) setLoadFailed(true);
      });

    return () => {
      cancelled = true;
      unmount?.();
    };
  }, []);

  return (
    <>
      <div ref={rootRef} className="atlas-root" />
      {loadFailed && (
        <p role="alert" className="admin-load-error">
          Kartan kunde inte laddas. Ladda om sidan och försök igen.
        </p>
      )}
    </>
  );
}
