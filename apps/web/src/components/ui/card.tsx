import { forwardRef, type HTMLAttributes, type ReactNode } from "react";

type CardProps = HTMLAttributes<HTMLElement> & {
  children: ReactNode;
};

export const Card = forwardRef<HTMLElement, CardProps>(function Card({ children, className = "", ...props }, ref) {
  return (
    <section ref={ref} className={`rounded-lg bg-white p-6 shadow-sm ring-1 ring-slate-200 ${className}`} {...props}>
      {children}
    </section>
  );
});
