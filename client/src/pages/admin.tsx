import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Shield, Plus, ArrowLeft, Trash2, Globe } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

export default function Admin() {
  const [, navigate] = useLocation();
  const [mode, setMode] = useState<"choose" | "create" | "enter">("choose");
  const [adminCode, setAdminCode] = useState("");
  const [title, setTitle] = useState("");
  const [agendaItems, setAgendaItems] = useState([{ title: "", description: "" }]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [lang, setLang] = useState<"ko" | "en">(
    navigator.language.startsWith("ko") ? "ko" : "en"
  );

  const t = {
    ko: {
      chairAdmin: "의장 / 관리자",
      createSession: "새 세션 만들기",
      enterSession: "기존 세션 입장",
      back: "돌아가기",
      prev: "뒤로",
      enterTitle: "기존 세션 입장",
      enterDesc: "세션 생성 시 발급된 관리 코드를 입력하세요",
      codePlaceholder: "관리 코드 (8자리)",
      checking: "확인 중...",
      enter: "입장",
      newSession: "새 세션",
      sessionTitle: "세션 제목",
      sessionTitlePlaceholder: "예: 제1회 정기총회",
      agendaList: "안건 목록",
      add: "추가",
      agendaNum: (n: number) => `제${n}호`,
      agendaTitlePlaceholder: "안건 제목",
      agendaDescPlaceholder: "상세 설명 (선택)",
      creating: "생성 중...",
      create: "세션 생성",
      createError: "세션 생성에 실패했습니다",
      codeError: "관리 코드를 확인하세요",
    },
    en: {
      chairAdmin: "Chair / Admin",
      createSession: "Create New Session",
      enterSession: "Enter Existing Session",
      back: "Home",
      prev: "Back",
      enterTitle: "Enter Existing Session",
      enterDesc: "Enter the admin code issued when the session was created",
      codePlaceholder: "Admin code (8 chars)",
      checking: "Checking...",
      enter: "Enter",
      newSession: "New Session",
      sessionTitle: "Session Title",
      sessionTitlePlaceholder: "e.g. Annual General Meeting",
      agendaList: "Agenda Items",
      add: "Add",
      agendaNum: (n: number) => `#${n}`,
      agendaTitlePlaceholder: "Agenda title",
      agendaDescPlaceholder: "Description (optional)",
      creating: "Creating...",
      create: "Create Session",
      createError: "Failed to create session",
      codeError: "Please check the admin code",
    },
  }[lang];

  function addAgenda() {
    setAgendaItems([...agendaItems, { title: "", description: "" }]);
  }

  function removeAgenda(index: number) {
    setAgendaItems(agendaItems.filter((_, i) => i !== index));
  }

  function updateAgenda(index: number, field: "title" | "description", value: string) {
    const items = [...agendaItems];
    items[index][field] = value;
    setAgendaItems(items);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setLoading(true);
    setError("");

    try {
      const res = await apiRequest("POST", "/api/sessions", {
        title: title.trim(),
        agendas: agendaItems.filter((a) => a.title.trim()),
      });
      const data = await res.json();
      navigate(`/admin/session/${data.adminCode}`);
    } catch (err: any) {
      setError(t.createError);
    } finally {
      setLoading(false);
    }
  }

  async function handleEnter(e: React.FormEvent) {
    e.preventDefault();
    if (!adminCode.trim()) return;
    setLoading(true);
    setError("");

    try {
      const res = await apiRequest("GET", `/api/sessions/admin/${adminCode.trim()}`);
      if (!res.ok) throw new Error(t.codeError);
      navigate(`/admin/session/${adminCode.trim()}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const LangToggle = () => (
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
  );

  if (mode === "choose") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-6">
          <LangToggle />
          <div className="text-center space-y-2">
            <Shield className="w-10 h-10 mx-auto text-primary" />
            <h1 className="text-xl font-bold">{t.chairAdmin}</h1>
          </div>

          <div className="space-y-3">
            <Button data-testid="button-create-session" className="w-full h-14 text-base" onClick={() => setMode("create")}>
              {t.createSession}
            </Button>
            <Button data-testid="button-enter-session" variant="outline" className="w-full h-14 text-base" onClick={() => setMode("enter")}>
              {t.enterSession}
            </Button>
          </div>

          <div className="text-center">
            <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
              <ArrowLeft className="w-4 h-4 mr-1" /> {t.back}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (mode === "enter") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-6">
          <LangToggle />
          <div className="text-center space-y-2">
            <h1 className="text-xl font-bold">{t.enterTitle}</h1>
            <p className="text-sm text-muted-foreground">{t.enterDesc}</p>
          </div>
          <form onSubmit={handleEnter} className="space-y-4">
            <Input
              data-testid="input-admin-code"
              placeholder={t.codePlaceholder}
              value={adminCode}
              onChange={(e) => setAdminCode(e.target.value.toUpperCase())}
              className="text-center font-mono tracking-widest text-base uppercase"
              maxLength={8}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button data-testid="button-enter" type="submit" className="w-full" disabled={loading || !adminCode.trim()}>
              {loading ? t.checking : t.enter}
            </Button>
          </form>
          <div className="text-center">
            <Button variant="ghost" size="sm" onClick={() => { setMode("choose"); setError(""); }}>
              <ArrowLeft className="w-4 h-4 mr-1" /> {t.prev}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-lg mx-auto space-y-6 pt-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => { setMode("choose"); setError(""); }}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h1 className="text-xl font-bold">{t.newSession}</h1>
          </div>
          <LangToggle />
        </div>

        <form onSubmit={handleCreate} className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium">{t.sessionTitle}</label>
            <Input
              data-testid="input-session-title"
              placeholder={t.sessionTitlePlaceholder}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">{t.agendaList}</label>
              <Button type="button" variant="ghost" size="sm" onClick={addAgenda}>
                <Plus className="w-4 h-4 mr-1" /> {t.add}
              </Button>
            </div>

            {agendaItems.map((item, i) => (
              <Card key={i} className="relative">
                <CardContent className="pt-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground w-14 shrink-0">{t.agendaNum(i + 1)}</span>
                    <Input
                      data-testid={`input-agenda-title-${i}`}
                      placeholder={t.agendaTitlePlaceholder}
                      value={item.title}
                      onChange={(e) => updateAgenda(i, "title", e.target.value)}
                    />
                    {agendaItems.length > 1 && (
                      <Button type="button" variant="ghost" size="icon" className="shrink-0 text-muted-foreground hover:text-destructive" onClick={() => removeAgenda(i)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                  <Textarea
                    data-testid={`input-agenda-desc-${i}`}
                    placeholder={t.agendaDescPlaceholder}
                    value={item.description}
                    onChange={(e) => updateAgenda(i, "description", e.target.value)}
                    rows={2}
                    className="text-sm"
                  />
                </CardContent>
              </Card>
            ))}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button data-testid="button-create" type="submit" className="w-full h-12 text-base" disabled={loading || !title.trim()}>
            {loading ? t.creating : t.create}
          </Button>
        </form>
      </div>
    </div>
  );
}
