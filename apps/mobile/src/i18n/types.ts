import type { fr } from "./fr";

type Widen<T> = T extends string ? string : { [K in keyof T]: Widen<T[K]> };

/** French is the reference shape; every other catalogue must have the same keys. */
export type Messages = Widen<typeof fr>;

export interface PluralForms {
  one: string;
  other: string;
}

type Join<K, P> = K extends string ? (P extends string ? `${K}.${P}` : never) : never;
type Paths<T> = T extends string
  ? never
  : T extends PluralForms
    ? never
    : { [K in keyof T & string]: T[K] extends string ? K : T[K] extends PluralForms ? never : Join<K, Paths<T[K]>> }[keyof T &
        string];
type PluralPaths<T> = T extends string
  ? never
  : { [K in keyof T & string]: T[K] extends PluralForms ? K : T[K] extends string ? never : Join<K, PluralPaths<T[K]>> }[keyof T &
      string];

export type MessageKey = Paths<Messages>;
export type PluralKey = PluralPaths<Messages>;
