import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Shield, Globe } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

export default function Home() {
  const [, navigate] = useLocation();
  const [accessCode, setAccessCode] = useState("");
  const [name, setName] = useState("");
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");
  const [lang, setLang] = useState<"ko" | "en">(
    navigator.language.startsWith("ko") ? "ko" : "en"
  );

  const t = {
    ko: {
      subtitle: "실시간 회의 의결 시스템",
      memberJoin: "참가자 입장",
      codePlaceholder: "접속 코드 입력",
      namePlaceholder: "이름 (실명)",
      joinButton: "입장하기",
      joining: "접속 중...",
      admin: "의장/관리자 입장",
    },
    en: {
      subtitle: "Live Meeting Decisions",
      memberJoin: "Join as Participant",
      codePlaceholder: "Enter access code",
      namePlaceholder: "Your name",
      joinButton: "Join",
      joining: "Joining...",
      admin: "Chair / Admin",
    },
  }[lang];

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!accessCode.trim() || !name.trim()) return;
    setJoining(true);
    setError("");

    try {
      const res = await apiRequest("POST", `/api/sessions/${accessCode.trim().toUpperCase()}/join`, { name: name.trim() });
      const data = await res.json();
      navigate(`/vote/${data.session.accessCode}/${data.participant.id}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setJoining(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        {/* Language toggle */}
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground gap-1"
            onClick={() => setLang(lang === "ko" ? "en" : "ko")}
          >
            <Globe className="w-3.5 h-3.5" />
            {lang === "ko" ? "EN" : "한국어"}
          </Button>
        </div>

        {/* Logo */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-2">
            <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="OneVoice">
              <rect x="4" y="8" width="28" height="20" rx="3" stroke="hsl(var(--primary))" strokeWidth="2.2" fill="none"/>
              <path d="M18 14v8M14 18h8" stroke="hsl(var(--accent))" strokeWidth="2.2" strokeLinecap="round"/>
              <circle cx="18" cy="18" r="7" stroke="hsl(var(--primary))" strokeWidth="1.5" fill="none" opacity="0.4"/>
            </svg>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">OneVoice</h1>
          <p className="text-sm text-muted-foreground">{t.subtitle}</p>
        </div>

        {/* Member join */}
        <Card data-testid="join-card">
          <CardHeader className="pb-4">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              {t.memberJoin}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleJoin} className="space-y-3">
              <Input
                data-testid="input-access-code"
                placeholder={t.codePlaceholder}
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                className="text-center font-mono tracking-widest text-base uppercase"
                maxLength={6}
              />
              <Input
                data-testid="input-name"
                placeholder={t.namePlaceholder}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button data-testid="button-join" type="submit" className="w-full" disabled={joining || !accessCode.trim() || !name.trim()}>
                {joining ? t.joining : t.joinButton}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Admin access */}
        <div className="text-center">
          <Button
            data-testid="button-admin"
            variant="ghost"
            size="sm"
            className="text-muted-foreground text-xs"
            onClick={() => navigate("/admin")}
          >
            <Shield className="w-3.5 h-3.5 mr-1" />
            {t.admin}
          </Button>
        </div>
      </div>
    </div>
  );
}
