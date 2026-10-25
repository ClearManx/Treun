import Link from "next/link";
import { ITEMS, SUPPLIERS } from "@/lib/treun/catalog";

export default function Landing() {
  const countries = new Set(SUPPLIERS.filter((s) => s.licence.status === "valid").map((s) => s.country)).size;
  return (
    <>
      <section className="hero">
        <span className="eyebrow">Agentic procurement for allied defence</span>
        <h1 className="hero-title">Equipment to the front line in seconds, not months.</h1>
        <p className="hero-lead">
          Order directly from verified suppliers across allied countries. Every order is licence-checked, held to budget, settled in USDC and
          recorded on Solana, so speed never costs accountability.
        </p>
        <div className="hero-ctas">
          <Link href="/catalogue" className="cta cta--primary">Browse the catalogue ▸</Link>
          <Link href="/ask" className="cta cta--secondary">Ask Treun ▸</Link>
        </div>
        <p className="small muted">Ask Treun: describe what your unit needs in plain language and the buyer agent builds, checks and pays for the order.</p>
      </section>

      <section className="value-grid">
        <div className="value">
          <span className="value-num">{ITEMS.length}</span>
          <b>Listings</b>
          <p>From {countries} allied countries, bought directly with no intermediary.</p>
        </div>
        <div className="value">
          <span className="value-num">0</span>
          <b>Payments without checks</b>
          <p>Supplier licences and unit budgets are enforced in code before anything is paid.</p>
        </div>
        <div className="value">
          <span className="value-num">100%</span>
          <b>On the record</b>
          <p>Every paid and refused order is on the <Link href="/treun/audit">audit ledger</Link>, with an on-chain receipt.</p>
        </div>
      </section>
    </>
  );
}
