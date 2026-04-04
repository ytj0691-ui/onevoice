import { pgTable, text, integer, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// 투표 세션
export const sessions = pgTable("sessions", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  accessCode: text("access_code").notNull().unique(),
  adminCode: text("admin_code").notNull(),
  status: text("status").notNull().default("waiting"), // waiting | active | ended
  createdAt: text("created_at").notNull(),
});

// 안건
export const agendas = pgTable("agendas", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull(),
  orderNum: integer("order_num").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull().default("pending"), // pending | voting | closed
  result: text("result"),
});

// 참가자
export const participants = pgTable("participants", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull(),
  name: text("name").notNull(),
  joinedAt: text("joined_at").notNull(),
});

// 투표
export const votes = pgTable("votes", {
  id: serial("id").primaryKey(),
  agendaId: integer("agenda_id").notNull(),
  participantId: integer("participant_id").notNull(),
  choice: text("choice").notNull(), // agree | disagree | abstain
  votedAt: text("voted_at").notNull(),
});

// Insert schemas
export const insertSessionSchema = createInsertSchema(sessions).omit({ id: true });
export const insertAgendaSchema = createInsertSchema(agendas).omit({ id: true });
export const insertParticipantSchema = createInsertSchema(participants).omit({ id: true });
export const insertVoteSchema = createInsertSchema(votes).omit({ id: true });

// Types
export type Session = typeof sessions.$inferSelect;
export type InsertSession = z.infer<typeof insertSessionSchema>;
export type Agenda = typeof agendas.$inferSelect;
export type InsertAgenda = z.infer<typeof insertAgendaSchema>;
export type Participant = typeof participants.$inferSelect;
export type InsertParticipant = z.infer<typeof insertParticipantSchema>;
export type Vote = typeof votes.$inferSelect;
export type InsertVote = z.infer<typeof insertVoteSchema>;
