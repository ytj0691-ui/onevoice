import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  const [, navigate] = useLocation();
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="text-center space-y-4">
        <h1 className="text-xl font-bold">페이지를 찾을 수 없습니다</h1>
        <Button onClick={() => navigate("/")}>홈으로 돌아가기</Button>
      </div>
    </div>
  );
}
