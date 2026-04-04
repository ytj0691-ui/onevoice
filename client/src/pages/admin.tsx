import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Shield, Plus, ArrowLeft, Trash2 } from "lucide-react";

export default function Admin() {
  const [, navigate] = useLocation();
  const [mode, setMode] = useState<"choose" | "create" | "enter">("choose");
  const [adminCode, setAdminCode] = useState("");
  const [title, setTitle] = useState("");
  const [agendaItems, setAgendaItems] = useState([{ title: "", description: "" }]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          agendas: agendaItems.filter((a) => a.title.trim()),
        }),
      });
      const data = await res.json();
      navigate(`/admin/session/${data.adminCode}`);
    } catch (err: any) {
      setError("세션 생성에 실패했습니다");
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
      const res = await fetch(`/api/sessions/admin/${adminCode.trim()}`);
      if (!res.ok) throw new Error("관리 코드를 확인하세요");
      navigate(`/admin/session/${adminCode.trim()}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (mode === "choose") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center space-y-2">
            <Shield className="w-10 h-10 mx-auto text-primary" />
            <h1 className="text-xl font-bold">의장/관리자</h1>
          </div>

          <div className="space-y-3">
            <Button data-testid="button-create-session" className="w-full h-14 text-base" onClick={() => setMode("create")}>
              새 총회 세션 만들기
            </Button>
            <Button data-testid="button-enter-session" variant="outline" className="w-full h-14 text-base" onClick={() => setMode("enter")}>
              기존 세션 입장
            </Button>
          </div>

          <div className="text-center">
            <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
              <ArrowLeft className="w-4 h-4 mr-1" /> 돌아가기
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
          <div className="text-center space-y-2">
            <h1 className="text-xl font-bold">기존 세션 입장</h1>
            <p className="text-sm text-muted-foreground">세션 생성 시 발급된 관리 코드를 입력하세요</p>
          </div>
          <form onSubmit={handleEnter} className="space-y-4">
            <Input
              data-testid="input-admin-code"
              placeholder="관리 코드 (8자리)"
              value={adminCode}
              onChange={(e) => setAdminCode(e.target.value.toUpperCase())}
              className="text-center font-mono tracking-widest text-base uppercase"
              maxLength={8}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button data-testid="button-enter" type="submit" className="w-full" disabled={loading || !adminCode.trim()}>
              {loading ? "확인 중..." : "입장"}
            </Button>
          </form>
          <div className="text-center">
            <Button variant="ghost" size="sm" onClick={() => { setMode("choose"); setError(""); }}>
              <ArrowLeft className="w-4 h-4 mr-1" /> 뒤로
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-lg mx-auto space-y-6 pt-8">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => { setMode("choose"); setError(""); }}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-xl font-bold">새 총회 세션</h1>
        </div>

        <form onSubmit={handleCreate} className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium">총회 제목</label>
            <Input
              data-testid="input-session-title"
              placeholder="예: 시냇물교실 선교회 제1회 설립총회"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">안건 목록</label>
              <Button type="button" variant="ghost" size="sm" onClick={addAgenda}>
                <Plus className="w-4 h-4 mr-1" /> 추가
              </Button>
            </div>

            {agendaItems.map((item, i) => (
              <Card key={i} className="relative">
                <CardContent className="pt-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground w-14 shrink-0">제{i + 1}호</span>
                    <Input
                      data-testid={`input-agenda-title-${i}`}
                      placeholder="안건 제목"
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
                    placeholder="상세 설명 (선택)"
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
            {loading ? "생성 중..." : "세션 생성"}
          </Button>
        </form>
      </div>
    </div>
  );
}
