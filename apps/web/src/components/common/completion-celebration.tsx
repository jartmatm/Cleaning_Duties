import Lottie from "lottie-react";
import successCompleteLottie from "../../assets/success-complete-lottie.json";

export function CompletionCelebration({ onComplete }: { onComplete: () => void }) {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-white">
      <Lottie
        animationData={successCompleteLottie}
        loop={false}
        autoplay
        className="h-64 w-64 max-w-[80vw]"
        onComplete={onComplete}
      />
    </div>
  );
}
