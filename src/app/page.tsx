"use client";
import React, { useEffect, useState } from "react";
import IntroCinematic from "@/components/landing/IntroCinematic";
import { NavBar, Hero, Stats, Features, DexPreview, TypeChartSection, FinalCTA, Footer } from "@/components/landing/Sections";

export default function Home() {
  const [intro, setIntro] = useState<boolean | null>(null);

  useEffect(() => {
    // play the cinematic once per browser session
    const seen = sessionStorage.getItem("pv.intro.seen");
    setIntro(!seen);
  }, []);

  const done = () => {
    sessionStorage.setItem("pv.intro.seen", "1");
    setIntro(false);
  };

  return (
    <div className="min-h-screen bg-ink">
      {intro && <IntroCinematic onDone={done} />}
      <NavBar />
      <Hero />
      <Stats />
      <Features />
      <DexPreview />
      <TypeChartSection />
      <FinalCTA />
      <Footer />
    </div>
  );
}
