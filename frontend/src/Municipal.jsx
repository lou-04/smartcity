import { useState } from "react";
import { useAccount, useReadContract, useWriteContract, usePublicClient } from "wagmi";
import { keccak256, toBytes } from "viem";
import { ABI, CONTRACT_ADDRESS, STATUS, friendly } from "./wagmi";

const MUNICIPAL_ROLE = keccak256(toBytes("MUNICIPAL_ROLE"));

export default function Municipal({ onDone }) {
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const client = usePublicClient();
  const [id, setId] = useState("");
  const [issue, setIssue] = useState(null);
  const [team, setTeam] = useState("");
  const [note, setNote] = useState("");
  const [log, setLog] = useState([]);
  const addLog = (m) => setLog((l) => [...l, m]);

  const { data: isAgent } = useReadContract({
    address: CONTRACT_ADDRESS, abi: ABI, functionName: "hasRole",
    args: [MUNICIPAL_ROLE, address], query: { enabled: !!address },
  });

  async function loadIssue(target = id) {
    try {
      const data = await client.readContract({
        address: CONTRACT_ADDRESS, abi: ABI, functionName: "getIssue", args: [BigInt(target)],
      });
      setIssue(data);
    } catch { setIssue(null); addLog("❌ Signalement introuvable."); }
  }

  async function send(functionName, args, okMsg) {
    try {
      const hash = await writeContractAsync({ address: CONTRACT_ADDRESS, abi: ABI, functionName, args });
      addLog("Tx envoyée : " + hash);
      await client.waitForTransactionReceipt({ hash });
      addLog("✅ " + okMsg);
      await loadIssue();
      onDone();
    } catch (err) { addLog("❌ " + friendly(err)); }
  }

  const status = issue ? Number(issue.status) : null;
  const nextStatus = status !== null && status < 4 ? status + 1 : null;

  return (
    <section>
      {address && isAgent === false && (
        <p style={{ color: "red" }}>⚠️ Ce compte n'a pas le rôle MUNICIPAL_ROLE : les actions seront refusées.</p>
      )}
      <h2>Gestion municipale</h2>

      <input type="number" min="1" placeholder="ID du signalement" value={id} onChange={(e) => setId(e.target.value)} />
      <button onClick={() => loadIssue()}>Charger</button>

      {issue && (
        <div style={{ margin: "12px 0", padding: 10, border: "1px solid #ccc" }}>
          <p><b>{issue.location}</b> : {issue.description}</p>
          <p>Statut actuel : <b>{STATUS[status]}</b> | Équipe : {issue.team || "—"}</p>

          <input placeholder="Commentaire d'intervention (facultatif)" value={note}
       onChange={(e) => setNote(e.target.value)} style={{ width: "100%", marginBottom: 8 }} />

{(status === 0 || status === 1) && (
  <div>
    <input placeholder="Équipe d'intervention" value={team} onChange={(e) => setTeam(e.target.value)} />
    <button onClick={() => send("assignTeam", [BigInt(id), team, note], "Équipe affectée")}>
      Affecter l'équipe
    </button>
  </div>
)}

{nextStatus !== null && (
  <div style={{ marginTop: 8 }}>
    <button onClick={() => send("updateStatus", [BigInt(id), nextStatus, note], "Statut mis à jour")}>
      Passer à : {STATUS[nextStatus]}
    </button>
  </div>
)}

          {nextStatus !== null && (
            <div style={{ marginTop: 8 }}>
              <input placeholder="Note (facultatif)" value={note} onChange={(e) => setNote(e.target.value)} />
              <button onClick={() => send("updateStatus", [BigInt(id), nextStatus, note], "Statut mis à jour")}>
                Passer à : {STATUS[nextStatus]}
              </button>
            </div>
          )}
          {nextStatus === null && <p>✅ Signalement clôturé.</p>}
        </div>
      )}

      <h3>Journal</h3>
      <pre style={{ background: "#eee", padding: 8, whiteSpace: "pre-wrap" }}>{log.join("\n")}</pre>
    </section>
  );
}