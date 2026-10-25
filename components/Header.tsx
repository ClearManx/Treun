"use client";

import { useEffect, useRef, useState } from "react";

/** Sticky header that slides away when scrolling down and comes back when scrolling up. */
export function Header({ children }: { children: React.ReactNode }) {
  const [hidden, setHidden] = useState(false);
  const last = useRef(0);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      if (y < 80) setHidden(false);
      else if (y > last.current + 4) setHidden(true);
      else if (y < last.current - 4) setHidden(false);
      last.current = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return <header className={`header${hidden ? " header--hidden" : ""}`}>{children}</header>;
}
