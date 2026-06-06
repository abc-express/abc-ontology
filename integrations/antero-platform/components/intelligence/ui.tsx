import type { ReactNode } from "react";

const styles = {
  page: {
    fontFamily: "system-ui, sans-serif",
    maxWidth: 960,
    margin: "0 auto",
    padding: "1.5rem",
    color: "#0f172a",
  } as const,
  section: {
    marginBottom: "2rem",
    padding: "1rem",
    border: "1px solid #e2e8f0",
    borderRadius: 8,
  } as const,
  h2: { marginTop: 0, fontSize: "1.1rem" } as const,
  input: {
    width: "100%",
    padding: "0.5rem",
    marginBottom: "0.5rem",
    borderRadius: 4,
    border: "1px solid #cbd5e1",
  } as const,
  button: {
    padding: "0.5rem 1rem",
    borderRadius: 4,
    border: "none",
    background: "#1e40af",
    color: "#fff",
    cursor: "pointer",
  } as const,
  pre: {
    background: "#f8fafc",
    padding: "0.75rem",
    overflow: "auto",
    fontSize: "0.85rem",
    borderRadius: 4,
  } as const,
  table: { width: "100%", borderCollapse: "collapse" as const },
  th: {
    textAlign: "left" as const,
    borderBottom: "1px solid #e2e8f0",
    padding: "0.5rem",
  },
  td: { padding: "0.5rem", borderBottom: "1px solid #f1f5f9" },
  error: { color: "#b91c1c", fontSize: "0.9rem" } as const,
};

export function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section style={styles.section}>
      <h2 style={styles.h2}>{title}</h2>
      {children}
    </section>
  );
}

export { styles };
