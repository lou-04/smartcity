import { useEffect, useState } from "react";
import { usePublicClient } from "wagmi";
import { ABI, CONTRACT_ADDRESS, STATUS, PRIORITY, fmtDate } from "./wagmi";

export default function Issues({ refreshKey }) {
  const client = usePublicClient();
  const [issues, setIssues] = useState([]);
  const [selected, setSelected] = useState(null);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const read = (functionName, args) =>
    client.readContract({ address: CONTRACT_ADDRESS, abi: ABI, functionName, args });

  async function load() {
    setLoading(true); setError("");
    try {
      const next = Number(await read("nextIssueId"));
      const ids = Array.from({ length: next - 1 }, (_, i) => BigInt(i + 1));
      const list = await Promise.all(ids.map(async (id) => ({ id, ...(await read("getIssue", [id])) })));
      setIssues(list.reverse());
    } catch (e) {
      setError("Lecture impossible : vérifiez le node, l'adresse du contrat et le réseau.");
    }
    setLoading(false);
  }

  async function open(id) {
    setSelected(id);
    setHistory(await read("getHistory", [id]));
  }

  useEffect(() => { load(); }, [refreshKey, client]);
  useEffect(() => { if (selected) open(selected); }, [refreshKey]);

  return (
    <section>
      <h2>Signalements <button onClick={load}>Actualiser</button></h2>
      {loading && <p>Chargement…</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}
      {!loading && !error && issues.length === 0 && <p>Aucun signalement.</p>}

      {issues.length > 0 && (
        <table border="1" cellPadding="4" style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr><th>ID</th><th>Réf.</th><th>Localisation</th><th>Catégorie</th><th>Priorité</th><th>Statut</th><th>Équipe</th><th></th></tr>
          </thead>
          <tbody>
            {issues.map((i) => (
              <tr key={i.id} style={{ background: selected === i.id ? "#eef" : undefined }}>
                <td>{String(i.id)}</td><td>{i.externalId || "—"}</td><td>{i.location}</td><td>{i.category}</td>
                <td>{PRIORITY[i.priority]}</td><td>{STATUS[i.status]}</td><td>{i.team || "—"}</td>
                <td><button onClick={() => open(i.id)}>Détails</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {selected && (
        <div style={{ marginTop: 16 }}>
          <h3>Historique du signalement #{String(selected)}</h3>
          <table border="1" cellPadding="4" style={{ borderCollapse: "collapse", width: "100%" }}>
  <thead>
    <tr><th>Date</th><th>Statut</th><th>Équipe</th><th>Commentaire</th><th>Acteur (adresse)</th></tr>
  </thead>
  <tbody>
    {history.map((h, k) => (
      <tr key={k}>
        <td>{fmtDate(h.timestamp)}</td>
        <td><b>{STATUS[h.status]}</b></td>
        <td>{h.team || "—"}</td>
        <td>{h.note || "—"}</td>
        <td><small style={{ wordBreak: "break-all" }}>{h.actor}</small></td>
      </tr>
    ))}
  </tbody>
</table>
        </div>
      )}
    </section>
  );
}