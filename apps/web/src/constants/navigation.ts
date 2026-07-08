import type { LucideIcon } from "lucide-react";
import { LayoutDashboard, MapPinned, SquareCheckBig, Users } from "lucide-react";

export type NavigationItem = {
  label: string;
  to: string;
  icon: LucideIcon;
};

export const navigationItems: NavigationItem[] = [
  { label: "Dashboard", to: "/", icon: LayoutDashboard },
  { label: "Sites", to: "/sites", icon: MapPinned },
  { label: "Cleaning Duties", to: "/duties", icon: SquareCheckBig },
  { label: "Users", to: "/users", icon: Users },
];
