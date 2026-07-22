import Lottie from "lottie-react";
import splashyLoader from "../../assets/splashy-loader.json";

type AppLoaderProps = {
  message?: string;
  fullScreen?: boolean;
};

export function AppLoader({ message = "Loading...", fullScreen = false }: AppLoaderProps) {
  return (
    <div className={`${fullScreen ? "min-h-screen" : "min-h-64"} flex items-center justify-center bg-white px-6`}>
      <div className="flex flex-col items-center gap-4 text-center">
        <Lottie animationData={splashyLoader} loop autoplay className="h-28 w-28" />
        <p className="text-sm font-semibold text-slate-700">{message}</p>
      </div>
    </div>
  );
}
