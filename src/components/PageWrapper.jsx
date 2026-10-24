import React from "react";
import { motion } from "framer-motion";

// Transition de page : legere montee + fondu, avec un ressort doux.
const PageWrapper = ({ children }) => (
  <motion.div
    initial={{ opacity: 0, y: 18 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -12 }}
    transition={{ type: "spring", stiffness: 220, damping: 26, mass: 0.9 }}
  >
    {children}
  </motion.div>
);

export default PageWrapper;
