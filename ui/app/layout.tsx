import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ITR Credentials Operations",
  description: "RegisterKaro automation live events dashboard"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
