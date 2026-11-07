// GCC — class name helper. Merges conditional class names with clsx.
import clsx, { type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}
