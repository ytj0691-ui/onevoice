import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { eq, and } from "drizzle-orm";
import {
  sessions, agendas, participants, votes,
  type Session, type InsertSession,
  type Agenda, type InsertAgenda,
  type Participant, type InsertParticipant,
  type Vote, type InsertVote,
} from "@shared/schema";

const connectionString = process.env.DATABASE_URL || "postgresql://localhost:5432/onevoice";

const pool = new Pool({
  connectionString,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

export const db = drizzle(pool);

export async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      access_code TEXT NOT NULL UNIQUE,
      admin_code TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'waiting',
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS agendas (
      id SERIAL PRIMARY KEY,
      session_id INTEGER NOT NULL,
      order_num INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      result TEXT
    );
    CREATE TABLE IF NOT EXISTS participants (
      id SERIAL PRIMARY KEY,
      session_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      joined_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS votes (
      id SERIAL PRIMARY KEY,
      agenda_id INTEGER NOT NULL,
      participant_id INTEGER NOT NULL,
      choice TEXT NOT NULL,
      voted_at TEXT NOT NULL
    );
  `);
  console.log("Database tables initialized");
}

export interface IStorage {
  createSession(data: InsertSession): Promise<Session>;
  getSession(id: number): Promise<Session | undefined>;
  getSessionByAccessCode(code: string): Promise<Session | undefined>;
  getSessionByAdminCode(code: string): Promise<Session | undefined>;
  updateSessionStatus(id: number, status: string): Promise<void>;
  createAgenda(data: InsertAgenda): Promise<Agenda>;
  getAgendasBySession(sessionId: number): Promise<Agenda[]>;
  getAgenda(id: number): Promise<Agenda | undefined>;
  updateAgendaStatus(id: number, status: string, result?: string): Promise<void>;
  deleteAgenda(id: number): Promise<void>;
  createParticipant(data: InsertParticipant): Promise<Participant>;
  getParticipantsBySession(sessionId: number): Promise<Participant[]>;
  getParticipant(id: number): Promise<Participant | undefined>;
  createVote(data: InsertVote): Promise<Vote>;
  getVotesByAgenda(agendaId: number): Promise<Vote[]>;
  getVoteByParticipantAndAgenda(participantId: number, agendaId: number): Promise<Vote | undefined>;
}

export class DatabaseStorage implements IStorage {
  async createSession(data: InsertSession): Promise<Session> {
    const [row] = await db.insert(sessions).values(data).returning();
    return row;
  }

  async getSession(id: number): Promise<Session | undefined> {
    const [row] = await db.select().from(sessions).where(eq(sessions.id, id));
    return row;
  }

  async getSessionByAccessCode(code: string): Promise<Session | undefined> {
    const [row] = await db.select().from(sessions).where(eq(sessions.accessCode, code));
    return row;
  }

  async getSessionByAdminCode(code: string): Promise<Session | undefined> {
    const [row] = await db.select().from(sessions).where(eq(sessions.adminCode, code));
    return row;
  }

  async updateSessionStatus(id: number, status: string): Promise<void> {
    await db.update(sessions).set({ status }).where(eq(sessions.id, id));
  }

  async createAgenda(data: InsertAgenda): Promise<Agenda> {
    const [row] = await db.insert(agendas).values(data).returning();
    return row;
  }

  async getAgendasBySession(sessionId: number): Promise<Agenda[]> {
    return db.select().from(agendas).where(eq(agendas.sessionId, sessionId));
  }

  async getAgenda(id: number): Promise<Agenda | undefined> {
    const [row] = await db.select().from(agendas).where(eq(agendas.id, id));
    return row;
  }

  async updateAgendaStatus(id: number, status: string, result?: string): Promise<void> {
    if (result !== undefined) {
      await db.update(agendas).set({ status, result }).where(eq(agendas.id, id));
    } else {
      await db.update(agendas).set({ status }).where(eq(agendas.id, id));
    }
  }

  async deleteAgenda(id: number): Promise<void> {
    await db.delete(agendas).where(eq(agendas.id, id));
  }

  async createParticipant(data: InsertParticipant): Promise<Participant> {
    const [row] = await db.insert(participants).values(data).returning();
    return row;
  }

  async getParticipantsBySession(sessionId: number): Promise<Participant[]> {
    return db.select().from(participants).where(eq(participants.sessionId, sessionId));
  }

  async getParticipant(id: number): Promise<Participant | undefined> {
    const [row] = await db.select().from(participants).where(eq(participants.id, id));
    return row;
  }

  async createVote(data: InsertVote): Promise<Vote> {
    const [row] = await db.insert(votes).values(data).returning();
    return row;
  }

  async getVotesByAgenda(agendaId: number): Promise<Vote[]> {
    return db.select().from(votes).where(eq(votes.agendaId, agendaId));
  }

  async getVoteByParticipantAndAgenda(participantId: number, agendaId: number): Promise<Vote | undefined> {
    const [row] = await db.select().from(votes)
      .where(and(eq(votes.participantId, participantId), eq(votes.agendaId, agendaId)));
    return row;
  }
}

export const storage = new DatabaseStorage();
