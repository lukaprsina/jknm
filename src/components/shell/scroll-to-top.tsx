"use client";

import React, { useEffect, useState } from "react";
import { ArrowBigUpIcon } from "lucide-react";
import { Button } from "~/components/ui/button";
import { useScroll } from "~/contexts/ScrollContext";
import { cn } from "~/lib/utils";

const ScrollToTop: React.FC = () => {
  const { enabled } = useScroll();
  const [isHidden, setIsHidden] = useState(!enabled);

  useEffect(() => {
    if (enabled) setIsHidden(false);
  }, [enabled]);

  const handleClick = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div
      onAnimationEnd={() => {
        if (!enabled) {
          setIsHidden(true);
        }
      }}
      className={cn(
        "fixed bottom-5 right-5 z-50 transition-all duration-300",
        isHidden ? "invisible opacity-0" : "visible opacity-100",
        enabled
          ? "animate-in fade-in slide-in-from-top"
          : "animate-out fade-out slide-out-to-top",
      )}
    >
      <Button variant="outline" size="icon" onClick={handleClick}>
        <ArrowBigUpIcon />
      </Button>
    </div>
  );
};

export default ScrollToTop;
