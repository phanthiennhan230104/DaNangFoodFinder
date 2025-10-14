import React from "react";
import useSmoothScroll from "../hooks/useSmoothScroll";

import Header from "../components/sections/LandingPage/Header";
import HeroMain from "../components/sections/LandingPage/HeroMain";
import About from "../components/sections/LandingPage/About";
import Features from "../components/sections/LandingPage/Features";
import WhyChoose from "../components/sections/LandingPage/WhyChoose";
import Footer from "../components/layout/Footer";
import "../styles/Global.css";


export default function LandingPage() {
  useSmoothScroll({ duration: 800, extraOffset: 20 });

  return (
    <>
      <Header />
      <HeroMain />
      <About />
      <Features />
      <WhyChoose />
      <Footer />
    </>
  );
}
