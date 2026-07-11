import type { Metadata } from "next";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";

export const metadata: Metadata = {
  title: "Thiết lập trải nghiệm — ZuniBee",
  description: "Chọn vai trò và thiết lập trải nghiệm demo trên ZuniBee.",
};

export default function OnboardingPage() {
  return <OnboardingFlow />;
}
