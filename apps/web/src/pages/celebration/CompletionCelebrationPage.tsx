import { useNavigate } from "react-router-dom";
import { CompletionCelebration } from "../../components/common/completion-celebration";

export function CompletionCelebrationPage() {
  const navigate = useNavigate();

  return <CompletionCelebration onComplete={() => navigate("/", { replace: true })} />;
}
