export const contactRoles = [
  "Una famiglia",
  "Un volontario",
  "Un professionista / collaboratore",
  "Un’associazione / realtà del territorio",
  "Altro",
] as const;

export type ContactMessage = {
  name: string;
  email: string;
  phone: string;
  role: string;
  message: string;
  privacy: true;
};

export const isContactEmail = (value: string) =>
  value.length <= 254 && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value);

export function validateContact(value: unknown): ContactMessage | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  const read = (key: string) => typeof input[key] === "string" ? input[key].trim() : "";
  const name = read("name"), email = read("email"), phone = read("phone");
  const role = read("role"), message = read("message");
  if (!name || name.length > 120 || /[\r\n\x00-\x1f]/.test(name) ||
      !isContactEmail(email) || phone.length > 40 || (phone && !/^[+\d\s().-]+$/.test(phone)) ||
      !contactRoles.some((option) => option === role) || message.length > 5000 ||
      input.privacy !== true) return null;
  return { name, email, phone, role, message, privacy: true };
}
