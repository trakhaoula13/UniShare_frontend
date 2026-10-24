import React, { useEffect, useRef, useState } from "react";
import { animate, useReducedMotion } from "framer-motion";

// Compteur qui monte progressivement jusqu'a la valeur (respecte "reduire les animations").
const AnimatedNumber = ({ value, duration = 0.9 }) => {
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(reduce || typeof value !== "number" ? value : 0);
  const current = useRef(0);

  useEffect(() => {
    if (typeof value !== "number") { setDisplay(value); return undefined; }
    if (reduce) { setDisplay(value); current.current = value; return undefined; }
    const controls = animate(current.current, value, {
      duration,
      ease: "easeOut",
      onUpdate: (v) => { current.current = v; setDisplay(Math.round(v)); },
    });
    return () => controls.stop();
  }, [value, duration, reduce]);

  return <>{display}</>;
};

export default AnimatedNumber;
