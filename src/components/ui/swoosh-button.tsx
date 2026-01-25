"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/utils";

interface SwooshButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  shadowColors?: {
    first?: string;
    second?: string;
    third?: string;
    fourth?: string;
    glow?: string;
  };
}

export default function SwooshButton({
  children,
  onClick,
  disabled = false,
  className = "",
  shadowColors = {
    first: "#07bccc",
    second: "#e601c0",
    third: "#e9019a",
    fourth: "#f40468",
    glow: "#f40468",
  },
}: SwooshButtonProps) {
  const boxShadowStyle = {
    boxShadow: `4px 4px 0px ${shadowColors.first},
                8px 8px 0px ${shadowColors.second},
                12px 12px 0px ${shadowColors.third},
                16px 16px 0px ${shadowColors.fourth},
                20px 20px 15px rgba(244, 4, 104, 0.3)`,
  };

  const noShadowStyle = {
    boxShadow: "0px 0px 0px transparent",
  };

  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "px-8 py-3 rounded-2xl font-bold text-white",
        "bg-gradient-to-br from-[#FF6B9F] via-[#C44FE2] to-[#6B5BFF]",
        "transition-all duration-200 ease-out",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        className
      )}
      style={boxShadowStyle}
      whileHover={disabled ? {} : { ...noShadowStyle, scale: 1.02 }}
      whileTap={disabled ? {} : { ...noShadowStyle, scale: 0.98 }}
    >
      {children}
    </motion.button>
  );
}
