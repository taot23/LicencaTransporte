import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Tratamento global de erros não capturados
window.addEventListener("unhandledrejection", (event) => {
  console.error("Unhandled promise rejection:", event.reason);
  // Previne que o erro apareça no console do navegador
  event.preventDefault();
});

// Tratamento global de erros
window.addEventListener("error", (event) => {
  console.error("Global error:", event.error);
});

createRoot(document.getElementById("root")!).render(<App />);
