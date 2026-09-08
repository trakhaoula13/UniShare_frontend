import React, { useMemo } from "react";

const LEVELS = [
  { label: "Tres faible", color: "#dc3545" },
  { label: "Faible", color: "#fd7e14" },
  { label: "Moyen", color: "#ffc107" },
  { label: "Fort", color: "#20c997" },
  { label: "Tres fort", color: "#198754" },
];

function computeStrength(password) {
  if (!password) return null;

  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  const idx = Math.min(score, LEVELS.length - 1);
  return { level: idx + 1, ...LEVELS[idx] };
}

// A placer juste sous un champ mot de passe (Register, ResetPasswordConfirm).
const PasswordStrengthMeter = ({ password }) => {
  const strength = useMemo(() => computeStrength(password), [password]);

  if (!strength) return null;

  return (
    <div className="mt-2" aria-live="polite">
      <div className="d-flex gap-1 mb-1">
        {LEVELS.map((_, i) => (
          <div
            key={i}
            style={{
              height: 4,
              flex: 1,
              borderRadius: 2,
              backgroundColor: i < strength.level ? strength.color : "#e9ecef",
              transition: "background-color 0.2s ease",
            }}
          />
        ))}
      </div>
      <small style={{ color: strength.color }}>{strength.label}</small>
    </div>
  );
};

export default PasswordStrengthMeter;
