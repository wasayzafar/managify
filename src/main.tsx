import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { analytics } from "./firebase";
import { AppRouter } from "./router";
import { QueryProvider } from "./providers/QueryProvider";
import "./ui/styles.css";


ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <QueryProvider>
        <AppRouter />
      </QueryProvider>
    </BrowserRouter>
  </React.StrictMode>
);
