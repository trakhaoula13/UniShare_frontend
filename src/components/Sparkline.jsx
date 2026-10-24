import React, { useId } from "react";

// Mini-graphique (sparkline) en SVG, sans bibliotheque.
//  type="line" : courbe avec aire degradee (au moins 2 valeurs)
//  type="bars" : petites barres (au moins 1 valeur)
const Sparkline = ({ values = [], type = "line", width = 110, height = 34, color = "#6c63ff", max }) => {
  const gradId = useId().replace(/:/g, "");
  const nums = values.map((v) => Number(v) || 0);

  if (type === "bars") {
    if (nums.length < 1) return null;
    const top = max ?? Math.max(...nums, 1);
    const gap = 3;
    const barW = Math.max(3, (width - gap * (nums.length - 1)) / nums.length);
    return (
      <svg className="sparkline" width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Mini-graphique">
        {nums.map((v, i) => {
          const h = Math.max(2, (v / top) * (height - 2));
          return <rect key={i} x={i * (barW + gap)} y={height - h} width={barW} height={h} rx={2} fill={color} opacity={i === nums.length - 1 ? 1 : 0.45} />;
        })}
      </svg>
    );
  }

  if (nums.length < 2) return null;
  const min = Math.min(...nums);
  const topV = max ?? Math.max(...nums);
  const range = topV - min || 1;
  const pad = 3;
  const stepX = (width - pad * 2) / (nums.length - 1);
  const pts = nums.map((v, i) => [pad + i * stepX, pad + (1 - (v - min) / range) * (height - pad * 2)]);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${pts[pts.length - 1][0].toFixed(1)},${height} L${pts[0][0].toFixed(1)},${height} Z`;
  const [lx, ly] = pts[pts.length - 1];

  return (
    <svg className="sparkline" width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Evolution">
      <defs>
        <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradId})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lx} cy={ly} r="2.6" fill={color} />
    </svg>
  );
};

export default Sparkline;
