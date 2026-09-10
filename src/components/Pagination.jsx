import React from "react";
import Icon from "./Icon";

// Pagination stylee via des classes custom (voir la section
// "---------- PAGINATION ----------" a ajouter dans le CSS global),
// coherente avec le reste du design (cartes arrondies, ombre douce,
// degrade primary).
const Pagination = ({ page, totalPages, onPageChange }) => {
  if (totalPages <= 1) return null;

  const pages = [];
  const start = Math.max(1, page - 2);
  const end = Math.min(totalPages, page + 2);
  for (let i = start; i <= end; i++) pages.push(i);

  return (
    <nav aria-label="Pagination" className="app-pagination-wrapper">
      <ul className="app-pagination">
        <li>
          <button
            className="app-pagination-btn app-pagination-arrow"
            onClick={() => onPageChange(page - 1)}
            disabled={page === 1}
            aria-label="Page precedente"
          >
            <Icon name="chevron-left" />
          </button>
        </li>

        {start > 1 && (
          <>
            <li><button className="app-pagination-btn" onClick={() => onPageChange(1)}>1</button></li>
            {start > 2 && <li className="app-pagination-ellipsis">…</li>}
          </>
        )}

        {pages.map((p) => (
          <li key={p}>
            <button
              className={`app-pagination-btn ${p === page ? "app-pagination-btn-active" : ""}`}
              onClick={() => onPageChange(p)}
              aria-current={p === page ? "page" : undefined}
            >
              {p}
            </button>
          </li>
        ))}

        {end < totalPages && (
          <>
            {end < totalPages - 1 && <li className="app-pagination-ellipsis">…</li>}
            <li><button className="app-pagination-btn" onClick={() => onPageChange(totalPages)}>{totalPages}</button></li>
          </>
        )}

        <li>
          <button
            className="app-pagination-btn app-pagination-arrow"
            onClick={() => onPageChange(page + 1)}
            disabled={page === totalPages}
            aria-label="Page suivante"
          >
            <Icon name="chevron-right" />
          </button>
        </li>
      </ul>
    </nav>
  );
};

export default Pagination;