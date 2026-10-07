/**
 * Texts used all over the site: the language switcher, the breadcrumbs, the closing call to action.
 *
 * HOW THESE FILES WORK (the same in every language folder):
 *   - The Swedish files in src/i18n/messages/sv are the master copy. A key exists here first.
 *   - Every other language has the same files with the same keys; copy a folder and translate the VALUES,
 *     never the keys. Anything left out is shown in Swedish.
 *   - {name} in a text is filled in by the code (a number, a name). Keep it, translated sentences move it
 *     wherever the grammar needs it. {count, plural, one {...} other {...}} picks a form by number.
 *   - <b>...</b> and <link>...</link> in a text are formatting the code turns into bold text or a link.
 */
const common = {
  languageSwitcher: {
    /** The label read out by screen readers for the language picker. */
    label: "Språk",
    /** Shown when the picker is a button: "Språk: Svenska". {language} is the current language's own name. */
    current: "Språk: {language}",
    /** Screen reader text when a language is available: "Visa sidan på English". */
    switchTo: "Visa sidan på {language}",
  },

  /** The trail at the top of a page ("Start > Kunskap > Blogg"). */
  breadcrumbs: {
    /** Screen reader name of the trail. */
    label: "Brödsmulor",
    /** The first step: the start page. */
    home: "Start",
  },

  /** The closing call to action at the end of most pages. A page may bring its own title and text; these are the default. */
  cta: {
    title: "Redo att se vad du faktiskt köper?",
    text: "Ladda upp en skärmdump av annonsen så tar vi fram underlaget. Det mesta är klart på några minuter.",
    createAnalysis: "Skapa analys",
    showMap: "Visa karta",
  },
};

export default common;
