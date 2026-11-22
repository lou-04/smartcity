const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("UrbanIssueRegistry", () => {
  let reg, admin, agent, citizen;
  const S = { Reported: 0, Assigned: 1, InProgress: 2, Resolved: 3, Closed: 4 };

  beforeEach(async () => {
    [admin, agent, citizen] = await ethers.getSigners();
    reg = await ethers.deployContract("UrbanIssueRegistry");
    await reg.grantRole(await reg.MUNICIPAL_ROLE(), agent.address);
  });

  const report = (c = reg.connect(citizen)) =>
    c.reportIssue("Rue Hassan II, Tanger", "Lampadaire en panne", "Eclairage", 2);

  const row = (id, status = 0, team = "") => ({
    externalId: id, issueType: "StreetLight", location: "Avenue Mohammed V",
    description: "Streetlight not working", reportDate: "2026-11-19", priority: 2,
    reportedBy: "Citizen01", assignedTo: team, status,
  });

  it("un citoyen crée un signalement et l'event est émis", async () => {
    await expect(report()).to.emit(reg, "IssueReported").withArgs(1, citizen.address, "Rue Hassan II, Tanger", 2);
    const it = await reg.getIssue(1);
    expect(it.status).to.equal(S.Reported);
    expect(it.reporter).to.equal(citizen.address);
  });

  it("refuse location ou description vide", async () => {
    await expect(reg.reportIssue("", "x", "c", 0)).to.be.revertedWith("location required");
    await expect(reg.reportIssue("x", "", "c", 0)).to.be.revertedWith("description required");
  });

  it("le service municipal affecte une équipe", async () => {
    await report();
    await expect(reg.connect(agent).assignTeam(1, "Equipe Electricite", "Prise en charge"))
      .to.emit(reg, "IssueAssigned").withArgs(1, "Equipe Electricite", agent.address);
    const it = await reg.getIssue(1);
    expect(it.team).to.equal("Equipe Electricite");
    expect(it.status).to.equal(S.Assigned);
  });

  it("un citoyen ne peut pas affecter ni changer le statut", async () => {
    await report();
    await expect(reg.connect(citizen).assignTeam(1, "X", ""))
      .to.be.revertedWithCustomError(reg, "AccessControlUnauthorizedAccount");
    await expect(reg.connect(citizen).updateStatus(1, S.Assigned, ""))
      .to.be.revertedWithCustomError(reg, "AccessControlUnauthorizedAccount");
  });

  it("cycle de vie complet jusqu'à Closed", async () => {
    await report();
    const a = reg.connect(agent);
    await a.assignTeam(1, "Equipe Electricite", "");
    await a.updateStatus(1, S.InProgress, "Intervention démarrée");
    await a.updateStatus(1, S.Resolved, "Lampadaire remplacé");
    await a.updateStatus(1, S.Closed, "Validé");
    expect((await reg.getIssue(1)).status).to.equal(S.Closed);
  });

  it("transition invalide refusée (saut d'étape)", async () => {
    await report();
    await expect(reg.connect(agent).updateStatus(1, S.Closed, ""))
      .to.be.revertedWith("Invalid transition");
  });

  it("InProgress impossible sans équipe", async () => {
    await report();
    await reg.connect(agent).updateStatus(1, S.Assigned, "");
    await expect(reg.connect(agent).updateStatus(1, S.InProgress, ""))
      .to.be.revertedWith("Assign a team first");
  });

  it("l'historique garde chaque action : statut, équipe, note, acteur, date", async () => {
    await report();
    await reg.connect(agent).assignTeam(1, "Equipe Electricite", "Technicien envoyé");
    await reg.connect(agent).updateStatus(1, S.InProgress, "Intervention démarrée");
    const h = await reg.getHistory(1);

    expect(h.length).to.equal(3);
    expect(h[0].status).to.equal(S.Reported);
    expect(h[0].actor).to.equal(citizen.address);
    expect(h[0].timestamp).to.be.greaterThan(0);

    expect(h[1].status).to.equal(S.Assigned);
    expect(h[1].team).to.equal("Equipe Electricite");
    expect(h[1].note).to.equal("Technicien envoyé");
    expect(h[1].actor).to.equal(agent.address);

    expect(h[2].status).to.equal(S.InProgress);
    expect(h[2].team).to.equal("Equipe Electricite");
    expect(h[2].note).to.equal("Intervention démarrée");
  });

  it("réaffectation : l'ancienne équipe reste dans l'historique", async () => {
    await report();
    await reg.connect(agent).assignTeam(1, "Equipe A", "");
    await reg.connect(agent).assignTeam(1, "Equipe B", "Changement d'équipe");
    const h = await reg.getHistory(1);
    expect(h.length).to.equal(3);
    expect(h[1].team).to.equal("Equipe A");
    expect(h[2].team).to.equal("Equipe B");
  });

  it("signalement inexistant refusé", async () => {
    await expect(reg.getIssue(99)).to.be.revertedWith("Issue not found");
    await expect(reg.getHistory(0)).to.be.revertedWith("Issue not found");
  });

  it("import : municipal OK, données et historique corrects", async () => {
    await reg.connect(agent).batchImportIssues([row("CITY-2026-001"), row("CITY-2026-002", S.InProgress, "UrbanTeam01")]);
    expect(await reg.nextIssueId()).to.equal(3);
    expect(await reg.getIssueIdByExternalId("CITY-2026-002")).to.equal(2);
    const it2 = await reg.getIssue(2);
    expect(it2.status).to.equal(S.InProgress);
    expect(it2.team).to.equal("UrbanTeam01");
    expect(it2.reportedBy).to.equal("Citizen01");
    expect((await reg.getHistory(2)).length).to.equal(2);
  });

  it("import : citoyen refusé", async () => {
    await expect(reg.connect(citizen).batchImportIssues([row("A")]))
      .to.be.revertedWithCustomError(reg, "AccessControlUnauthorizedAccount");
  });

  it("import : issueId en double refusé", async () => {
    await reg.connect(agent).batchImportIssues([row("CITY-1")]);
    await expect(reg.connect(agent).batchImportIssues([row("CITY-1")])).to.be.revertedWith("Duplicate issueId");
    await expect(reg.connect(agent).batchImportIssues([row("X"), row("X")])).to.be.revertedWith("Duplicate issueId");
  });

  it("import : statut avancé sans équipe refusé, lot vide refusé", async () => {
    await expect(reg.connect(agent).batchImportIssues([row("Z", S.Assigned, "")]))
      .to.be.revertedWith("Team required for this status");
    await expect(reg.connect(agent).batchImportIssues([])).to.be.revertedWith("Invalid batch size");
  });
});