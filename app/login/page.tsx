"use client";

// v2.0: email/password sign-in via Supabase Auth, replacing v1.0's
// shared-passcode form. There's no self-serve sign-up yet — an Org Admin
// creates accounts (see README "Inviting people" for the bootstrap SQL
// until a real invite flow exists) — so this page only signs people in.
//
// Rebuilt 2026-09-16 (Phase 1, design-system pass) on the v2.0 token
// set via the existing Input/Button primitives, instead of v1.0's
// legacy .login-wrap/.login-card classes — sign-in is most people's
// first impression of the product, so it shouldn't be the one screen
// left in the old visual language.

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (signInError) {
      setError(signInError.message);
      setBusy(false);
      return;
    }
    router.push(params.get("next") || "/");
    router.refresh();
  }

  return (
    <div className="v2-login-wrap">
      <form className="v2-login-card" onSubmit={submit}>
        <h1>VBP Navigator</h1>
        <p>Sign in to continue.</p>
        <Input
          type="email"
          autoFocus
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
        />
        <Input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
        />
        {error && <p className="v2-login-error">{error}</p>}
        <Button type="submit" disabled={busy || !email || !password}>
          {busy ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
