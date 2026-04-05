import type { Express } from "express";
import type { Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage, initDb } from "./storage";

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
  initDb().catch(console.error);

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // ============ SESSION ROUTES ============

  app.post("/api/sessions", async (req, res) => {
    try {
      const { title, agendas: agendaList } = req.body;
      if (!title) return res.status(400).json({ error: "Title is required" });

      const session = await storage.createSession({
        title,
        accessCode: generateCode(6),
        adminCode: generateCode(8),
        status: "waiting",
        createdAt: new Date().toISOString(),
      });

      if (agendaList && Array.isArray(agendaList)) {
        for (let i = 0; i < agendaList.length; i++) {
          const a = agendaList[i];
          await storage.createAgenda({
            sessionId: session.id,
            orderNum: i + 1,
            title: a.title,
            description: a.description || null,
            status: "pending",
            result: null,
          });
        }
      }

      res.json(session);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/sessions/admin/:code", async (req, res) => {
    try {
      const session = await storage.getSessionByAdminCode(req.params.code);
      if (!session) return res.status(404).json({ error: "Session not found" });
      const agendaList = await storage.getAgendasBySession(session.id);
      const participantList = await storage.getParticipantsBySession(session.id);
      res.json({ session, agendas: agendaList, participants: participantList });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/sessions/join/:code", async (req, res) => {
    try {
      const session = await storage.getSessionByAccessCode(req.params.code);
      if (!session) return res.status(404).json({ error: "Invalid access code" });
      res.json({ session });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ============ AGENDA ROUTES ============

  app.post("/api/sessions/:sessionId/agendas", async (req, res) => {
    try {
      const sessionId = parseInt(req.params.sessionId);
      const { title, description } = req.body;
      if (!title) return res.status(400).json({ error: "Title is required" });

      const existing = await storage.getAgendasBySession(sessionId);
      const agenda = await storage.createAgenda({
        sessionId,
        orderNum: existing.length + 1,
        title,
        description: description || null,
        status: "pending",
        result: null,
      });

      broadcast(sessionId, { type: "agenda_added", agenda });
      res.json(agenda);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // 안건 삭제 (pending 상태만 삭제 가능)
  app.delete("/api/agendas/:id", async (req, res) => {
    try {
      const agendaId = parseInt(req.params.id);
      const agenda = await storage.getAgenda(agendaId);
      if (!agenda) return res.status(404).json({ error: "Agenda not found" });
      if (agenda.status !== "pending") {
        return res.status(400).json({ error: "Only pending agendas can be deleted" });
      }
      await storage.deleteAgenda(agendaId);
      broadcast(agenda.sessionId, { type: "agenda_deleted", agendaId });
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/agendas/:id/start", async (req, res) => {
    try {
      const agenda = await storage.getAgenda(parseInt(req.params.id));
      if (!agenda) return res.status(404).json({ error: "Agenda not found" });

      const allAgendas = await storage.getAgendasBySession(agenda.sessionId);
      for (const a of allAgendas) {
        if (a.status === "voting" && a.id !== agenda.id) {
          await storage.updateAgendaStatus(a.id, "closed");
        }
      }

      await storage.updateAgendaStatus(agenda.id, "voting");
      const session = await storage.getSession(agenda.sessionId);
      if (session && session.status === "waiting") {
        await storage.updateSessionStatus(session.id, "active");
      }

      broadcast(agenda.sessionId, {
        type: "voting_started",
        agendaId: agenda.id,
        agendaTitle: agenda.title,
        agendaDescription: agenda.description,
      });

      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/agendas/:id/close", async (req, res) => {
    try {
      const agenda = await storage.getAgenda(parseInt(req.params.id));
      if (!agenda) return res.status(404).json({ error: "Agenda not found" });

      const allVotes = await storage.getVotesByAgenda(agenda.id);
      const agree = allVotes.filter((v) => v.choice === "agree").length;
      const disagree = allVotes.filter((v) => v.choice === "disagree").length;
      const abstain = allVotes.filter((v) => v.choice === "abstain").length;

      const total = allVotes.length;
      const result = total > 0 && agree > total / 2 ? "passed" : "rejected";

      await storage.updateAgendaStatus(agenda.id, "closed", result);

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
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/agendas/:id/votes", async (req, res) => {
    try {
      const agendaId = parseInt(req.params.id);
      const allVotes = await storage.getVotesByAgenda(agendaId);
      const agree = allVotes.filter((v) => v.choice === "agree").length;
      const disagree = allVotes.filter((v) => v.choice === "disagree").length;
      const abstain = allVotes.filter((v) => v.choice === "abstain").length;
      res.json({ agree, disagree, abstain, total: allVotes.length, votes: allVotes });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ============ PARTICIPANT ROUTES ============

  app.post("/api/sessions/:code/join", async (req, res) => {
    try {
      const session = await storage.getSessionByAccessCode(req.params.code);
      if (!session) return res.status(404).json({ error: "Invalid access code" });

      const { name } = req.body;
      if (!name) return res.status(400).json({ error: "Name is required" });

      const participant = await storage.createParticipant({
        sessionId: session.id,
        name,
        joinedAt: new Date().toISOString(),
      });

      const allParticipants = await storage.getParticipantsBySession(session.id);
      broadcast(session.id, {
        type: "participant_joined",
        participant,
        totalParticipants: allParticipants.length,
      });

      res.json({ participant, session });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ============ VOTE ROUTES ============

  app.post("/api/vote", async (req, res) => {
    try {
      const { agendaId, participantId, choice } = req.body;
      if (!agendaId || !participantId || !choice) {
        return res.status(400).json({ error: "Missing required fields" });
      }
      if (!["agree", "disagree", "abstain"].includes(choice)) {
        return res.status(400).json({ error: "Invalid choice" });
      }

      const agenda = await storage.getAgenda(agendaId);
      if (!agenda || agenda.status !== "voting") {
        return res.status(400).json({ error: "Not currently voting" });
      }

      const existing = await storage.getVoteByParticipantAndAgenda(participantId, agendaId);
      if (existing) {
        return res.status(400).json({ error: "Already voted" });
      }

      await storage.createVote({
        agendaId,
        participantId,
        choice,
        votedAt: new Date().toISOString(),
      });

      const allVotes = await storage.getVotesByAgenda(agendaId);
      const agree = allVotes.filter((v) => v.choice === "agree").length;
      const disagree = allVotes.filter((v) => v.choice === "disagree").length;
      const abstain = allVotes.filter((v) => v.choice === "abstain").length;
      const allParticipants = await storage.getParticipantsBySession(agenda.sessionId);

      broadcast(agenda.sessionId, {
        type: "vote_cast",
        agendaId,
        agree,
        disagree,
        abstain,
        total: allVotes.length,
        participantCount: allParticipants.length,
      });

      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ============ WEBSOCKET ============

  const wss = new WebSocketServer({ server, path: "/ws" });

  const keepaliveInterval = setInterval(() => {
    wss.clients.forEach((ws: any) => {
      if (ws.isAlive === false) return ws.terminate();
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on("close", () => clearInterval(keepaliveInterval));

  wss.on("connection", (ws: any, req) => {
    ws.isAlive = true;
    ws.on("pong", () => { ws.isAlive = true; });

    const url = new URL(req.url || "", `http://${req.headers.host}`);
    const sessionId = parseInt(url.searchParams.get("sessionId") || "0");

    if (sessionId) {
      if (!sessionClients.has(sessionId)) {
        sessionClients.set(sessionId, new Set());
      }
      sessionClients.get(sessionId)!.add(ws);

      ws.on("close", () => {
        sessionClients.get(sessionId)?.delete(ws);
      });
    }
  });
}
