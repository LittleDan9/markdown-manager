import React from "react";
import { Spinner } from "react-bootstrap";
import PropTypes from "prop-types";

const overlayStyle = {
  position: "fixed",
  top: 0,
  left: 0,
  width: "100vw",
  height: "100vh",
  zIndex: 2000,
  background: "rgba(0,0,0,0.3)",
  backdropFilter: "blur(6px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const modalStyle = {
  background: "rgba(255,255,255,0.1)",
  borderRadius: "1rem",
  padding: "2rem 3rem",
  boxShadow: "0 2px 16px rgba(0,0,0,0.15)",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
};

export default function LoadingOverlay({ show, text = "Loading..." }) {
  if (!show) return null;
  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <Spinner animation="border" variant="primary" style={{ width: 48, height: 48, marginBottom: 16 }} />
        <div style={{ color: "#fff", fontSize: "1.25rem", marginTop: 8, textShadow: "0 1px 4px #000" }}>{text}</div>
      </div>
    </div>
  );
}

LoadingOverlay.propTypes = {
  show: PropTypes.bool,
  text: PropTypes.string,
};
