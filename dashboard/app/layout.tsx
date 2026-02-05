import "./globals.css";

export const metadata = {
  title: "AI Docs Analytics",
  description: "Track AI coding agent traffic on your documentation",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-zinc-950 text-zinc-100 min-h-screen">{children}</body>
    </html>
  );
}
