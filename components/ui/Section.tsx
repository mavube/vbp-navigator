import { ReactNode } from "react";

interface SectionProps {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}

// v3.0 Phase 6a (UI/UX modernization) — a titled, card-framed grouping
// primitive. Card.tsx is the plain box; Section wraps it with a header
// row (title + optional description + optional right-aligned actions)
// so module pages can break "one long scroll of stuff" into clearly
// labeled, self-contained sections instead of every page inventing its
// own ad hoc h2-plus-div heading pattern (which is what Documents,
// Architecture, and most other modules were doing individually before
// this pass).
export function Section({ title, description, actions, children }: SectionProps) {
  return (
    <section className="v2-section">
      <div className="v2-section-head">
        <div>
          <h2 className="v2-section-title">{title}</h2>
          {description && <p className="v2-section-description">{description}</p>}
        </div>
        {actions && <div className="v2-section-actions">{actions}</div>}
      </div>
      <div className="v2-section-body">{children}</div>
    </section>
  );
}
