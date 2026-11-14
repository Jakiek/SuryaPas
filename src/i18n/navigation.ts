import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

// Locale-aware Link, redirect and router. Use these instead of next/link
// so links keep the current locale.
export const { Link, redirect, usePathname, useRouter } =
  createNavigation(routing);
