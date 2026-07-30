import Lottie from "lottie-react";
import successCompleteLottie from "../../assets/success-complete-lottie.json";

export function CompletionCelebration({ onComplete }: { onComplete: () => void }) {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-white">
      <Lottie
        animationData={successCompleteLottie}
        loop={false}
        autoplay
        className="h-72 w-72 max-w-[80vw] sm:h-96 sm:w-96"
        onComplete={onComplete}
      />
    </div>
  );
}
