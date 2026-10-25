import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Header } from "@/components/Header";
import { BasketButton } from "@/components/Basket";
import { ContourBackground } from "@/components/ContourBackground";
import { modules } from "@/lib/modules";
import "./globals.css";

// Fonts load in the browser from Google Fonts, so building needs no network. Archivo's width
// axis (62–125) gives the wide headings. Swap the link and the --sans/--mono tokens in globals.css to restyle.
const FONTS =
  "https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..800&family=Martian+Mono:wght@400;500;600&display=swap";

export const metadata: Metadata = {
  title: "Treun · Agentic procurement",
  description: "Buyer agents order from verified suppliers and settle in USDC on Solana.",
};

const links = [
  { href: "/catalogue", label: "Catalogue" },
  { href: "/ask", label: "Ask Treun" },
  { href: "/treun/audit", label: "Audit ledger" },
];
const usesPayments = modules.some((m) => m.id === "payments");

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href={FONTS} />
      </head>
      <body>
        <ContourBackground />
        <Header>
          <div className="header-inner">
            <Link href="/" className="wordmark">
              <b>treun</b>
            </Link>
            <Nav links={links} />
            <div className="header-right">
              <BasketButton />
              <Link href="/signin" className="signin-btn">Register / Sign in</Link>
            </div>
          </div>
        </Header>
        <main className="page">{children}</main>
        <footer className="footer">
          <div className="footer-inner">
            <span>{usesPayments ? "SOLANA DEVNET · TEST MONEY ONLY" : "STARTER PROJECT"}</span>
            <span>DEMO · FICTIONAL SUPPLIERS · SIMULATED LICENCE CHECKS · <Link href="/admin">HQ ADMIN</Link></span>
          </div>
        </footer>
      </body>
    </html>
  );
}
