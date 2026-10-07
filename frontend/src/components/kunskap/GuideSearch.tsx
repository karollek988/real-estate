"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SearchIcon } from "@/components/icons";
import { LIBRARY_ANCHOR } from "@/lib/content/paths";

/**
 * The hub's search field. Searching filters the list further down the page
 * (?q=...#guider) - the list does the matching, so this only sets the
 * address. Without JavaScript it is a plain GET form and does the same.
 */
export function GuideSearch({ action, placeholder, label }: { action: string; placeholder: string; label: string }) {
  return (
    <Suspense fallback={<SearchForm action={action} placeholder={placeholder} label={label} initialQuery="" />}>
      <SearchFormFromAddress action={action} placeholder={placeholder} label={label} />
    </Suspense>
  );
}

function SearchFormFromAddress(props: { action: string; placeholder: string; label: string }) {
  const query = useSearchParams()?.get("q") ?? "";
  // Remount when the address changes (a cleared search), so the field follows it.
  return <SearchForm key={query} {...props} initialQuery={query} />;
}

function SearchForm({ action, placeholder, label, initialQuery }: { action: string; placeholder: string; label: string; initialQuery: string }) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);

  return (
    <form
      role="search"
      action={action}
      method="get"
      onSubmit={(e) => {
        e.preventDefault();
        const q = query.trim();
        router.push(`${action}${q ? `?q=${encodeURIComponent(q)}` : ""}#${LIBRARY_ANCHOR}`);
      }}
    >
      <label htmlFor="guide-search" className="sr-only">
        {label}
      </label>
      <div className="flex items-center gap-2 rounded-[18px] border border-ka-line-strong bg-white p-1.5 pl-4 shadow-ka-card transition focus-within:border-ka-green-700 focus-within:ring-4 focus-within:ring-ka-green-700/15">
        <SearchIcon className="h-5 w-5 shrink-0 text-ka-muted" strokeWidth={2} />
        <input
          id="guide-search"
          name="q"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="off"
          enterKeyHint="search"
          placeholder={placeholder}
          className="h-12 min-w-0 flex-1 bg-transparent text-[16px] text-ka-ink outline-none placeholder:text-ka-muted/80"
        />
        <button
          type="submit"
          className="h-12 shrink-0 cursor-pointer rounded-[13px] bg-ka-green-900 px-5 text-[15.5px] font-semibold text-white transition hover:bg-ka-green-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ka-green-700 focus-visible:ring-offset-2 sm:px-7"
        >
          Sök
        </button>
      </div>
    </form>
  );
}
