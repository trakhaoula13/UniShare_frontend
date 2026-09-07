import React from "react";
import { motion } from "framer-motion";
import Icon from "./Icon";

const StatCard = ({ icon, label, value, color = "primary", delay = 0 }) => (
  <motion.div
    className="col-6 col-lg-3"
    initial={{ opacity: 0, y: 24 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4, delay }}
  >
    <div className={`stat-card stat-${color}`}>
      <div className="stat-icon">
        <Icon name={icon} size={20} />
      </div>
      <div>
        <h3>{value}</h3>
        <p>{label}</p>
      </div>
    </div>
  </motion.div>
);

export default StatCard;
