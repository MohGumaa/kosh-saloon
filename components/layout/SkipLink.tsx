import { getTranslations } from "next-intl/server";

/** Target id of the skip link; each layout renders exactly one `<main>` with it. */
export const MAIN_CONTENT_ID = "main-content";

/** First focusable element on the page: hidden until focused, then jumps to the main content. */
export async function SkipLink() {
  const t = await getTranslations("header");

  return (
    <a
      href={`#${MAIN_CONTENT_ID}`}
      className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground focus:shadow-lg focus:outline-none focus:ring-3 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
    >
      {t("skipToContent")}
    </a>
  );
}
