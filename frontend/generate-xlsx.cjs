const XLSX = require("xlsx");

const valid = [
  { issueId: "CITY-2026-001", issueType: "StreetLight", location: "Avenue Mohammed V", description: "Streetlight not working", reportDate: "2026-11-19", priority: "High", reportedBy: "Citizen01", assignedTo: "UrbanTeam01", status: "Reported" },
  { issueId: "CITY-2026-002", issueType: "Pothole", location: "Rue Hassan II", description: "Dangerous pothole", reportDate: "2026-11-18", priority: "Critical", reportedBy: "Citizen02", assignedTo: "RoadTeam01", status: "Assigned" },
  { issueId: "CITY-2026-003", issueType: "Waste", location: "Boulevard Pasteur", description: "Overflowing bins", reportDate: "2026-11-17", priority: "Medium", reportedBy: "Citizen03", assignedTo: "CleanTeam01", status: "InProgress" },
  { issueId: "CITY-2026-004", issueType: "WaterLeak", location: "Place du 9 Avril", description: "Water leak on sidewalk", reportDate: "2026-11-16", priority: "High", reportedBy: "Citizen04", assignedTo: "WaterTeam01", status: "Resolved" },
  { issueId: "CITY-2026-005", issueType: "Park", location: "Jardin de la Mendoubia", description: "Broken bench", reportDate: "2026-11-15", priority: "Low", reportedBy: "Citizen05", assignedTo: "", status: "Reported" },
];

const withErrors = [
  { ...valid[0], issueId: "CITY-ERR-001" },
  { ...valid[1], issueId: "CITY-ERR-002" },
  { ...valid[2], issueId: "CITY-ERR-003", location: "" },
  { ...valid[3], issueId: "CITY-ERR-004", reportDate: "19/11/2026" },
  { ...valid[4], issueId: "CITY-ERR-005", status: "Assigned", assignedTo: "" },
  { ...valid[0], issueId: "CITY-ERR-001" },
];

function write(rows, name) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "UrbanIssues");
  XLSX.writeFile(wb, name);
  console.log(name + " créé");
}

write(valid, "urban_issues.xlsx");
write(withErrors, "urban_issues-test-erreurs.xlsx");