import { http, createConfig } from "wagmi";
import { hardhat, sepolia } from "wagmi/chains";
import { injected } from "wagmi/connectors";
import { parseAbi } from "viem";

export const config = createConfig({
  chains: [hardhat, sepolia],
  connectors: [injected()],
  transports: { [hardhat.id]: http("http://127.0.0.1:8545"), [sepolia.id]: http() },
});

export const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS;

// Les enums Solidity sont lus comme des uint8 (0, 1, 2...)
export const STATUS = ["Reported", "Assigned", "InProgress", "Resolved", "Closed"];
export const PRIORITY = ["Low", "Medium", "High", "Critical"];

export const fmtDate = (ts) => new Date(Number(ts) * 1000).toLocaleString("fr-FR");

export const ABI = parseAbi([
  "function reportIssue(string location,string description,string category,uint8 priority) returns (uint256)",
  "function assignTeam(uint256 issueId,string team,string note)",
  "function updateStatus(uint256 issueId,uint8 newStatus,string note)",
  "function nextIssueId() view returns (uint256)",
  "function batchImportIssues((string externalId,string issueType,string location,string description,string reportDate,uint8 priority,string reportedBy,string assignedTo,uint8 status)[] rows)",
  "function getIssue(uint256 issueId) view returns ((address reporter,string externalId,string reportedBy,string location,string description,string category,string reportDate,uint8 priority,uint8 status,string team,uint64 createdAt,uint64 updatedAt))",
  "function getIssueIdByExternalId(string externalId) view returns (uint256)",
  "function getHistory(uint256 issueId) view returns ((uint8 status,address actor,string team,string note,uint64 timestamp)[])",
  "function hasRole(bytes32 role,address account) view returns (bool)",
  "error AccessControlUnauthorizedAccount(address account, bytes32 neededRole)",
]);

// Messages d'erreur lisibles
export function friendly(err) {
  const m = err.shortMessage || err.message || "";
  if (m.includes("AccessControlUnauthorizedAccount")) return "Ce compte n'a pas le rôle MUNICIPAL_ROLE.";
  if (m.includes("Invalid transition")) return "Transition interdite : le statut avance d'une seule étape.";
  if (m.includes("Assign a team first")) return "Affectez d'abord une équipe.";
  if (m.includes("Cannot assign now")) return "Affectation impossible à ce stade.";
  if (m.includes("location required")) return "La localisation est obligatoire.";
  if (m.includes("description required")) return "La description est obligatoire.";
  if (m.includes("User rejected")) return "Transaction refusée dans le wallet.";
  if (m.includes("Invalid batch size")) return "Taille de lot invalide (1 à 20 lignes).";
  if (m.includes("Array length mismatch")) return "Les colonnes n'ont pas la même longueur.";
  if (m.includes("Duplicate issueId")) return "Un issueId du lot existe déjà sur la blockchain.";
  if (m.includes("issueId required")) return "issueId obligatoire.";
  if (m.includes("Team required for this status")) return "Une équipe est obligatoire pour ce statut.";
  return m;
}