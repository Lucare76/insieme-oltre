"use client";

import { useEffect } from "react";

export default function AuthHashRedirect() {
  useEffect(() => {
    const hash = window.location.hash;

    if (!hash.includes("access_token=")) return;
    if (window.location.pathname === "/admin") return;

    window.location.replace(`/admin${hash}`);
  }, []);

  return null;
}
