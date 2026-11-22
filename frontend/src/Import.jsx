import { useState } from "react";
import { useAccount, useReadContract, useWriteContract, usePublicClient } from "wagmi";
import * as XLSX from "xlsx";
import { keccak256, toBytes } from "viem";
import { ABI, CONTRACT_ADDRESS, PRIORITY, STATUS, friendly } from "./wagmi";

const MUNICIPAL_ROLE = keccak256(toBytes("MUNICIPAL_ROLE"));
const BATCH_SIZE = 10; // le contrat accepte 20 au maximum
const COLUMNS = ["issueId", "issueType", "location", "description", "reportDate",
                 "priority", "reportedBy", "assignedTo", "status"];

const PRIORITY_MAP = { low: 0, faible: 0, medium: 1, moyenne: 1, high: 2, haute: 2, critical: 3, critique: 3 };
const STATUS_MAP = Object.fromEntries(STATUS.map((s, i) => [s.toLowerCase(), i]));

function parseEnum(v, map, max) {
  const s = String(v ?? "").trim().toLowerCase();
  if (s in map) return map[s];
  if (new RegExp(`^[0-${max}]$`).test(s)) return Number(s);
  return null;
}
const parsePriority = (v) => parseEnum(v, PRIORITY_MAP, 3);
const parseStatus = (v) => parseEnum(v, STATUS_MAP, 4);
const str = (v) => String(v ?? "").trim();

// Validation côté client AVANT toute transaction (une ligne invalide ferait échouer tout le lot)
function validateRow(r) {
  const errors = [];
  ["issueId", "issueType", "location", "description", "reportDate"].forEach((k) => {
    if (!str(r[k])) errors.push(`${k} manquant`);
  });
  if (str(r.reportDate) && !/^\d{4}-\d{2}-\d{2}$/.test(str(r.reportDate))) errors.push("reportDate doit être AAAA-MM-JJ");
  if (parsePriority(r.priority) === null) errors.push("priority invalide");
  const st = parseStatus(r.status);
  if (st === null) errors.push("status invalide");
  else if (st > 0 && !str(r.assignedTo)) errors.push("assignedTo obligatoire pour ce statut");
  return errors;
}

export default function ImportExcel({ onDone }) {
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const client = usePublicClient();
  const [rows, setRows] = useState([]);
  const [log, setLog] = useState([]);
  const [busy, setBusy] = useState(false);
  const addLog = (m) => setLog((l) => [...l, m]);

  const { data: isAgent } = useReadContract({
    address: CONTRACT_ADDRESS, abi: ABI, functionName: "hasRole",
    args: [MUNICIPAL_ROLE, address], query: { enabled: !!address },
  });

  // true si cet issueId existe déjà sur la blockchain
  async function existsOnChain(id) {
    try {
      await client.readContract({
        address: CONTRACT_ADDRESS, abi: ABI, functionName: "getIssueIdByExternalId", args: [id],
      });
      return true;
    } catch { return false; }
  }

  async function onFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setRows([]);
    try {
      const wb = XLSX.read(await file.arrayBuffer());
      const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { raw: false, defval: "" });
      if (data.length === 0) return addLog("❌ Fichier vide.");
      const missing = COLUMNS.filter((c) => !(c in data[0]));
      if (missing.length) return addLog("❌ Colonnes manquantes : " + missing.join(", "));

      const seen = new Set();
      const checked = await Promise.all(data.map(async (r) => {
        const errors = validateRow(r);
        const id = str(r.issueId);
        if (id) {
          if (seen.has(id)) errors.push("issueId en double dans le fichier");
          seen.add(id);
          if (await existsOnChain(id)) errors.push("issueId déjà enregistré sur la blockchain");
        }
        return { ...r, errors, selected: errors.length === 0 };
      }));
      setRows(checked);
      addLog(`📄 ${data.length} ligne(s) lue(s).`);
    } catch {
      addLog("❌ Impossible de lire ce fichier (.xlsx ou .csv attendu).");
    }
  }

  const toggle = (i) =>
    setRows((rs) => rs.map((r, k) => (k === i && !r.errors.length ? { ...r, selected: !r.selected } : r)));
  const toggleAll = (value) =>
    setRows((rs) => rs.map((r) => (r.errors.length ? r : { ...r, selected: value })));

  async function saveSelected() {
    const todo = rows.filter((r) => r.selected);
    if (todo.length === 0) return addLog("Aucune ligne sélectionnée.");
    setBusy(true);
    for (let i = 0; i < todo.length; i += BATCH_SIZE) {
      const chunk = todo.slice(i, i + BATCH_SIZE);
      const n = i / BATCH_SIZE + 1;
      try {
        const hash = await writeContractAsync({
          address: CONTRACT_ADDRESS, abi: ABI, functionName: "batchImportIssues",
          args: [chunk.map((r) => ({
            externalId: str(r.issueId),
            issueType: str(r.issueType),
            location: str(r.location),
            description: str(r.description),
            reportDate: str(r.reportDate),
            priority: parsePriority(r.priority),
            reportedBy: str(r.reportedBy),
            assignedTo: str(r.assignedTo),
            status: parseStatus(r.status),
          }))],
        });
        addLog(`Lot ${n} envoyé : ${hash}`);
        await client.waitForTransactionReceipt({ hash });
        addLog(`✅ Lot ${n} confirmé (${chunk.length} signalement(s))`);
        onDone();
      } catch (err) {
        addLog(`❌ Lot ${n} : ` + friendly(err));
      }
    }
    setBusy(false);
  }

  const selectedCount = rows.filter((r) => r.selected).length;

  return (
    <section>
      {address && isAgent === false && (
        <p style={{ color: "red" }}>⚠️ Ce compte n'a pas le rôle MUNICIPAL_ROLE : l'import sera refusé.</p>
      )}
      <h2>Import Excel / CSV</h2>
      <p>Colonnes attendues : <code>{COLUMNS.join(", ")}</code></p>
      <input type="file" accept=".xlsx,.csv" onChange={onFile} />

      {rows.length > 0 && (
        <>
          <p>
            <button onClick={() => toggleAll(true)}>Tout sélectionner</button>{" "}
            <button onClick={() => toggleAll(false)}>Tout désélectionner</button>{" "}
            {selectedCount} / {rows.length} sélectionnée(s)
          </p>
          <div style={{ overflowX: "auto" }}>
            <table border="1" cellPadding="4" style={{ borderCollapse: "collapse", width: "100%" }}>
              <thead>
                <tr><th></th><th>issueId</th><th>Type</th><th>Localisation</th><th>Description</th><th>Date</th>
                    <th>Priorité</th><th>Signalé par</th><th>Équipe</th><th>Statut</th><th>Validation</th></tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const p = parsePriority(r.priority), s = parseStatus(r.status);
                  return (
                    <tr key={i} style={{ background: r.errors.length ? "#fdd" : undefined }}>
                      <td><input type="checkbox" checked={r.selected} disabled={!!r.errors.length} onChange={() => toggle(i)} /></td>
                      <td>{r.issueId}</td><td>{r.issueType}</td><td>{r.location}</td><td>{r.description}</td>
                      <td>{r.reportDate}</td>
                      <td>{p !== null ? PRIORITY[p] : r.priority}</td>
                      <td>{r.reportedBy || "—"}</td><td>{r.assignedTo || "—"}</td>
                      <td>{s !== null ? STATUS[s] : r.status}</td>
                      <td>{r.errors.length ? r.errors.join(", ") : "OK"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <button onClick={saveSelected} disabled={busy || selectedCount === 0} style={{ marginTop: 8 }}>
            {busy ? "Envoi en cours…" : `Enregistrer ${selectedCount} signalement(s) sur la blockchain`}
          </button>
        </>
      )}

      <h3>Journal</h3>
      <pre style={{ background: "#eee", padding: 8, whiteSpace: "pre-wrap" }}>{log.join("\n")}</pre>
    </section>
  );
}