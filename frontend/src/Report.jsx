import { useState } from "react";
import { useAccount, useWriteContract, usePublicClient } from "wagmi";
import { ABI, CONTRACT_ADDRESS, PRIORITY, friendly } from "./wagmi";

export default function Report({ onDone }) {
  const { isConnected } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const client = usePublicClient();
  const [form, setForm] = useState({ location: "", description: "", category: "Eclairage", priority: 1 });
  const [log, setLog] = useState([]);
  const addLog = (m) => setLog((l) => [...l, m]);
  const set = (k, v) => setForm({ ...form, [k]: v });

  async function submit(e) {
    e.preventDefault();
    if (!isConnected) return addLog("Connectez votre wallet d'abord.");
    if (!form.location.trim() || !form.description.trim())
      return addLog("Erreur : localisation et description obligatoires.");
    try {
      const hash = await writeContractAsync({
        address: CONTRACT_ADDRESS, abi: ABI, functionName: "reportIssue",
        args: [form.location, form.description, form.category, Number(form.priority)],
      });
      addLog("Tx envoyée : " + hash);
      await client.waitForTransactionReceipt({ hash });
      addLog("✅ Signalement enregistré : " + hash);
      onDone();
    } catch (err) { addLog("❌ " + friendly(err)); }
  }

  return (
    <section>
      <h2>Signaler un problème</h2>
      <form onSubmit={submit} style={{ display: "grid", gap: 6, maxWidth: 500 }}>
        <input placeholder="Localisation (ex : Rue Hassan II, Tanger)" value={form.location}
               onChange={(e) => set("location", e.target.value)} />
        <textarea placeholder="Description" value={form.description}
                  onChange={(e) => set("description", e.target.value)} />
        <select value={form.category} onChange={(e) => set("category", e.target.value)}>
          {["Eclairage", "Voirie", "Propreté", "Eau", "Espaces verts", "Autre"].map((c) => <option key={c}>{c}</option>)}
        </select>
        <select value={form.priority} onChange={(e) => set("priority", e.target.value)}>
          {PRIORITY.map((p, i) => <option key={p} value={i}>Priorité : {p}</option>)}
        </select>
        <button type="submit">Envoyer le signalement</button>
      </form>
      <h3>Journal</h3>
      <pre style={{ background: "#eee", padding: 8, whiteSpace: "pre-wrap" }}>{log.join("\n")}</pre>
    </section>
  );
}