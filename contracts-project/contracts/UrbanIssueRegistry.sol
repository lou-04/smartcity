// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";

contract UrbanIssueRegistry is AccessControl {
    bytes32 public constant MUNICIPAL_ROLE = keccak256("MUNICIPAL_ROLE");
    uint256 public constant MAX_BATCH = 20;

    enum Status { Reported, Assigned, InProgress, Resolved, Closed }
    enum Priority { Low, Medium, High, Critical }

    struct Issue {
        address reporter;
        string externalId;
        string reportedBy;
        string location;
        string description;
        string category;
        string reportDate;
        Priority priority;
        Status status;
        string team;
        uint64 createdAt;
        uint64 updatedAt;
    }

    struct HistoryEntry {
        Status status;
        address actor;
        string team;
        string note;
        uint64 timestamp;
    }

    // Une ligne du fichier Excel
    struct ImportRow {
        string externalId;
        string issueType;
        string location;
        string description;
        string reportDate;
        Priority priority;
        string reportedBy;
        string assignedTo;
        Status status;
    }

    uint256 public nextIssueId = 1;
    mapping(uint256 => Issue) private issues;
    mapping(uint256 => HistoryEntry[]) private history;
    mapping(bytes32 => uint256) private idByExternalId;

    event IssueReported(uint256 indexed issueId, address indexed reporter, string location, Priority priority);
    event IssueAssigned(uint256 indexed issueId, string team, address indexed actor);
    event StatusUpdated(uint256 indexed issueId, Status oldStatus, Status newStatus, address indexed actor);

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MUNICIPAL_ROLE, msg.sender);
    }

    // ---------- Citoyens ----------
    function reportIssue(
        string calldata location,
        string calldata description,
        string calldata category,
        Priority priority
    ) external returns (uint256 id) {
        require(bytes(location).length > 0, "location required");
        require(bytes(description).length > 0, "description required");

        id = nextIssueId++;
        uint64 ts = uint64(block.timestamp);
        issues[id] = Issue(
            msg.sender, "", "", location, description, category, "",
            priority, Status.Reported, "", ts, ts
        );
        history[id].push(HistoryEntry(Status.Reported, msg.sender, "", "Signalement enregistre", ts));
        emit IssueReported(id, msg.sender, location, priority);
    }

    // ---------- Service municipal ----------
    function batchImportIssues(ImportRow[] calldata rows) external onlyRole(MUNICIPAL_ROLE) {
        uint256 n = rows.length;
        require(n > 0 && n <= MAX_BATCH, "Invalid batch size");
        for (uint256 i = 0; i < n; i++) {
            _import(rows[i]);
        }
    }

    function assignTeam(uint256 issueId, string calldata team, string calldata note)
        external onlyRole(MUNICIPAL_ROLE)
    {
        _requireExists(issueId);
        require(bytes(team).length > 0, "team required");
        Issue storage it = issues[issueId];
        require(it.status == Status.Reported || it.status == Status.Assigned, "Cannot assign now");

        Status old = it.status;
        it.team = team;
        it.status = Status.Assigned;
        it.updatedAt = uint64(block.timestamp);
        history[issueId].push(HistoryEntry(Status.Assigned, msg.sender, team, note, uint64(block.timestamp)));

        emit IssueAssigned(issueId, team, msg.sender);
        emit StatusUpdated(issueId, old, Status.Assigned, msg.sender);
    }

    function updateStatus(uint256 issueId, Status newStatus, string calldata note)
        external onlyRole(MUNICIPAL_ROLE)
    {
        _requireExists(issueId);
        Issue storage it = issues[issueId];
        Status old = it.status;

        require(uint8(newStatus) == uint8(old) + 1, "Invalid transition");
        require(newStatus != Status.InProgress || bytes(it.team).length > 0, "Assign a team first");

        it.status = newStatus;
        it.updatedAt = uint64(block.timestamp);
        history[issueId].push(HistoryEntry(newStatus, msg.sender, it.team, note, uint64(block.timestamp)));

        emit StatusUpdated(issueId, old, newStatus, msg.sender);
    }

    // ---------- Lecture publique ----------
    function getIssue(uint256 issueId) external view returns (Issue memory) {
        _requireExists(issueId);
        return issues[issueId];
    }

    function getHistory(uint256 issueId) external view returns (HistoryEntry[] memory) {
        _requireExists(issueId);
        return history[issueId];
    }

    // Retrouver un signalement à partir de son identifiant métier (ex : CITY-2026-001)
    function getIssueIdByExternalId(string calldata externalId) external view returns (uint256) {
        uint256 id = idByExternalId[keccak256(bytes(externalId))];
        require(id != 0, "Issue not found");
        return id;
    }

    // ---------- Interne ----------
    function _requireExists(uint256 issueId) internal view {
        require(issueId > 0 && issueId < nextIssueId, "Issue not found");
    }

    function _import(ImportRow calldata r) internal {
        require(bytes(r.externalId).length > 0, "issueId required");
        require(bytes(r.location).length > 0, "location required");
        require(bytes(r.description).length > 0, "description required");
        require(r.status == Status.Reported || bytes(r.assignedTo).length > 0, "Team required for this status");

        bytes32 key = keccak256(bytes(r.externalId));
        require(idByExternalId[key] == 0, "Duplicate issueId");

        uint256 id = nextIssueId++;
        idByExternalId[key] = id;
        uint64 ts = uint64(block.timestamp);

        issues[id] = Issue(
            msg.sender, r.externalId, r.reportedBy, r.location, r.description, r.issueType, r.reportDate,
            r.priority, r.status, r.assignedTo, ts, ts
        );
        history[id].push(HistoryEntry(Status.Reported, msg.sender, r.assignedTo, "Importe depuis Excel", ts));
        if (r.status != Status.Reported) {
            history[id].push(HistoryEntry(r.status, msg.sender, r.assignedTo, "Statut importe depuis Excel", ts));
        }
        emit IssueReported(id, msg.sender, r.location, r.priority);
    }
}