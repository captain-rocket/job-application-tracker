import { StrictMode } from "react";
import ReactDom from "react-dom/client";
import { BrowserRouter } from "react-router";
import App from "./App";
import "./styles.css";

ReactDom.createRoot(document.getElementById("root") as HTMLElement).render(
  <BrowserRouter>
    <StrictMode>
      <App />
    </StrictMode>
  </BrowserRouter>,
);
