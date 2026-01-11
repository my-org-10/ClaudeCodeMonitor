import { useState } from "react";
import "./styles/base.css";
import "./styles/buttons.css";
import "./styles/sidebar.css";
import "./styles/home.css";
import "./styles/main.css";
import "./styles/messages.css";
import "./styles/approvals.css";
import "./styles/composer.css";
import "./styles/diff.css";
import "./styles/diff-viewer.css";
import "./styles/debug.css";
import { Sidebar } from "./components/Sidebar";
import { Home } from "./components/Home";
import { MainHeader } from "./components/MainHeader";
import { Messages } from "./components/Messages";
import { Approvals } from "./components/Approvals";
import { Composer } from "./components/Composer";
import { GitDiffPanel } from "./components/GitDiffPanel";
import { GitDiffViewer } from "./components/GitDiffViewer";
import { DebugPanel } from "./components/DebugPanel";
import { useWorkspaces } from "./hooks/useWorkspaces";
import { useThreads } from "./hooks/useThreads";
import { useWindowDrag } from "./hooks/useWindowDrag";
import { useGitStatus } from "./hooks/useGitStatus";
import { useGitDiffs } from "./hooks/useGitDiffs";
import { useModels } from "./hooks/useModels";
import { useSkills } from "./hooks/useSkills";
import { useDebugLog } from "./hooks/useDebugLog";
import { useWorkspaceRefreshOnFocus } from "./hooks/useWorkspaceRefreshOnFocus";
import { useWorkspaceRestore } from "./hooks/useWorkspaceRestore";
import type { AccessMode } from "./types";

function App() {
  const [centerMode, setCenterMode] = useState<"chat" | "diff">("chat");
  const [selectedDiffPath, setSelectedDiffPath] = useState<string | null>(null);
  const [accessMode, setAccessMode] = useState<AccessMode>("current");
  const {
    debugOpen,
    setDebugOpen,
    debugEntries,
    hasDebugAlerts,
    addDebugEntry,
    handleCopyDebug,
    clearDebugEntries,
  } = useDebugLog();

  const {
    workspaces,
    activeWorkspace,
    activeWorkspaceId,
    setActiveWorkspaceId,
    addWorkspace,
    connectWorkspace,
    markWorkspaceConnected,
    hasLoaded,
    refreshWorkspaces,
  } = useWorkspaces({ onDebug: addDebugEntry });

  const { status: gitStatus, refresh: refreshGitStatus } =
    useGitStatus(activeWorkspace);
  const {
    diffs: gitDiffs,
    isLoading: isDiffLoading,
    error: diffError,
  } = useGitDiffs(activeWorkspace, gitStatus.files, centerMode === "diff");
  const {
    models,
    selectedModel,
    selectedModelId,
    setSelectedModelId,
    reasoningOptions,
    selectedEffort,
    setSelectedEffort,
  } = useModels({ activeWorkspace, onDebug: addDebugEntry });
  const { skills } = useSkills({ activeWorkspace, onDebug: addDebugEntry });

  const resolvedModel = selectedModel?.model ?? null;
  const fileStatus =
    gitStatus.files.length > 0
      ? `${gitStatus.files.length} file${gitStatus.files.length === 1 ? "" : "s"} changed`
      : "Working tree clean";

  const {
    setActiveThreadId,
    activeThreadId,
    activeItems,
    approvals,
    threadsByWorkspace,
    threadStatusById,
    removeThread,
    startThreadForWorkspace,
    listThreadsForWorkspace,
    sendUserMessage,
    startReview,
    handleApprovalDecision,
  } = useThreads({
    activeWorkspace,
    onWorkspaceConnected: markWorkspaceConnected,
    onDebug: addDebugEntry,
    model: resolvedModel,
    effort: selectedEffort,
    accessMode,
    onMessageActivity: refreshGitStatus,
  });

  useWindowDrag("titlebar");
  useWorkspaceRestore({
    workspaces,
    hasLoaded,
    connectWorkspace,
    listThreadsForWorkspace,
  });
  useWorkspaceRefreshOnFocus({
    workspaces,
    refreshWorkspaces,
    listThreadsForWorkspace,
  });

  async function handleAddWorkspace() {
    const workspace = await addWorkspace();
    if (workspace) {
      setActiveThreadId(null, workspace.id);
    }
  }

  function exitDiffView() {
    setCenterMode("chat");
    setSelectedDiffPath(null);
  }

  async function handleAddAgent(workspace: (typeof workspaces)[number]) {
    exitDiffView();
    setActiveWorkspaceId(workspace.id);
    if (!workspace.connected) {
      await connectWorkspace(workspace);
    }
    await startThreadForWorkspace(workspace.id);
  }

  function handleSelectDiff(path: string) {
    setSelectedDiffPath(path);
    setCenterMode("diff");
  }

  async function handleSend(text: string) {
    const trimmed = text.trim();
    if (!trimmed) {
      return;
    }
    if (activeThreadId && threadStatusById[activeThreadId]?.isReviewing) {
      return;
    }
    if (activeWorkspace && !activeWorkspace.connected) {
      await connectWorkspace(activeWorkspace);
    }
    if (trimmed.startsWith("/review")) {
      await startReview(trimmed);
      return;
    }
    await sendUserMessage(trimmed);
  }

  return (
    <div className="app">
      <div className="drag-strip" id="titlebar" />
      <Sidebar
        workspaces={workspaces}
        threadsByWorkspace={threadsByWorkspace}
        threadStatusById={threadStatusById}
        activeWorkspaceId={activeWorkspaceId}
        activeThreadId={activeThreadId}
        onAddWorkspace={handleAddWorkspace}
        onSelectWorkspace={(workspaceId) => {
          exitDiffView();
          setActiveWorkspaceId(workspaceId);
        }}
        onConnectWorkspace={connectWorkspace}
        onAddAgent={handleAddAgent}
        onSelectThread={(workspaceId, threadId) => {
          exitDiffView();
          setActiveWorkspaceId(workspaceId);
          setActiveThreadId(threadId, workspaceId);
        }}
        onDeleteThread={(workspaceId, threadId) => {
          removeThread(workspaceId, threadId);
        }}
      />

      <section className="main">
        {!activeWorkspace && (
          <Home
            onOpenProject={handleAddWorkspace}
            onAddWorkspace={handleAddWorkspace}
            onCloneRepository={() => {}}
          />
        )}

        {activeWorkspace && (
          <>
            <div className="main-topbar">
              <div className="main-topbar-left">
                {centerMode === "diff" && (
                  <button
                    className="ghost icon-button"
                    onClick={() => {
                      setCenterMode("chat");
                      setSelectedDiffPath(null);
                    }}
                    aria-label="Back to chat"
                  >
                    <span aria-hidden>‹</span>
                  </button>
                )}
                <MainHeader
                  workspace={activeWorkspace}
                  branchName={gitStatus.branchName || "unknown"}
                />
              </div>
              <div className="actions">
                {hasDebugAlerts && (
                  <button
                    className="ghost icon-button"
                    onClick={() => setDebugOpen((prev) => !prev)}
                    aria-label="Debug"
                  >
                    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
                      <path
                        d="M9 7.5V6.5a3 3 0 0 1 6 0v1"
                        stroke="currentColor"
                        strokeWidth="1.4"
                        strokeLinecap="round"
                      />
                      <rect
                        x="7"
                        y="7.5"
                        width="10"
                        height="9"
                        rx="3"
                        stroke="currentColor"
                        strokeWidth="1.4"
                      />
                      <path
                        d="M4 12h3m10 0h3M6 8l2 2m8-2-2 2M6 16l2-2m8 2-2-2"
                        stroke="currentColor"
                        strokeWidth="1.4"
                        strokeLinecap="round"
                      />
                      <circle cx="10" cy="12" r="0.8" fill="currentColor" />
                      <circle cx="14" cy="12" r="0.8" fill="currentColor" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            <div className="content">
              {centerMode === "diff" ? (
                <GitDiffViewer
                  diffs={gitDiffs}
                  selectedPath={selectedDiffPath}
                  isLoading={isDiffLoading}
                  error={diffError}
                />
              ) : (
                <Messages
                  items={activeItems}
                  isThinking={
                    activeThreadId
                      ? threadStatusById[activeThreadId]?.isProcessing ?? false
                      : false
                  }
                />
              )}
            </div>

            <div className="right-panel">
              <GitDiffPanel
                branchName={gitStatus.branchName || "unknown"}
                totalAdditions={gitStatus.totalAdditions}
                totalDeletions={gitStatus.totalDeletions}
                fileStatus={fileStatus}
                error={gitStatus.error}
                files={gitStatus.files}
                selectedPath={selectedDiffPath}
                onSelectFile={handleSelectDiff}
              />
              <Approvals approvals={approvals} onDecision={handleApprovalDecision} />
            </div>

            {centerMode === "chat" && (
              <Composer
                onSend={handleSend}
                disabled={
                  activeThreadId
                    ? threadStatusById[activeThreadId]?.isReviewing ?? false
                    : false
                }
                models={models}
                selectedModelId={selectedModelId}
                onSelectModel={setSelectedModelId}
                reasoningOptions={reasoningOptions}
                selectedEffort={selectedEffort}
                onSelectEffort={setSelectedEffort}
                accessMode={accessMode}
                onSelectAccessMode={setAccessMode}
                skills={skills}
              />
            )}
            <DebugPanel
              entries={debugEntries}
              isOpen={debugOpen}
              onToggle={() => setDebugOpen((prev) => !prev)}
              onClear={clearDebugEntries}
              onCopy={handleCopyDebug}
            />
          </>
        )}
      </section>
    </div>
  );
}

export default App;
