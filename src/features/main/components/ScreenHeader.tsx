import type { ReactNode } from "react";

type ScreenHeaderProps = {
  title: string;
  subtitle: string;
  className?: string;
  children?: ReactNode;
};

export default function ScreenHeader({ title, subtitle, className, children }: ScreenHeaderProps) {
  const classes = ["screen-header", className].filter(Boolean).join(" ");

  return (
    <header className={classes}>
      <h1 className="screen-title">{title}</h1>
      <p className="screen-subtitle">{subtitle}</p>
      {children}
    </header>
  );
}
