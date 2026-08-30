import { LandingNavbar } from "@/components/landing/LandingNavbar";
import { HeroSection } from "@/components/landing/HeroSection";
import { IntegrationsBar } from "@/components/landing/IntegrationsBar";
import { FeatureShowcase } from "@/components/landing/FeatureShowcase";
import { RoiCalculator } from "@/components/landing/RoiCalculator";
import { ComparisonTable } from "@/components/landing/ComparisonTable";
import { PricingSection } from "@/components/landing/PricingSection";
import { FaqSection } from "@/components/landing/FaqSection";
import { LandingFooter } from "@/components/landing/LandingFooter";

export const metadata = {
    title: "DistroAI — The AI-Native ERP & Distribution Engine for India",
    description: "Automate WhatsApp B2B ordering, sync with desktop Tally in real-time, predict stockouts with Prophet ML, and track salesmen GPS beat routes in one unified platform.",
    keywords: "distribution ERP, FMCG distributor software, Tally integration, WhatsApp ordering bot, field sales tracking, SFA India, GST invoicing",
};

export default function LandingPage() {
    return (
        <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] selection:bg-[var(--gold)]/30 selection:text-[var(--gold-light)]">
            {/* Top Navigation */}
            <LandingNavbar />

            {/* Main Content Sections */}
            <main>
                {/* 1. Hero with Interactive WhatsApp Simulator */}
                <HeroSection />

                {/* 2. Platform Stats & Ecosystem Trust Badges */}
                <IntegrationsBar />

                {/* 3. Four Core Pillars Showcase */}
                <FeatureShowcase />

                {/* 4. Interactive ROI Calculator */}
                <RoiCalculator />

                {/* 5. Competitor Comparison Table */}
                <ComparisonTable />

                {/* 6. Transparent INR Pricing Plans */}
                <PricingSection />

                {/* 7. Distributor FAQs */}
                <FaqSection />
            </main>

            {/* Footer with Final High-Converting CTA Banner */}
            <LandingFooter />
        </div>
    );
}
