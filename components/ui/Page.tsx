import { ReactNode } from "react";

interface PageProps {
  title: string;
  description?: ReactNode;
  children: ReactNode;
}

// The one shared layout every module page uses — replaces the
// maxWidth/padding/h1/p markup that used to be copy-pasted into all
// eight page.tsx files individually. A page's own content is
// everything specific to it; the shell (width, spacing, heading
// treatment) is the same everywhere, on purpose, and now lives in one
// place so a future design change touches one file instead of eight.
export function Page({ title, description, children }: PageProps) {
  return (
    <main className="v2-page-shell">
      <div className="v2-page-header">
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {children}
    </main>
  );
}
