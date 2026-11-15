// The connected powers PLN offers a household (SPEC 2.2 step 3), as the
// select lists them. Choosing one sets two inputs at once: `connectedVa`
// and `subsidised`.
//
// These are the choices a person can make, not prices. The tariff for each
// is looked up by the engine in the assumption set (SPEC 3.1).
//
// 450 VA and 900 VA each come in a subsidised form; 900 VA also in a
// non-subsidised one, so the "900" appears twice with different meanings.

export interface PowerChoice {
  /** Stable id used as the <option> value, such as "900-subsidised". */
  id: string;
  connectedVa: number;
  subsidised: boolean;
}

// Powers from 1,300 VA up, all non-subsidised. The last four are the larger
// residential sizes PLN sells; SPEC says only "and larger", so this list of
// them is listed in SPEC 2.2 step 3.
const NON_SUBSIDISED_VA = [
  900, 1300, 2200, 3500, 4400, 5500, 6600, 7700, 10600, 11000, 13200, 16500,
];

export const POWER_CHOICES: PowerChoice[] = [
  { id: "450-subsidised", connectedVa: 450, subsidised: true },
  { id: "900-subsidised", connectedVa: 900, subsidised: true },
  ...NON_SUBSIDISED_VA.map((va) => ({
    id: String(va),
    connectedVa: va,
    subsidised: false,
  })),
];

/** The choice matching what the draft holds, or undefined while none is made. */
export function findPowerChoice(
  connectedVa: number | null,
  subsidised: boolean,
): PowerChoice | undefined {
  return POWER_CHOICES.find(
    (choice) =>
      choice.connectedVa === connectedVa && choice.subsidised === subsidised,
  );
}

export function findPowerChoiceById(id: string): PowerChoice | undefined {
  return POWER_CHOICES.find((choice) => choice.id === id);
}

/** True only for a pair the select offers: 2,200 VA subsidised is not one. */
export function isOfferedPower(connectedVa: number, subsidised: boolean): boolean {
  return findPowerChoice(connectedVa, subsidised) !== undefined;
}
