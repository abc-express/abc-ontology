import Link from "next/link";

export default function HomePage() {
  return (
    <main
      style={{
        fontFamily: "system-ui, sans-serif",
        maxWidth: 640,
        margin: "4rem auto",
        padding: "0 1.5rem",
      }}
    >
      <h1>ANTERO Platform</h1>
      <p>
        Fase A DAEMON consumer — read-only intelligence via server-side BFF.
      </p>
      <p>
        <Link href="/intelligence">Open Intelligence →</Link>
      </p>
    </main>
  );
}
