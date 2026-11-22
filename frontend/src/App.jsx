import { useState } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import Report from "./Report";
import Issues from "./Issues";
import Municipal from "./Municipal";
import ImportExcel from "./Import";

export default function App() {
  const [tab, setTab] = useState("issues");
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = () => setRefreshKey((k) => k + 1);

  const { address, isConnected } = useAccount();
  const { connect, connectors, error, isPending } = useConnect();
  const { disconnect } = useDisconnect();

  return (
    <div style={{ maxWidth: 1000, margin: "auto", padding: 20 }}>
      <h1>Smart City : signalements urbains</h1>
      <nav style={{ display: "flex", gap: 8 }}>
        <button onClick={() => setTab("issues")}>Signalements</button>
        <button onClick={() => setTab("report")}>Signaler un problème</button>
        <button onClick={() => setTab("municipal")}>Municipalité</button>
        <button onClick={() => setTab("import")}>Import Excel</button>
      </nav>

      <div style={{ margin: "12px 0" }}>
        {isConnected ? (
          <>Connecté : {address} <button onClick={() => disconnect()}>Déconnecter</button></>
        ) : (
          <>
            {connectors.length === 0 && <p style={{ color: "red" }}>Aucun wallet détecté.</p>}
            {connectors.map((c) => (
              <button key={c.uid} disabled={isPending} onClick={() => connect({ connector: c })}>
                Connecter {c.name}
              </button>
            ))}
            {error && <p style={{ color: "red" }}>Erreur : {error.message}</p>}
          </>
        )}
      </div>

      {tab === "issues" && <Issues refreshKey={refreshKey} />}
      {tab === "report" && <Report onDone={refresh} />}
      {tab === "municipal" && <Municipal onDone={refresh} />}
      {tab === "import" && <ImportExcel onDone={refresh} />}
    </div>
  );
}