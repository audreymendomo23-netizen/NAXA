"use client";

export type ClientProfileVerificationData = {
  address?: string | null;
  phone?: string | null;
  photo?: string | null;
};

/** Source unique de vérité pour l'affichage de la coche du profil client. */
export function isProfileVerified(user: ClientProfileVerificationData): boolean {
  return Boolean(user.address?.trim() && user.phone?.trim() && user.photo?.trim());
}
