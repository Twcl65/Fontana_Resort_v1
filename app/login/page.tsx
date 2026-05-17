"use client";

import { Suspense, useEffect, useMemo, useState, FormEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import FontanaLogo from "@/components/assets/fontana_logo.png";
import FontanaCover from "@/components/assets/fontana_cover.jpg";
import {
  Calendar,
  CheckCircle2,
  MapPin,
  Phone,
  Mail,
  Shield,
  Sparkles,
  Users,
  ChevronRight,
  Waves,
  Palmtree,
  User,
  WalletCards,
  UserPlus,
  Eye,
  EyeOff,
  ChevronLeft,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/components/ui/utils";
import { onAuthStateChanged, handleOAuthSession, loginWithEmail, signInWithGoogle, signUpWithEmail } from "@/lib/auth";
import { getAppOAuthCallbackUrl } from "@/lib/oauth-config";
import { listCottages, type FontanaCottageRow } from "@/lib/fontana-data";
import { normalizeCottageAmenities } from "@/lib/fontana-data";

const OAUTH_INTENT_KEY = "fontana_oauth_intent";

const NAV_LINKS = [
  { label: "Home", href: "/login#hero" },
  { label: "About Us", href: "/login#about" },
  { label: "Contact", href: "/login#contact" },
];

const FEATURES = [
  {
    title: "Real-Time Cottage Availability",
    description: "See which cottages are available for your dates instantly. No more phone calls or guesswork.",
    icon: Calendar,
  },
  {
    title: "Instant Booking Confirmation",
    description: "Get immediate confirmation and a digital receipt. Your reservation is secured right away.",
    icon: CheckCircle2,
  },
  {
    title: "Secure Online Reservation",
    description: "Your data and payments are protected. Book with confidence on our secure platform.",
    icon: Shield,
  },
  {
    title: "Easy Reservation Management",
    description: "View, modify, or cancel your bookings from your account—all in one place.",
    icon: Sparkles,
  },
];

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.9-5.5 3.9-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.9 1.5l2.7-2.6C17 3.2 14.8 2.3 12 2.3 6.8 2.3 2.5 6.6 2.5 11.8S6.8 21.3 12 21.3c6.9 0 9.1-4.8 9.1-7.3 0-.5-.1-.9-.1-1.3H12z"
      />
      <path fill="#34A853" d="M3.6 7.4l3.2 2.4c.9-2.6 2.9-3.8 5.2-3.8 1.9 0 3.1.8 3.9 1.5l2.7-2.6C17 3.2 14.8 2.3 12 2.3 8.3 2.3 5 4.4 3.6 7.4z" />
      <path fill="#4A90E2" d="M12 21.3c2.7 0 5-.9 6.6-2.5l-3-2.4c-.8.6-1.9 1-3.6 1-3.8 0-5.2-2.6-5.5-3.9L3.2 16c1.5 3.1 4.7 5.3 8.8 5.3z" />
      <path fill="#FBBC05" d="M3.2 16l3.3-2.6c-.1-.4-.2-.9-.2-1.4s.1-1 .2-1.4L3.2 8C2.7 9.2 2.5 10.5 2.5 11.8c0 1.4.3 2.9.7 4.2z" />
    </svg>
  );
}

type LandingCottage = {
  id: string;
  name: string;
  category: string;
  capacityLabel: string;
  price: number;
  images: string[];
  status: string;
  amenities: string[];
  description: string;
};

function mapLandingCottage(row: FontanaCottageRow): LandingCottage {
  const images =
    row.image_urls && row.image_urls.length > 0
      ? row.image_urls
      : row.image_url
        ? [row.image_url]
        : [];
  const cap = Math.max(1, Number(row.capacity) || 1);
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    capacityLabel: `Good for ${cap} people`,
    price: Number(row.rate_night),
    images,
    status: row.status,
    amenities: normalizeCottageAmenities(row.amenities).map((a) => a.name),
    description: `${row.category} space with resort-managed amenities for day and overnight stays.`,
  };
}

function Slideshow({
  images,
  alt,
  className,
  intervalMs = 4200,
}: {
  images: string[];
  alt: string;
  className?: string;
  intervalMs?: number;
}) {
  const safeImages = useMemo(() => images.filter(Boolean), [images]);
  const [active, setActive] = useState(0);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    if (hovered) return;
    if (safeImages.length <= 1) return;
    const id = window.setInterval(() => {
      setActive((i) => (i + 1) % safeImages.length);
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [hovered, intervalMs, safeImages.length]);

  if (safeImages.length === 0) {
    return <div className={cn("h-full w-full bg-muted", className)} />;
  }

  return (
    <div
      className={cn("relative h-full w-full", className)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {safeImages.map((src, idx) => (
        <img
          key={`${src}-${idx}`}
          src={src}
          alt={alt}
          className={cn(
            "absolute inset-0 h-full w-full object-cover transition-opacity duration-700",
            idx === active ? "opacity-100" : "opacity-0"
          )}
          loading={idx === 0 ? "eager" : "lazy"}
        />
      ))}

      {safeImages.length > 1 && (
        <>
          <button
            type="button"
            aria-label="Previous image"
            className="absolute left-2 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur transition hover:bg-black/65"
            onClick={() => setActive((prev) => (prev - 1 + safeImages.length) % safeImages.length)}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Next image"
            className="absolute right-2 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur transition hover:bg-black/65"
            onClick={() => setActive((prev) => (prev + 1) % safeImages.length)}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2">
            <div className="flex items-center gap-1.5 rounded-full bg-black/35 px-3 py-2 backdrop-blur">
              {safeImages.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  aria-label={`Show image ${idx + 1}`}
                  onClick={() => setActive(idx)}
                  className={cn(
                    "h-1.5 w-1.5 rounded-full transition-all",
                    idx === active ? "w-5 bg-white" : "bg-white/50 hover:bg-white/80"
                  )}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const STEPS = [
  { step: 1, title: "Choose a Cottage", icon: Palmtree },
  { step: 2, title: "Select Reservation Date", icon: Calendar },
  { step: 3, title: "Confirm Booking", icon: CheckCircle2 },
  { step: 4, title: "Enjoy Your Stay", icon: Waves },
];

function LandingPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loginOpen, setLoginOpen] = useState(false);
  const [signupOpen, setSignupOpen] = useState(false);

  const [loginUsernameOrEmail, setLoginUsernameOrEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  const [signupName, setSignupName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupLoading, setSignupLoading] = useState(false);

  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [signupError, setSignupError] = useState("");
  const [liveCottages, setLiveCottages] = useState<LandingCottage[]>([]);
  const [cottagesLoading, setCottagesLoading] = useState(true);
  const [cottagesError, setCottagesError] = useState<string | null>(null);

  const openLogin = () => {
    setSignupOpen(false);
    setLoginOpen(true);
  };
  const openSignup = () => {
    setLoginOpen(false);
    setSignupOpen(true);
  };

  const clearOAuthIntent = () => {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(OAUTH_INTENT_KEY);
  };

  useEffect(() => {
    const oauthError = searchParams.get("oauth_error");
    if (oauthError) {
      setLoginError(decodeURIComponent(oauthError));
      setLoginOpen(true);
    }
  }, [searchParams]);

  useEffect(() => {
    const initSession = async () => {
      try {
        const result = await handleOAuthSession();
        if (!result) return;
        clearOAuthIntent();
        router.push(result.redirectTo);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to verify user access.";
        setLoginError(message);
      }
    };

    const { data: authListener } = onAuthStateChanged(async (event, session) => {
      if (event !== "SIGNED_IN" || !session?.user) return;
      try {
        const result = await handleOAuthSession();
        if (!result) return;
        clearOAuthIntent();
        router.push(result.redirectTo);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to verify user access.";
        setLoginError(message);
      }
    });

    initSession();

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [router]);

  useEffect(() => {
    const loadLandingCottages = async () => {
      setCottagesLoading(true);
      setCottagesError(null);
      const cottagesRes = await listCottages();
      if (cottagesRes.error) {
        setCottagesError(cottagesRes.error);
      }
      const mapped = (cottagesRes.data ?? []).map(mapLandingCottage);
      setLiveCottages(mapped);
      setCottagesLoading(false);
    };
    void loadLandingCottages();
  }, []);

  const handleLoginSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoginError("");
    setLoginLoading(true);

    try {
      const result = await loginWithEmail({
        email: loginUsernameOrEmail.trim(),
        password: loginPassword,
      });
      setLoginLoading(false);
      setLoginOpen(false);
      router.push(result.redirectTo);
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to verify user access.";
      setLoginError(message);
      setLoginLoading(false);
      return;
    }

  };

  const handleSignupSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSignupError("");
    setSignupLoading(true);
    clearOAuthIntent();

    try {
      await signUpWithEmail({
        full_name: signupName.trim(),
        email: signupEmail.trim(),
        password: signupPassword,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Signup failed.";
      setSignupError(message);
      setSignupLoading(false);
      return;
    }

    setSignupLoading(false);
    setSignupOpen(false);
    setLoginOpen(true);
  };

  const handleGoogleLogin = async () => {
    setLoginError("");
    setLoginLoading(true);
    clearOAuthIntent();

    try {
      await signInWithGoogle(getAppOAuthCallbackUrl());
    } catch (error) {
      const message = error instanceof Error ? error.message : "Google sign in failed.";
      setLoginError(message);
      setLoginLoading(false);
      return;
    }
  };

  const handleGoogleSignup = async () => {
    setSignupError("");
    setSignupLoading(true);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(OAUTH_INTENT_KEY, "google-signup");
    }

    try {
      await signInWithGoogle(getAppOAuthCallbackUrl());
    } catch (error) {
      const message = error instanceof Error ? error.message : "Google sign up failed.";
      setSignupError(message);
      setSignupLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Login Dialog */}
      <Dialog open={loginOpen} onOpenChange={setLoginOpen}>
        <DialogContent showClose={true} className="max-w-sm gap-0 p-5">
          <DialogHeader className="space-y-0 pb-3 pt-0">
            <div className="flex flex-col items-center gap-2">
              <Image
                src={FontanaLogo}
                alt="Fontana Blue Cold Spring"
                width={88}
                height={88}
                className="h-20 w-20 shrink-0 rounded-xl object-contain"
              />
              <div className="text-center">
                <DialogTitle className="text-xl font-bold">Login</DialogTitle>
                <p className="text-sm text-muted-foreground">Please enter your details to login.</p>
              </div>
            </div>
          </DialogHeader>
          <form onSubmit={handleLoginSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="login-username-email" className="text-xs font-medium text-foreground">Email</Label>
              <Input
                id="login-username-email"
                type="text"
                placeholder="Enter your Email"
                autoComplete="username"
                required
                className="h-9 text-sm"
                value={loginUsernameOrEmail}
                onChange={(e) => setLoginUsernameOrEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="login-password" className="text-xs font-medium text-foreground">Password</Label>
              <div className="relative">
                <Input
                  id="login-password"
                  type={showLoginPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  required
                  className="h-9 pr-9 text-sm"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowLoginPassword((p) => !p)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showLoginPassword ? "Hide password" : "Show password"}
                >
                  {showLoginPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-input"
                />
                Remember me
              </label>
              <button
                type="button"
                className="text-xs font-medium text-primary hover:underline"
              >
                Forgot Password
              </button>
            </div>
            <Button type="submit" className="h-9 w-full" disabled={loginLoading}>
              {loginLoading ? "Signing in..." : "Log In"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-9 w-full"
              disabled={loginLoading}
              onClick={handleGoogleLogin}
            >
              <GoogleIcon className="mr-2 h-4 w-4" />
              Continue with Google
            </Button>
            {loginError && <p className="text-xs text-red-600">{loginError}</p>}
          </form>
          <DialogFooter className="mt-3 flex flex-col items-center justify-center border-t border-border pt-3 sm:!justify-center">
            <p className="w-full text-center text-xs text-muted-foreground">
              Don&apos;t have an account Yet?{" "}
              <button
                type="button"
                className="font-medium text-primary underline-offset-4 hover:underline"
                onClick={openSignup}
              >
                Sign Up
              </button>
            </p>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Signup Dialog */}
      <Dialog open={signupOpen} onOpenChange={setSignupOpen}>
        <DialogContent showClose={true} className="max-w-sm gap-0 p-5">
          <DialogHeader className="space-y-0 pb-3 pt-0">
            <div className="flex flex-col items-center gap-2">
              <Image
                src={FontanaLogo}
                alt="Fontana Blue Cold Spring"
                width={88}
                height={88}
                className="h-20 w-20 shrink-0 rounded-xl object-contain"
              />
              <div className="text-center">
                <DialogTitle className="text-xl font-bold">Sign up</DialogTitle>
                <p className="text-sm text-muted-foreground">Create an account to book your stay.</p>
              </div>
            </div>
          </DialogHeader>
          <form onSubmit={handleSignupSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="signup-name" className="text-xs font-medium text-foreground">Full name</Label>
              <Input
                id="signup-name"
                type="text"
                placeholder="Enter your name"
                autoComplete="name"
                required
                className="h-9 text-sm"
                value={signupName}
                onChange={(e) => setSignupName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="signup-email" className="text-xs font-medium text-foreground">Email</Label>
              <Input
                id="signup-email"
                type="email"
                placeholder="Enter your Email"
                autoComplete="email"
                required
                className="h-9 text-sm"
                value={signupEmail}
                onChange={(e) => setSignupEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="signup-password" className="text-xs font-medium text-foreground">Password</Label>
              <div className="relative">
                <Input
                  id="signup-password"
                  type={showSignupPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  autoComplete="new-password"
                  required
                  className="h-9 pr-9 text-sm"
                  value={signupPassword}
                  onChange={(e) => setSignupPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowSignupPassword((p) => !p)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showSignupPassword ? "Hide password" : "Show password"}
                >
                  {showSignupPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" className="h-9 w-full" disabled={signupLoading}>
              {signupLoading ? "Creating account..." : "Sign Up"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-9 w-full"
              disabled={signupLoading}
              onClick={handleGoogleSignup}
            >
              <GoogleIcon className="mr-2 h-4 w-4" />
              Sign up with Google
            </Button>
            {signupError && <p className="text-xs text-red-600">{signupError}</p>}
          </form>
          <DialogFooter className="mt-3 flex flex-col items-center justify-center border-t border-border pt-3 sm:!justify-center">
            <p className="w-full text-center text-xs text-muted-foreground">
              Already have an account?{" "}
              <button
                type="button"
                className="font-medium text-primary underline-offset-4 hover:underline"
                onClick={openLogin}
              >
                Login
              </button>
            </p>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Header Navbar */}
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="container flex h-14 max-w-6xl items-center justify-between px-4">
          <Link
            href="/login#hero"
            className="flex items-center gap-2 font-semibold text-primary"
          >
            <Image
              src={FontanaLogo}
              alt="Fontana Blue Cold Spring"
              width={36}
              height={36}
              className="h-9 w-auto object-contain mix-blend-multiply"
            />
            <span className="hidden sm:inline">Fontana Blue Cold Spring</span>
          </Link>
          <nav className="flex items-center gap-1 sm:gap-4">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
              >
                {link.label}
              </Link>
            ))}
            <Button
              onClick={() => setLoginOpen(true)}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Login
            </Button>
          </nav>
        </div>
      </header>

      <main>
        {/* Hero Section */}
        <section
          id="hero"
          className="relative flex min-h-[90vh] items-center justify-center overflow-hidden px-4 py-16"
        >
          {/* Background using Fontana cover */}
          <div className="pointer-events-none absolute inset-0">
            <div
              className="absolute inset-0 bg-cover bg-center bg-no-repeat"
              style={{
                backgroundImage: `url(${FontanaCover.src})`,
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-br from-black/80 via-black/70 to-black/60" />
            <div className="absolute inset-0 opacity-50 mix-blend-screen">
              <div className="pointer-events-none absolute -top-40 -right-40 h-80 w-80 rounded-full bg-primary/40 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-cyan-400/40 blur-3xl" />
            </div>
          </div>

          <div className="container relative z-10 grid max-w-5xl gap-10 md:grid-cols-[1.4fr,1fr] items-center">
            {/* Left: concise resort pitch */}
            <div className="space-y-6 text-left text-white">
              <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-white/80 backdrop-blur">
                <Waves className="h-3 w-3" />
                Fontana Blue Cold Spring • Jasaan, Misamis Oriental
              </p>
              <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl md:text-6xl">
                Your coastal escape,
                <span className="block text-primary-100">booked in a few taps.</span>
              </h1>
              <p className="max-w-xl text-sm sm:text-base text-white/80">
                Reserve cottages, confirm schedules, and manage your stay in one simple,
                secure portal—anytime, anywhere.
              </p>
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Button
                  onClick={() => setLoginOpen(true)}
                  size="lg"
                  className="bg-white text-primary hover:bg-white/90 shadow-xl"
                >
                  Book a Cottage
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="border-white/60 bg-white/5 text-white hover:bg-white/10 hover:text-white"
                >
                  <Link href="/login#cottages">Preview Cottages</Link>
                </Button>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-white/70">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  <span>Secure online reservations</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span>Real‑time cottage availability</span>
                </div>
              </div>
            </div>


          </div>
        </section>

        {/* What you can do inside */}
        <section className="border-t border-border/40 bg-muted/40 py-14 md:py-20">
          <div className="container max-w-6xl px-4">
            <div className="grid gap-10 md:grid-cols-[1.2fr,1fr] items-start">
              <div className="space-y-4">
                <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground">
                  Everything in one reservation hub
                </h2>
                <p className="text-sm md:text-base text-muted-foreground max-w-xl">
                  Fontana&apos;s portal keeps your bookings, payments, and stay details organized so you
                  don&apos;t have to juggle calls and handwritten notes.
                </p>
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  {FEATURES.map((feature) => (
                    <Card
                      key={feature.title}
                      className="border-border/50 bg-card/80 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg"
                    >
                      <CardHeader className="space-y-2 pb-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                          <feature.icon className="h-4 w-4" />
                        </div>
                        <CardTitle className="text-sm font-semibold">{feature.title}</CardTitle>
                        <CardDescription className="text-xs text-muted-foreground">
                          {feature.description}
                        </CardDescription>
                      </CardHeader>
                    </Card>
                  ))}
                </div>
              </div>

              <Card className="border-dashed border-primary/30 bg-gradient-to-br from-primary/5 via-card to-accent/5 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold">A clearer booking journey</CardTitle>
                  <CardDescription className="text-xs">
                    See at a glance how simple it is to confirm your stay.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-xs">
                  <ol className="space-y-3">
                    {STEPS.map((step) => (
                      <li key={step.step} className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[0.7rem] font-semibold text-primary-foreground">
                          {step.step}
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{step.title}</p>
                          {step.step === 1 && (
                            <p className="text-[0.7rem] text-muted-foreground">
                              Browse available cottages that match your group size and date.
                            </p>
                          )}
                          {step.step === 2 && (
                            <p className="text-[0.7rem] text-muted-foreground">
                              Lock in a schedule that fits your planned getaway.
                            </p>
                          )}
                          {step.step === 3 && (
                            <p className="text-[0.7rem] text-muted-foreground">
                              Confirm details and pay using the preferred method.
                            </p>
                          )}
                          {step.step === 4 && (
                            <p className="text-[0.7rem] text-muted-foreground">
                              Arrive at Fontana with everything already coordinated.
                            </p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ol>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Cottage types preview */}
        <section
          id="cottages"
          className="relative overflow-hidden border-t border-border/40 bg-gradient-to-b from-background via-background to-muted/40 py-14 md:py-20"
        >
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -top-24 left-1/2 h-64 w-[56rem] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
            <div className="absolute -bottom-32 right-[-6rem] h-72 w-72 rounded-full bg-sky-500/10 blur-3xl" />
            <div
              className="absolute inset-0 opacity-[0.35]"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 1px 1px, rgba(0,0,0,0.10) 1px, transparent 0)",
                backgroundSize: "18px 18px",
              }}
            />
          </div>
          <div className="container max-w-6xl px-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground">
                  Cottage types at a glance
                </h2>
                <p className="mt-1 text-sm text-muted-foreground max-w-xl">
                  From intimate poolside spots to family cottages, pick a space that matches your stay.
                </p>
              </div>
              <button
                type="button"
                className="mt-2 text-xs font-medium text-primary underline-offset-4 hover:underline md:mt-0"
                onClick={() => setLoginOpen(true)}
              >
                Log in to view full availability
              </button>
            </div>

            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {cottagesError && (
                <Card className="col-span-full border-red-200 bg-red-50 shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-base text-red-700">Unable to load cottages</CardTitle>
                    <CardDescription className="text-xs text-red-700/90">
                      {cottagesError}
                    </CardDescription>
                  </CardHeader>
                </Card>
              )}
              {!cottagesLoading &&
                liveCottages.map((cottage) => (
                <Card
                  key={cottage.id}
                  className="group overflow-hidden border-border/60 bg-card/90 shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl"
                >
                  <div className="relative aspect-[4/3] overflow-hidden bg-muted">
                    <Slideshow
                      images={cottage.images}
                      alt={cottage.name}
                      className="h-full w-full transition-transform duration-500 group-hover:scale-[1.03]"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent opacity-80" />
                    <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-xs text-white">
                      <span className="inline-flex items-center gap-1 rounded-full bg-black/40 px-3 py-1 backdrop-blur">
                        <Users className="h-3.5 w-3.5" />
                        {cottage.capacityLabel}
                      </span>
                      <span className="rounded-full bg-primary px-3 py-1 text-[0.7rem] font-semibold text-primary-foreground">
                        {`₱${cottage.price.toLocaleString()} / night`}
                      </span>
                    </div>
                  </div>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">{cottage.name}</CardTitle>
                    <CardDescription className="text-xs">
                      {`${cottage.category} · ${cottage.status}`}
                    </CardDescription>
                    <p className="text-xs text-muted-foreground">{cottage.description}</p>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {(cottage.amenities.length ? cottage.amenities : ["No amenities listed"]).slice(0, 5).map((item, idx) => (
                        <span
                          key={`${cottage.id}-amenity-${idx}-${item}`}
                          className="rounded-md bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  </CardHeader>
                  <CardFooter className="pt-0">
                    <Button
                      onClick={() => setLoginOpen(true)}
                      size="sm"
                      className="w-full text-xs"
                      variant="book"
                    >
                      Book Now
                    </Button>
                  </CardFooter>
                </Card>
              ))}
              {!cottagesLoading && liveCottages.length === 0 && (
                <Card className="col-span-full border-border/60 bg-card/90 shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-base">No cottages published yet</CardTitle>
                    <CardDescription className="text-xs">
                      Ask the admin to add cottages so they appear here on the landing page.
                    </CardDescription>
                  </CardHeader>
                </Card>
              )}
              {cottagesLoading && (
                <Card className="col-span-full border-border/60 bg-card/90 shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-base">Loading cottages...</CardTitle>
                  </CardHeader>
                </Card>
              )}
            </div>
          </div>
        </section>

        {/* Resort snapshot / About */}
        <section id="about" className="border-t border-border/40 bg-muted/40 py-14 md:py-20">
          <div className="container max-w-6xl px-4">
            <div className="grid gap-10 lg:grid-cols-[1.1fr,1fr] items-center">
              <div className="space-y-4">
                <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground">
                  A quick snapshot of Fontana Blue Cold Spring
                </h2>
                <p className="text-sm md:text-base text-muted-foreground">
                  Nestled in Jasaan, Misamis Oriental, Fontana Blue Cold Spring combines clear water,
                  green surroundings, and cottage-style spaces designed for small groups and families.
                  The reservation system you&apos;re viewing was built to remove the friction from that
                  experience.
                </p>
                <div className="grid gap-4 text-xs sm:grid-cols-3">
                  <div className="rounded-lg bg-card/80 p-3 shadow-sm">
                    <p className="text-[0.7rem] text-muted-foreground">Ideal for</p>
                    <p className="mt-1 font-semibold">Family trips</p>
                    <p className="mt-1 text-[0.7rem] text-muted-foreground">
                      Cottages sized for group bonding and celebrations.
                    </p>
                  </div>
                  <div className="rounded-lg bg-card/80 p-3 shadow-sm">
                    <p className="text-[0.7rem] text-muted-foreground">Location</p>
                    <p className="mt-1 font-semibold">Jasaan, Misamis Oriental</p>
                    <p className="mt-1 text-[0.7rem] text-muted-foreground">
                      Easy to reach for both local guests and visitors.
                    </p>
                  </div>
                  <div className="rounded-lg bg-card/80 p-3 shadow-sm">
                    <p className="text-[0.7rem] text-muted-foreground">System goal</p>
                    <p className="mt-1 font-semibold">Faster confirmation</p>
                    <p className="mt-1 text-[0.7rem] text-muted-foreground">
                      Let guests secure a spot without back‑and‑forth.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm">
                  <img
                    src="https://images.unsplash.com/photo-1501117716987-c8e1ecb2105a?w=900&q=80&auto=format&fit=crop"
                    alt="Poolside view placeholder"
                    className="h-44 w-full object-cover"
                  />
                </div>
                <div className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm">
                  <img
                    src="https://images.unsplash.com/photo-1518834056226-0b028a2b5a47?w=600&q=80&auto=format&fit=crop"
                    alt="Garden path placeholder"
                    className="h-32 w-full object-cover"
                  />
                </div>
                <div className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm">
                  <img
                    src="https://images.unsplash.com/photo-1540541338287-41700207dee6?w=600&q=80&auto=format&fit=crop"
                    alt="Cottage exterior placeholder"
                    className="h-32 w-full object-cover"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Final call-to-action + contact */}
        <section className="border-t border-border/60 bg-gradient-to-br from-primary/95 via-primary to-sky-600 py-14 md:py-18">
          <div className="container max-w-6xl px-4 text-white">
            <div className="grid gap-10 lg:grid-cols-[1.1fr,1fr] items-center">
              <div className="space-y-4">
                <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">
                  Ready to try the reservation portal?
                </h2>
                <p className="text-sm md:text-base text-white/90 max-w-xl">
                  Create an account or log in to explore actual schedules, manage bookings, and keep
                  everything about your stay in one place.
                </p>
                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <Button
                    onClick={openSignup}
                    size="lg"
                    variant="secondary"
                    className="bg-white text-primary hover:bg-white/90"
                  >
                    Sign up as a user
                  </Button>
                  <Button
                    onClick={openLogin}
                    size="lg"
                    variant="outline"
                    className="h-11 rounded-full border-white/70 bg-transparent px-7 text-white hover:bg-white/10"
                  >
                    I already have an account
                  </Button>
                </div>
              </div>

              <Card
                id="contact"
                className="border-white/20 bg-white/5 text-white shadow-xl backdrop-blur-md"
              >
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Waves className="h-4 w-4" />
                    Cold Spring contact details
                  </CardTitle>
                  <CardDescription className="text-[0.7rem] text-white/80">
                    For questions about the system or on-site concerns, reach out using the details
                    below.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-xs">
                  <div>
                    <p className="text-[0.7rem] uppercase tracking-wide text-white/60">Location</p>
                    <p className="mt-1 flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5" />
                      Jasaan, Misamis Oriental, Philippines
                    </p>
                  </div>
                  <div>
                    <p className="text-[0.7rem] uppercase tracking-wide text-white/60">Contact</p>
                    <p className="mt-1 flex items-center gap-2">
                      <Phone className="h-3.5 w-3.5" />
                      +63 XXX XXX XXXX
                    </p>
                    <p className="mt-1 flex items-center gap-2">
                      <Mail className="h-3.5 w-3.5" />
                      info@fontanablueresort.com
                    </p>
                  </div>
                  <div>
                    <p className="text-[0.7rem] uppercase tracking-wide text-white/60">Social</p>
                    <div className="mt-1 flex gap-4">
                      <a
                        href="#"
                        className="text-white/80 transition-colors hover:text-white"
                        aria-label="Facebook"
                      >
                        Facebook
                      </a>
                      <a
                        href="#"
                        className="text-white/80 transition-colors hover:text-white"
                        aria-label="Instagram"
                      >
                        Instagram
                      </a>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="border-t border-white/10 pt-3 text-[0.7rem] text-white/70">
                  © {new Date().getFullYear()} Fontana Blue Cold Spring. All rights reserved.
                </CardFooter>
              </Card>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default function LandingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-950 text-sm text-white/70">
          Loading…
        </div>
      }
    >
      <LandingPageContent />
    </Suspense>
  );
}
