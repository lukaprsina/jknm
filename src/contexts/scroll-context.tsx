"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

interface ScrollContextType {
  enabled: boolean;
}

const ScrollContext = createContext<ScrollContextType>({ enabled: false });

export const ScrollProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const viewportHeight = window.innerHeight;
      if (window.scrollY > viewportHeight && !enabled) {
        setEnabled(true);
      } else if (window.scrollY <= viewportHeight && enabled) {
        setEnabled(false);
      }
    };

    window.addEventListener("scroll", handleScroll);
    handleScroll(); // Call handleScroll on mount

    return () => window.removeEventListener("scroll", handleScroll);
  }, [enabled]);

  return (
    <ScrollContext.Provider value={{ enabled }}>
      {children}
    </ScrollContext.Provider>
  );
};

export const useScroll = () => useContext(ScrollContext);
