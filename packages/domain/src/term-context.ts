export type TermContextInput = {
  termId?: string;
  termTitle?: string;
  termShortTitle?: string;
};

export const EMPTY_TERM_CONTEXT = {
  termId: "",
  termTitle: "",
  termShortTitle: "",
};

export function resolveTermContext(termContext?: TermContextInput | null) {
  return {
    termId: termContext?.termId ?? "",
    termTitle: termContext?.termTitle ?? "",
    termShortTitle: termContext?.termShortTitle ?? "",
  };
}