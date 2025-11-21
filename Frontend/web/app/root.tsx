import {
  isRouteErrorResponse,
  Links,
  Meta,
  NavLink,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLocation,
} from "react-router";

import type { Route } from "./+types/root";
import "./app.css";
import { Button } from "./components/ui/button";

export function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const hideNav = location.pathname === "/";
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        <div className="min-h-screen flex flex-col">
          {hideNav ? "" : (
            <nav className="bg-slate-600 text-white p-4 space-x-2">
              <Button asChild variant="link" className="text-secondary"><NavLink to="/accueil">Accueil</NavLink></Button>
              <Button asChild variant="link" className="text-secondary"><NavLink to="/carte" prefetch="intent">Carte</NavLink></Button>
              <Button asChild variant="link" className="text-secondary"><NavLink to="/equipes" prefetch="intent">Équipes</NavLink></Button>
              <Button asChild variant="link" className="text-secondary"><NavLink to="/planning" prefetch="intent">Planning</NavLink></Button>
            </nav>
          )}
          <main className="flex-1 flex flex-row overflow-y-scroll">
            {children}
          </main>
          <footer className="bg-slate-500 text-white p-4 text-center">
            IUTRS - W51 - 2025
          </footer>
        </div>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details =
      error.status === 404
        ? "The requested page could not be found."
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="pt-16 p-4 container mx-auto">
      <h1>{message}</h1>
      <p>{details}</p>
      {stack && (
        <pre className="w-full p-4 overflow-x-auto">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
