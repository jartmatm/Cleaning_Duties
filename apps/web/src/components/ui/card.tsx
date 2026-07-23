import type { HTMLAttributes, ReactNode } from "react";

type CardProps = HTMLAttributes<HTMLElement> & {
  children: ReactNode;
};

export function Card({ children, className = "", ...props }: CardProps) {
  return (
    <section className={`rounded-lg bg-white p-6 shadow-sm ring-1 ring-slate-200 ${className}`} {...props}>
      {children}
    </section>
  );
}
