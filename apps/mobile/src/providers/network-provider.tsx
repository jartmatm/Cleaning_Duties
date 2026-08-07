import * as Network from "expo-network";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

const NetworkContext = createContext({ isOnline: true });

export function NetworkProvider({ children }: { children: ReactNode }) {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    void Network.getNetworkStateAsync().then((state) => setIsOnline(Boolean(state.isConnected && state.isInternetReachable !== false)));
    const subscription = Network.addNetworkStateListener((state) => {
      setIsOnline(Boolean(state.isConnected && state.isInternetReachable !== false));
    });
    return () => subscription.remove();
  }, []);

  return <NetworkContext.Provider value={{ isOnline }}>{children}</NetworkContext.Provider>;
}

export function useNetwork() {
  return useContext(NetworkContext);
}
