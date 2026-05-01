export interface HomepageEvalCheck {
  id: string;
  label: string;
  passed: boolean;
}

export interface HomepageEvalReport {
  scenario: string;
  passed: boolean;
  checks: HomepageEvalCheck[];
}

interface EvaluateHomepageScenarioOptions {
  scenario: string;
  container: HTMLElement;
  expectIntro: boolean;
}

export function evaluateHomepageScenario({
  scenario,
  container,
  expectIntro,
}: EvaluateHomepageScenarioOptions): HomepageEvalReport {
  const main = container.querySelector("main");
  const viewportStage = container.querySelector('[data-shell-viewport-stage="true"]');
  const footer = container.querySelector("footer");
  const chatContainer = container.querySelector('[data-chat-container-mode="embedded"]');
  const messageViewport = container.querySelector('[data-chat-message-viewport="true"]');
  const composerRow = container.querySelector('[data-chat-composer-row="true"]');
  const intro = container.querySelector('[data-homepage-chat-intro="true"]');
  const legacyStage = container.querySelector('[data-homepage-chat-stage="true"]');
  const serviceChips = container.querySelectorAll('[data-homepage-service-chip="true"]');

  const checks: HomepageEvalCheck[] = [
    {
      id: "chat-first-main",
      label: "home route renders the embedded chat directly inside main",
      passed: Boolean(main && chatContainer && main.contains(chatContainer)),
    },
    {
      id: "footer-below-fold",
      label: "footer remains outside the viewport stage",
      passed: Boolean(viewportStage && footer && !viewportStage.contains(footer)),
    },
    {
      id: "separate-composer-row",
      label: "message viewport and composer row remain separate",
      passed: Boolean(messageViewport && composerRow && !messageViewport.contains(composerRow)),
    },
    {
      id: "no-legacy-route-hero",
      label: "route no longer renders a separate homepage hero wrapper",
      passed: legacyStage == null,
    },
    {
      id: "intro-placement",
      label: expectIntro
        ? "hero intro is either omitted or rendered inside the chat surface"
        : "active conversation state hides the homepage intro",
      passed: expectIntro
        ? intro == null || Boolean(messageViewport && chatContainer?.contains(intro) && serviceChips.length >= 3)
        : intro == null,
    },
  ];

  return {
    scenario,
    passed: checks.every((check) => check.passed),
    checks,
  };
}
