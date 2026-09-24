"use client";

import { useContext, useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { usePathname } from "next/navigation";
import { LayoutRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";

function FrozenRouter({ children }: { children: React.ReactNode }) {
  const context = useContext(LayoutRouterContext);
  const [frozen] = useState(context);
  return (
    <LayoutRouterContext.Provider value={frozen}>
      {children}
    </LayoutRouterContext.Provider>
  );
}

const ease = [0.22, 1, 0.36, 1] as const;

export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const reduce = useReducedMotion();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        id="content"
        className="page-shell"
        initial={
          reduce
            ? { opacity: 0 }
            : { opacity: 0, y: 12, filter: "blur(8px)" }
        }
        animate={
          reduce
            ? { opacity: 1, filter: "none" }
            : { opacity: 1, y: 0, filter: "none" }
        }
        exit={
          reduce
            ? { opacity: 0 }
            : { opacity: 0, y: -8, filter: "blur(6px)" }
        }
        transition={{ duration: reduce ? 0.12 : 0.38, ease }}
      >
        <FrozenRouter>{children}</FrozenRouter>
      </motion.div>
    </AnimatePresence>
  );
}
