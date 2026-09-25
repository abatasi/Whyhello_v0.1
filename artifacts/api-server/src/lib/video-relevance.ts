type VideoSignal = {
  signalType: string;
  mediaType: string | null;
  title: string;
  description: string | null;
  quotable?: { quote: string } | undefined;
};

const SPORTS_HIGHLIGHT_TITLE =
  /\b(?:touchdown|football|sports? highlights?|one[\s-]?handed\s+(?:td|touchdown|catch|reception)|basketball dunk|soccer goal|hockey goal|game[\s-]winning goal)\b/i;
const BUSINESS_EVIDENCE =
  /\b(?:financial planning|wealth management|advis(?:or|er|ory)|investment|business|client|succession|fiduciary)\b/i;

/**
 * An uncorroborated sports highlight cannot be treated as evidence of the
 * contact's professional perspective just because their name or "TD" appears
 * in the title. The title can refer to a different person or to a touchdown.
 */
export function unrelatedSportsVideo(signal: VideoSignal): {
  score: number;
  description: string;
  matchedHqSignals: string[];
} | null {
  if (signal.signalType !== "personal" || !["video", "youtube", "youtube_video"].includes(signal.mediaType ?? "")) return null;
  if (!SPORTS_HIGHLIGHT_TITLE.test(signal.title)) return null;
  const description = signal.description?.trim() ?? "";
  const verifiedContext = [description, signal.quotable?.quote ?? ""].filter(
    text => text && !/^(?:n\/a|none|unknown)$/i.test(text)
      && !/\b(?:no|not|non)[\s-]+(?:substantive[\s-]+)?business\b/i.test(text),
  );
  if (verifiedContext.some(text => BUSINESS_EVIDENCE.test(text))) return null;
  return {
    score: 10,
    description: `This video ("${signal.title}") appears to be a sports highlight, not verified professional content from the contact. It supplies no reliable connection to the seller's offering; at most it is a personal-interest cue, not an outreach trigger.`,
    matchedHqSignals: [],
  };
}