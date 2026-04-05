import { useState, useEffect, useCallback } from "react";
import { useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Users, Play, Square, Plus, Copy, Check,
  CircleCheckBig, CircleX, Minus, ChevronDown, ChevronUp,
  Shield, Trash2, Globe,
} from "lucide-react";
import { connectWs, onWsMessage } from "@/lib/ws";
import { apiRequest } from "@/lib/queryClient";

type Agenda = {
  id: number; sessionId: number; orderNum: number;
  title: string; description: string | null;
  status: string; result: string | null;
};
type VoteCounts = { agree: number; disagree: number; abstain: number; total: number };

// 이름 마스킹: 가운데 글자를 *로 처리 (유태종 → 유*종)
function maskName(name: string): string {
  if (name.length <= 1) return name;
  if (name.length === 2) return name[0] + "*";
  const mid = Math.floor(name.length / 2);
  return name[0] + "*".repeat(name.length - 2) + name[name.length - 1];
}

export default function AdminSession() {
  const params = useParams<{ code: string }>();
  const [session, setSession] = useState<any>(null);
  const [agendas, setAgendas] = useState<Agenda[]>([]);
  const [participants, setParticipants] = useState<any[]>([]);
  const [voteCounts, setVoteCounts] = useState<Record<number, VoteCounts>>({});
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [copiedAdmin, setCopiedAdmin] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [lang, setLang] = useState<"ko" | "en">(
    navigator.language.startsWith("ko") ? "ko" : "en"
  );

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/sessions/admin/${params.code}`);
      if (!res.ok) return;
      const data = await res.json();
      setSession(data.session);
      setAgendas(data.agendas);
      setParticipants(data.participants);
      for (const a of data.agendas) {
        const vRes = await fetch(`/api/agendas/${a.id}/votes`);
        if (vRes.ok) {
          const vData = await vRes.json();
          setVoteCounts((prev) => ({ ...prev, [a.id]: vData }));
        }
      }
    } finally {
      setLoading(false);
    }
  }, [params.code]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (!session) return;
    connectWs(session.id);
    const unsub = onWsMessage((msg) => {
      if (msg.type === "participant_joined") {
        setParticipants((prev) => [...prev, msg.participant]);
      }
      if (msg.type === "vote_cast") {
        setVoteCounts((prev) => ({
          ...prev,
          [msg.agendaId]: { agree: msg.agree, disagree: msg.disagree, abstain: msg.abstain, total: msg.total },
        }));
      }
      if (msg.type === "voting_started") {
        setAgendas((prev) =>
          prev.map((a) =>
            a.id === msg.agendaId ? { ...a, status: "voting" }
            : a.status === "voting" ? { ...a, status: "closed" } : a
          )
        );
      }
      if (msg.type === "voting_closed") {
        setAgendas((prev) =>
          prev.map((a) => a.id === msg.agendaId ? { ...a, status: "closed", result: msg.result } : a)
        );
        setVoteCounts((prev) => ({
          ...prev,
          [msg.agendaId]: { agree: msg.agree, disagree: msg.disagree, abstain: msg.abstain, total: msg.total },
        }));
      }
      if (msg.type === "agenda_added") {
        // 새 안건을 맨 앞에 추가 (화면 위쪽)
        setAgendas((prev) => [msg.agenda, ...prev]);
      }
      if (msg.type === "agenda_deleted") {
        setAgendas((prev) => prev.filter((a) => a.id !== msg.agendaId));
      }
    });
    return unsub;
  }, [session]);

  async function startVoting(agendaId: number) {
    await apiRequest("POST", `/api/agendas/${agendaId}/start`);
  }
  async function closeVoting(agendaId: number) {
    await apiRequest("POST", `/api/agendas/${agendaId}/close`);
  }
  async function deleteAgenda(agendaId: number) {
    if (!confirm("이 안건을 삭제하시겠습니까?")) return;
    await apiRequest("DELETE", `/api/agendas/${agendaId}`);
    setAgendas((prev) => prev.filter((a) => a.id !== agendaId));
  }
  async function addAgenda(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim() || !session) return;
    await apiRequest("POST", `/api/sessions/${session.id}/agendas`, {
      title: newTitle.trim(),
      description: newDesc.trim() || undefined,
    });
    setNewTitle(""); setNewDesc(""); setShowAdd(false);
  }
  function copyCode() {
    if (!session) return;
    navigator.clipboard.writeText(session.accessCode).catch(() => {});
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  }
  function copyAdminCode() {
    if (!params.code) return;
    navigator.clipboard.writeText(params.code).catch(() => {});
    setCopiedAdmin(true); setTimeout(() => setCopiedAdmin(false), 2000);
  }

  if (loading) return <div className="flex items-center justify-center min-h-screen"><p className="text-muted-foreground">로딩 중...</p></div>;
  if (!session) return <div className="flex items-center justify-center min-h-screen"><p className="text-muted-foreground">세션을 찾을 수 없습니다</p></div>;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div>
          <h1 className="font-semibold text-base">{session.title}</h1>
          <p className="text-xs text-muted-foreground">Chair Dashboard / 의장 관리</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setLang(lang === "ko" ? "en" : "ko")} className="text-xs h-7 px-2">
            <Globe className="w-3 h-3 mr-1" />{lang === "ko" ? "EN" : "한국어"}
          </Button>
          <Badge variant="secondary" className="gap-1 text-xs">
            <Users className="w-3 h-3" />{participants.length}명
          </Badge>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-4">

        {/* Agenda 섹션 (맨 위로) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-sm">Agenda / 안건</h2>
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={() => setShowAdd(!showAdd)}>
              <Plus className="w-3.5 h-3.5" /> Add / 추가
            </Button>
          </div>

          {/* 새 안건 추가 폼 */}
          {showAdd && (
            <Card>
              <CardContent className="pt-4 space-y-2">
                <form onSubmit={addAgenda} className="space-y-2">
                  <Input data-testid="input-new-agenda-title" placeholder="안건 제목" value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)} />
                  <Textarea placeholder="상세 설명 (선택)" value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)} rows={2} />
                  <div className="flex gap-2">
                    <Button type="submit" size="sm" disabled={!newTitle.trim()}>추가</Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setShowAdd(false)}>취소</Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* 안건 목록: 최신 안건이 위에 */}
          {agendas.map((agenda) => {
            const counts = voteCounts[agenda.id] || { agree: 0, disagree: 0, abstain: 0, total: 0 };
            const isVoting = agenda.status === "voting";
            const isClosed = agenda.status === "closed";
            const isPassed = agenda.result === "passed";
            // 의장 제외한 실제 투표 인원
            const voterCount = participants.length;

            return (
              <Card key={agenda.id} data-testid={`card-agenda-${agenda.id}`}
                className={`transition-all ${isVoting ? "ring-2 ring-primary/40 bg-primary/5" : ""}`}>
                <CardContent className="pt-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium text-muted-foreground">제{agenda.orderNum}호</span>
                        {isVoting && <Badge className="bg-primary text-primary-foreground text-xs animate-pulse">Voting</Badge>}
                        {isClosed && isPassed && (
                          <Badge className="bg-chart-1 text-white text-xs gap-1">
                            <CircleCheckBig className="w-3 h-3" /> Passed
                          </Badge>
                        )}
                        {isClosed && !isPassed && agenda.result && (
                          <Badge variant="destructive" className="text-xs gap-1">
                            <CircleX className="w-3 h-3" /> Rejected
                          </Badge>
                        )}
                      </div>
                      <h3 className="text-sm font-semibold">{agenda.title}</h3>
                      {agenda.description && <p className="text-xs text-muted-foreground mt-1">{agenda.description}</p>}
                    </div>
                    <div className="shrink-0 flex gap-2 items-center">
                      {/* 삭제 버튼: pending 상태일 때만 */}
                      {agenda.status === "pending" && (
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                          onClick={() => deleteAgenda(agenda.id)} title="안건 삭제">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      {agenda.status === "pending" && (
                        <Button data-testid={`button-start-${agenda.id}`} size="sm" onClick={() => startVoting(agenda.id)}>
                          <Play className="w-3.5 h-3.5 mr-1" /> Start Vote
                        </Button>
                      )}
                      {isVoting && (
                        <Button data-testid={`button-close-${agenda.id}`} size="sm" variant="destructive" onClick={() => closeVoting(agenda.id)}>
                          <Square className="w-3.5 h-3.5 mr-1" /> Close Vote
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* 투표 결과 */}
                  {(isVoting || isClosed) && (
                    <div className="space-y-2 pt-2 border-t">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Results / 현황</span>
                        <span>{counts.total} / {voterCount} voted</span>
                      </div>
                      <div className="space-y-1.5">
                        {[
                          { label: "Agree", key: "agree" as const, color: "bg-emerald-500", textColor: "text-emerald-600" },
                          { label: "Against", key: "disagree" as const, color: "bg-red-500", textColor: "text-red-600" },
                          { label: "Abstain", key: "abstain" as const, color: "bg-gray-400", textColor: "text-muted-foreground" },
                        ].map(({ label, key, color, textColor }) => (
                          <div key={key} className="flex items-center gap-2">
                            <span className={`text-xs w-12 text-right font-medium ${textColor}`}>{label}</span>
                            <div className="flex-1 h-6 bg-muted rounded-md overflow-hidden">
                              <div className={`h-full ${color} rounded-md transition-all duration-500 flex items-center justify-end px-2`}
                                style={{ width: voterCount > 0 ? `${Math.max((counts[key] / voterCount) * 100, counts[key] > 0 ? 12 : 0)}%` : "0%" }}>
                                {counts[key] > 0 && <span className="text-xs font-bold text-white">{counts[key]}</span>}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="pt-1">
                        <Progress value={voterCount > 0 ? (counts.total / voterCount) * 100 : 0} className="h-1.5" />
                        <p className="text-xs text-muted-foreground mt-1">
                          Turnout {voterCount > 0 ? Math.round((counts.total / voterCount) * 100) : 0}%
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}

          {agendas.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-sm">No agenda items yet</p>
              <p className="text-xs mt-1">Click "Add" to create agenda items</p>
            </div>
          )}
        </div>

        {/* 참가자 목록 (안건 아래로) */}
        <div className="border rounded-lg overflow-hidden">
          <button onClick={() => setShowParticipants(!showParticipants)}
            className="w-full flex items-center justify-between px-4 py-3 bg-card hover:bg-muted/50 transition-colors">
            <span className="text-sm font-medium flex items-center gap-2">
              <Users className="w-4 h-4" /> Participants / 참석자 ({participants.length})
            </span>
            {showParticipants ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {showParticipants && (
            <div className="px-4 pb-3 bg-card">
              {/* 최대 3줄 표시 후 스크롤 */}
              <div className="max-h-24 overflow-y-auto space-y-1 pt-2">
                {participants.map((p) => (
                  <div key={p.id} className="text-sm py-1 border-b last:border-0 text-muted-foreground">
                    {maskName(p.name)}
                  </div>
                ))}
                {participants.length === 0 && (
                  <p className="text-xs text-muted-foreground py-2">아직 참석한 회원이 없습니다</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 접속 코드 (하단으로) */}
        <Card className="bg-muted/30">
          <CardContent className="pt-4 space-y-3">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Access Code / 접속 코드</p>
              <div className="flex items-center gap-3">
                <span className="text-2xl font-bold tracking-widest font-mono">{session.accessCode}</span>
                <Button variant="outline" size="sm" className="gap-1 h-8" onClick={copyCode}>
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? "복사됨" : "복사"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">이 코드를 참가자에게 공유하세요.</p>
            </div>
            <div className="border-t pt-3 space-y-1">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Shield className="w-3 h-3" /> Admin Code / 관리 코드 (의장 전용)
              </p>
              <div className="flex items-center gap-3">
                <span className="text-lg font-bold tracking-widest font-mono text-primary">{params.code}</span>
                <Button variant="outline" size="sm" className="gap-1 h-8" onClick={copyAdminCode}>
                  {copiedAdmin ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedAdmin ? "복사됨" : "복사"}
                </Button>
              </div>
              <p className="text-xs text-destructive">참가자에게 공유하지 마세요.</p>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
