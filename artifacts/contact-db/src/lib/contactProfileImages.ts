import agnesKrauseProfileImg from "@assets/agnes_krause_profile.png";

const CONTACT_PROFILE_IMAGES: Record<number, string> = {
  3836: agnesKrauseProfileImg,
};

export function getContactProfileImage(contactId: number): string | undefined {
  return CONTACT_PROFILE_IMAGES[contactId];
}