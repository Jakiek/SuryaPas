"use client";

import { createContext, useContext, type ReactNode } from "react";

// Lets the result screen know that the result on show was never saved, without
// changing the props the saved page gives it. Outside a provider (every saved
// result, and the example) the notice is null and everything is as before.
const UnsavedNoticeContext = createContext<ReactNode>(null);

export function UnsavedProvider({ notice, children }: { notice: ReactNode; children: ReactNode }) {
  return <UnsavedNoticeContext.Provider value={notice}>{children}</UnsavedNoticeContext.Provider>;
}

/** The "not saved" note to show at the top of the page, or null for a saved result. */
export function useUnsavedNotice(): ReactNode {
  return useContext(UnsavedNoticeContext);
}
