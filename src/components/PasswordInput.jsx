import React, { useState } from "react";
import Icon from "./Icon";

const PasswordInput = ({ value, onChange, name = "password", placeholder = "", required = true, minLength }) => {
  const [visible, setVisible] = useState(false);

  return (
    <div className="password-input-wrapper">
      <input
        type={visible ? "text" : "password"}
        name={name}
        className="form-control"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        minLength={minLength}
      />
      <button
        type="button"
        className="password-toggle-btn"
        onClick={() => setVisible((v) => !v)}
        tabIndex={-1}
        aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
      >
        <Icon name={visible ? "eye-slash" : "eye"} />
      </button>
    </div>
  );
};

export default PasswordInput;
