export type LinkedInContactIdentity = {
  firstName: string;
  lastName: string;
  linkedinUrl: string | null;
};

function compactSlug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function linkedinAuthorSlug(url: string | null): string | null {
  const match = url?.match(/linkedin\.com\/posts\/([^_/?#]+)/i);
  return match?.[1]?.toLowerCase() ?? null;
}

export function linkedinProfileSlug(url: string | null): string | null {
  const match = url?.match(/linkedin\.com\/in\/([^/?#]+)/i);
  return match?.[1]?.toLowerCase().replace(/\/$/, "") ?? null;
}

/**
 * LinkedIn post URLs use the author's public handle, which often differs from
 * the profile slug and may include a brand suffix (for example,
 * agneskrausewealth vs. agnes-krause-a03b838).
 */
export function isContactAuthoredLinkedInSignal(
  signal: { title: string; url: string | null },
  contact: LinkedInContactIdentity,
): boolean {
  const nameSlug = compactSlug(`${contact.firstName}${contact.lastName}`);
  const profileSlug = linkedinProfileSlug(contact.linkedinUrl);
  const authorSlug = linkedinAuthorSlug(signal.url);
  const authorCompact = authorSlug ? compactSlug(authorSlug) : "";

  if (
    authorCompact
    && nameSlug.length >= 6
    && (
      authorCompact === nameSlug
      || authorCompact.startsWith(nameSlug)
      || (profileSlug && authorCompact === compactSlug(profileSlug))
    )
  ) {
    return true;
  }

  const title = signal.title.toLowerCase();
  const fullName = `${contact.firstName} ${contact.lastName}`.toLowerCase();
  return title === fullName
    || title.startsWith(`${fullName}'s post`)
    || title.startsWith(`${fullName} -`);
}