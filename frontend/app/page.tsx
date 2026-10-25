import { HomeExperience } from "@/components/landing/home-experience";

/**
 * Public landing — static shell with a GSAP intro, then Hero2.
 * Must not call APIs, read cookies, or depend on the backend (cold starts).
 */
export default function Home() {
  return <HomeExperience />;
}
