// Consent state management — used by the cookie banner and registration flow.

export interface ConsentState {
  privacyPolicyVersion: number;
  consentedCategories: string[];
  acceptedAt: string;
}

function getStored(): string | null {
  try {
    return localStorage.getItem("arqvertice_consent");
  } catch {
    return null;
  }
}

export function getConsentState(): ConsentState {
  const raw = getStored();
  if (!raw) {
    return {
      privacyPolicyVersion: 1,
      consentedCategories: [],
      acceptedAt: "",
    };
  }
  try {
    return { ...JSON.parse(raw), consentedCategories: Array.isArray(JSON.parse(raw).consentedCategories) ? JSON.parse(raw).consentedCategories : [] };
  } catch {
    return { privacyPolicyVersion: 1, consentedCategories: [], acceptedAt: "" };
  }
}

export function setConsentState(state: Omit<ConsentState, "privacyPolicyVersion"> & { privacyPolicyVersion: number }) {
  try {
    localStorage.setItem("arqvertice_consent", JSON.stringify(state));
  } catch {
    // Non-fatal: the server-side registration is the source of truth.
  }
}

export function hasConsent(): boolean {
  const state = getConsentState();
  return state.acceptedAt.length > 0 && state.consentGiven !== false;
}
