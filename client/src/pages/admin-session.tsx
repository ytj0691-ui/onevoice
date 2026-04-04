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
} from "lucide-react";
import { connectWs, onWsMessage } from "@/lib/ws";
import { apiRequest } from "@/lib/queryClient";

type Agenda = {
  id: number;
  sessionId: number;
  orderNum: number;
  title: string;
  description: string | null;
  status: string;
  result: string | null;
};

type VoteCounts = {
  agree: number;
  disagree: number;
  abstain: number;
  total: number;
};

export default function AdminSession() {
  const params = useParams<{ code: string }>();
  const [session, setSession] = useState<any>(null);
  const [agendas, setAgendas] = useState<Agenda[]>([]);
  const [participants, setParticipants] = useState<any[]>([]);
  const [voteCounts, setVoteCounts] = useState<Record<number, VoteCounts>>({});
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/sessions/admin/${params.code}`);
      if (!res.ok) return;
      const data = await res.json();
      setSession(data.session);
      setAgendas(data.agendas);
      setParticipants(data.participants);

      // Fetch vote counts for each agenda
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

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
          [msg.agendaId]: {
            agree: msg.agree,
            disagree: msg.disagree,
            abstain: msg.abstain,
            total: msg.total,
          },
        }));
      }
      if (msg.type === "voting_started") {
        setAgendas((prev) =>
          prev.map((a) =>
            a.id === msg.agendaId
              ? { ...a, status: "voting" }
              : a.status === "voting"
              ? { ...a, status: "closed" }
              : a
          )
        );
      }
      if (msg.type === "voting_closed") {
        setAgendas((prev) =>
          prev.map((a) =>
            a.id === msg.agendaId ? { ...a, status: "closed", result: msg.result } : a
          )
        );
        setVoteCounts((prev) => ({
          ...prev,
          [msg.agendaId]: {
            agree: msg.agree,
            disagree: msg.disagree,
            abstain: msg.abstain,
            total: msg.total,
          },
        }));
      }
      if (msg.type === "agenda_added") {
        setAgendas((prev) => [...prev, msg.agenda]);
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

  async function addAgenda(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim() || !session) return;
    await apiRequest("POST", `/api/sessions/${session.id}/agendas`, {
      title: newTitle.trim(),
      description: newDesc.trim() || undefined,
    });
    setNewTitle("");
    setNewDesc("");
    setShowAdd(false);
  }

  function copyCode() {
    if (!session) return;
    navigator.clipboard.writeText(session.accessCode).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">로딩 중...</div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-destructive">세션을 찾을 수 없습니다</div>
      </div>
    );
  }

  const votingAgenda = agendas.find((a) => a.status === "voting");

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-base font-bold text-foreground">{session.title}</h1>
              <p className="text-xs text-muted-foreground">의장 관리 화면</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="gap-1">
                <Users className="w-3 h-3" />
                <span data-testid="text-participant-count">{participants.length}명</span>
              </Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Access code panel */}
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">회원 접속 코드</p>
                <p className="text-2xl font-mono font-bold tracking-[0.3em] text-primary" data-testid="text-access-code">
                  {session.accessCode}
                </p>
              </div>
              <Button data-testid="button-copy-code" variant="outline" size="sm" onClick={copyCode}>
                {copied ? <Check className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
                {copied ? "복사됨" : "복사"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              이 코드를 회원들에게 공유하세요. Zoom 화면에 표시하면 편리합니다.
            </p>
          </CardContent>
        </Card>

        {/* Participants toggle */}
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-between"
          onClick={() => setShowParticipants(!showParticipants)}
        >
          <span className="text-sm">참석 회원 ({participants.length}명)</span>
          {showParticipants ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </Button>
        {showParticipants && (
          <div className="flex flex-wrap gap-2 px-2">
            {participants.map((p) => (
              <Badge key={p.id} variant="secondary" className="text-xs">
                {p.name}
              </Badge>
            ))}
            {participants.length === 0 && (
              <p className="text-sm text-muted-foreground">아직 참석한 회원이 없습니다</p>
            )}
          </div>
        )}

        {/* Agendas */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">안건 목록</h2>
            <Button data-testid="button-add-agenda" variant="outline" size="sm" onClick={() => setShowAdd(!showAdd)}>
              <Plus className="w-4 h-4 mr-1" /> 안건 추가
            </Button>
          </div>

          {showAdd && (
            <Card>
              <CardContent className="pt-4">
                <form onSubmit={addAgenda} className="space-y-3">
                  <Input
                    data-testid="input-new-agenda-title"
                    placeholder="안건 제목"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                  />
                  <Textarea
                    placeholder="상세 설명 (선택)"
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    rows={2}
                  />
                  <div className="flex gap-2">
                    <Button type="submit" size="sm" disabled={!newTitle.trim()}>추가</Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setShowAdd(false)}>취소</Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {agendas
            .sort((a, b) => a.orderNum - b.orderNum)
            .map((agenda) => {
              const counts = voteCounts[agenda.id] || { agree: 0, disagree: 0, abstain: 0, total: 0 };
              const isVoting = agenda.status === "voting";
              const isClosed = agenda.status === "closed";
              const isPassed = agenda.result === "passed";

              return (
                <Card
                  key={agenda.id}
                  data-testid={`card-agenda-${agenda.id}`}
                  className={`transition-all ${
                    isVoting ? "ring-2 ring-primary/40 bg-primary/5" : ""
                  }`}
                >
                  <CardContent className="pt-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium text-muted-foreground">
                            제{agenda.orderNum}호
                          </span>
                          {isVoting && (
                            <Badge className="bg-primary text-primary-foreground text-xs animate-pulse">
                              투표 진행 중
                            </Badge>
                          )}
                          {isClosed && isPassed && (
                            <Badge className="bg-chart-1 text-white text-xs gap-1">
                              <CircleCheckBig className="w-3 h-3" /> 가결
                            </Badge>
                          )}
                          {isClosed && !isPassed && agenda.result && (
                            <Badge variant="destructive" className="text-xs gap-1">
                              <CircleX className="w-3 h-3" /> 부결
                            </Badge>
                          )}
                        </div>
                        <h3 className="text-sm font-semibold">{agenda.title}</h3>
                        {agenda.description && (
                          <p className="text-xs text-muted-foreground mt-1">{agenda.description}</p>
                        )}
                      </div>

                      <div className="shrink-0">
                        {agenda.status === "pending" && (
                          <Button
                            data-testid={`button-start-${agenda.id}`}
                            size="sm"
                            onClick={() => startVoting(agenda.id)}
                          >
                            <Play className="w-3.5 h-3.5 mr-1" /> 투표 시작
                          </Button>
                        )}
                        {isVoting && (
                          <Button
                            data-testid={`button-close-${agenda.id}`}
                            size="sm"
                            variant="destructive"
                            onClick={() => closeVoting(agenda.id)}
                          >
                            <Square className="w-3.5 h-3.5 mr-1" /> 투표 종료
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Vote results */}
                    {(isVoting || isClosed) && (
                      <div className="space-y-2 pt-2 border-t">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>투표 현황</span>
                          <span>{counts.total} / {participants.length}명 투표</span>
                        </div>

                        {/* Bar chart */}
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-xs w-8 text-right font-medium text-emerald-600 dark:text-emerald-400">찬성</span>
                            <div className="flex-1 h-6 bg-muted rounded-md overflow-hidden">
                              <div
                                className="h-full bg-emerald-500 dark:bg-emerald-400 rounded-md transition-all duration-500 flex items-center justify-end px-2"
                                style={{ width: counts.total > 0 ? `${Math.max((counts.agree / participants.length) * 100, counts.agree > 0 ? 12 : 0)}%` : "0%" }}
                              >
                                {counts.agree > 0 && <span className="text-xs font-bold text-white">{counts.agree}</span>}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs w-8 text-right font-medium text-red-600 dark:text-red-400">반대</span>
                            <div className="flex-1 h-6 bg-muted rounded-md overflow-hidden">
                              <div
                                className="h-full bg-red-500 dark:bg-red-400 rounded-md transition-all duration-500 flex items-center justify-end px-2"
                                style={{ width: counts.total > 0 ? `${Math.max((counts.disagree / participants.length) * 100, counts.disagree > 0 ? 12 : 0)}%` : "0%" }}
                              >
                                {counts.disagree > 0 && <span className="text-xs font-bold text-white">{counts.disagree}</span>}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs w-8 text-right font-medium text-muted-foreground">보류</span>
                            <div className="flex-1 h-6 bg-muted rounded-md overflow-hidden">
                              <div
                                className="h-full bg-gray-400 dark:bg-gray-500 rounded-md transition-all duration-500 flex items-center justify-end px-2"
                                style={{ width: counts.total > 0 ? `${Math.max((counts.abstain / participants.length) * 100, counts.abstain > 0 ? 12 : 0)}%` : "0%" }}
                              >
                                {counts.abstain > 0 && <span className="text-xs font-bold text-white">{counts.abstain}</span>}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Progress */}
                        <div className="pt-1">
                          <Progress
                            value={participants.length > 0 ? (counts.total / participants.length) * 100 : 0}
                            className="h-1.5"
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            투표율 {participants.length > 0 ? Math.round((counts.total / participants.length) * 100) : 0}%
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
              <p className="text-sm">등록된 안건이 없습니다</p>
              <p className="text-xs mt-1">"안건 추가" 버튼으로 안건을 등록하세요</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
