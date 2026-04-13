import type { PropsWithChildren } from "react";

type PageShellProps = PropsWithChildren<{
  eyebrow?: string;
  title: string;
  description: string;
}>;

export function PageShell({
  eyebrow,
  title,
  description,
  children,
}: PageShellProps) {
  return (
    <main className="page-shell">
      <section className="hero-card" aria-labelledby="page-title">
        <div className="hero-copy">
          {eyebrow ? <p className="hero-eyebrow">{eyebrow}</p> : null}
          <h1 id="page-title" className="hero-title">
            {title}
          </h1>
          <p className="hero-description">{description}</p>
        </div>
        {children}
      </section>
    </main>
  );
}
