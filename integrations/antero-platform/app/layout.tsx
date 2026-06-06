export const metadata = {
  title: "ANTERO Platform",
  description: "DAEMON read-only consumer (Fase A)",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
