import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// The shadcn-svelte class-merge helper: resolves conditional class expressions
// (clsx) and de-dupes conflicting Tailwind utilities (twMerge). Used by every
// generated component in $lib/components/ui.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Ref/child prop helpers the generated shadcn-svelte components import from here.
// (The CLI normally emits these into utils.ts; kept in sync manually.)
export type WithElementRef<T, U extends HTMLElement = HTMLElement> = T & {
  ref?: U | null;
};

export type WithoutChild<T> = T extends { child?: any } ? Omit<T, "child"> : T;

export type WithoutChildren<T> = T extends { children?: any }
  ? Omit<T, "children">
  : T;

export type WithoutChildrenOrChild<T> = WithoutChildren<WithoutChild<T>>;
