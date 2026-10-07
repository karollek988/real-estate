import type messages from "./sv";

/** The shape of every language's texts: the Swedish ones are the master copy. */
export type Messages = typeof messages;

/** A language's texts, where anything left out is shown in Swedish: this is what lets a language be added bit by bit. */
export type DeepPartial<T> = { [K in keyof T]?: T[K] extends readonly unknown[] ? T[K] : T[K] extends object ? DeepPartial<T[K]> : T[K] };
