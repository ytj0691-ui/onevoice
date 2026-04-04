import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// 투표 세션 (총회 하나당 하나의 세션)
export const sessions = sqliteTable("sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(), // e.g. "시냇물교실 선교회 설립총회"
  accessCode: text("access_code").notNull().unique(), // 회원 접속용 코드
  adminCode: text("admin_code").notNull(), // 의장용 관리 코드
  status: text("status").notNull().default("waiting"), // waiting | active | ended
  createdAt: text("created_at").notNull(),
});

// 안건
export const agendas = sqliteTable("agendas", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sessionId: integer("session_id").notNull(),
  orderNum: integer("order_num").notNull(), // 안건 순서
  title: text("title").notNull(), // e.g. "정관 승인의 건"
  description: text("description"), // 안건 상세 설명
  status: text("status").notNull().default("pending"), // pending | voting | closed
  result: text("result"), // passed | rejected | null
});

// 참가자 (회원)
export const participants = sqliteTable("participants", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sessionId: integer("session_id").notNull(),
  name: text("name").notNull(),
  joinedAt: text("joined_at").notNull(),
});

// 투표
export const votes = sqliteTable("votes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
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
