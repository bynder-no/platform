export const TITLE_KORTSELGER = "Kortselger";
export const TITLE_PALITELIG_SELGER = "Pålitelig selger";
export const TITLE_SLAB_SPESIALIST = "Slab-spesialist";
export const TITLE_SEALED_SAMLER = "Sealed-samler";
export const TITLE_TOPPRATET = "Toppratet";

export const PROFILE_TITLE_OPTIONS = [
  TITLE_KORTSELGER,
  TITLE_PALITELIG_SELGER,
  TITLE_SLAB_SPESIALIST,
  TITLE_SEALED_SAMLER,
  TITLE_TOPPRATET,
] as const;

export type ProfileTitle = (typeof PROFILE_TITLE_OPTIONS)[number];

export const ALLOWED_ACTIVE_TITLES = new Set<string>(PROFILE_TITLE_OPTIONS);

export type TitleUnlockMap = Record<string, boolean>;
