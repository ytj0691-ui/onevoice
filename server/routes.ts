import type { Express } from "express";
import type { Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";

// Track WebSocket connections by session
const sessionClients = new Map<number, Set<WebSocket>>();

function broadcast(sessionId: number, message: object) {
  const clients = sessionClients.get(sessionId);
  if (!clients) return;
  const data = JSON.stringify(message);
  clients.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    }
  });
}

function generateCode(length: number): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < length; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export function registerRoutes(server: Server, app: Express) {
  // ============ SESSION ROUTES ============

  // Create new session (의장이 총회 생성)
  app.post("/api/sessions", (req, res) => {
    const { title, agendas: agendaList } = req.body;
    if (!title) return res.status(400).json({ error: "제목을 입력하세요" });

    const session = storage.createSession({
      title,
      accessCode: generateCode(6),
      adminCode: generateCode(8),
      status: "waiting",
      createdAt: new Date().toISOString(),
    });

    // Create agendas if provided
    if (agendaList && Array.isArray(agendaList)) {
      agendaList.forEach((a: { title: string; description?: string }, i: number) => {
        storage.createAgenda({
          sessionId: session.id,
          orderNum: i + 1,
          title: a.title,
          description: a.description || null,
          status: "pending",
          result: null,
        });
      });
    }

    res.json(session);
  });

  // Get session by admin code
  app.get("/api/sessions/admin/:code", (req, res) => {
    const session = storage.getSessionByAdminCode(req.params.code);
    if (!session) return res.status(404).json({ error: "세션을 찾을 수 없습니다" });
    const agendaList = storage.getAgendasBySession(session.id);
    const participantList = storage.getParticipantsBySession(session.id);
    res.json({ session, agendas: agendaList, participants: participantList });
  });

  // Get session by access code (회원 입장)
  app.get("/api/sessions/join/:code", (req, res) => {
    const session = storage.getSessionByAccessCode(req.params.code);
    if (!session) return res.status(404).json({ error: "잘못된 접속 코드입니다" });
    res.json({ session });
  });

  // ============ AGENDA ROUTES ============

  // Add agenda to session
  app.post("/api/sessions/:sessionId/agendas", (req, res) => {
    const sessionId = parseInt(req.params.sessionId);
    const { title, description } = req.body;
    if (!title) return res.status(400).json({ error: "안건 제목을 입력하세요" });

    const existing = storage.getAgendasBySession(sessionId);
    const agenda = storage.createAgenda({
      sessionId,
      orderNum: existing.length + 1,
      title,
      description: description || null,
      status: "pending",
      result: null,
    });

    broadcast(sessionId, { type: "agenda_added", agenda });
    res.json(agenda);
  });

  // Start voting on an agenda
  app.post("/api/agendas/:id/start", (req, res) => {
    const agenda = storage.getAgenda(parseInt(req.params.id));
    if (!agenda) return res.status(404).json({ error: "안건을 찾을 수 없습니다" });

    // Close any currently voting agenda in the same session
    const allAgendas = storage.getAgendasBySession(agenda.sessionId);
    allAgendas.forEach((a) => {
      if (a.status === "voting" && a.id !== agenda.id) {
        storage.updateAgendaStatus(a.id, "closed");
      }
    });

    storage.updateAgendaStatus(agenda.id, "voting");
    const session = storage.getSession(agenda.sessionId);
    if (session && session.status === "waiting") {
      storage.updateSessionStatus(session.id, "active");
    }

    broadcast(agenda.sessionId, {
      type: "voting_started",
      agendaId: agenda.id,
      agendaTitle: agenda.title,
      agendaDescription: agenda.description,
    });

    res.json({ success: true });
  });

  // Close voting on an agenda
  app.post("/api/agendas/:id/close", (req, res) => {
    const agenda = storage.getAgenda(parseInt(req.params.id));
    if (!agenda) return res.status(404).json({ error: "안건을 찾을 수 없습니다" });

    const allVotes = storage.getVotesByAgenda(agenda.id);
    const agree = allVotes.filter((v) => v.choice === "agree").length;
    const disagree = allVotes.filter((v) => v.choice === "disagree").length;
    const abstain = allVotes.filter((v) => v.choice === "abstain").length;

    // 출석 회원 과반수 찬성으로 의결 (정관 제13조 4항)
    const total = allVotes.length;
    const result = total > 0 && agree > total / 2 ? "passed" : "rejected";

    storage.updateAgendaStatus(agenda.id, "closed", result);

    broadcast(agenda.sessionId, {
      type: "voting_closed",
      agendaId: agenda.id,
      result,
      agree,
      disagree,
      abstain,
      total,
    });

    res.json({ result, agree, disagree, abstain, total });
  });

  // Get votes for an agenda
  app.get("/api/agendas/:id/votes", (req, res) => {
    const agendaId = parseInt(req.params.id);
    const allVotes = storage.getVotesByAgenda(agendaId);
    const agree = allVotes.filter((v) => v.choice === "agree").length;
    const disagree = allVotes.filter((v) => v.choice === "disagree").length;
    const abstain = allVotes.filter((v) => v.choice === "abstain").length;
    res.json({ agree, disagree, abstain, total: allVotes.length, votes: allVotes });
  });

  // ============ PARTICIPANT ROUTES ============

  // Join session as participant
  app.post("/api/sessions/:code/join", (req, res) => {
    const session = storage.getSessionByAccessCode(req.params.code);
    if (!session) return res.status(404).json({ error: "잘못된 접속 코드입니다" });

    const { name } = req.body;
    if (!name) return res.status(400).json({ error: "이름을 입력하세요" });

    const participant = storage.createParticipant({
      sessionId: session.id,
      name,
      joinedAt: new Date().toISOString(),
    });

    broadcast(session.id, {
      type: "participant_joined",
      participant,
      totalParticipants: storage.getParticipantsBySession(session.id).length,
    });

    res.json({ participant, session });
  });

  // ============ VOTE ROUTES ============

  // Cast a vote
  app.post("/api/vote", (req, res) => {
    const { agendaId, participantId, choice } = req.body;
    if (!agendaId || !participantId || !choice) {
      return res.status(400).json({ error: "필수 정보가 누락되었습니다" });
    }
    if (!["agree", "disagree", "abstain"].includes(choice)) {
      return res.status(400).json({ error: "올바른 선택이 아닙니다" });
    }

    const agenda = storage.getAgenda(agendaId);
    if (!agenda || agenda.status !== "voting") {
      return res.status(400).json({ error: "현재 투표 중인 안건이 아닙니다" });
    }

    // Check if already voted
    const existing = storage.getVoteByParticipantAndAgenda(participantId, agendaId);
    if (existing) {
      return res.status(400).json({ error: "이미 투표하셨습니다" });
    }

    const vote = storage.createVote({
      agendaId,
      participantId,
      choice,
      votedAt: new Date().toISOString(),
    });

    // Broadcast updated counts
    const allVotes = storage.getVotesByAgenda(agendaId);
    const agree = allVotes.filter((v) => v.choice === "agree").length;
    const disagree = allVotes.filter((v) => v.choice === "disagree").length;
    const abstain = allVotes.filter((v) => v.choice === "abstain").length;
    const participantCount = storage.getParticipantsBySession(agenda.sessionId).length;

    broadcast(agenda.sessionId, {
      type: "vote_cast",
      agendaId,
      agree,
      disagree,
      abstain,
      total: allVotes.length,
      participantCount,
    });

    res.json({ success: true });
  });

  // ============ WEBSOCKET ============

  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws, req) => {
    const url = new URL(req.url || "", `http://${req.headers.host}`);
    const sessionId = parseInt(url.searchParams.get("sessionId") || "0");

    if (sessionId) {
      if (!sessionClients.has(sessionId)) {
        sessionClients.set(sessionId, new Set());
      }
      sessionClients.get(sessionId)!.add(ws);
    }

    ws.on("close", () => {
      if (sessionId) {
        sessionClients.get(sessionId)?.delete(ws);
      }
    });

    ws.on("error", () => {
      if (sessionId) {
        sessionClients.get(sessionId)?.delete(ws);
      }
    });
  });
}
