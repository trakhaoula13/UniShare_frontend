import React from "react";
import Icon from "./Icon";

// Composant de pagination generique, a utiliser sur les listes filtrees
// cote client (Courses, Notes...). Coherent avec le style Bootstrap deja
// utilise dans le reste de l'app.
const Pagination = ({ page, totalPages, onPageChange }) => {
  if (totalPages <= 1) return null;

  const pages = [];
  const start = Math.max(1, page - 2);
  const end = Math.min(totalPages, page + 2);
  for (let i = start; i <= end; i++) pages.push(i);

  return (
    <nav aria-label="Pagination" className="d-flex justify-content-center mt-4">
      <ul className="pagination">
        <li className={`page-item ${page === 1 ? "disabled" : ""}`}>
          <button
            className="page-link d-flex align-items-center"
            onClick={() => onPageChange(page - 1)}
            disabled={page === 1}
            aria-label="Page precedente"
          >
            <Icon name="chevron-left" />
          </button>
        </li>

        {start > 1 && (
          <>
            <li className="page-item">
              <button className="page-link" onClick={() => onPageChange(1)}>1</button>
            </li>
            {start > 2 && <li className="page-item disabled"><span className="page-link">…</span></li>}
          </>
        )}

        {pages.map((p) => (
          <li key={p} className={`page-item ${p === page ? "active" : ""}`}>
            <button className="page-link" onClick={() => onPageChange(p)}>{p}</button>
          </li>
        ))}

        {end < totalPages && (
          <>
            {end < totalPages - 1 && <li className="page-item disabled"><span className="page-link">…</span></li>}
            <li className="page-item">
              <button className="page-link" onClick={() => onPageChange(totalPages)}>{totalPages}</button>
            </li>
          </>
        )}

        <li className={`page-item ${page === totalPages ? "disabled" : ""}`}>
          <button
            className="page-link d-flex align-items-center"
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
