import type { Metadata } from "next";
import { LiveHome } from "@/components/marketing/LiveHome";

// Overrides the root layout's title for the homepage only; every other route
// keeps the layout default.
export const metadata: Metadata = {
  title: "EnhancedOps.Ninja — Command Center for Multi-Location Operators",
  description:
    "Spoke & Hub Command Center, the Ninja Operating System with survey readiness, and the Ninja Path — for multi-location operators.",
};

export default function HomePage() {
  return <LiveHome />;
}
