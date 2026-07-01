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
    colorDanger: "#9b2c2c",
    colorSuccess: "#2f5f46",
    colorWarning: "#8a5b16",
    borderRadius: "0.5rem",
    fontFamily: '"Helvetica Neue", "Avenir Next", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
  },
  elements: {
    rootBox: {
      color: "#181918",
    },
    cardBox: {
      boxShadow: "0 18px 60px rgba(31, 33, 31, 0.12)",
      color: "#181918",
    },
    card: {
      border: "1px solid rgba(24, 25, 24, 0.1)",
      borderRadius: "8px",
      backgroundColor: "#fbfaf6",
      color: "#181918",
    },
    modalContent: {
      color: "#181918",
      backgroundColor: "#fbfaf6",
    },
    modalCloseButton: {
      color: "#181918",
    },
    headerTitle: {
      color: "#181918",
      fontWeight: "600",
      letterSpacing: "0",
    },
    headerSubtitle: {
      color: "rgba(24, 25, 24, 0.58)",
    },
    profileSectionTitleText: {
      color: "#181918",
    },
    profileSectionContent: {
      color: "#181918",
    },
    profileSectionPrimaryButton: {
      color: "#181918",
    },
    formFieldLabel: {
      color: "#181918",
    },
    formFieldHintText: {
      color: "rgba(24, 25, 24, 0.62)",
    },
    formFieldAction: {
      color: "#282927",
    },
    identityPreviewText: {
      color: "#181918",
    },
    identityPreviewEditButton: {
      color: "#282927",
    },
    userPreviewTextContainer: {
      color: "#181918",
    },
    userButtonPopoverCard: {
      color: "#181918",
      backgroundColor: "#fbfaf6",
      border: "1px solid rgba(24, 25, 24, 0.1)",
      borderRadius: "8px",
      boxShadow: "0 18px 60px rgba(31, 33, 31, 0.12)",
    },
    userButtonPopoverActionButton: {
      color: "#181918",
    },
    userButtonPopoverActionButtonText: {
      color: "#181918",
    },
    userButtonPopoverFooter: {
      color: "#181918",
    },
    navbarButton: {
      color: "#181918",
    },
    pageScrollBox: {
      color: "#181918",
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
      color: "#181918",
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
  localAuthBypass ? (
    <App />
  ) : (
    <ClerkProvider
      publishableKey={clerkPublishableKey}
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
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
  )
);
