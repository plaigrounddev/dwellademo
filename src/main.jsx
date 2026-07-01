import { ClerkProvider, useAuth } from "@clerk/react";
import React from "react";
import { createRoot } from "react-dom/client";
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import App from "./App.jsx";
import "./styles.css";

const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const convexUrl = import.meta.env.VITE_CONVEX_URL;
const convexClient = convexUrl ? new ConvexReactClient(convexUrl) : null;
const localAuthBypass = import.meta.env.DEV && import.meta.env.VITE_DWELLA_LOCAL_AUTH_BYPASS === "true";
const clerkAppearance = {
  variables: {
    colorPrimary: "#282927",
    colorBackground: "#fbfaf6",
    colorText: "#181918",
    colorTextSecondary: "rgba(24, 25, 24, 0.58)",
    colorInputBackground: "#ffffff",
    colorInputText: "#181918",
    colorNeutral: "#f2f2ef",
    colorRing: "rgba(24, 25, 24, 0.18)",
    colorModalBackdrop: "rgba(24, 25, 24, 0.38)",
    borderRadius: "0.5rem",
    fontFamily: '"Helvetica Neue", "Avenir Next", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
  },
  elements: {
    cardBox: {
      boxShadow: "0 18px 60px rgba(31, 33, 31, 0.12)",
    },
    card: {
      border: "1px solid rgba(24, 25, 24, 0.1)",
      borderRadius: "8px",
      backgroundColor: "#fbfaf6",
    },
    headerTitle: {
      color: "#181918",
      fontWeight: "600",
      letterSpacing: "0",
    },
    headerSubtitle: {
      color: "rgba(24, 25, 24, 0.58)",
    },
    formButtonPrimary: {
      minHeight: "44px",
      borderRadius: "8px",
      backgroundColor: "#282927",
      color: "rgba(255, 255, 255, 0.92)",
      fontWeight: "600",
      boxShadow: "none",
    },
    socialButtonsBlockButton: {
      minHeight: "42px",
      borderRadius: "8px",
      borderColor: "rgba(24, 25, 24, 0.12)",
      color: "#181918",
      boxShadow: "none",
    },
    formFieldInput: {
      minHeight: "42px",
      borderRadius: "8px",
      borderColor: "rgba(24, 25, 24, 0.14)",
      backgroundColor: "#ffffff",
      boxShadow: "none",
    },
    footerActionLink: {
      color: "#282927",
      fontWeight: "600",
    },
  },
  options: {
    socialButtonsVariant: "blockButton",
  },
};

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {localAuthBypass ? (
      <App />
    ) : (
      <ClerkProvider
        publishableKey={clerkPublishableKey}
        signInUrl="/sign-in"
        signInFallbackRedirectUrl="/agent"
        signUpFallbackRedirectUrl="/agent"
        afterSignOutUrl="/"
        appearance={clerkAppearance}
      >
        {convexClient ? (
          <ConvexProviderWithClerk client={convexClient} useAuth={useAuth}>
            <App />
          </ConvexProviderWithClerk>
        ) : (
          <App />
        )}
      </ClerkProvider>
    )}
  </React.StrictMode>
);
