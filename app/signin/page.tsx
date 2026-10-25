"use client";

import Link from "next/link";
import { useState } from "react";

export default function SignInPage() {
  const [mode, setMode] = useState<"signin" | "register">("signin");
  const [sent, setSent] = useState(false);

  return (
    <div className="auth">
      <section className="module">
        <div className="module-strip">
          <span>{mode === "signin" ? "Sign in" : "Register"}</span>
          <span>Demo</span>
        </div>
        <form className="module-body" onSubmit={(e) => { e.preventDefault(); setSent(true); }}>
          <div className="row">
            <button type="button" className={`chip${mode === "signin" ? " chip--on" : ""}`} onClick={() => { setMode("signin"); setSent(false); }}>Sign in</button>
            <button type="button" className={`chip${mode === "register" ? " chip--on" : ""}`} onClick={() => { setMode("register"); setSent(false); }}>Register</button>
          </div>
          {mode === "register" && (
            <>
              <label className="label" htmlFor="unit">Unit or organisation</label>
              <input id="unit" placeholder="e.g. 3rd Recon Company" />
              <label className="label" htmlFor="role">Account type</label>
              <select id="role" className="filter-select" defaultValue="buyer">
                <option value="buyer">Buyer (unit procurement)</option>
                <option value="supplier">Supplier</option>
                <option value="auditor">Auditor</option>
              </select>
            </>
          )}
          <label className="label" htmlFor="email">Work email</label>
          <input id="email" type="email" placeholder="name@organisation.org" required />
          <button className="btn btn--primary" type="submit">{mode === "signin" ? "Send sign-in link ▸" : "Request access ▸"}</button>
          {sent && (
            <div className="notice">
              Accounts aren&apos;t enabled in this demo. In production, buyers, suppliers and auditors would be verified before they can order, list or audit.
            </div>
          )}
          <Link href="/" className="small">◂ Back to Treun</Link>
        </form>
      </section>
    </div>
  );
}
