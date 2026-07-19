import { NavLink } from "react-router-dom";
import { navigationItems } from "../../constants/navigation";

export function MobileNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--company-border)] bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
      <div className="mx-auto grid max-w-7xl gap-2" style={{ gridTemplateColumns: `repeat(${navigationItems.length}, minmax(0, 1fr))` }}>
        {navigationItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 rounded-2xl px-2 py-2 text-[11px] font-medium ${
                  isActive ? "bg-[var(--company-primary)] text-white" : "text-slate-500"
                }`
              }
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
