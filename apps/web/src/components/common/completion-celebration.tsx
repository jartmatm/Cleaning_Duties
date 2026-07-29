import Lottie from "lottie-react";
import { useEffect, useState } from "react";
import successCompleteLottie from "../../assets/success-complete-lottie.json";

export function CompletionCelebration({ onComplete }: { onComplete: () => void }) {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });

    const animationFrame = window.requestAnimationFrame(() => {
      window.setTimeout(() => setIsReady(true), 180);
    });

    return () => window.cancelAnimationFrame(animationFrame);
  }, []);

  return (
    <div className="fixed inset-0 z-[90] flex min-h-[100dvh] items-center justify-center bg-white">
      {isReady ? (
        <Lottie
          animationData={successCompleteLottie}
          loop={false}
          autoplay
          className="h-64 w-64 max-w-[80vw]"
          onComplete={onComplete}
        />
      ) : null}
    </div>
  );
}
