import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq, and } from "drizzle-orm";
import {
  sessions, agendas, participants, votes,
  type Session, type InsertSession,
  type Agenda, type InsertAgenda,
  type Participant, type InsertParticipant,
  type Vote, type InsertVote,
} from "@shared/schema";

const sqlite = new Database("hansori.db");
sqlite.pragma("journal_mode = WAL");
export const db = drizzle(sqlite);

// Create tables
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    access_code TEXT NOT NULL UNIQUE,
    admin_code TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'waiting',
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS agendas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    order_num INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    result TEXT
  );
  CREATE TABLE IF NOT EXISTS participants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    joined_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS votes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agenda_id INTEGER NOT NULL,
    participant_id INTEGER NOT NULL,
    choice TEXT NOT NULL,
    voted_at TEXT NOT NULL
  );
`);

export interface IStorage {
  // Sessions
  createSession(data: InsertSession): Session;
  getSession(id: number): Session | undefined;
  getSessionByAccessCode(code: string): Session | undefined;
  getSessionByAdminCode(code: string): Session | undefined;
  updateSessionStatus(id: number, status: string): void;

  // Agendas
  createAgenda(data: InsertAgenda): Agenda;
  getAgendasBySession(sessionId: number): Agenda[];
  getAgenda(id: number): Agenda | undefined;
  updateAgendaStatus(id: number, status: string, result?: string): void;

  // Participants
  createParticipant(data: InsertParticipant): Participant;
  getParticipantsBySession(sessionId: number): Participant[];
  getParticipant(id: number): Participant | undefined;

  // Votes
  createVote(data: InsertVote): Vote;
  getVotesByAgenda(agendaId: number): Vote[];
  getVoteByParticipantAndAgenda(participantId: number, agendaId: number): Vote | undefined;
}

export class DatabaseStorage implements IStorage {
  createSession(data: InsertSession): Session {
    return db.insert(sessions).values(data).returning().get();
  }

  getSession(id: number): Session | undefined {
    return db.select().from(sessions).where(eq(sessions.id, id)).get();
  }

  getSessionByAccessCode(code: string): Session | undefined {
    return db.select().from(sessions).where(eq(sessions.accessCode, code)).get();
  }

  getSessionByAdminCode(code: string): Session | undefined {
    return db.select().from(sessions).where(eq(sessions.adminCode, code)).get();
  }

  updateSessionStatus(id: number, status: string): void {
    db.update(sessions).set({ status }).where(eq(sessions.id, id)).run();
  }

  createAgenda(data: InsertAgenda): Agenda {
    return db.insert(agendas).values(data).returning().get();
  }

  getAgendasBySession(sessionId: number): Agenda[] {
    return db.select().from(agendas).where(eq(agendas.sessionId, sessionId)).all();
  }

  getAgenda(id: number): Agenda | undefined {
    return db.select().from(agendas).where(eq(agendas.id, id)).get();
  }

  updateAgendaStatus(id: number, status: string, result?: string): void {
    if (result !== undefined) {
      db.update(agendas).set({ status, result }).where(eq(agendas.id, id)).run();
    } else {
      db.update(agendas).set({ status }).where(eq(agendas.id, id)).run();
    }
  }

  createParticipant(data: InsertParticipant): Participant {
    return db.insert(participants).values(data).returning().get();
  }

  getParticipantsBySession(sessionId: number): Participant[] {
    return db.select().from(participants).where(eq(participants.sessionId, sessionId)).all();
  }

  getParticipant(id: number): Participant | undefined {
    return db.select().from(participants).where(eq(participants.id, id)).get();
  }

  createVote(data: InsertVote): Vote {
    return db.insert(votes).values(data).returning().get();
  }

  getVotesByAgenda(agendaId: number): Vote[] {
    return db.select().from(votes).where(eq(votes.agendaId, agendaId)).all();
  }

  getVoteByParticipantAndAgenda(participantId: number, agendaId: number): Vote | undefined {
    return db.select().from(votes)
      .where(and(eq(votes.participantId, participantId), eq(votes.agendaId, agendaId)))
      .get();
  }
}

export const storage = new DatabaseStorage();
