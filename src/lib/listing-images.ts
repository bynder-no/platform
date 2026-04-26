export const LISTING_IMAGE_MAX_FILES = 3;
export const LISTING_IMAGE_SLOT_NAMES = [
  "image_slot_0",
  "image_slot_1",
  "image_slot_2",
] as const;

export const LISTING_IMAGE_ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function safeFilenamePart(filename: string) {
  return filename
    .toLowerCase()
    .replace(/[^a-z0-9.\-_]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^\.+/, "")
    .slice(0, 80);
}

export function buildListingImageStoragePath(
  userId: string,
  listingId: string,
  originalFilename: string,
) {
  const sanitizedName = safeFilenamePart(originalFilename) || "image";
  const uniquePrefix = `${Date.now()}-${crypto.randomUUID()}`;
  return `${userId}/${listingId}/${uniquePrefix}-${sanitizedName}`;
}

export function validateListingImageFiles(files: File[]) {
  if (files.length > LISTING_IMAGE_MAX_FILES) {
    return `Du kan laste opp maks ${LISTING_IMAGE_MAX_FILES} bilder.`;
  }

  for (const file of files) {
    if (!LISTING_IMAGE_ALLOWED_TYPES.has(file.type)) {
      return "Kun bilder i formatene JPG, PNG eller WEBP er tillatt.";
    }
  }

  return null;
}

export function normalizeListingImageUrls(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is string => typeof item === "string")
    .map((value) => value.trim())
    .filter((value) => value !== "");
}

export function getListingImageFilesFromFormData(formData: FormData): File[] {
  const slotFiles = LISTING_IMAGE_SLOT_NAMES.map((name) => formData.get(name)).filter(
    (value): value is File => value instanceof File && value.size > 0,
  );
  if (slotFiles.length > 0) {
    return slotFiles;
  }
  return formData
    .getAll("images")
    .filter((value): value is File => value instanceof File && value.size > 0);
}

export function getListingImageFilesBySlotFromFormData(
  formData: FormData,
): Array<File | null> {
  return LISTING_IMAGE_SLOT_NAMES.map((name) => {
    const value = formData.get(name);
    if (value instanceof File && value.size > 0) {
      return value;
    }
    return null;
  });
}

export function getExistingImageUrlsBySlotFromFormData(formData: FormData): string[] {
  return [0, 1, 2]
    .map((index) => String(formData.get(`existing_image_slot_${index}`) ?? "").trim())
    .filter((value) => value !== "");
}
