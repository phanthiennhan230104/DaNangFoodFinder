import React from "react";
import useSmoothScroll from "../hooks/useSmoothScroll";

import Header from "../components/layout/Header";
import HeroMain from "../components/sections/HeroMain";
import About from "../components/sections/About";
import Features from "../components/sections/Features";
import WhyChoose from "../components/sections/WhyChoose";
import Stats from "../components/sections/Stats";
import Footer from "../components/layout/Footer";

export default function LandingPage() {
  useSmoothScroll({ duration: 800, extraOffset: 20 });

  return (
    <>
      <Header />
      <HeroMain />
      <About />
      <Features />
      <WhyChoose />
      <Stats />
      <Footer />
    </>
  );
}
