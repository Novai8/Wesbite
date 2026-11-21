import type { Metadata } from "next";
import { SetupBuilderForm } from "@/components/setup-builder-form";

export const metadata: Metadata = {
  title: "Setup builder",
  description:
    "Give Fyndra a total budget and it builds a complete setup across categories — with a visible breakdown of where every cent goes.",
};

export default function SetupBuilderPage() {
  return (
    <div className="container-page py-12 md:py-16">
      <div className="max-w-2xl">
        <p className="eyebrow">Setup builder</p>
        <h1 className="mt-3 text-[clamp(2rem,4.5vw,3rem)]">One budget, a whole setup</h1>
        <p className="mt-4 text-lg leading-relaxed text-muted">
          Pick the areas you need, set a total, and Fyndra allocates it across
          the whole setup — showing exactly where the money goes and what&apos;s
          left over.
        </p>
      </div>

      <div className="mt-10">
        <SetupBuilderForm />
      </div>
    </div>
  );
}
