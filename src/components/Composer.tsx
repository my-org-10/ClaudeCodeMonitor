import { useCallback, useState } from "react";

type ComposerProps = {
  onSend: (text: string) => void;
  disabled?: boolean;
  models: { id: string; displayName: string; model: string }[];
  selectedModelId: string | null;
  onSelectModel: (id: string) => void;
  reasoningOptions: string[];
  selectedEffort: string | null;
  onSelectEffort: (effort: string) => void;
  accessMode: "read-only" | "current" | "full-access";
  onSelectAccessMode: (mode: "read-only" | "current" | "full-access") => void;
  skills: { name: string; description?: string }[];
};

export function Composer({
  onSend,
  disabled = false,
  models,
  selectedModelId,
  onSelectModel,
  reasoningOptions,
  selectedEffort,
  onSelectEffort,
  accessMode,
  onSelectAccessMode,
  skills,
}: ComposerProps) {
  const [text, setText] = useState("");

  const handleSend = useCallback(() => {
    if (disabled) {
      return;
    }
    const trimmed = text.trim();
    if (!trimmed) {
      return;
    }
    onSend(trimmed);
    setText("");
  }, [disabled, onSend, text]);

  const handleSelectSkill = useCallback((name: string) => {
    const snippet = `$${name}`;
    setText((prev) => {
      const trimmed = prev.trim();
      if (!trimmed) {
        return snippet + " ";
      }
      if (trimmed.includes(snippet)) {
        return prev;
      }
      return `${prev.trim()} ${snippet} `;
    });
  }, []);

  return (
    <footer className={`composer${disabled ? " is-disabled" : ""}`}>
      <div className="composer-input">
        <textarea
          placeholder={
            disabled
              ? "Review in progress. Chat will re-enable when it completes."
              : "Ask Codex to do something..."
          }
          value={text}
          onChange={(event) => setText(event.target.value)}
          disabled={disabled}
          onKeyDown={(event) => {
            if (disabled) {
              return;
            }
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              handleSend();
            }
          }}
        />
        <button
          className="composer-send"
          onClick={handleSend}
          disabled={disabled}
        >
          Send
        </button>
      </div>
      <div className="composer-bar">
        <div className="composer-meta">
          <div className="composer-select-wrap">
            <span className="composer-icon" aria-hidden>
              <svg viewBox="0 0 24 24" fill="none">
                <path
                  d="M7 8V6a5 5 0 0 1 10 0v2"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
                <rect
                  x="4.5"
                  y="8"
                  width="15"
                  height="11"
                  rx="3"
                  stroke="currentColor"
                  strokeWidth="1.4"
                />
                <circle cx="9" cy="13" r="1" fill="currentColor" />
                <circle cx="15" cy="13" r="1" fill="currentColor" />
                <path
                  d="M9 16h6"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            <select
              className="composer-select composer-select--model"
              aria-label="Model"
              value={selectedModelId ?? ""}
              onChange={(event) => onSelectModel(event.target.value)}
              disabled={disabled}
            >
              {models.length === 0 && <option value="">No models</option>}
              {models.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.displayName || model.model}
                </option>
              ))}
            </select>
          </div>
          <div className="composer-select-wrap">
            <span className="composer-icon" aria-hidden>
              <svg viewBox="0 0 24 24" fill="none">
                <path
                  d="M8.5 4.5a3.5 3.5 0 0 0-3.46 4.03A4 4 0 0 0 6 16.5h2"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
                <path
                  d="M15.5 4.5a3.5 3.5 0 0 1 3.46 4.03A4 4 0 0 1 18 16.5h-2"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
                <path
                  d="M9 12h6"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
                <path
                  d="M12 12v6"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            <select
              className="composer-select composer-select--effort"
              aria-label="Thinking mode"
              value={selectedEffort ?? ""}
              onChange={(event) => onSelectEffort(event.target.value)}
              disabled={disabled}
            >
              {reasoningOptions.length === 0 && (
                <option value="">Default</option>
              )}
              {reasoningOptions.map((effort) => (
                <option key={effort} value={effort}>
                  {effort}
                </option>
              ))}
            </select>
          </div>
          <div className="composer-select-wrap">
            <span className="composer-icon" aria-hidden>
              <svg viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 4l7 3v5c0 4.5-3 7.5-7 8-4-0.5-7-3.5-7-8V7l7-3z"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinejoin="round"
                />
                <path
                  d="M9.5 12.5l1.8 1.8 3.7-4"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <select
              className="composer-select composer-select--approval"
              aria-label="Agent access"
              disabled={disabled}
              value={accessMode}
              onChange={(event) =>
                onSelectAccessMode(
                  event.target.value as "read-only" | "current" | "full-access",
                )
              }
            >
              <option value="read-only">Read only</option>
              <option value="current">Current</option>
              <option value="full-access">Full access</option>
            </select>
          </div>
          <div className="composer-select-wrap">
            <span className="composer-icon" aria-hidden>
              <svg viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 4v5m0 6v5M4 12h5m6 0h5"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
                <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.4" />
              </svg>
            </span>
            <select
              className="composer-select composer-select--skill"
              aria-label="Skills"
              onChange={(event) => {
                const value = event.target.value;
                if (value) {
                  handleSelectSkill(value);
                  event.target.value = "";
                }
              }}
              disabled={disabled}
            >
              <option value="">Skill</option>
              {skills.map((skill) => (
                <option key={skill.name} value={skill.name}>
                  {skill.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </footer>
  );
}
