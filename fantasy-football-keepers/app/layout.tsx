import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "2026 Keeper Selection", description: "Fantasy Football 2026 keeper portal" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
