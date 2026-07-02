import React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import L from "leaflet";
import { ArrowUp, ChevronLeft, ChevronRight, CirclePlus, Files, FileText, Folder, Home, Images, Map, Menu, MessageCircle, Mic, PanelsTopLeft, Phone, SquarePen, X } from "lucide-react";
import { SignIn, SignUp, UserButton, useAuth } from "@clerk/react";
import { useConvex, useConvexAuth, useQuery } from "convex/react";
import { useThreadMessages } from "convex-durable-agents/react";
import { useBlockNoteSync } from "@convex-dev/prosemirror-sync/blocknote";
import { BlockNoteEditor } from "@blocknote/core";
import "@blocknote/core/fonts/inter.css";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";
import "leaflet/dist/leaflet.css";
import "streamdown/styles.css";
import { StickToBottom, useStickToBottomContext } from "use-stick-to-bottom";
import { api } from "../convex/_generated/api";
import { createDwellaAgentClient } from "./agent/client.js";
import { createDocumentExport, downloadDocumentExport } from "./agent/documentExport.js";
import { DocumentAnalysisIllustration } from "./components/illustrations/document-analysis.jsx";
import { DocumentDocxIllustration } from "./components/illustrations/document-docx.jsx";
import { DocumentHtmlIllustration } from "./components/illustrations/document-html.jsx";
import { DocumentImgIllustration } from "./components/illustrations/document-img.jsx";
import { DocumentPdfIllustration } from "./components/illustrations/document-pdf.jsx";
import { DocumentTxtIllustration } from "./components/illustrations/document-txt.jsx";
import { DocumentZipIllustration } from "./components/illustrations/document-zip.jsx";
import { CommandSearch } from "./components/ui/command-search.jsx";
import { Diamond } from "./components/ui/diamond.jsx";
import { LiveWaveform } from "./components/ui/live-waveform.jsx";
import {
  DWELLA_FIRST_CONVERSATION_MESSAGE,
} from "../convex/dwellaConversationContract.js";
import { createAgentWorkspaceStore } from "./agent/workspaceStore.js";

const Orb = React.lazy(() => import("./components/ui/orb.jsx").then((module) => ({ default: module.Orb })));

const dayPhotoSrc = "/assets/dwella-home-photo.png";
const nightPhotoSrc = "/assets/dwella-home-night.png";
const pendingAgentMessageKey = "dwella.pendingAgentMessage";

const pageContent = {
  dreamers: {
    title: ["Dream Homes", "Deserve Dwella."],
    copy:
      "Dwella is the autonomous homebuilding agent that prepares your brief, contacts builders, compares quotes, and flags hidden costs before you sign.",
    placeholder: "Describe your build..."
  },
  builders: {
    title: ["Better Briefs", "Better Builds."],
    copy:
      "Dwella helps builders receive clearer project briefs, cleaner quote requests, and better-prepared homeowners before the first conversation starts.",
    placeholder: "Ask about builder briefs..."
  }
};

function DwellaHeroReveal({ onStart, onOpenAgent }) {
  const [audience, setAudience] = React.useState("dreamers");
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [prompt, setPrompt] = React.useState("");
  const content = pageContent[audience];
  const submitPrompt = (event) => {
    event.preventDefault();
    const message = prompt.trim();
    if (!message) return;
    onStart(message);
  };

  return (
    <main className={`hero-shell hero-shell--${audience}`} aria-label="Dwella home reveal animation">
      <div className="hero-gradient" aria-hidden="true" />
      <nav className="top-nav" aria-label="Dwella audience navigation">
        <div className="brand-mark">Dwella</div>
        <div className="nav-center">
          <div className="audience-toggle" role="group" aria-label="Switch page content">
            <button
              className={audience === "dreamers" ? "is-active" : ""}
              type="button"
              aria-pressed={audience === "dreamers"}
              onClick={() => setAudience("dreamers")}
            >
              {audience === "dreamers" ? (
                <motion.span className="toggle-indicator" layoutId="audience-indicator" transition={{ type: "spring", stiffness: 420, damping: 34 }} />
              ) : null}
              <span className="toggle-label">Dreamers</span>
            </button>
            <button
              className={audience === "builders" ? "is-active" : ""}
              type="button"
              aria-pressed={audience === "builders"}
              onClick={() => setAudience("builders")}
            >
              {audience === "builders" ? (
                <motion.span className="toggle-indicator" layoutId="audience-indicator" transition={{ type: "spring", stiffness: 420, damping: 34 }} />
              ) : null}
              <span className="toggle-label">Builders</span>
            </button>
          </div>
          <div className="home-menu">
            <button
              className="menu-button"
              type="button"
              aria-label="Open menu"
              aria-expanded={menuOpen}
              aria-controls="home-menu"
              onClick={() => setMenuOpen((isOpen) => !isOpen)}
            >
              <span />
              <span />
              <span />
            </button>
            {menuOpen ? (
              <div className="home-menu__content" id="home-menu" role="menu">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    onOpenAgent();
                  }}
                >
                  Agent workspace
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </nav>
      <section className="hero-reveal" aria-hidden="true">
        <img className="hero-image hero-image--day" src={dayPhotoSrc} alt="" />
        <motion.img
          key={audience}
          className="hero-image hero-image--night"
          src={nightPhotoSrc}
          alt=""
          initial={false}
          animate={{ opacity: audience === "builders" ? 1 : 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        />
        <div className="paper-glow" />
      </section>
      <section className="hero-content" aria-labelledby="dwella-hero-title">
        <h1 id="dwella-hero-title">
          <span>{content.title[0]}</span>
          <span>{content.title[1]}</span>
        </h1>
        <p className="hero-copy">{content.copy}</p>
        <form className="hero-prompt" action="#" onSubmit={submitPrompt}>
          <label className="sr-only" htmlFor="dwella-prompt">
            Tell Dwella what you want to build
          </label>
          <input id="dwella-prompt" type="text" placeholder={content.placeholder} value={prompt} onChange={(event) => setPrompt(event.target.value)} />
          <button className="voice-button" type="submit" aria-label="Start Dwella">
            <span className="wave wave--one" />
            <span className="wave wave--two" />
            <span className="wave wave--three" />
          </button>
        </form>
      </section>
    </main>
  );
}

const agentNavItems = [
  { label: "Conversation", icon: "chat" },
  { label: "Document editor", icon: "doc" },
  { label: "Concept gallery", icon: "concepts" },
  { label: "Live map", icon: "map" },
  { label: "Files", icon: "files" }
];

const artifactMenuItems = [
  { label: "Document editor", icon: "doc" },
  { label: "Concept gallery", icon: "concepts" },
  { label: "Live map", icon: "map" },
  { label: "Files workspace", icon: "files" }
];

// "browser" is temporarily retired from the UI; workspace state still carries it.
const artifactTargets = ["doc", "map", "files", "concepts"];
const artifactPanelSpring = { type: "spring", stiffness: 360, damping: 38, mass: 0.82 };
const artifactSwitchTransition = { duration: 0.18, ease: [0.22, 1, 0.36, 1] };

const agentUserButtonAppearance = {
  elements: {
    avatarBox: {
      width: "34px",
      height: "34px",
      borderRadius: "8px",
      border: "1px solid rgba(24, 25, 24, 0.12)",
      boxShadow: "0 8px 28px rgba(24, 25, 24, 0.08)",
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
    userPreviewTextContainer: {
      color: "#181918",
    },
  },
};

const lucideIcons = {
  browser: PanelsTopLeft,
  chat: MessageCircle,
  concepts: Images,
  doc: FileText,
  files: Files,
  home: Home,
  map: Map,
};

function AgentIcon({ name }) {
  const Icon = lucideIcons[name] ?? MessageCircle;
  return <Icon className="agent-icon" aria-hidden="true" strokeWidth={1.35} absoluteStrokeWidth />;
}

function cleanVoiceTranscript(value) {
  const transcript = String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .trim();
  if (!transcript || looksLikeNonSpeechTranscript(transcript)) return "";
  return transcript;
}

function looksLikeNonSpeechTranscript(value) {
  const visible = Array.from(String(value ?? "")).filter((char) => /\S/u.test(char));
  if (!visible.length) return true;

  const speechLikeCount = visible.filter((char) => /[\p{L}\p{N}]/u.test(char)).length;
  return speechLikeCount === 0;
}

function appendPlainDocumentText(content, text) {
  const cleanText = String(text ?? "").trim();
  if (!cleanText) return content ?? "";
  const currentContent = String(content ?? "").trimEnd();
  return currentContent ? `${currentContent}\n\n${cleanText}` : cleanText;
}

function createProseMirrorDocumentFromText(text = "") {
  const blocks = createBlockNoteBlocksFromText(text).map((block, index) => blockToProseMirrorContainer(block, index));
  return {
    type: "doc",
    content: blocks.length
      ? [
          {
            type: "blockGroup",
            content: blocks,
          },
        ]
      : [],
  };
}

function createBlockNoteBlocksFromText(text = "") {
  const lines = String(text ?? "")
    .replace(/\r\n/g, "\n")
    .trim()
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) return [{ type: "paragraph", content: "" }];

  return lines.map((line) => {
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      return {
        type: "heading",
        props: { level: Math.min(3, heading[1].length) },
        content: heading[2].trim(),
      };
    }
    const bullet = line.match(/^[-*]\s+(.+)$/);
    if (bullet) {
      return { type: "bulletListItem", content: bullet[1].trim() };
    }
    const numbered = line.match(/^\d+[.)]\s+(.+)$/);
    if (numbered) {
      return { type: "numberedListItem", content: numbered[1].trim() };
    }
    return { type: "paragraph", content: line };
  });
}

function blockToProseMirrorContainer(block, index) {
  return {
    type: "blockContainer",
    attrs: { id: createBlockNoteBlockId(index) },
    content: [blockToProseMirrorContent(block)],
  };
}

function parseInlineMarkdownToProseMirror(text) {
  const source = String(text ?? "");
  if (!source) return [];
  const nodes = [];
  const unlinked = source.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
  const pattern = /(\*\*([^*]+)\*\*|\*([^*\n]+)\*|__([^_]+)__|_([^_\n]+)_|`([^`\n]+)`)/g;
  let cursor = 0;
  let match;
  while ((match = pattern.exec(unlinked)) !== null) {
    if (match.index > cursor) {
      nodes.push({ type: "text", text: unlinked.slice(cursor, match.index) });
    }
    if (match[2] !== undefined || match[4] !== undefined) {
      nodes.push({ type: "text", text: match[2] ?? match[4], marks: [{ type: "bold" }] });
    } else if (match[3] !== undefined || match[5] !== undefined) {
      nodes.push({ type: "text", text: match[3] ?? match[5], marks: [{ type: "italic" }] });
    } else {
      nodes.push({ type: "text", text: match[6], marks: [{ type: "code" }] });
    }
    cursor = match.index + match[0].length;
  }
  if (cursor < unlinked.length) {
    nodes.push({ type: "text", text: unlinked.slice(cursor) });
  }
  return nodes.filter((node) => node.text);
}

function blockToProseMirrorContent(block) {
  const inlineNodes = block.content ? parseInlineMarkdownToProseMirror(String(block.content)) : [];
  const content = inlineNodes.length ? inlineNodes : undefined;
  const attrs = {
    backgroundColor: "default",
    textColor: "default",
    textAlignment: "left",
  };
  if (block.type === "heading") {
    return {
      type: "heading",
      attrs: { ...attrs, level: block.props?.level ?? 2, isToggleable: false },
      ...(content ? { content } : {}),
    };
  }
  if (block.type === "bulletListItem" || block.type === "numberedListItem") {
    return {
      type: block.type,
      attrs,
      ...(content ? { content } : {}),
    };
  }
  return {
    type: "paragraph",
    attrs,
    ...(content ? { content } : {}),
  };
}

function createBlockNoteBlockId(index) {
  return globalThis.crypto?.randomUUID?.() ?? `local-block-${Date.now().toString(36)}-${index}`;
}

function blockNoteBlocksToPlainText(blocks = []) {
  const lines = [];
  for (const block of blocks) {
    collectBlockNoteText(block, lines);
  }
  return lines
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
}

function collectBlockNoteText(block, lines) {
  if (!block) return;
  const text = inlineContentToPlainText(block.content);
  if (text) lines.push(text);
  if (Array.isArray(block.children)) {
    for (const child of block.children) collectBlockNoteText(child, lines);
  }
}

function inlineContentToPlainText(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((item) => {
      if (typeof item === "string") return item;
      if (item?.type === "text") return String(item.text ?? "");
      if (Array.isArray(item?.content)) return inlineContentToPlainText(item.content);
      return "";
    })
    .join("");
}

function shouldOpenArtifactForCommand(type) {
  return [
    "open_artifact",
    "show_status",
    "create_document",
    "append_to_document",
    "replace_document",
    "export_document",
    "create_file",
    "create_folder",
    "set_browser_url",
    "add_map_marker",
    "create_concepts",
  ].includes(type);
}

function createModelMarkerId(existingId) {
  const cleanId = String(existingId ?? "").trim();
  if (cleanId) return cleanId;
  const randomId = globalThis.crypto?.randomUUID?.();
  if (randomId) return `model-marker-${randomId}`;
  return `model-marker-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function createClientMessageId(prefix) {
  const randomId = globalThis.crypto?.randomUUID?.();
  if (randomId) return `${prefix}-${randomId}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

const agentEndpoint = import.meta.env.VITE_DWELLA_AGENT_ENDPOINT || "/dwella/agent";
const localAuthBypass = import.meta.env.DEV && import.meta.env.VITE_DWELLA_LOCAL_AUTH_BYPASS === "true";
const StreamdownRenderer = React.lazy(() => import("streamdown").then((module) => ({ default: module.Streamdown })));

function extractDurableMessageText(message) {
  const parts = Array.isArray(message?.parts) ? message.parts : [];
  return parts
    .map((part) => {
      if (part?.type === "text") return String(part.text ?? "");
      return "";
    })
    .filter(Boolean)
    .join("\n")
    .trim();
}

function getLatestAssistantTextSince(messages = [], startedAt = 0) {
  const minCreationTime = Number(startedAt);
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role !== "assistant") continue;
    if (Number(message?._creationTime ?? message?.metadata?._creationTime ?? 0) <= minCreationTime) continue;
    const text = extractDurableMessageText(message);
    if (text) return text;
  }
  return "";
}

function AgentMessageContent({ message }) {
  if (message.role === "user") {
    return message.content ? <p>{message.content}</p> : null;
  }

  return (
    <React.Suspense fallback={<p>{message.content}</p>}>
      <StreamdownRenderer
        className="agent-markdown"
        controls={{ code: { copy: true }, table: { copy: true, download: false, fullscreen: false } }}
        mode="streaming"
        parseIncompleteMarkdown
        skipHtml
      >
        {message.content}
      </StreamdownRenderer>
    </React.Suspense>
  );
}

function TextShimmer({
  children,
  as: Component = "span",
  className = "",
  duration = 2,
  spread = 2,
  baseColor,
  shimmerColor,
  style,
}) {
  const MotionComponent = React.useMemo(() => motion.create(Component), [Component]);
  const dynamicSpread = React.useMemo(() => String(children ?? "").length * spread, [children, spread]);

  return (
    <MotionComponent
      className={["text-shimmer", className].filter(Boolean).join(" ")}
      initial={{ backgroundPosition: "100% center" }}
      animate={{ backgroundPosition: "0% center" }}
      transition={{ repeat: Infinity, duration, ease: "linear" }}
      style={{
        ...style,
        "--spread": `${dynamicSpread}px`,
        "--base-color": baseColor ?? "color-mix(in oklab, currentColor 55%, transparent)",
        "--base-gradient-color": shimmerColor ?? "currentColor",
        backgroundImage: "var(--bg), linear-gradient(var(--base-color), var(--base-color))",
      }}
    >
      {children}
    </MotionComponent>
  );
}

function useMediaQuery(query) {
  const getMatches = React.useCallback(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(query).matches;
  }, [query]);
  const [matches, setMatches] = React.useState(getMatches);

  React.useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const mediaQuery = window.matchMedia(query);
    const handleChange = () => setMatches(mediaQuery.matches);
    handleChange();

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    }

    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, [query]);

  return matches;
}

function AgentConversation({ messages, isProcessing = false, showVoiceCta = false, onStartVoice }) {
  return (
    <StickToBottom className="agent-conversation" resize="smooth" initial="instant" role="log" aria-label="Conversation">
      <StickToBottom.Content className="agent-conversation__content">
        {messages.map((message) => (
          <article className={message.role === "user" ? "agent-message agent-message--user" : "agent-message agent-message--assistant"} key={message.id}>
            {message.content ? (
              <div className="agent-message__bubble">
                <AgentMessageContent message={message} />
              </div>
            ) : null}
            {message.role === "user" && Array.isArray(message.attachments) && message.attachments.length ? (
              <div className="agent-message__attachments">
                <FileChipList attachments={message.attachments} />
              </div>
            ) : null}
          </article>
        ))}
        {showVoiceCta ? (
          <button className="agent-voice-cta" type="button" onClick={onStartVoice} aria-label="Call Dwella">
            <TextShimmer
              className="agent-voice-cta__copy"
              baseColor="rgba(24, 25, 24, 0.42)"
              shimmerColor="#181918"
              spread={2.2}
            >
              Dwella is calling...
            </TextShimmer>
            <span className="agent-voice-cta__action" aria-hidden="true">
              <Phone />
            </span>
          </button>
        ) : null}
        {isProcessing ? (
          <article className="agent-message agent-message--assistant agent-message--loading" aria-live="polite">
            <div className="agent-message__loading">
              <Diamond className="agent-message__loading-diamond" />
            </div>
          </article>
        ) : null}
      </StickToBottom.Content>
      <AgentConversationScrollButton />
    </StickToBottom>
  );
}

function AgentConversationScrollButton() {
  const { isAtBottom, scrollToBottom } = useStickToBottomContext();
  if (isAtBottom) return null;

  return (
    <button className="agent-scroll-button" type="button" aria-label="Scroll to latest message" onClick={() => scrollToBottom("smooth")}>
      <span />
    </button>
  );
}

function createRealtimeStartError(stage, error, details = {}) {
  const realtimeError = error instanceof Error ? error : new Error(String(error ?? "Realtime start failed"));
  realtimeError.realtimeStage = stage;
  realtimeError.realtimeDetails = details;
  return realtimeError;
}

function normalizeRealtimeStartError(error) {
  return {
    stage: error?.realtimeStage ?? "unknown",
    name: error?.name ?? "Error",
    message: String(error?.message ?? "Realtime start failed"),
    status: error?.realtimeDetails?.status ?? null,
    responseText: error?.realtimeDetails?.responseText ?? null,
  };
}

function createAudioLevelMonitor(stream, onLevel, onBands) {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;

  const audioContext = new AudioContextClass();
  const analyser = audioContext.createAnalyser();
  const source = audioContext.createMediaStreamSource(stream);
  const samples = new Uint8Array(analyser.frequencyBinCount);
  const frequencySamples = new Uint8Array(analyser.frequencyBinCount);
  let frameId = 0;

  analyser.fftSize = 256;
  analyser.smoothingTimeConstant = 0.72;
  source.connect(analyser);

  const tick = () => {
    analyser.getByteTimeDomainData(samples);
    analyser.getByteFrequencyData(frequencySamples);
    let sum = 0;
    for (const sample of samples) {
      const centered = (sample - 128) / 128;
      sum += centered * centered;
    }
    const level = Math.min(1, Math.sqrt(sum / samples.length) * 5);
    onLevel(level);
    if (typeof onBands === "function") {
      const bandCount = 28;
      const bucketSize = Math.max(1, Math.floor(frequencySamples.length / bandCount));
      const bands = Array.from({ length: bandCount }, (_, bandIndex) => {
        const start = bandIndex * bucketSize;
        const end = Math.min(frequencySamples.length, start + bucketSize);
        let total = 0;
        for (let index = start; index < end; index += 1) total += frequencySamples[index];
        const average = end > start ? total / (end - start) : 0;
        return Math.min(1, Math.max(level * 0.28, average / 168));
      });
      onBands(bands);
    }
    frameId = window.requestAnimationFrame(tick);
  };

  tick();

  return {
    stop() {
      window.cancelAnimationFrame(frameId);
      source.disconnect();
      audioContext.close().catch(() => {});
      onLevel(0);
      onBands?.(Array.from({ length: 28 }, () => 0));
    },
  };
}

function formatFileSize(size) {
  const bytes = Number(size) || 0;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

function normalizeVisibleAttachments(attachments = []) {
  if (!Array.isArray(attachments)) return [];
  return attachments
    .map((attachment, index) => ({
      id: String(attachment?.id ?? `attachment-${index}`),
      name: String(attachment?.name ?? "").trim(),
      size: Number(attachment?.size) || 0,
      type: String(attachment?.type ?? "").trim(),
    }))
    .filter((attachment) => attachment.name)
    .slice(0, 8);
}

function FileChipList({ attachments, removable = false, onRemove }) {
  return (
    <div className="agent-file-chip-list" aria-label="Attached files">
      {attachments.map((attachment) => (
        <span className="agent-file-chip" key={attachment.id}>
          <DocumentFileIllustration fileName={attachment.name} />
          <span className="agent-file-chip__text">
            <span>{attachment.name}</span>
            <span>{formatFileSize(attachment.size)}</span>
          </span>
          {removable ? (
            <button type="button" aria-label={`Remove ${attachment.name}`} onClick={() => onRemove?.(attachment.id)}>
              <X aria-hidden="true" />
            </button>
          ) : null}
        </span>
      ))}
    </div>
  );
}

function useDwellaAuth() {
  if (localAuthBypass) {
    return {
      getToken: async () => null,
      isLoaded: true,
      isSignedIn: false,
    };
  }
  return useAuth();
}

function useDwellaConvexAuth() {
  if (localAuthBypass) {
    return {
      isAuthenticated: false,
      isLoading: false,
    };
  }
  return useConvexAuth();
}

function useDwellaConvexClient() {
  if (localAuthBypass) return null;
  return useConvex();
}

function useDwellaThreadMessages(input) {
  if (localAuthBypass) {
    return {
      isRunning: false,
      messages: [],
    };
  }
  return useThreadMessages(input);
}

function AgentShell() {
  const convexClient = useDwellaConvexClient();
  const { isAuthenticated, isLoading } = useDwellaConvexAuth();
  const { getToken, isLoaded: clerkLoaded, isSignedIn } = useDwellaAuth();
  const prefersReducedMotion = useReducedMotion();
  const isCompactArtifactMotion = useMediaQuery("(max-width: 900px)");
  const agentClient = React.useMemo(
    () => createDwellaAgentClient({
      endpoint: agentEndpoint,
      getAuthToken: async () => {
        if (!clerkLoaded || !isSignedIn) return null;
        return await getToken({ template: "convex" });
      },
    }),
    [clerkLoaded, getToken, isSignedIn]
  );
  const agentWorkspaceStore = React.useMemo(
    () => (isAuthenticated ? createAgentWorkspaceStore(convexClient) : null),
    [convexClient, isAuthenticated]
  );
  const initialArtifact = getInitialArtifact();
  const initialArtifactOpen = Boolean(getRequestedArtifact());
  const [thread] = React.useState(() => agentClient.getOrCreateThread());
  const [userProfile, setUserProfile] = React.useState(() => loadUserProfile());
  const [onboardingOpen, setOnboardingOpen] = React.useState(() => !loadUserProfile());
  const userProfileRef = React.useRef(userProfile);
  const durableConversation = useDwellaThreadMessages({
    messagesQuery: api.dwellaAgent.listClientThreadMessages,
    streamingMessageUpdatesQuery: api.dwellaAgent.streamClientThreadUpdates,
    threadQuery: api.dwellaAgent.getClientThread,
    threadId: thread.id,
    skip: localAuthBypass || !isAuthenticated,
  });
  const [artifactMenuOpen, setArtifactMenuOpen] = React.useState(false);
  const [artifactOpen, setArtifactOpen] = React.useState(initialArtifactOpen);
  const [artifactLayoutOpen, setArtifactLayoutOpen] = React.useState(initialArtifactOpen);
  const [activeArtifact, setActiveArtifact] = React.useState(initialArtifact);
  const [prompt, setPrompt] = React.useState("");
  const [messages, setMessages] = React.useState(() => loadConversationMessages(thread.id));
  const [workspace, setWorkspace] = React.useState(() => loadWorkspace(thread.id));
  const [workspacePersistence, setWorkspacePersistence] = React.useState("local");
  const [isSending, setIsSending] = React.useState(false);
  const [isRecording, setIsRecording] = React.useState(false);
  const [isVoiceProcessing, setIsVoiceProcessing] = React.useState(false);
  const [isRealtimeConnecting, setIsRealtimeConnecting] = React.useState(false);
  const [isRealtimeConnected, setIsRealtimeConnected] = React.useState(false);
  const [attachedFiles, setAttachedFiles] = React.useState([]);
  const [isTextComposerOpen, setIsTextComposerOpen] = React.useState(false);
  const initialMessageSent = React.useRef(false);
  const fileInputRef = React.useRef(null);
  const textareaRef = React.useRef(null);
  const attachedFilesRef = React.useRef(attachedFiles);
  const workspacePersistenceRef = React.useRef(workspacePersistence);
  const workspaceRef = React.useRef(workspace);
  const artifactOpenRef = React.useRef(artifactOpen);
  const mediaRecorderRef = React.useRef(null);
  const voiceChunksRef = React.useRef([]);
  const voiceStreamRef = React.useRef(null);
  const realtimePeerRef = React.useRef(null);
  const realtimeChannelRef = React.useRef(null);
  const realtimeStreamRef = React.useRef(null);
  const realtimeAudioRef = React.useRef(null);
  const voiceLevelMonitorRef = React.useRef(null);
  const orbInputVolumeRef = React.useRef(0);
  const voiceWaveformBandsRef = React.useRef(Array.from({ length: 28 }, () => 0));
  const orbOutputVolumeRef = React.useRef(0);
  const realtimeDisconnectTimerRef = React.useRef(null);
  const realtimeClosingRef = React.useRef(false);
  const realtimeToolCallsRef = React.useRef(new Set());
  const realtimeAssistantMessageIdRef = React.useRef(null);
  const realtimeAssistantTextRef = React.useRef("");
  const artifactDismissedRef = React.useRef(false);
  const pendingAssistantMessageIdRef = React.useRef(null);
  const pendingAgentStartedAtRef = React.useRef(0);
  const durableLatestCreationTimeRef = React.useRef(0);
  const durableIsRunning = durableConversation.isRunning && !localAuthBypass;
  const isAgentBusy = isSending || durableIsRunning;
  const pendingDurableAssistantText = React.useMemo(
    () => getLatestAssistantTextSince(durableConversation.messages, pendingAgentStartedAtRef.current),
    [durableConversation.messages]
  );

  React.useEffect(() => {
    for (const message of durableConversation.messages ?? []) {
      const creationTime = Number(message?._creationTime ?? 0);
      if (creationTime > durableLatestCreationTimeRef.current) {
        durableLatestCreationTimeRef.current = creationTime;
      }
    }
  }, [durableConversation.messages]);

  React.useEffect(() => {
    saveWorkspace(thread.id, workspace);
  }, [thread.id, workspace]);

  React.useEffect(() => {
    saveConversationMessages(thread.id, messages);
  }, [thread.id, messages]);

  React.useEffect(() => {
    const pendingAssistantMessageId = pendingAssistantMessageIdRef.current;
    if (!pendingAssistantMessageId || !pendingDurableAssistantText) return;
    setMessages((current) => {
      let changed = false;
      const nextMessages = current.map((message) => {
        if (message.id !== pendingAssistantMessageId) return message;
        if (message.content === pendingDurableAssistantText) return message;
        changed = true;
        return { ...message, content: pendingDurableAssistantText };
      });
      return changed ? nextMessages : current;
    });
  }, [pendingDurableAssistantText]);

  React.useEffect(() => {
    workspaceRef.current = workspace;
  }, [workspace]);

  React.useEffect(() => {
    userProfileRef.current = userProfile;
  }, [userProfile]);

  React.useEffect(() => {
    workspacePersistenceRef.current = workspacePersistence;
  }, [workspacePersistence]);

  React.useEffect(() => {
    artifactOpenRef.current = artifactOpen;
  }, [artifactOpen]);

  React.useEffect(() => {
    const syncArtifactFromUrl = () => {
      if (window.location.pathname !== "/agent") return;
      const requestedArtifact = getRequestedArtifact();
      if (!requestedArtifact) return;
      artifactDismissedRef.current = false;
      setActiveArtifact(requestedArtifact);
      setArtifactLayoutOpen(true);
      setArtifactOpen(true);
    };

    window.addEventListener("popstate", syncArtifactFromUrl);
    window.addEventListener("hashchange", syncArtifactFromUrl);
    window.addEventListener("dwella-location-change", syncArtifactFromUrl);
    return () => {
      window.removeEventListener("popstate", syncArtifactFromUrl);
      window.removeEventListener("hashchange", syncArtifactFromUrl);
      window.removeEventListener("dwella-location-change", syncArtifactFromUrl);
    };
  }, []);

  React.useEffect(() => {
    let alive = true;
    if (isLoading) {
      setWorkspacePersistence("connecting");
      return undefined;
    }
    if (!agentWorkspaceStore) {
      setWorkspacePersistence("local");
      return undefined;
    }

    setWorkspacePersistence("connecting");
    agentWorkspaceStore
      .ensureWorkspace(thread.id)
      .then((serverWorkspace) => {
        if (!alive || !serverWorkspace) return;
        setWorkspace(normalizeWorkspace(serverWorkspace));
        setWorkspacePersistence("convex");
      })
      .catch((error) => {
        console.warn("Dwella Convex workspace fell back to the browser workspace.", error);
        if (alive) setWorkspacePersistence("local");
      });

    return () => {
      alive = false;
    };
  }, [agentWorkspaceStore, isLoading, thread.id]);

  const closeArtifact = () => {
    artifactDismissedRef.current = true;
    setArtifactMenuOpen(false);
    setArtifactLayoutOpen(false);
    setArtifactOpen(false);
    if (window.location.pathname === "/agent" && window.location.search) {
      window.history.replaceState({}, "", "/agent");
    }
  };

  const openArtifact = React.useCallback((target) => {
    artifactDismissedRef.current = false;
    setArtifactLayoutOpen(true);
    if (target && artifactTargets.includes(target)) {
      setActiveArtifact(target);
      if (window.location.pathname === "/agent") {
        window.history.replaceState({}, "", `/agent?artifact=${target}`);
      }
    }
    setArtifactOpen(true);
  }, []);

  const artifactPanelMotion = React.useMemo(() => {
    if (prefersReducedMotion) {
      return {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: 0.12, ease: "linear" },
      };
    }

    if (isCompactArtifactMotion) {
      return {
        initial: { opacity: 0, y: 20, scale: 0.99 },
        animate: { opacity: 1, y: 0, scale: 1 },
        exit: { opacity: 0, y: 18, scale: 0.99 },
        transition: artifactPanelSpring,
      };
    }

    return {
      initial: { opacity: 0, x: 22, scale: 0.992 },
      animate: { opacity: 1, x: 0, scale: 1 },
      exit: { opacity: 0, x: 18, scale: 0.992 },
      transition: artifactPanelSpring,
    };
  }, [isCompactArtifactMotion, prefersReducedMotion]);

  const artifactSwitchMotion = React.useMemo(() => {
    if (prefersReducedMotion) {
      return {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: 0.1, ease: "linear" },
      };
    }

    return {
      initial: { opacity: 0, y: 8, filter: "blur(3px)" },
      animate: { opacity: 1, y: 0, filter: "blur(0px)" },
      exit: { opacity: 0, y: -6, filter: "blur(2px)" },
      transition: artifactSwitchTransition,
    };
  }, [prefersReducedMotion]);

  const updateWorkspace = React.useCallback((updater) => {
    setWorkspace((current) => {
      const next = typeof updater === "function" ? updater(current) : updater;
      return { ...next, updatedAt: Date.now() };
    });
  }, []);

  const runWorkspaceMutation = React.useCallback(
    async (operation) => {
      if (!agentWorkspaceStore || workspacePersistenceRef.current !== "convex") return;
      try {
        const serverWorkspace = await operation(agentWorkspaceStore);
        if (serverWorkspace) {
          setWorkspace(normalizeWorkspace(serverWorkspace));
          setWorkspacePersistence("convex");
        }
      } catch (error) {
        console.warn("Dwella workspace mutation failed; keeping local state.", error);
        setWorkspacePersistence("local");
      }
    },
    [agentWorkspaceStore]
  );

  const workspaceActions = React.useMemo(
    () => ({
      createDocument(documentInput = {}) {
        const title = String(documentInput.title ?? "Untitled document").trim() || "Untitled document";
        const content = String(documentInput.content ?? "");
        updateWorkspace((current) => createLocalDocument(current, title, content));
        if (workspacePersistenceRef.current === "convex") {
          runWorkspaceMutation((store) => store.createDocument(thread.id, title, content));
        }
      },
      updateDocument(documentId, patch) {
        updateWorkspace((current) => updateLocalDocument(current, documentId, patch));
        if (isConvexDocumentId(documentId)) {
          // Content for synced documents flows through prosemirror-sync steps; pushing it
          // here as plain text would overwrite rich formatting on every keystroke.
          const { content: _syncedContent, ...serverPatch } = patch ?? {};
          if (Object.keys(serverPatch).length) {
            runWorkspaceMutation((store) => store.updateDocument(thread.id, documentId, serverPatch));
          }
        }
      },
      appendDocumentText(documentId, text) {
        const cleanText = String(text ?? "").trim();
        if (!cleanText) return;
        updateWorkspace((current) => {
          const activeDocument = current.documents.find((document) => document.id === documentId);
          if (!activeDocument) return current;
          return updateLocalDocument(current, documentId, { content: appendPlainDocumentText(activeDocument.content, cleanText) });
        });
        if (isConvexDocumentId(documentId)) {
          runWorkspaceMutation((store) => store.appendDocumentText(thread.id, documentId, cleanText));
        }
      },
      replaceDocumentText(documentId, text) {
        updateWorkspace((current) => updateLocalDocument(current, documentId, { content: String(text ?? "") }));
        if (isConvexDocumentId(documentId)) {
          runWorkspaceMutation((store) => store.replaceDocumentText(thread.id, documentId, String(text ?? "")));
        }
      },
      setActiveDocument(documentId) {
        updateWorkspace((current) => ({ ...current, activeDocumentId: documentId }));
        if (isConvexDocumentId(documentId)) {
          runWorkspaceMutation((store) => store.setActiveDocument(thread.id, documentId));
        }
      },
      createFolder(name) {
        if (workspacePersistenceRef.current === "convex") {
          runWorkspaceMutation((store) => store.createFolder(thread.id, name));
          return;
        }
        updateWorkspace((current) => createLocalFolder(current, name));
      },
      createFile(name) {
        if (workspacePersistenceRef.current === "convex") {
          runWorkspaceMutation((store) => store.createFile(thread.id, name));
          return;
        }
        updateWorkspace((current) => createLocalFile(current, name));
      },
      updateMapView(center, zoom) {
        updateWorkspace((current) => ({ ...current, map: { ...current.map, center, zoom } }));
        runWorkspaceMutation((store) => store.updateMapView(thread.id, center, zoom));
      },
      addMapMarker(marker) {
        updateWorkspace((current) => ({
          ...current,
          map: { ...current.map, markers: [...current.map.markers, marker] },
        }));
        runWorkspaceMutation((store) => store.addMapMarker(thread.id, marker));
      },
      resetMap() {
        updateWorkspace((current) => ({ ...current, map: { ...current.map, center: defaultMapCenter(), zoom: 12, markers: [] } }));
        runWorkspaceMutation((store) => store.clearMapMarkers(thread.id));
      },
      updateBrowserUrl(url) {
        updateWorkspace((current) => ({ ...current, browser: { ...current.browser, url } }));
        runWorkspaceMutation((store) => store.updateBrowserUrl(thread.id, url));
      },
      async uploadDocumentAsset(file) {
        if (workspacePersistenceRef.current !== "convex" || !agentWorkspaceStore) {
          return URL.createObjectURL(file);
        }
        try {
          const result = await agentWorkspaceStore.uploadDocumentAsset(thread.id, file);
          if (result?.workspace) {
            setWorkspace(normalizeWorkspace(result.workspace));
            setWorkspacePersistence("convex");
          }
          return result?.url || URL.createObjectURL(file);
        } catch (error) {
          console.warn("Dwella document asset upload failed; using a local preview URL.", error);
          return URL.createObjectURL(file);
        }
      },
    }),
    [agentWorkspaceStore, runWorkspaceMutation, thread.id, updateWorkspace]
  );

  const exportDocumentForUser = React.useCallback(
    async (input = {}) => {
      const currentWorkspace = workspaceRef.current;
      const activeDocument = currentWorkspace.documents.find((document) => document.id === currentWorkspace.activeDocumentId) ?? currentWorkspace.documents[0];
      const title = String(input.title ?? activeDocument?.title ?? "Builder brief").trim() || "Builder brief";
      const content = String(input.content ?? activeDocument?.content ?? "").trim();
      const format = ["doc", "docx"].includes(String(input.format ?? "").toLowerCase()) ? "doc" : "pdf";

      if (!content) {
        return { ok: false, error: "Document content is required before export." };
      }

      const exportedDocument = await createDocumentExport({ title, content, format });
      downloadDocumentExport(exportedDocument);
      workspaceActions.createFile({
        name: exportedDocument.filename,
        mimeType: exportedDocument.mimeType,
        size: exportedDocument.size,
        source: "export",
      });
      openArtifact("files");
      return {
        ok: true,
        artifact: "files",
        filename: exportedDocument.filename,
        mimeType: exportedDocument.mimeType,
        size: exportedDocument.size,
      };
    },
    [openArtifact, workspaceActions]
  );

  const generateConceptsFromCommand = React.useCallback(
    (payload = {}) => {
      if (!agentWorkspaceStore) return;
      agentWorkspaceStore.generateConcepts(thread.id, payload).catch((error) => {
        console.error("Dwella concept generation failed", error);
        setMessages((current) => [
          ...current,
          {
            id: createClientMessageId("concepts-error"),
            role: "assistant",
            content: "I couldn't start rendering those concepts just now. Please try again in a moment.",
          },
        ]);
      });
    },
    [agentWorkspaceStore, thread.id]
  );

  const requestConceptColorFromCommand = React.useCallback(
    (payload = {}) => {
      if (!agentWorkspaceStore) return;
      agentWorkspaceStore
        .renderConceptColor(thread.id, { conceptName: payload.conceptName })
        .catch((error) => console.error("Dwella concept colour request failed", error));
    },
    [agentWorkspaceStore, thread.id]
  );

  const requestConceptFloorPlanFromCommand = React.useCallback(
    (payload = {}) => {
      if (!agentWorkspaceStore) return;
      agentWorkspaceStore
        .renderConceptFloorPlan(thread.id, { conceptName: payload.conceptName })
        .catch((error) => console.error("Dwella concept floor plan request failed", error));
    },
    [agentWorkspaceStore, thread.id]
  );

  const requestConceptViewFromCommand = React.useCallback(
    (payload = {}) => {
      if (!agentWorkspaceStore) return;
      agentWorkspaceStore
        .renderConceptView(thread.id, { conceptName: payload.conceptName, view: payload.view })
        .catch((error) => console.error("Dwella concept view request failed", error));
    },
    [agentWorkspaceStore, thread.id]
  );

  const focusMapFromCommand = React.useCallback(
    (payload = {}) => {
      if (!isFiniteNumber(payload.lat) || !isFiniteNumber(payload.lng)) return;
      const zoom = isFiniteNumber(payload.zoom) ? Math.min(19, Math.max(3, Math.round(payload.zoom))) : 12;
      workspaceActions.updateMapView({ lat: payload.lat, lng: payload.lng }, zoom);
      const label = String(payload.label ?? "").trim();
      if (label) {
        workspaceActions.addMapMarker({
          id: createModelMarkerId(),
          label,
          lat: payload.lat,
          lng: payload.lng,
        });
      }
    },
    [workspaceActions]
  );

  const applyScreenCommands = React.useCallback(
    (commands = []) => {
      if (!Array.isArray(commands)) return;
      const shouldAutoOpenArtifact = !window.matchMedia("(max-width: 900px)").matches;
      for (const command of commands) {
        const target = artifactTargets.includes(command?.target) ? command.target : null;

        if (command?.type === "create_document") {
          workspaceActions.createDocument({
            title: command.payload?.title,
            content: command.payload?.content,
          });
        }

        if (command?.type === "append_to_document") {
          const currentWorkspace = workspaceRef.current;
          const activeDocument = currentWorkspace.documents.find((document) => document.id === currentWorkspace.activeDocumentId) ?? currentWorkspace.documents[0];
          if (activeDocument) {
            workspaceActions.appendDocumentText(activeDocument.id, command.payload?.text);
          }
        }

        if (command?.type === "replace_document") {
          const currentWorkspace = workspaceRef.current;
          const activeDocument = currentWorkspace.documents.find((document) => document.id === currentWorkspace.activeDocumentId) ?? currentWorkspace.documents[0];
          if (activeDocument) {
            workspaceActions.replaceDocumentText(activeDocument.id, command.payload?.text);
          }
        }

        if (command?.type === "export_document") {
          void exportDocumentForUser(command.payload ?? {}).catch((error) => {
            console.error("Dwella document export failed", error);
          });
        }

        if (command?.type === "create_file") {
          const name = String(command.payload?.name ?? "").trim();
          if (name) workspaceActions.createFile(command.payload);
        }

        if (command?.type === "create_folder") {
          const name = String(command.payload?.name ?? "").trim();
          if (name) workspaceActions.createFolder(name);
        }

        if (command?.type === "set_browser_url") {
          const url = String(command.payload?.url ?? "").trim();
          if (url) workspaceActions.updateBrowserUrl(url);
        }

        if (command?.type === "create_concepts") {
          generateConceptsFromCommand(command.payload);
        }

        if (command?.type === "render_concept_color") {
          requestConceptColorFromCommand(command.payload);
        }

        if (command?.type === "render_concept_floor_plan") {
          requestConceptFloorPlanFromCommand(command.payload);
        }

        if (command?.type === "render_concept_view") {
          requestConceptViewFromCommand(command.payload);
        }

        if (command?.type === "focus_map") {
          focusMapFromCommand(command.payload);
        }

        if (command?.type === "add_map_marker") {
          const marker = command.payload?.marker ?? command.payload;
          if (isFiniteNumber(marker?.lat) && isFiniteNumber(marker?.lng)) {
            workspaceActions.addMapMarker({
              id: createModelMarkerId(marker.id),
              label: String(marker.label ?? "Marker").trim() || "Marker",
              lat: marker.lat,
              lng: marker.lng,
            });
          }
        }

        if (target) {
          setActiveArtifact(target);
        }
        if (command?.target === "doc" && command.payload?.documentId) {
          workspaceActions.setActiveDocument(command.payload.documentId);
        }
        if (shouldAutoOpenArtifact && target && !artifactDismissedRef.current && shouldOpenArtifactForCommand(command.type)) {
          setArtifactLayoutOpen(true);
          setArtifactOpen(true);
        }
      }
    },
    [exportDocumentForUser, focusMapFromCommand, generateConceptsFromCommand, requestConceptColorFromCommand, requestConceptFloorPlanFromCommand, requestConceptViewFromCommand, workspaceActions]
  );

  const sendMessage = React.useCallback(
    async (message, attachments = []) => {
      const trimmed = message.trim();
      const validAttachments = Array.isArray(attachments) ? attachments : [];
      if ((!trimmed && !validAttachments.length) || isAgentBusy) return;
      const messageForAgent = trimmed || (validAttachments.length ? "Please review the attached file." : "");
      const visibleAttachments = normalizeVisibleAttachments(validAttachments);
      const timestamp = Date.now();
      const pendingAssistantMessageId = `assistant-pending-${timestamp}`;
      pendingAssistantMessageIdRef.current = pendingAssistantMessageId;
      // Prefer the newest durable message's server timestamp as the "new reply" threshold so a
      // wrong client clock cannot suppress streamed replies or backfill a stale one.
      pendingAgentStartedAtRef.current = durableLatestCreationTimeRef.current || timestamp;
      setIsSending(true);
      setMessages((current) => [
        ...current,
        { id: `user-${timestamp}`, role: "user", content: messageForAgent, attachments: visibleAttachments },
        { id: pendingAssistantMessageId, role: "assistant", content: "" },
      ]);
      setPrompt("");
      for (const attachment of validAttachments) {
        if (attachment.previewUrl) URL.revokeObjectURL(attachment.previewUrl);
      }
      setAttachedFiles([]);
      for (const attachment of validAttachments) {
        workspaceActions.createFile({
          name: attachment.name,
          size: attachment.size,
          mimeType: attachment.type,
          source: "upload",
        });
      }

      try {
        const result = await agentClient.sendTextMessage({
          threadId: thread.id,
          message: messageForAgent,
          history: messages,
          attachments: validAttachments,
          workspaceContext: createWorkspaceContextForAgent(workspaceRef.current, activeArtifact),
          profile: userProfileRef.current,
        });
        const assistantMessage = String(result?.assistantMessage ?? "").trim();
        if (assistantMessage) {
          setMessages((current) => {
            let replacedPendingMessage = false;
            const nextMessages = current.map((message) => {
              if (message.id !== pendingAssistantMessageId) return message;
              replacedPendingMessage = true;
              return { ...message, content: assistantMessage };
            });
            if (replacedPendingMessage) return nextMessages;
            return [...current, { id: `assistant-${Date.now()}`, role: "assistant", content: assistantMessage }];
          });
          if (pendingAssistantMessageIdRef.current === pendingAssistantMessageId) {
            pendingAssistantMessageIdRef.current = null;
            pendingAgentStartedAtRef.current = 0;
          }
        } else if (result?.status !== "waiting") {
          setMessages((current) =>
            current.map((message) =>
              message.id === pendingAssistantMessageId
                ? { ...message, content: "I couldn't finish that request. Please try again." }
                : message
            )
          );
          if (pendingAssistantMessageIdRef.current === pendingAssistantMessageId) {
            pendingAssistantMessageIdRef.current = null;
            pendingAgentStartedAtRef.current = 0;
          }
        }
        applyScreenCommands(result?.screenCommands);
      } catch (error) {
        console.error("Dwella agent request failed", error);
        setMessages((current) =>
          current.map((message) =>
            message.id === pendingAssistantMessageId
              ? { ...message, content: "I couldn't reach Dwella just now. Please try again." }
              : message
          )
        );
        if (pendingAssistantMessageIdRef.current === pendingAssistantMessageId) {
          pendingAssistantMessageIdRef.current = null;
          pendingAgentStartedAtRef.current = 0;
        }
      } finally {
        setIsSending(false);
      }
    },
    [activeArtifact, agentClient, applyScreenCommands, isAgentBusy, messages, thread.id, workspaceActions]
  );

  React.useEffect(() => {
    attachedFilesRef.current = attachedFiles;
  }, [attachedFiles]);

  React.useEffect(
    () => () => {
      for (const attachment of attachedFilesRef.current) {
        if (attachment.previewUrl) URL.revokeObjectURL(attachment.previewUrl);
      }
    },
    []
  );

  const attachFiles = (fileList) => {
    const files = Array.from(fileList ?? []);
    if (!files.length) return;
    setAttachedFiles((current) => {
      const remainingSlots = Math.max(0, 8 - current.length);
      const nextFiles = files.slice(0, remainingSlots).map((file) => ({
        id: `attachment-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        name: file.name,
        previewUrl: file.type?.startsWith("image/") ? URL.createObjectURL(file) : "",
        size: file.size,
        type: file.type,
      }));
      return [...current, ...nextFiles];
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeAttachedFile = (attachmentId) => {
    setAttachedFiles((current) => {
      const removed = current.find((attachment) => attachment.id === attachmentId);
      if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
      return current.filter((attachment) => attachment.id !== attachmentId);
    });
  };

  React.useEffect(() => {
    if (initialMessageSent.current) return;
    const params = new URLSearchParams(window.location.search);
    const initialMessage = params.get("message");
    if (!initialMessage) return;
    initialMessageSent.current = true;
    window.history.replaceState({}, "", "/agent");
    sendMessage(initialMessage);
  }, [sendMessage]);

  const submitPrompt = (event) => {
    event.preventDefault();
    sendMessage(prompt, attachedFiles);
  };

  const appendVoiceEdit = React.useCallback(
    (edit) => {
      if (!edit?.text) return;
      const currentWorkspace = workspaceRef.current;
      const activeDocument = currentWorkspace.documents.find((document) => document.id === currentWorkspace.activeDocumentId) ?? currentWorkspace.documents[0];
      if (!activeDocument) return;
      workspaceActions.appendDocumentText(activeDocument.id, edit.text);
    },
    [workspaceActions]
  );

  const addVoiceStatusMessage = React.useCallback((content) => {
    setMessages((current) => [
      ...current,
      { id: createClientMessageId("voice-status"), role: "assistant", content },
    ]);
  }, []);

  const finishVoiceRecording = React.useCallback(
    async (audioBlob) => {
      setIsVoiceProcessing(true);
      try {
        const result = await agentClient.transcribeVoice({ threadId: thread.id, audioBlob });
        applyScreenCommands(result?.screenCommands);
        const transcript = cleanVoiceTranscript(result?.transcript);
        const documentEditText = cleanVoiceTranscript(result?.documentEdit?.text);

        if (transcript) {
          setMessages((current) => [...current, { id: `voice-user-${Date.now()}`, role: "user", content: transcript }]);
        }
        if (result?.documentEdit && documentEditText) {
          appendVoiceEdit({ ...result.documentEdit, text: documentEditText });
        }
        if (result?.assistantMessage || result?.message) {
          setMessages((current) => [
            ...current,
            { id: `voice-assistant-${Date.now()}`, role: "assistant", content: result.assistantMessage || result.message },
          ]);
        }
      } catch (error) {
        console.error("Dwella voice transcription failed", error);
        addVoiceStatusMessage("I couldn't turn that voice note into text just now. Please try again in a moment.");
      } finally {
        setIsVoiceProcessing(false);
      }
    },
    [addVoiceStatusMessage, agentClient, appendVoiceEdit, applyScreenCommands, thread.id]
  );

  const sendRealtimeEvent = React.useCallback((event) => {
    const channel = realtimeChannelRef.current;
    if (!channel || channel.readyState !== "open") return false;
    try {
      channel.send(JSON.stringify(event));
      return true;
    } catch (error) {
      console.warn("Dwella realtime event could not be sent.", error);
      return false;
    }
  }, []);

  const stopVoiceLevelMonitor = React.useCallback(() => {
    try {
      voiceLevelMonitorRef.current?.stop();
    } catch (error) {
      console.warn("Dwella voice level monitor failed to stop cleanly.", error);
    }
    voiceLevelMonitorRef.current = null;
    orbInputVolumeRef.current = 0;
    voiceWaveformBandsRef.current = Array.from({ length: 28 }, () => 0);
  }, []);

  const startVoiceLevelMonitor = React.useCallback(
    (stream) => {
      stopVoiceLevelMonitor();
      try {
        voiceLevelMonitorRef.current = createAudioLevelMonitor(stream, (level) => {
          orbInputVolumeRef.current = (orbInputVolumeRef.current * 0.72) + (level * 0.28);
        }, (bands) => {
          voiceWaveformBandsRef.current = bands;
        });
      } catch {
        voiceLevelMonitorRef.current = null;
      }
    },
    [stopVoiceLevelMonitor]
  );

  const executeRealtimeTool = React.useCallback(
    async (name, args = {}) => {
      const currentWorkspace = workspaceRef.current;
      const activeDocument = currentWorkspace.documents.find((document) => document.id === currentWorkspace.activeDocumentId) ?? currentWorkspace.documents[0];

      if (name === "show_artifact") {
        openArtifact(args.target);
        return { ok: true, artifact: args.target };
      }

      if (name === "append_to_document") {
        if (!activeDocument) return { ok: false, error: "No document is available." };
        if (!String(args.text ?? "").trim()) return { ok: false, error: "Text is required." };
        workspaceActions.appendDocumentText(activeDocument.id, args.text);
        openArtifact("doc");
        return { ok: true, artifact: "doc", documentId: activeDocument.id };
      }

      if (name === "replace_document") {
        if (!activeDocument) return { ok: false, error: "No document is available." };
        if (!String(args.text ?? "").trim()) return { ok: false, error: "Text is required." };
        workspaceActions.replaceDocumentText(activeDocument.id, args.text);
        openArtifact("doc");
        return { ok: true, artifact: "doc", documentId: activeDocument.id };
      }

      if (name === "create_document") {
        workspaceActions.createDocument({
          title: args.title,
          content: args.content,
        });
        openArtifact("doc");
        return { ok: true, artifact: "doc" };
      }

      if (name === "export_document") {
        return await exportDocumentForUser(args);
      }

      if (name === "create_file") {
        const nameToCreate = String(args.name ?? "").trim();
        if (!nameToCreate) return { ok: false, error: "File name is required." };
        workspaceActions.createFile(nameToCreate);
        openArtifact("files");
        return { ok: true, artifact: "files", name: nameToCreate };
      }

      if (name === "create_folder") {
        const nameToCreate = String(args.name ?? "").trim();
        if (!nameToCreate) return { ok: false, error: "Folder name is required." };
        workspaceActions.createFolder(nameToCreate);
        openArtifact("files");
        return { ok: true, artifact: "files", name: nameToCreate };
      }

      if (name === "add_map_marker") {
        if (!isFiniteNumber(args.lat) || !isFiniteNumber(args.lng)) {
          return { ok: false, error: "Marker coordinates are required." };
        }
        const marker = {
          id: `realtime-marker-${Date.now()}`,
          label: String(args.label ?? "Marker").trim() || "Marker",
          lat: args.lat,
          lng: args.lng,
        };
        workspaceActions.addMapMarker(marker);
        openArtifact("map");
        return { ok: true, artifact: "map", marker };
      }

      if (name === "create_concept_visuals") {
        if (!Array.isArray(args.concepts) || !args.concepts.length) {
          return { ok: false, error: "At least one concept is required." };
        }
        generateConceptsFromCommand(args);
        openArtifact("concepts");
        return {
          ok: true,
          artifact: "concepts",
          status: "rendering",
          message: "The concept sketches are rendering into the gallery now.",
        };
      }

      if (name === "show_concept_in_color") {
        requestConceptColorFromCommand(args);
        openArtifact("concepts");
        return {
          ok: true,
          artifact: "concepts",
          status: "rendering",
          message: "The colour render is on its way in the gallery.",
        };
      }

      if (name === "show_concept_floor_plan") {
        requestConceptFloorPlanFromCommand(args);
        openArtifact("concepts");
        return {
          ok: true,
          artifact: "concepts",
          status: "rendering",
          message: "The concept floor plan is being drawn in the gallery.",
        };
      }

      if (name === "show_concept_view") {
        if (!String(args.view ?? "").trim()) {
          return { ok: false, error: "A view description is required." };
        }
        requestConceptViewFromCommand(args);
        openArtifact("concepts");
        return {
          ok: true,
          artifact: "concepts",
          status: "rendering",
          message: "That view is being created in the gallery from the concept's locked design.",
        };
      }

      if (name === "focus_map") {
        if (!isFiniteNumber(args.lat) || !isFiniteNumber(args.lng)) {
          return { ok: false, error: "Map coordinates are required." };
        }
        focusMapFromCommand(args);
        openArtifact("map");
        return { ok: true, artifact: "map" };
      }

      return { ok: false, error: `Unknown tool: ${name}` };
    },
    [exportDocumentForUser, focusMapFromCommand, generateConceptsFromCommand, openArtifact, requestConceptColorFromCommand, requestConceptFloorPlanFromCommand, requestConceptViewFromCommand, workspaceActions]
  );

  const handleRealtimeToolCall = React.useCallback(
    async (toolCall) => {
      if (!toolCall?.name || !toolCall?.call_id) return;
      if (realtimeToolCallsRef.current.has(toolCall.call_id)) return;
      realtimeToolCallsRef.current.add(toolCall.call_id);
      let args = {};
      try {
        args = toolCall.arguments ? JSON.parse(toolCall.arguments) : {};
      } catch {
        args = {};
      }

      let output;
      try {
        output = await executeRealtimeTool(toolCall.name, args);
      } catch (error) {
        console.error("Dwella realtime workspace tool failed", { tool: toolCall.name, error });
        output = { ok: false, error: "Workspace action failed." };
      }
      const sentOutput = sendRealtimeEvent({
        type: "conversation.item.create",
        item: {
          type: "function_call_output",
          call_id: toolCall.call_id,
          output: JSON.stringify(output),
        },
      });
      if (sentOutput) sendRealtimeEvent({ type: "response.create" });
    },
    [executeRealtimeTool, sendRealtimeEvent]
  );

  const updateRealtimeAssistantTranscript = React.useCallback((text, { replace = false, final = false } = {}) => {
    const cleanText = String(text ?? "");
    if (!cleanText) return;
    const previousText = realtimeAssistantTextRef.current;
    const nextText = replace ? cleanText.trim() : `${previousText}${cleanText}`;
    if (!nextText.trim()) return;

    const messageId = realtimeAssistantMessageIdRef.current ?? createClientMessageId("realtime-assistant");
    realtimeAssistantMessageIdRef.current = final ? null : messageId;
    realtimeAssistantTextRef.current = final ? "" : nextText;

    setMessages((current) => {
      let found = false;
      const nextMessages = current.map((message) => {
        if (message.id !== messageId) return message;
        found = true;
        return { ...message, content: nextText };
      });
      if (found) return nextMessages;
      return [...current, { id: messageId, role: "assistant", content: nextText }];
    });
  }, []);

  const handleRealtimeEvent = React.useCallback(
    (event) => {
      if (event.type === "error") {
        console.error("Dwella realtime server event error", event.error ?? event);
        return;
      }

      if (event.type === "conversation.item.input_audio_transcription.completed" && event.transcript) {
        const transcript = cleanVoiceTranscript(event.transcript);
        if (transcript) {
          setMessages((current) => [...current, { id: `realtime-user-${Date.now()}`, role: "user", content: transcript }]);
        }
      }

      if (
        (event.type === "response.audio_transcript.delta" ||
          event.type === "response.output_audio_transcript.delta" ||
          event.type === "response.output_text.delta" ||
          event.type === "response.text.delta") &&
        event.delta
      ) {
        orbOutputVolumeRef.current = 0.85;
        updateRealtimeAssistantTranscript(event.delta);
      }

      const assistantText = event.transcript || event.text;
      if (
        (event.type === "response.audio_transcript.done" ||
          event.type === "response.output_audio_transcript.done" ||
          event.type === "response.output_text.done" ||
          event.type === "response.text.done") &&
        (assistantText || realtimeAssistantTextRef.current)
      ) {
        orbOutputVolumeRef.current = 0.85;
        updateRealtimeAssistantTranscript(assistantText || realtimeAssistantTextRef.current, { replace: true, final: true });
      }

      if (event.type === "response.function_call_arguments.done") {
        handleRealtimeToolCall({
          name: event.name,
          call_id: event.call_id,
          arguments: event.arguments,
        });
      }

      if (event.type === "response.output_item.done" && event.item?.type === "function_call") {
        handleRealtimeToolCall(event.item);
      }
    },
    [handleRealtimeToolCall, updateRealtimeAssistantTranscript]
  );

  const clearRealtimeDisconnectTimer = React.useCallback(() => {
    if (realtimeDisconnectTimerRef.current) {
      window.clearTimeout(realtimeDisconnectTimerRef.current);
      realtimeDisconnectTimerRef.current = null;
    }
  }, []);

  const disconnectRealtimeSession = React.useCallback(() => {
    realtimeClosingRef.current = true;
    clearRealtimeDisconnectTimer();
    const channel = realtimeChannelRef.current;
    realtimeChannelRef.current = null;
    try {
      if (channel && channel.readyState !== "closed") channel.close();
    } catch (error) {
      console.warn("Dwella realtime data channel did not close cleanly.", error);
    }
    const peer = realtimePeerRef.current;
    realtimePeerRef.current = null;
    try {
      peer?.close();
    } catch (error) {
      console.warn("Dwella realtime peer did not close cleanly.", error);
    }
    realtimeStreamRef.current?.getTracks().forEach((track) => {
      try {
        track.stop();
      } catch {
        // Some browsers can throw if the track is already ended.
      }
    });
    realtimeStreamRef.current = null;
    try {
      realtimeAudioRef.current?.remove();
    } catch {
      // Removing an already detached audio node is harmless.
    }
    realtimeAudioRef.current = null;
    stopVoiceLevelMonitor();
    realtimeToolCallsRef.current.clear();
    realtimeAssistantMessageIdRef.current = null;
    realtimeAssistantTextRef.current = "";
    setIsRealtimeConnecting(false);
    setIsRealtimeConnected(false);
    window.setTimeout(() => {
      realtimeClosingRef.current = false;
    }, 0);
  }, [clearRealtimeDisconnectTimer, stopVoiceLevelMonitor]);

  React.useEffect(() => disconnectRealtimeSession, [disconnectRealtimeSession]);

  const startRealtimeSession = React.useCallback(async (approvedStream) => {
    if (!approvedStream || typeof RTCPeerConnection === "undefined") {
      console.error("Dwella realtime voice requires browser WebRTC microphone support.");
      addVoiceStatusMessage("Live voice is not available in this browser, so I can only take a short voice note here.");
      return false;
    }

    setIsRealtimeConnecting(true);
    let session;
    try {
      session = await agentClient.createVoiceSession({ threadId: thread.id, profile: userProfileRef.current });
    } catch (error) {
      console.error("Dwella realtime voice session failed", error);
      setIsRealtimeConnecting(false);
      approvedStream.getTracks().forEach((track) => track.stop());
      addVoiceStatusMessage("I couldn't start live voice just now. Please check that you're signed in and try again.");
      return "handled";
    }
    if (!session?.clientSecret) {
      setIsRealtimeConnecting(false);
      approvedStream.getTracks().forEach((track) => track.stop());
      applyScreenCommands(session?.screenCommands);
      console.error("Dwella realtime voice session did not return a client secret.");
      addVoiceStatusMessage("I couldn't get a live voice session just now. Please try again in a moment.");
      return "handled";
    }
    applyScreenCommands(session?.screenCommands);

    try {
      realtimeClosingRef.current = false;
      clearRealtimeDisconnectTimer();
      const peer = new RTCPeerConnection();
      const channel = peer.createDataChannel("oai-events");
      const audio = document.createElement("audio");
      audio.autoplay = true;
      audio.hidden = true;
      document.body.append(audio);

      realtimeStreamRef.current = approvedStream;
      realtimePeerRef.current = peer;
      realtimeChannelRef.current = channel;
      realtimeAudioRef.current = audio;
      startVoiceLevelMonitor(approvedStream);

      approvedStream.getAudioTracks().forEach((track) => peer.addTrack(track, approvedStream));
      peer.addEventListener("track", (event) => {
        audio.srcObject = event.streams[0];
      });
      peer.addEventListener("connectionstatechange", () => {
        if (peer.connectionState === "connected") {
          clearRealtimeDisconnectTimer();
          return;
        }

        if (peer.connectionState === "disconnected") {
          clearRealtimeDisconnectTimer();
          realtimeDisconnectTimerRef.current = window.setTimeout(() => {
            if (realtimePeerRef.current === peer && peer.connectionState === "disconnected") {
              console.warn("Dwella realtime WebRTC connection stayed disconnected; closing session.");
              disconnectRealtimeSession();
            }
          }, 5000);
          return;
        }

        if (peer.connectionState === "failed" || peer.connectionState === "closed") {
          disconnectRealtimeSession();
        }
      });
      channel.addEventListener("open", () => {
        clearRealtimeDisconnectTimer();
        setIsRealtimeConnected(true);
        setIsRealtimeConnecting(false);
      });
      channel.addEventListener("message", (messageEvent) => {
        try {
          handleRealtimeEvent(JSON.parse(messageEvent.data));
        } catch {
          // Ignore malformed realtime events.
        }
      });
      channel.addEventListener("error", (event) => {
        console.error("Dwella realtime data channel error", event);
      });
      channel.addEventListener("close", () => {
        if (realtimeChannelRef.current !== channel || realtimeClosingRef.current) return;
        console.warn("Dwella realtime data channel closed unexpectedly.");
        disconnectRealtimeSession();
      });

      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      let response;
      try {
        response = await fetch("https://api.openai.com/v1/realtime/calls", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.clientSecret}`,
            "Content-Type": "application/sdp",
          },
          body: offer.sdp,
        });
      } catch (error) {
        throw createRealtimeStartError("openai_sdp_network", error);
      }

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        throw createRealtimeStartError("openai_sdp", new Error(`Realtime call failed with status ${response.status}`), {
          status: response.status,
          responseText: errorText.slice(0, 500),
        });
      }

      const answerSdp = await response.text();
      if (!answerSdp.trim()) {
        throw createRealtimeStartError("openai_sdp", new Error("Realtime call returned an empty SDP answer"));
      }
      try {
        await peer.setRemoteDescription({ type: "answer", sdp: answerSdp });
      } catch (error) {
        throw createRealtimeStartError("remote_description", error);
      }
      return true;
    } catch (error) {
      const failure = normalizeRealtimeStartError(error);
      console.error(
        `Dwella realtime start failed at ${failure.stage}: ${failure.name}: ${failure.message}`,
        failure.status ? { status: failure.status, responseText: failure.responseText } : undefined
      );
      if (realtimeStreamRef.current === approvedStream) {
        disconnectRealtimeSession();
      } else {
        approvedStream.getTracks().forEach((track) => track.stop());
        disconnectRealtimeSession();
      }
      addVoiceStatusMessage("Live voice couldn't connect just now. The workspace is still open, and you can try again.");
      return "handled";
    }
  }, [addVoiceStatusMessage, agentClient, applyScreenCommands, clearRealtimeDisconnectTimer, disconnectRealtimeSession, handleRealtimeEvent, startVoiceLevelMonitor, thread.id]);

  React.useEffect(() => {
    const intervalId = window.setInterval(() => {
      orbOutputVolumeRef.current *= 0.82;
      if (isAgentBusy || isVoiceProcessing) {
        orbOutputVolumeRef.current = Math.max(orbOutputVolumeRef.current, 0.22);
      }
    }, 80);
    return () => window.clearInterval(intervalId);
  }, [isAgentBusy, isVoiceProcessing]);

  const startVoice = async () => {
    let approvedStream = null;
    try {
      if (isRealtimeConnected || isRealtimeConnecting) {
        disconnectRealtimeSession();
        setMessages((current) => [
          ...current,
          { id: createClientMessageId("realtime-stopped"), role: "assistant", content: "Live voice control is off." },
        ]);
        return;
      }

      if (isRecording) {
        try {
          mediaRecorderRef.current?.stop();
        } catch (error) {
          console.warn("Dwella voice recorder did not stop cleanly.", error);
          setIsRecording(false);
          addVoiceStatusMessage("I stopped listening, but that voice note could not be saved.");
        }
        return;
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        console.error("Dwella voice capture requires browser microphone support.");
        addVoiceStatusMessage("This browser cannot give Dwella microphone access. Please try Chrome or Safari with microphone permission allowed.");
        return;
      }

      try {
        approvedStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (error) {
        const failure = normalizeRealtimeStartError(createRealtimeStartError("microphone", error));
        console.error(
          `Dwella microphone permission failed: ${failure.name}: ${failure.message}`,
          undefined
        );
        console.error("Dwella microphone permission failed", failure);
        addVoiceStatusMessage("I couldn't access the microphone. Please allow microphone access, then try again.");
        return;
      }

      const liveStarted = await startRealtimeSession(approvedStream);
      if (liveStarted) return;

      if (typeof MediaRecorder === "undefined") {
        approvedStream.getTracks().forEach((track) => track.stop());
        console.error("Dwella voice notes require browser MediaRecorder support.");
        addVoiceStatusMessage("This browser cannot record a voice note here. Please try Chrome or Safari.");
        return;
      }

      let session;
      try {
        session = await agentClient.createVoiceSession({ threadId: thread.id, profile: userProfileRef.current });
      } catch (error) {
        approvedStream.getTracks().forEach((track) => track.stop());
        console.error("Dwella voice session failed", error);
        addVoiceStatusMessage("I couldn't prepare voice capture just now. Please make sure you're signed in and try again.");
        return;
      }
      applyScreenCommands(session?.screenCommands);

      try {
        const stream = approvedStream;
        voiceStreamRef.current = stream;
        startVoiceLevelMonitor(stream);
        voiceChunksRef.current = [];
        const preferredType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "";
        const recorder = new MediaRecorder(stream, preferredType ? { mimeType: preferredType } : undefined);
        mediaRecorderRef.current = recorder;

        recorder.addEventListener("dataavailable", (event) => {
          if (event.data.size > 0) voiceChunksRef.current.push(event.data);
        });
        recorder.addEventListener("stop", () => {
          const audioBlob = new Blob(voiceChunksRef.current, { type: recorder.mimeType || "audio/webm" });
          voiceChunksRef.current = [];
          voiceStreamRef.current?.getTracks().forEach((track) => track.stop());
          voiceStreamRef.current = null;
          stopVoiceLevelMonitor();
          mediaRecorderRef.current = null;
          setIsRecording(false);
          finishVoiceRecording(audioBlob);
        });

        recorder.start();
        setIsRecording(true);
      } catch (error) {
        approvedStream.getTracks().forEach((track) => track.stop());
        stopVoiceLevelMonitor();
        setIsRecording(false);
        console.error("Dwella voice recorder failed to start.", error);
        addVoiceStatusMessage("I couldn't start recording that voice note. Please try again.");
      }
    } catch (error) {
      console.error("Dwella voice startup failed", error);
      approvedStream?.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // The track may already have been stopped while unwinding the failed start.
        }
      });
      disconnectRealtimeSession();
      stopVoiceLevelMonitor();
      mediaRecorderRef.current = null;
      voiceStreamRef.current = null;
      setIsRecording(false);
      setIsRealtimeConnecting(false);
      setIsRealtimeConnected(false);
      setIsVoiceProcessing(false);
      addVoiceStatusMessage("Voice hit a startup problem, but the workspace is still open. Please try again.");
    }
  };

  const startVoiceFromCta = () => {
    playCallRingSound();
    startVoice();
  };

  const stopVoiceControl = () => {
    try {
      if (isRealtimeConnected || isRealtimeConnecting) {
        disconnectRealtimeSession();
        return;
      }

      if (isRecording) {
        mediaRecorderRef.current?.stop();
      }
    } catch (error) {
      console.warn("Dwella voice stop failed.", error);
      disconnectRealtimeSession();
      setIsRecording(false);
      addVoiceStatusMessage("I stopped listening, but that voice session did not close cleanly.");
    }
  };

  const orbAgentState = isRealtimeConnected || isRecording
    ? "listening"
    : isRealtimeConnecting || isAgentBusy || isVoiceProcessing
      ? "thinking"
      : null;
  const hasPromptText = prompt.trim().length > 0;
  const isVoiceActive = isRecording || isRealtimeConnected || isRealtimeConnecting || isVoiceProcessing;
  const showPromptWaveform = isVoiceActive;
  const hasSendContent = hasPromptText || attachedFiles.length > 0;
  const showSendButton = hasSendContent || !isVoiceActive;
  const showTextComposer = !isVoiceActive || isTextComposerOpen || hasSendContent;

  React.useEffect(() => {
    if (!isVoiceActive) setIsTextComposerOpen(false);
  }, [isVoiceActive]);

  const openTextComposer = () => {
    setIsTextComposerOpen(true);
    window.requestAnimationFrame(() => textareaRef.current?.focus());
  };

  const handlePromptKeyDown = (event) => {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent?.isComposing) return;
    event.preventDefault();
    if (!hasSendContent || isAgentBusy) return;
    sendMessage(prompt, attachedFiles);
  };

  return (
    <main className={artifactLayoutOpen ? "agent-shell" : "agent-shell agent-shell--artifact-closed"} aria-label="Dwella agent workspace">
      <aside className="agent-rail" aria-label="Agent navigation">
        <a className="agent-rail__brand" href="/" aria-label="Dwella home" data-tooltip="Home">
          <AgentIcon name="home" />
        </a>
        <nav className="agent-rail__menu" aria-label="Workspace tools">
          <button
            className="agent-rail__button"
            type="button"
            aria-label="Start a new conversation"
            data-tooltip="New conversation"
            onClick={startNewConversation}
          >
            <SquarePen className="agent-icon" aria-hidden="true" strokeWidth={1.35} absoluteStrokeWidth />
          </button>
          <span className="agent-rail__divider" aria-hidden="true" />
          {agentNavItems.map((item) => {
            const isActive = item.icon === "chat" ? !artifactOpen : artifactOpen && item.icon === activeArtifact;
            return (
              <button
                className={isActive ? "agent-rail__button is-active" : "agent-rail__button"}
                key={item.label}
                type="button"
                aria-label={item.label}
                data-tooltip={item.label}
                onClick={() => {
                  if (item.icon === "chat") {
                    closeArtifact();
                  } else {
                    openArtifact(item.icon);
                  }
                }}
              >
                <AgentIcon name={item.icon} />
              </button>
            );
          })}
        </nav>
        {!localAuthBypass && isSignedIn ? (
          <div className="agent-rail__account" data-tooltip="Account">
            <UserButton afterSignOutUrl="/" appearance={agentUserButtonAppearance} />
          </div>
        ) : null}
      </aside>

      <motion.section
        className="agent-drawer"
        aria-label="Conversation drawer"
        layout={!prefersReducedMotion}
        transition={{ layout: artifactPanelSpring }}
      >
        <h1 className="sr-only">Dwella agent workspace</h1>
        <AgentConversation
          messages={messages}
          isProcessing={isAgentBusy}
          showVoiceCta={messages.length <= 1 && !isVoiceActive && !isAgentBusy && !onboardingOpen}
          onStartVoice={startVoiceFromCta}
        />

        <form className={showPromptWaveform ? "agent-prompt is-voice-mode" : "agent-prompt"} action="#" onSubmit={submitPrompt}>
          <label className="sr-only" htmlFor="agent-prompt-input">
            Message Dwella
          </label>
          <div className="agent-prompt__topline">
            <button className="agent-prompt__attach" type="button" onClick={() => fileInputRef.current?.click()}>
              <CirclePlus aria-hidden="true" />
              <span>Add file</span>
            </button>
            <input
              ref={fileInputRef}
              className="sr-only"
              type="file"
              multiple
              onChange={(event) => attachFiles(event.target.files)}
            />
          </div>
          {attachedFiles.length ? (
            <FileChipList attachments={attachedFiles} removable onRemove={removeAttachedFile} />
          ) : null}
          <div className="agent-prompt__control-row">
            <motion.div
              className={isVoiceActive ? "agent-voice-control is-active" : "agent-voice-control"}
              layout
              transition={{ type: "spring", stiffness: 420, damping: 34 }}
            >
              {isVoiceActive ? (
                <>
                  <span className="agent-voice-control__orb" aria-hidden="true">
                    <React.Suspense fallback={<div className="agent-orb-fallback" />}>
                      <Orb
                        agentState={orbAgentState}
                        colors={["#000000", "#000000"]}
                        inputVolumeRef={orbInputVolumeRef}
                        outputVolumeRef={orbOutputVolumeRef}
                        seed={4276}
                      />
                    </React.Suspense>
                  </span>
                  <LiveWaveform
                    active={isRealtimeConnected || isRecording}
                    barColor="rgba(176, 176, 169, 0.86)"
                    barGap={2}
                    barWidth={3}
                    className="agent-voice-control__waveform"
                    fadeEdges
                    height={44}
                    historySize={120}
                    inputVolumeRef={orbInputVolumeRef}
                    mode="static"
                    outputVolumeRef={orbOutputVolumeRef}
                    processing={isRealtimeConnecting || isVoiceProcessing}
                    waveformBandsRef={voiceWaveformBandsRef}
                  />
                  <button
                    className="agent-voice-control__cancel"
                    type="button"
                    onClick={stopVoiceControl}
                    disabled={isVoiceProcessing}
                    aria-label="Stop voice"
                    title="Stop voice"
                  >
                    <X aria-hidden="true" />
                  </button>
                </>
              ) : (
                <button
                  className="agent-voice-control__start"
                  type="button"
                  onClick={startVoice}
                  disabled={isVoiceProcessing}
                  aria-label="Start voice"
                  title="Start voice"
                >
                  <Mic className="agent-voice-control__icon" aria-hidden="true" />
                </button>
              )}
            </motion.div>
            <motion.div
              className={[
                "agent-prompt__bar",
                isVoiceActive ? "is-voice-adjacent" : "",
                isVoiceActive && !showTextComposer ? "is-collapsed" : "",
                isVoiceActive && showTextComposer ? "is-text-open" : "",
              ].filter(Boolean).join(" ")}
              layout
              transition={{ type: "spring", stiffness: 420, damping: 34 }}
            >
              {showTextComposer ? (
                <>
                  <textarea
                    ref={textareaRef}
                    id="agent-prompt-input"
                    rows="1"
                    placeholder="Message Dwella..."
                    value={prompt}
                    onChange={(event) => setPrompt(event.target.value)}
                    onKeyDown={handlePromptKeyDown}
                  />
                  {showSendButton ? (
                    <button
                      className={hasSendContent ? "agent-prompt__send is-ready" : "agent-prompt__send"}
                      type="submit"
                      disabled={isAgentBusy || !hasSendContent}
                      aria-label={isAgentBusy ? "Sending message" : "Send message"}
                      title={isAgentBusy ? "Sending" : "Send"}
                      style={{
                        "--agent-send-bg": hasSendContent ? "#282927" : "#f2f2ef",
                        "--agent-send-color": hasSendContent ? "rgba(255, 255, 255, 0.9)" : "rgba(24, 25, 24, 0.36)",
                        "--agent-send-icon-rotate": hasSendContent ? "90deg" : "0deg",
                      }}
                    >
                      <ArrowUp aria-hidden="true" />
                    </button>
                  ) : null}
                </>
              ) : (
                <button className="agent-prompt__chat-toggle" type="button" onClick={openTextComposer} aria-label="Open text message input" title="Message">
                  <MessageCircle aria-hidden="true" />
                </button>
              )}
            </motion.div>
          </div>
        </form>
      </motion.section>

      <button
        className="agent-artifact-open"
        type="button"
        aria-label="Open artifact preview"
        aria-expanded={artifactOpen}
        onClick={() => {
          artifactDismissedRef.current = false;
          setArtifactLayoutOpen(true);
          setArtifactOpen(true);
        }}
      >
        <AgentIcon name="browser" />
      </button>

      <AnimatePresence
        initial={false}
        mode="popLayout"
        onExitComplete={() => {
          if (!artifactOpenRef.current) setArtifactLayoutOpen(false);
        }}
      >
        {artifactOpen ? (
          <motion.section
            key="agent-preview"
            className="agent-preview"
            aria-label="Preview workspace"
            aria-hidden={!artifactOpen}
            initial={artifactPanelMotion.initial}
            animate={artifactPanelMotion.animate}
            exit={artifactPanelMotion.exit}
            transition={artifactPanelMotion.transition}
            style={{ transformOrigin: isCompactArtifactMotion ? "center bottom" : "right center" }}
          >
            <button className="agent-bottom-sheet-handle" type="button" aria-label="Close artifact preview" onClick={closeArtifact}>
              <span />
            </button>
            <div className="agent-artifact-menu">
              <button className="agent-artifact-close" type="button" aria-label="Close artifact preview" onClick={closeArtifact}>
                <span />
                <span />
              </button>
              <button
                className="agent-artifact-menu__trigger"
                type="button"
                aria-label="Open artifact menu"
                aria-expanded={artifactMenuOpen}
                aria-controls="agent-artifact-menu"
                onClick={() => setArtifactMenuOpen((isOpen) => !isOpen)}
              >
                <Menu className="agent-icon agent-icon--menu" aria-hidden="true" strokeWidth={1.35} absoluteStrokeWidth />
              </button>
              {artifactMenuOpen ? (
                <div className="agent-artifact-menu__content" id="agent-artifact-menu" role="menu">
                  {artifactMenuItems.map((item) => (
                    <button
                      className="agent-artifact-menu__item"
                      key={item.label}
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setArtifactMenuOpen(false);
                        openArtifact(item.icon);
                      }}
                    >
                      <AgentIcon name={item.icon} />
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <ArtifactGlobalSearch workspace={workspace} actions={workspaceActions} openArtifact={openArtifact} />
            <div className="agent-preview__surface">
              <h2 className="sr-only">{artifactMenuItems.find((item) => item.icon === activeArtifact)?.label ?? "Preview workspace"}</h2>
              <AnimatePresence initial={false} mode="wait">
                <motion.div
                  key={activeArtifact}
                  className="agent-preview__artifact"
                  initial={artifactSwitchMotion.initial}
                  animate={artifactSwitchMotion.animate}
                  exit={artifactSwitchMotion.exit}
                  transition={artifactSwitchMotion.transition}
                >
                  <ArtifactWorkspace
                    activeArtifact={activeArtifact}
                    workspace={workspace}
                    actions={workspaceActions}
                    openArtifact={openArtifact}
                    threadId={thread.id}
                    conceptStore={agentWorkspaceStore}
                  />
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.section>
        ) : null}
      </AnimatePresence>

      {onboardingOpen ? (
        <OnboardingSheet
          onComplete={(profile) => {
            saveUserProfile(profile);
            setUserProfile(profile);
            setOnboardingOpen(false);
          }}
          onSkip={() => setOnboardingOpen(false)}
        />
      ) : null}
    </main>
  );
}

function OnboardingSheet({ onComplete, onSkip }) {
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [ownsLand, setOwnsLand] = React.useState("");
  const canStart = name.trim().length > 0 && Boolean(ownsLand);

  const submit = (event) => {
    event.preventDefault();
    if (!canStart) return;
    onComplete({ name: name.trim(), email: email.trim(), phone: phone.trim(), ownsLand });
  };

  return (
    <div className="onboarding-scrim">
      <motion.section
        className="onboarding-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
        initial={{ y: 14, scale: 0.98, opacity: 0 }}
        animate={{ y: 0, scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 340, damping: 32 }}
      >
        <h2 id="onboarding-title">Before we dream</h2>
        <p>So Dwella knows who she's building with.</p>
        <form onSubmit={submit}>
          <label>
            <span>Name</span>
            <input
              autoComplete="name"
              autoFocus
              placeholder="What should Dwella call you?"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <label>
            <span>Email</span>
            <input
              autoComplete="email"
              inputMode="email"
              placeholder="you@example.com"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label>
            <span>Phone</span>
            <input
              autoComplete="tel"
              inputMode="tel"
              placeholder="04xx xxx xxx"
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
            />
          </label>
          <fieldset className="onboarding-sheet__land">
            <legend>Do you already own the land?</legend>
            <div className="onboarding-sheet__land-options">
              <button
                className={ownsLand === "yes" ? "is-selected" : ""}
                type="button"
                aria-pressed={ownsLand === "yes"}
                onClick={() => setOwnsLand("yes")}
              >
                Yes
              </button>
              <button
                className={ownsLand === "no" ? "is-selected" : ""}
                type="button"
                aria-pressed={ownsLand === "no"}
                onClick={() => setOwnsLand("no")}
              >
                No
              </button>
            </div>
          </fieldset>
          <button className="onboarding-sheet__start" type="submit" disabled={!canStart}>
            Get started
          </button>
        </form>
        <button className="onboarding-sheet__skip" type="button" onClick={onSkip}>
          Skip for now
        </button>
      </motion.section>
    </div>
  );
}

function AgentAuthGate() {
  if (localAuthBypass) {
    return <AgentShell />;
  }

  const { isLoaded, isSignedIn } = useDwellaAuth();

  React.useEffect(() => {
    if (!isLoaded || isSignedIn) return;
    const redirectPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    rememberPendingAgentMessage();
    window.history.replaceState({}, "", `/sign-up?redirect_url=${encodeURIComponent(redirectPath)}`);
  }, [isLoaded, isSignedIn]);

  if (!isLoaded) {
    return <AuthTransitionScreen label="Loading workspace" />;
  }

  if (!isSignedIn) {
    return <AuthTransitionScreen label="Redirecting to sign in" />;
  }

  return <AgentShell />;
}

function SignInPage() {
  if (localAuthBypass) {
    return <AgentShell />;
  }

  const { isLoaded, isSignedIn } = useAuth();
  const redirectTarget = getSafeRedirectTarget();

  React.useEffect(() => {
    if (isLoaded && isSignedIn) {
      window.history.replaceState({}, "", restorePendingAgentMessage(redirectTarget));
    }
  }, [isLoaded, isSignedIn, redirectTarget]);

  React.useEffect(() => {
    if (!isLoaded || isSignedIn) return;
    // Never rewrite Clerk subroutes like /sign-in/factor-one or /sign-in/sso-callback.
    if (window.location.pathname !== "/sign-in") return;
    const currentRedirect = new URLSearchParams(window.location.search).get("redirect_url");
    if (currentRedirect && currentRedirect !== redirectTarget) {
      window.history.replaceState({}, "", `/sign-in?redirect_url=${encodeURIComponent(redirectTarget)}`);
    }
  }, [isLoaded, isSignedIn, redirectTarget]);

  if (!isLoaded) {
    return <AuthTransitionScreen label="Loading sign in" />;
  }

  if (isSignedIn) {
    return <AuthTransitionScreen label="Redirecting to workspace" />;
  }

  return (
    <main className="auth-page" aria-label="Sign in to Dwella">
      <div className="auth-page__backdrop" aria-hidden="true" />
      <a className="auth-page__brand" href="/">
        Dwella
      </a>
      <section className="auth-page__form" aria-label="Dwella sign in form">
        <SignIn
          path="/sign-in"
          routing="path"
          signUpUrl="/sign-up"
          forceRedirectUrl={redirectTarget}
          signUpForceRedirectUrl={redirectTarget}
          fallbackRedirectUrl={redirectTarget}
          signUpFallbackRedirectUrl={redirectTarget}
        />
      </section>
    </main>
  );
}

function SignUpPage() {
  if (localAuthBypass) {
    return <AgentShell />;
  }

  const { isLoaded, isSignedIn } = useAuth();
  const redirectTarget = getSafeRedirectTarget();

  React.useEffect(() => {
    if (isLoaded && isSignedIn) {
      window.history.replaceState({}, "", restorePendingAgentMessage(redirectTarget));
    }
  }, [isLoaded, isSignedIn, redirectTarget]);

  React.useEffect(() => {
    if (!isLoaded || isSignedIn) return;
    // Never rewrite Clerk subroutes like /sign-up/verify-email-address or /sign-up/sso-callback.
    if (window.location.pathname !== "/sign-up") return;
    const currentRedirect = new URLSearchParams(window.location.search).get("redirect_url");
    if (currentRedirect && currentRedirect !== redirectTarget) {
      window.history.replaceState({}, "", `/sign-up?redirect_url=${encodeURIComponent(redirectTarget)}`);
    }
  }, [isLoaded, isSignedIn, redirectTarget]);

  if (!isLoaded) {
    return <AuthTransitionScreen label="Loading sign up" />;
  }

  if (isSignedIn) {
    return <AuthTransitionScreen label="Redirecting to workspace" />;
  }

  return (
    <main className="auth-page" aria-label="Sign up for Dwella">
      <div className="auth-page__backdrop" aria-hidden="true" />
      <a className="auth-page__brand" href="/">
        Dwella
      </a>
      <section className="auth-page__form" aria-label="Dwella sign up form">
        <SignUp
          path="/sign-up"
          routing="path"
          signInUrl="/sign-in"
          forceRedirectUrl={redirectTarget}
          signInForceRedirectUrl={redirectTarget}
          fallbackRedirectUrl={redirectTarget}
          signInFallbackRedirectUrl={redirectTarget}
        />
      </section>
    </main>
  );
}

function AuthTransitionScreen({ label }) {
  return <main className="agent-auth-gate" aria-label={label} />;
}

function ArtifactWorkspace({ activeArtifact, workspace, actions, openArtifact, threadId, conceptStore }) {
  if (activeArtifact === "doc") {
    return <DocumentArtifact workspace={workspace} actions={actions} openArtifact={openArtifact} />;
  }

  if (activeArtifact === "map") {
    return <MapArtifact workspace={workspace} actions={actions} />;
  }

  if (activeArtifact === "files") {
    return <FilesArtifact workspace={workspace} actions={actions} openArtifact={openArtifact} />;
  }

  if (activeArtifact === "concepts") {
    return <ConceptsArtifact threadId={threadId} conceptStore={conceptStore} />;
  }

  return <DocumentArtifact workspace={workspace} actions={actions} openArtifact={openArtifact} />;
}

function ConceptsArtifact({ threadId, conceptStore }) {
  if (localAuthBypass) {
    return (
      <div className="artifact-empty">
        <p>Sign in to generate and browse home concept imagery.</p>
      </div>
    );
  }
  return <ConvexConceptsArtifact threadId={threadId} conceptStore={conceptStore} />;
}

function ConvexConceptsArtifact({ threadId, conceptStore }) {
  const conceptData = useQuery(api.conceptDesigner.listThreadConcepts, { threadId });
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [viewPreference, setViewPreference] = React.useState({});

  const concepts = conceptData?.concepts ?? [];
  const conceptCount = concepts.length;
  const safeIndex = Math.min(activeIndex, Math.max(0, conceptCount - 1));
  const concept = concepts[safeIndex];

  React.useEffect(() => {
    if (activeIndex !== safeIndex) setActiveIndex(safeIndex);
  }, [activeIndex, safeIndex]);

  // When a colour, plan, or derived view starts or finishes rendering, bring it on
  // stage automatically so the user never has to know to click.
  const prevRenderStatusesRef = React.useRef({});
  React.useEffect(() => {
    const previous = prevRenderStatusesRef.current;
    const next = {};
    concepts.forEach((item, index) => {
      next[item.id] = {
        colour: item.colorStatus,
        plan: item.floorPlanStatus,
        ...(Object.fromEntries((item.views ?? []).map((view) => [view.id, view.status]))),
      };
      const before = previous[item.id];
      if (!before) return;
      const bringOnStage = (viewKey) => {
        setViewPreference((current) => ({ ...current, [item.id]: viewKey }));
        setActiveIndex(index);
      };
      if (item.colorStatus !== before.colour && (item.colorStatus === "rendering" || item.colorStatus === "ready")) {
        bringOnStage("colour");
      }
      if (item.floorPlanStatus !== before.plan && (item.floorPlanStatus === "rendering" || item.floorPlanStatus === "ready")) {
        bringOnStage("plan");
      }
      for (const view of item.views ?? []) {
        if (view.status !== before[view.id] && (view.status === "rendering" || view.status === "ready")) {
          bringOnStage(view.id);
        }
      }
    });
    prevRenderStatusesRef.current = next;
  }, [concepts]);

  const goTo = (index) => {
    setActiveIndex(Math.max(0, Math.min(conceptCount - 1, index)));
  };

  if (conceptData === undefined) {
    return <div className="artifact-concepts artifact-concepts--empty" aria-live="polite" />;
  }

  if (!concept) {
    return (
      <div className="artifact-concepts artifact-concepts--empty">
        <h3>Nothing here yet, and that's the fun part.</h3>
        <p>Describe your dream home in the conversation and Dwella will sketch it into this space.</p>
      </div>
    );
  }

  const extraViews = concept.views ?? [];
  const requestedView = viewPreference[concept.id] ?? "auto";
  const activeView =
    requestedView === "auto" ? (concept.heroImageUrl ? "colour" : "sketch") : requestedView;
  const isColoring = concept.colorStatus === "rendering";
  const isPlanning = concept.floorPlanStatus === "rendering";
  const activeExtraView = extraViews.find((view) => view.id === activeView) ?? null;

  const setView = (view) => setViewPreference((current) => ({ ...current, [concept.id]: view }));

  const selectColour = () => {
    setView("colour");
    if (!concept.heroImageUrl && !isColoring) {
      conceptStore
        ?.renderConceptColor(threadId, { optionId: concept.id })
        .catch((error) => console.error("Dwella concept colour request failed", error));
    }
  };

  const selectPlan = () => {
    setView("plan");
    if (!concept.floorPlanImageUrl && !isPlanning) {
      conceptStore
        ?.renderConceptFloorPlan(threadId, { optionId: concept.id })
        .catch((error) => console.error("Dwella concept floor plan request failed", error));
    }
  };

  const displayedImage = activeExtraView
    ? activeExtraView.imageUrl ?? concept.sketchImageUrl
    : activeView === "plan"
      ? concept.floorPlanImageUrl
      : activeView === "colour"
        ? concept.heroImageUrl ?? concept.sketchImageUrl
        : concept.sketchImageUrl;
  const busyLabel = activeExtraView
    ? !activeExtraView.imageUrl && activeExtraView.status === "rendering"
      ? `Creating ${activeExtraView.label.toLowerCase()}...`
      : ""
    : activeView === "plan" && !concept.floorPlanImageUrl && isPlanning
      ? "Drawing the plan..."
      : activeView === "colour" && !concept.heroImageUrl && isColoring
        ? "Painting it in..."
        : "";
  const views = [
    { key: "sketch", label: "Sketch", onSelect: () => setView("sketch"), busy: false },
    { key: "colour", label: "Colour", onSelect: selectColour, busy: isColoring },
    { key: "plan", label: "Plan", onSelect: selectPlan, busy: isPlanning },
    ...extraViews.map((view) => ({
      key: view.id,
      label: view.label,
      onSelect: () => setView(view.id),
      busy: view.status === "rendering",
    })),
  ];

  return (
    <div className="artifact-concepts artifact-concepts--stage">
      <div className="concept-stage">
        {conceptCount > 1 ? (
          <button
            className="concept-stage__arrow"
            type="button"
            aria-label="Previous concept"
            disabled={safeIndex === 0}
            onClick={() => goTo(safeIndex - 1)}
          >
            <ChevronLeft aria-hidden="true" />
          </button>
        ) : null}
        <figure className="concept-stage__frame">
          {displayedImage ? (
            <img
              className={busyLabel ? "concept-stage__image is-coloring" : "concept-stage__image"}
              src={displayedImage}
              alt={`${concept.name} ${activeExtraView ? activeExtraView.label : activeView === "plan" ? "concept floor plan" : activeView === "colour" ? "colour concept render" : "concept sketch"}`}
            />
          ) : concept.status === "failed" ? (
            <div className="concept-stage__fallback">
              <span>{concept.error || "This sketch couldn't be rendered. Ask Dwella to try again."}</span>
            </div>
          ) : (
            <ConceptStageSkeleton />
          )}
          {busyLabel ? (
            <div className="concept-stage__coloring" aria-live="polite">
              <Diamond className="concept-stage__coloring-diamond" />
              <span>{busyLabel}</span>
            </div>
          ) : null}
        </figure>
        {conceptCount > 1 ? (
          <button
            className="concept-stage__arrow"
            type="button"
            aria-label="Next concept"
            disabled={safeIndex === conceptCount - 1}
            onClick={() => goTo(safeIndex + 1)}
          >
            <ChevronRight aria-hidden="true" />
          </button>
        ) : null}
      </div>

      <div className="concept-stage__caption">
        <h3>{concept.name}</h3>
      </div>

      {concept.status === "ready" ? (
        <div className="concept-views" role="group" aria-label="Concept views">
          {views.map((view) => (
            <button
              className={view.key === activeView ? "is-active" : ""}
              key={view.key}
              type="button"
              aria-pressed={view.key === activeView}
              onClick={view.onSelect}
            >
              {view.key === activeView ? (
                <motion.span
                  className="toggle-indicator concept-views__indicator"
                  layoutId="concept-view-indicator"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                />
              ) : null}
              <span className="toggle-label">{view.label}</span>
              {view.busy ? <span className="concept-views__busy" aria-hidden="true" /> : null}
            </button>
          ))}
        </div>
      ) : null}

      {conceptCount > 1 ? (
        <div className="concept-stage__dots" role="tablist" aria-label="Concept directions">
          {concepts.map((item, index) => (
            <button
              className={index === safeIndex ? "is-active" : ""}
              key={item.id}
              type="button"
              role="tab"
              aria-selected={index === safeIndex}
              aria-label={item.name}
              onClick={() => goTo(index)}
            />
          ))}
        </div>
      ) : null}

      <p className="concept-disclaimer">{conceptData.disclaimer}</p>
    </div>
  );
}

function ConceptStageSkeleton() {
  return (
    <div className="concept-skeleton" aria-live="polite" aria-label="Concept sketch rendering">
      <div className="concept-skeleton__canvas">
        <span className="concept-skeleton__roof" />
        <span className="concept-skeleton__wall" />
        <span className="concept-skeleton__ground" />
      </div>
      <div className="concept-skeleton__caption">
        <Diamond className="concept-skeleton__diamond" />
        <span>Sketching...</span>
      </div>
    </div>
  );
}

function ArtifactGlobalSearch({ workspace, actions, openArtifact }) {
  const activeDocument = workspace.documents.find((document) => document.id === workspace.activeDocumentId) ?? workspace.documents[0];
  const commandItems = React.useMemo(() => {
    const currentDocumentId = activeDocument?.id;
    return [
      ...workspace.documents.map((document) => ({
        id: `document:${document.id}`,
        title: document.title || "Untitled document",
        section: "Documents",
        icon: <FileText size={15} />,
        shortcut: document.id === currentDocumentId ? "Current" : "",
        isSelected: document.id === currentDocumentId,
        action: () => {
          actions.setActiveDocument(document.id);
          openArtifact("doc");
        },
      })),
      ...workspace.folders.map((folder) => ({
        id: `folder:${folder.id}`,
        title: folder.name || "Untitled folder",
        section: "Folders",
        description: "Open in files",
        icon: <Folder size={15} />,
        keywords: ["folder", "files"],
        action: () => openArtifact("files"),
      })),
      ...workspace.files.map((file) => {
        const parentFolder = workspace.folders.find((folder) => folder.id === file.folderId);
        return {
          id: `file:${file.id}`,
          title: file.name || "Untitled file",
          section: "Files",
          description: parentFolder?.name || "Files",
          icon: file.documentId ? <FileText size={15} /> : <Files size={15} />,
          keywords: ["file", parentFolder?.name, file.type].filter(Boolean),
          action: () => {
            if (file.documentId) {
              actions.setActiveDocument(file.documentId);
              openArtifact("doc");
              return;
            }
            openArtifact("files");
          },
        };
      }),
      {
        id: "action:new-document",
        title: "New document",
        section: "Actions",
        icon: <CirclePlus size={15} />,
        action: () => {
          actions.createDocument();
          openArtifact("doc");
        },
      },
      {
        id: "action:open-documents",
        title: "Document editor",
        section: "Actions",
        icon: <FileText size={15} />,
        action: () => openArtifact("doc"),
      },
      {
        id: "action:open-files",
        title: "Files",
        section: "Actions",
        icon: <Files size={15} />,
        action: () => openArtifact("files"),
      },
      {
        id: "action:open-map",
        title: "Live map",
        section: "Actions",
        icon: <Map size={15} />,
        action: () => openArtifact("map"),
      },
      {
        id: "action:open-concepts",
        title: "Concept gallery",
        section: "Actions",
        icon: <Images size={15} />,
        action: () => openArtifact("concepts"),
      },
    ];
  }, [actions, activeDocument?.id, openArtifact, workspace.documents, workspace.files, workspace.folders]);

  return (
    <div className="agent-artifact-search">
      <CommandSearch
        ariaLabel="Search workspace"
        className="artifact-global-command"
        emptyLabel="No workspace results found"
        id="artifact-global-command-search"
        items={commandItems}
        placeholder="Search documents, files, folders, actions..."
        shortcutKey={null}
        shortcutLabel={null}
        triggerLabel="Search workspace"
      />
    </div>
  );
}

function DocumentArtifact({ workspace, actions, openArtifact }) {
  const activeDocument = workspace.documents.find((document) => document.id === workspace.activeDocumentId) ?? workspace.documents[0];
  const [editorRetryKey, setEditorRetryKey] = React.useState(0);

  if (!activeDocument) {
    return (
      <div className="artifact-empty">
        <button type="button" onClick={actions.createDocument}>Create document</button>
      </div>
    );
  }

  return (
    <div className="artifact-document">
      <div className="convex-document-editor" data-component="convex-document-editor">
        <input
          className="document-title-input"
          aria-label="Document title"
          value={activeDocument.title}
          onChange={(event) => actions.updateDocument(activeDocument.id, { title: event.target.value || "Untitled document" })}
        />
        <RichDocumentErrorBoundary
          resetKey={`${activeDocument.id}:${editorRetryKey}`}
          onRetry={() => setEditorRetryKey((key) => key + 1)}
        >
          {isConvexDocumentId(activeDocument.id) ? (
            <SyncedRichDocumentEditor key={`${activeDocument.id}:${editorRetryKey}`} document={activeDocument} actions={actions} />
          ) : (
            <LocalRichDocumentEditor key={activeDocument.id} document={activeDocument} actions={actions} />
          )}
        </RichDocumentErrorBoundary>
      </div>
    </div>
  );
}

class RichDocumentErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidUpdate(previousProps) {
    if (previousProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  componentDidCatch(error, info) {
    console.error("Dwella rich document editor failed", error, info);
  }

  render() {
    if (this.state.error) {
      return <RichDocumentSyncFallback onRetry={this.props.onRetry} />;
    }
    return this.props.children;
  }
}

function RichDocumentSyncFallback({ onRetry }) {
  return (
    <div className="rich-document-error" role="status">
      <p>Document sync paused for a moment.</p>
      <button type="button" onClick={onRetry}>Try again</button>
    </div>
  );
}

function SyncedRichDocumentEditor({ document, actions }) {
  const editorOptions = useBlockNoteEditorOptions(actions);
  const sync = useBlockNoteSync(api.prosemirrorSync, String(document.id), {
    snapshotDebounceMs: 900,
    warnOnUnsyncedClose: true,
    editorOptions,
  });
  const { create, editor, isLoading } = sync;

  React.useEffect(() => {
    if (isLoading || editor || !create) return;
    let cancelled = false;
    create(createProseMirrorDocumentFromText(document.content))
      .catch((error) => {
        if (!cancelled) {
          console.warn("Dwella rich document initialization failed", error);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [create, document.content, editor, isLoading]);

  React.useEffect(() => {
    if (!editor) return undefined;
    return editor.onChange(() => {
      actions.updateDocument(document.id, { content: blockNoteBlocksToPlainText(editor.document) });
    });
  }, [actions, document.id, editor]);

  if (isLoading || !editor) {
    return <div className="rich-document-loading">Opening document...</div>;
  }

  return (
    <div className="rich-document-surface">
      <BlockNoteView editor={editor} theme="light" />
    </div>
  );
}

function LocalRichDocumentEditor({ document, actions }) {
  const editorOptions = useBlockNoteEditorOptions(actions);
  const editor = React.useMemo(
    () =>
      BlockNoteEditor.create({
        ...editorOptions,
        initialContent: createBlockNoteBlocksFromText(document.content),
      }),
    [document.id, editorOptions]
  );
  const latestEditorTextRef = React.useRef(String(document.content ?? ""));

  React.useEffect(() => {
    const nextContent = String(document.content ?? "");
    const currentContent = blockNoteBlocksToPlainText(editor.document);
    if (nextContent === latestEditorTextRef.current || nextContent === currentContent) {
      latestEditorTextRef.current = nextContent;
      return;
    }
    latestEditorTextRef.current = nextContent;
    editor.replaceBlocks(editor.document, createBlockNoteBlocksFromText(nextContent));
  }, [document.content, editor]);

  React.useEffect(() => {
    return editor.onChange(() => {
      const content = blockNoteBlocksToPlainText(editor.document);
      latestEditorTextRef.current = content;
      actions.updateDocument(document.id, { content });
    });
  }, [actions, document.id, editor]);

  return (
    <div className="rich-document-surface">
      <BlockNoteView editor={editor} theme="light" />
    </div>
  );
}

function useBlockNoteEditorOptions(actions) {
  return React.useMemo(
    () => ({
      uploadFile: (file) => actions.uploadDocumentAsset(file),
      tables: {
        splitCells: true,
        cellBackgroundColor: true,
        cellTextColor: true,
        headers: true,
      },
    }),
    [actions]
  );
}

function MapArtifact({ workspace, actions }) {
  const mapState = workspace.map;
  const mapElementRef = React.useRef(null);
  const mapRef = React.useRef(null);
  const markerLayerRef = React.useRef(null);
  const latestMapStateRef = React.useRef(mapState);

  latestMapStateRef.current = mapState;

  React.useEffect(() => {
    if (!mapElementRef.current || mapRef.current) return undefined;

    const map = L.map(mapElementRef.current, {
      attributionControl: true,
      zoomControl: false,
    }).setView([mapState.center.lat, mapState.center.lng], mapState.zoom);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap",
    }).addTo(map);

    L.control.zoom({ position: "bottomright" }).addTo(map);
    markerLayerRef.current = L.layerGroup().addTo(map);

    map.on("click", (event) => {
      const current = latestMapStateRef.current;
      const marker = {
        id: `marker-${Date.now()}`,
        label: `Pin ${current.markers.length + 1}`,
        lat: event.latlng.lat,
        lng: event.latlng.lng,
      };
      actions.addMapMarker(marker);
    });

    map.on("moveend", () => {
      const center = map.getCenter();
      actions.updateMapView({ lat: center.lat, lng: center.lng }, map.getZoom());
    });

    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(mapElementRef.current);
    window.setTimeout(() => map.invalidateSize(), 0);
    mapRef.current = map;

    return () => {
      observer.disconnect();
      map.remove();
      mapRef.current = null;
      markerLayerRef.current = null;
    };
  }, [actions]);

  React.useEffect(() => {
    if (!mapRef.current) return;
    const center = mapRef.current.getCenter();
    const centerChanged = Math.abs(center.lat - mapState.center.lat) > 0.000001 || Math.abs(center.lng - mapState.center.lng) > 0.000001;
    if (centerChanged || mapRef.current.getZoom() !== mapState.zoom) {
      mapRef.current.setView([mapState.center.lat, mapState.center.lng], mapState.zoom, { animate: false });
    }
  }, [mapState.center.lat, mapState.center.lng, mapState.zoom]);

  React.useEffect(() => {
    if (!markerLayerRef.current) return;
    markerLayerRef.current.clearLayers();
    mapState.markers.forEach((marker) => {
      L.marker([marker.lat, marker.lng], {
        icon: L.divIcon({
          className: "real-map-marker",
          html: "<span></span>",
          iconSize: [24, 24],
          iconAnchor: [12, 24],
        }),
        title: marker.label,
      }).addTo(markerLayerRef.current);
    });
  }, [mapState.markers]);

  return (
    <div className="artifact-map">
      <div className="artifact-toolbar">
        <button
          type="button"
          onClick={actions.resetMap}
        >
          Reset
        </button>
      </div>
      <div className="live-map-canvas" ref={mapElementRef} role="application" aria-label="Interactive project map" />
    </div>
  );
}

function BrowserArtifact({ workspace, actions }) {
  return (
    <div className="artifact-browser">
      <div className="artifact-toolbar">
        <input
          aria-label="Sandbox browser address"
          value={workspace.browser.url}
          onChange={(event) => actions.updateBrowserUrl(event.target.value)}
        />
      </div>
      <iframe
        className="sandbox-browser-frame"
        title="Agent browser sandbox"
        sandbox="allow-forms allow-scripts"
        srcDoc={`<!doctype html><html><body style="margin:0;font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#fff;color:#555;display:grid;place-items:center;min-height:100vh;"><main style="max-width:420px;line-height:1.5;text-align:center;padding:24px;"><p style="margin:0 0 10px;color:#222;">Sandbox browser</p><p style="margin:0;">${escapeHtml(workspace.browser.url || "about:blank")}</p></main></body></html>`}
      />
    </div>
  );
}

function FilesArtifact({ workspace, actions, openArtifact }) {
  const [fileName, setFileName] = React.useState("");
  const [folderName, setFolderName] = React.useState("");
  const [scanningFileId, setScanningFileId] = React.useState("");
  const seenFileIdsRef = React.useRef(new Set(workspace.files.map((file) => file.id)));

  React.useEffect(() => {
    const newReusableFile = workspace.files.find((file) => {
      const isNew = !seenFileIdsRef.current.has(file.id);
      seenFileIdsRef.current.add(file.id);
      return isNew && isReusableDocumentFile(file.name);
    });
    if (newReusableFile) setScanningFileId(newReusableFile.id);
  }, [workspace.files]);

  React.useEffect(() => {
    if (!scanningFileId) return undefined;
    const timeoutId = window.setTimeout(() => setScanningFileId(""), 2600);
    return () => window.clearTimeout(timeoutId);
  }, [scanningFileId]);

  const createFolder = () => {
    const name = folderName.trim();
    if (!name) return;
    actions.createFolder(name);
    setFolderName("");
  };

  const createFile = () => {
    const name = fileName.trim();
    if (!name) return;
    actions.createFile(name);
    setFileName("");
  };

  return (
    <div className="artifact-files">
      <div className="artifact-toolbar artifact-toolbar--files">
        <input aria-label="New folder name" placeholder="Folder name" value={folderName} onChange={(event) => setFolderName(event.target.value)} />
        <button type="button" onClick={createFolder}>Folder</button>
        <input aria-label="New file name" placeholder="File name" value={fileName} onChange={(event) => setFileName(event.target.value)} />
        <button type="button" onClick={createFile}>File</button>
      </div>
      <div className="file-workspace" aria-label="Agent thread files">
        {workspace.folders.map((folder) => (
          <section className="file-folder" key={folder.id}>
            <div className="file-folder__name">
              <span className="file-glyph file-glyph--folder" aria-hidden="true" />
              <span>{folder.name}</span>
            </div>
            <div className="file-folder__items">
              {workspace.files.filter((file) => file.folderId === folder.id).map((file) => (
                <button
                  className={file.id === scanningFileId ? "file-row is-scanning" : "file-row"}
                  key={file.id}
                  type="button"
                  onClick={() => {
                    if (file.documentId) {
                      actions.setActiveDocument(file.documentId);
                      openArtifact("doc");
                    }
                  }}
                >
                  <DocumentFileIllustration fileName={file.name} isScanning={file.id === scanningFileId} />
                  <span>{file.name}</span>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function DocumentFileIllustration({ fileName, isScanning }) {
  if (isScanning) return <DocumentAnalysisIllustration className="file-document-illustration file-document-illustration--analysis" />;

  const extension = getFileExtension(fileName);
  if (extension === "pdf") return <DocumentPdfIllustration className="file-document-illustration" />;
  if (extension === "doc" || extension === "docx" || extension === "dwella") return <DocumentDocxIllustration className="file-document-illustration" />;
  if (extension === "txt" || extension === "md") return <DocumentTxtIllustration className="file-document-illustration" />;
  if (["gif", "heic", "jpeg", "jpg", "png", "svg", "webp"].includes(extension)) {
    return <DocumentImgIllustration className="file-document-illustration" />;
  }
  if (["7z", "gz", "rar", "tar", "zip"].includes(extension)) {
    return <DocumentZipIllustration className="file-document-illustration" />;
  }
  if (["css", "htm", "html", "js", "jsx", "ts", "tsx"].includes(extension)) {
    return <DocumentHtmlIllustration className="file-document-illustration" />;
  }

  return <span className="file-glyph file-glyph--file" aria-hidden="true" />;
}

function createLocalDocument(current, title = "Untitled document", content = "") {
  const now = Date.now();
  const documentTitle = String(title ?? "Untitled document").trim() || "Untitled document";
  const document = {
    id: `doc-${now}`,
    title: documentTitle,
    content,
    createdAt: now,
    updatedAt: now,
    storage: "local",
  };
  return {
    ...current,
    activeDocumentId: document.id,
    documents: [...current.documents, document],
    files: [
      ...current.files,
      {
        id: `file-${now}`,
        folderId: "documents",
        name: createRichDocumentFilename(documentTitle),
        type: "document",
        documentId: document.id,
        updatedAt: now,
      },
    ],
  };
}

function updateLocalDocument(current, documentId, patch) {
  const activeDocument = current.documents.find((document) => document.id === documentId);
  return {
    ...current,
    activeDocumentId: documentId,
    documents: current.documents.map((document) =>
      document.id === documentId ? { ...document, ...patch, updatedAt: Date.now() } : document
    ),
    files: ensureDocumentFile(current.files, documentId, patch.title ?? activeDocument?.title),
  };
}

function createLocalFolder(current, name) {
  return {
    ...current,
    folders: [...current.folders, { id: `folder-${Date.now()}`, name, parentId: "root", createdAt: Date.now() }],
  };
}

function createLocalFile(current, input) {
  const fileInput = typeof input === "string" ? { name: input } : (input ?? {});
  const name = String(fileInput.name ?? "").trim();
  if (!name) return current;
  const now = Date.now();
  return {
    ...current,
    files: [
      ...current.files,
      {
        id: `file-${now}-${Math.random().toString(36).slice(2)}`,
        folderId: "root",
        name,
        type: "file",
        mimeType: fileInput.mimeType ?? "",
        size: Number(fileInput.size) || 0,
        source: fileInput.source ?? "manual",
        updatedAt: now,
      },
    ],
  };
}

function isConvexDocumentId(documentId) {
  return typeof documentId === "string" && documentId.length >= 20 && !documentId.startsWith("doc-");
}

function getFileExtension(fileName) {
  const extension = String(fileName ?? "").split(".").pop();
  return extension && extension !== fileName ? extension.toLowerCase() : "";
}

function isReusableDocumentFile(fileName) {
  return [
    "7z",
    "css",
    "doc",
    "docx",
    "dwella",
    "gif",
    "gz",
    "heic",
    "htm",
    "html",
    "jpeg",
    "jpg",
    "js",
    "jsx",
    "md",
    "pdf",
    "png",
    "rar",
    "svg",
    "tar",
    "ts",
    "tsx",
    "txt",
    "webp",
    "zip",
  ].includes(getFileExtension(fileName));
}

function createRichDocumentFilename(title) {
  return `${String(title || "Untitled document").trim() || "Untitled document"}.dwella`;
}

function loadWorkspace(threadId) {
  const storageKey = `dwella.agent.workspace.${threadId}`;
  try {
    const saved = window.localStorage.getItem(storageKey);
    if (saved) return normalizeWorkspace(JSON.parse(saved));
  } catch {
    // Local persistence is best-effort only.
  }
  return createInitialWorkspace();
}

function saveWorkspace(threadId, workspace) {
  try {
    window.localStorage.setItem(`dwella.agent.workspace.${threadId}`, JSON.stringify(workspace));
  } catch {
    // Local persistence is best-effort only.
  }
}

function loadConversationMessages(threadId) {
  const fallback = createInitialConversationMessages();
  try {
    const saved = window.localStorage.getItem(`dwella.agent.messages.${threadId}`);
    if (!saved) return fallback;
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) return fallback;
    const messages = parsed
      .filter((message) => message?.role === "user" || message?.role === "assistant")
      .map((message, index) => ({
        id: String(message.id ?? `saved-${index}`),
        role: message.role,
        content: String(message.content ?? "").slice(0, 6000),
        attachments: normalizeVisibleAttachments(message.attachments),
      }))
      .filter((message) => message.content.trim() || message.attachments.length);
    return messages.length ? messages.slice(-80) : fallback;
  } catch {
    return fallback;
  }
}

function saveConversationMessages(threadId, messages) {
  try {
    const boundedMessages = Array.isArray(messages) ? messages.slice(-80) : createInitialConversationMessages();
    window.localStorage.setItem(`dwella.agent.messages.${threadId}`, JSON.stringify(boundedMessages));
  } catch {
    // Conversation persistence is best-effort only.
  }
}

function createInitialConversationMessages() {
  return [
    {
      id: "welcome",
      role: "assistant",
      content: DWELLA_FIRST_CONVERSATION_MESSAGE,
    },
  ];
}

function createWorkspaceContextForAgent(workspace, activeArtifact) {
  const normalizedWorkspace = normalizeWorkspace(workspace);
  const activeDocument =
    normalizedWorkspace.documents.find((document) => document.id === normalizedWorkspace.activeDocumentId) ??
    normalizedWorkspace.documents[0];
  const markers = normalizedWorkspace.map.markers;

  return {
    activeArtifact,
    activeDocumentTitle: activeDocument?.title ?? "",
    activeDocumentExcerpt: activeDocument?.content ? activeDocument.content.slice(-1800) : "",
    documentTitles: normalizedWorkspace.documents.map((document) => document.title),
    fileNames: normalizedWorkspace.files.map((file) => file.name),
    browserUrl: normalizedWorkspace.browser.url,
    mapSummary: markers.length
      ? `${markers.length} marker${markers.length === 1 ? "" : "s"}: ${markers.map((marker) => marker.label).join(", ")}`
      : `No map markers, centred near ${normalizedWorkspace.map.center.lat.toFixed(4)}, ${normalizedWorkspace.map.center.lng.toFixed(4)}`,
  };
}

function createInitialWorkspace() {
  const now = Date.now();
  const document = {
    id: `doc-${now}`,
    title: "Untitled document",
    content: "",
    createdAt: now,
    updatedAt: now,
    storage: "convex-document-editor",
  };
  return {
    updatedAt: now,
    activeDocumentId: document.id,
    documents: [document],
    folders: [
      { id: "root", name: "Thread files", parentId: null, createdAt: now },
      { id: "documents", name: "Documents", parentId: "root", createdAt: now },
    ],
    files: [
      { id: `file-${now}`, folderId: "documents", name: createRichDocumentFilename(document.title), type: "document", documentId: document.id, updatedAt: now },
    ],
    map: { center: defaultMapCenter(), zoom: 12, markers: [] },
    browser: { url: "about:blank" },
  };
}

function normalizeWorkspace(saved) {
  const fallback = createInitialWorkspace();
  return {
    ...fallback,
    ...saved,
    documents: Array.isArray(saved?.documents) && saved.documents.length ? saved.documents : fallback.documents,
    folders: Array.isArray(saved?.folders) && saved.folders.length ? saved.folders : fallback.folders,
    files: Array.isArray(saved?.files) ? saved.files : fallback.files,
    map: normalizeMapState(saved?.map, fallback.map),
    browser: { ...fallback.browser, ...(saved?.browser ?? {}) },
  };
}

function ensureDocumentFile(files, documentId, title) {
  const name = createRichDocumentFilename(title || "Untitled document");
  if (!files.some((file) => file.documentId === documentId)) {
    return [...files, { id: `file-${Date.now()}`, folderId: "documents", name, type: "document", documentId, updatedAt: Date.now() }];
  }
  return files.map((file) => file.documentId === documentId ? { ...file, name, updatedAt: Date.now() } : file);
}

function normalizeMapState(savedMap, fallbackMap) {
  const center = isFiniteNumber(savedMap?.center?.lat) && isFiniteNumber(savedMap?.center?.lng) ? savedMap.center : fallbackMap.center;
  const zoom = isFiniteNumber(savedMap?.zoom) ? savedMap.zoom : fallbackMap.zoom;
  const markers = Array.isArray(savedMap?.markers)
    ? savedMap.markers
        .map((marker, index) => {
          if (isFiniteNumber(marker.lat) && isFiniteNumber(marker.lng)) return marker;
          return null;
        })
        .filter(Boolean)
        .map((marker, index) => ({ ...marker, label: marker.label || `Pin ${index + 1}` }))
    : fallbackMap.markers;

  return { center, zoom, markers };
}

function defaultMapCenter() {
  return { lat: -27.4698, lng: 153.0251 };
}

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

const userProfileStorageKey = "dwella.agent.profile";

function loadUserProfile() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(userProfileStorageKey));
    if (!saved || typeof saved !== "object") return null;
    const profile = {
      name: String(saved.name ?? "").trim().slice(0, 120),
      email: String(saved.email ?? "").trim().slice(0, 200),
      phone: String(saved.phone ?? "").trim().slice(0, 40),
      ownsLand: saved.ownsLand === "yes" || saved.ownsLand === "no" ? saved.ownsLand : "",
    };
    return profile.name || profile.email || profile.phone || profile.ownsLand ? profile : null;
  } catch {
    return null;
  }
}

function saveUserProfile(profile) {
  try {
    window.localStorage.setItem(userProfileStorageKey, JSON.stringify(profile));
  } catch {
    // Profile persistence is best-effort only.
  }
}

function playCallRingSound() {
  const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextCtor) return;

  try {
    const context = new AudioContextCtor();
    const now = context.currentTime;
    const masterGain = context.createGain();
    const toneFilter = context.createBiquadFilter();

    toneFilter.type = "lowpass";
    toneFilter.frequency.setValueAtTime(1800, now);
    toneFilter.Q.setValueAtTime(0.75, now);

    masterGain.gain.setValueAtTime(0.0001, now);
    masterGain.gain.exponentialRampToValueAtTime(0.045, now + 0.03);
    masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.05);

    toneFilter.connect(masterGain);
    masterGain.connect(context.destination);

    [
      { frequency: 523.25, offset: 0, duration: 0.32, volume: 0.032 },
      { frequency: 659.25, offset: 0.16, duration: 0.36, volume: 0.026 },
      { frequency: 783.99, offset: 0.36, duration: 0.46, volume: 0.022 },
    ].forEach((tone) => {
      const oscillator = context.createOscillator();
      const overtone = context.createOscillator();
      const toneGain = context.createGain();
      const start = now + tone.offset;
      const end = start + tone.duration;

      oscillator.type = "triangle";
      oscillator.frequency.setValueAtTime(tone.frequency, start);
      oscillator.frequency.exponentialRampToValueAtTime(tone.frequency * 0.996, end);

      overtone.type = "sine";
      overtone.frequency.setValueAtTime(tone.frequency * 2, start);

      toneGain.gain.setValueAtTime(0.0001, start);
      toneGain.gain.exponentialRampToValueAtTime(tone.volume, start + 0.025);
      toneGain.gain.exponentialRampToValueAtTime(0.0001, end);

      oscillator.connect(toneGain);
      overtone.connect(toneGain);
      toneGain.connect(toneFilter);
      oscillator.start(start);
      overtone.start(start);
      oscillator.stop(end + 0.04);
      overtone.stop(end + 0.04);
    });

    window.setTimeout(() => context.close().catch(() => {}), 1250);
  } catch {
    // Audio feedback is optional.
  }
}

function startNewConversation() {
  try {
    window.localStorage.setItem("dwella.agent.threadId", `thread-${Date.now().toString(36)}`);
  } catch {
    // If storage is unavailable the reload still lands on a usable session.
  }
  window.location.assign("/agent");
}

function getInitialArtifact() {
  return getRequestedArtifact() ?? "doc";
}

function getRequestedArtifact() {
  const params = new URLSearchParams(window.location.search);
  const requested = params.get("artifact") || window.location.hash.replace("#", "");
  return artifactTargets.includes(requested) ? requested : null;
}

function getSafeRedirectTarget() {
  const requested = new URLSearchParams(window.location.search).get("redirect_url");
  if (!requested) return "/agent";

  try {
    const parsed = new URL(requested, window.location.origin);
    if (parsed.origin !== window.location.origin) return "/agent";
    if (!parsed.pathname.startsWith("/agent")) return "/agent";
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return "/agent";
  }
}

function rememberPendingAgentMessage() {
  const message = new URLSearchParams(window.location.search).get("message");
  if (!message?.trim()) return;
  try {
    window.sessionStorage.setItem(pendingAgentMessageKey, message);
  } catch {
    // If storage is blocked, the redirect_url query still carries the message.
  }
}

function restorePendingAgentMessage(target) {
  try {
    const parsed = new URL(target, window.location.origin);
    if (parsed.origin !== window.location.origin || parsed.pathname !== "/agent") return target;
    if (parsed.searchParams.get("message")) {
      window.sessionStorage.removeItem(pendingAgentMessageKey);
      return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    }

    const pendingMessage = window.sessionStorage.getItem(pendingAgentMessageKey);
    if (!pendingMessage?.trim()) return target;
    parsed.searchParams.set("message", pendingMessage);
    window.sessionStorage.removeItem(pendingAgentMessageKey);
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return target;
  }
}

export default function App() {
  const [path, setPath] = React.useState(() => window.location.pathname);

  React.useEffect(() => {
    let currentHref = window.location.href;
    const notifyLocationChange = () => {
      if (window.location.href === currentHref) return;
      currentHref = window.location.href;
      setPath(window.location.pathname);
      window.dispatchEvent(new Event("dwella-location-change"));
    };
    const originalPushState = window.history.pushState;
    const originalReplaceState = window.history.replaceState;
    window.history.pushState = function pushState(...args) {
      const result = originalPushState.apply(this, args);
      notifyLocationChange();
      return result;
    };
    window.history.replaceState = function replaceState(...args) {
      const result = originalReplaceState.apply(this, args);
      notifyLocationChange();
      return result;
    };
    const handlePopState = () => notifyLocationChange();
    window.addEventListener("popstate", handlePopState);
    return () => {
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  const startAgent = (message) => {
    window.history.pushState({}, "", `/agent?message=${encodeURIComponent(message)}`);
    setPath("/agent");
  };

  const openAgent = () => {
    window.history.pushState({}, "", "/agent");
    setPath("/agent");
  };

  if (path === "/agent") {
    return <AgentAuthGate />;
  }

  // Clerk path routing renders subroutes like /sign-in/factor-one and
  // /sign-up/sso-callback, so match by prefix.
  if (path === "/sign-in" || path.startsWith("/sign-in/")) {
    return <SignInPage />;
  }

  if (path === "/sign-up" || path.startsWith("/sign-up/")) {
    return <SignUpPage />;
  }

  return <DwellaHeroReveal onStart={startAgent} onOpenAgent={openAgent} />;
}
