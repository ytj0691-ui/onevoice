import { useState, useEffect, useCallback } from "react";
import { useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CircleCheckBig, CircleX, Minus, Clock } from "lucide-react";
import { connectWs, onWsMessage } from "@/lib/ws";

type VotingState = {
  agendaId: number;
  agendaTitle: string;
  agendaDescription?: string;
};

export default function Vote() {
  const params = useParams<{ code: string; participantId: string }>();
  const participantId = parseInt(params.participantId || "0");

  const [session, setSession] = useState<any>(null);
  const [currentVoting, setCurrentVoting] = useState<VotingState | null>(null);
  const [myVotes, setMyVotes] = useState<Record<number, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState<{
    agendaTitle: string;
    result: string;
    agree: number;
    disagree: number;
    abstain: number;
    total: number;
  } | null>(null);

  const fetchSession = useCallback(async () => {
    try {
      const res = await fetch(`/api/sessions/join/${params.code}`);
      if (!res.ok) return;
      const data = await res.json();
      setSession(data.session);
    } catch {}
  }, [params.code]);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  useEffect(() => {
    if (!session) return;
    connectWs(session.id);

    const unsub = onWsMessage((msg) => {
      if (msg.type === "voting_started") {
        setCurrentVoting({
          agendaId: msg.agendaId,
          agendaTitle: msg.agendaTitle,
          agendaDescription: msg.agendaDescription,
        });
        setLastResult(null);
      }
      if (msg.type === "voting_closed") {
        setCurrentVoting(null);
        setLastResult({
          agendaTitle: currentVoting?.agendaTitle || "",
          result: msg.result,
          agree: msg.agree,
          disagree: msg.disagree,
          abstain: msg.abstain,
          total: msg.total,
        });
      }
    });
    return unsub;
  }, [session, currentVoting?.agendaTitle]);

  async function castVote(choice: string) {
    if (!currentVoting || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agendaId: currentVoting.agendaId,
          participantId,
          choice,
        }),
      });
      if (res.ok) {
        setMyVotes((prev) => ({ ...prev, [currentVoting.agendaId]: choice }));
      } else {
        const data = await res.json();
        if (data.error === "이미 투표하셨습니다") {
          setMyVotes((prev) => ({ ...prev, [currentVoting.agendaId]: choice }));
        }
      }
    } catch {} finally {
      setSubmitting(false);
    }
  }

  const hasVoted = currentVoting ? myVotes[currentVoting.agendaId] : undefined;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="px-4 py-3 text-center">
          <h1 className="text-sm font-bold text-foreground">
            {session?.title || "로딩 중..."}
          </h1>
          <p className="text-xs text-muted-foreground">한소리 투표</p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-4">
        {/* Waiting state */}
        {!currentVoting && !lastResult && (
          <div className="text-center space-y-4">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-muted">
              <Clock className="w-8 h-8 text-muted-foreground" />
            </div>
            <div>
              <p className="text-base font-medium text-foreground">대기 중</p>
              <p className="text-sm text-muted-foreground mt-1">
                의장이 투표를 시작하면<br />여기에 안건이 표시됩니다
              </p>
            </div>
          </div>
        )}

        {/* Last result */}
        {!currentVoting && lastResult && (
          <Card className="w-full max-w-sm">
            <CardContent className="pt-6 text-center space-y-4">
              {lastResult.result === "passed" ? (
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                  <CircleCheckBig className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
                </div>
              ) : (
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30">
                  <CircleX className="w-8 h-8 text-red-600 dark:text-red-400" />
                </div>
              )}
              <div>
                <Badge className={lastResult.result === "passed" ? "bg-emerald-500 text-white" : "bg-red-500 text-white"}>
                  {lastResult.result === "passed" ? "가결" : "부결"}
                </Badge>
                <p className="text-sm font-medium mt-2">{lastResult.agendaTitle}</p>
              </div>
              <div className="flex justify-center gap-6 text-sm">
                <div className="text-center">
                  <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{lastResult.agree}</p>
                  <p className="text-xs text-muted-foreground">찬성</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-red-600 dark:text-red-400">{lastResult.disagree}</p>
                  <p className="text-xs text-muted-foreground">반대</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-muted-foreground">{lastResult.abstain}</p>
                  <p className="text-xs text-muted-foreground">보류</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">다음 안건을 기다려 주세요</p>
            </CardContent>
          </Card>
        )}

        {/* Active voting */}
        {currentVoting && (
          <div className="w-full max-w-sm space-y-6">
            {/* Agenda info */}
            <div className="text-center space-y-2">
              <Badge className="bg-primary text-primary-foreground">투표 진행 중</Badge>
              <h2 className="text-base font-bold text-foreground">{currentVoting.agendaTitle}</h2>
              {currentVoting.agendaDescription && (
                <p className="text-sm text-muted-foreground">{currentVoting.agendaDescription}</p>
              )}
            </div>

            {hasVoted ? (
              /* Already voted */
              <Card className="bg-primary/5 border-primary/20">
                <CardContent className="pt-6 text-center space-y-3">
                  <CircleCheckBig className="w-12 h-12 mx-auto text-primary" />
                  <p className="text-base font-semibold">투표 완료</p>
                  <Badge variant="secondary" className="text-sm">
                    {hasVoted === "agree" ? "찬성" : hasVoted === "disagree" ? "반대" : "보류"}
                  </Badge>
                  <p className="text-xs text-muted-foreground">의장이 투표를 종료하면 결과가 표시됩니다</p>
                </CardContent>
              </Card>
            ) : (
              /* Vote buttons */
              <div className="space-y-3">
                <button
                  data-testid="button-agree"
                  onClick={() => castVote("agree")}
                  disabled={submitting}
                  className="w-full h-20 rounded-xl bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white text-lg font-bold transition-all duration-200 animate-pulse-agree disabled:opacity-50 flex items-center justify-center gap-3 shadow-lg"
                >
                  <CircleCheckBig className="w-7 h-7" />
                  찬성
                </button>

                <button
                  data-testid="button-disagree"
                  onClick={() => castVote("disagree")}
                  disabled={submitting}
                  className="w-full h-20 rounded-xl bg-red-500 hover:bg-red-600 active:bg-red-700 text-white text-lg font-bold transition-all duration-200 animate-pulse-disagree disabled:opacity-50 flex items-center justify-center gap-3 shadow-lg"
                >
                  <CircleX className="w-7 h-7" />
                  반대
                </button>

                <button
                  data-testid="button-abstain"
                  onClick={() => castVote("abstain")}
                  disabled={submitting}
                  className="w-full h-14 rounded-xl bg-gray-400 hover:bg-gray-500 active:bg-gray-600 text-white text-base font-semibold transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Minus className="w-5 h-5" />
                  보류
                </button>

                <p className="text-xs text-center text-muted-foreground">
                  버튼을 누르면 즉시 투표됩니다
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
