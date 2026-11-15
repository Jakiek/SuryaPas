"use client";

import { useId, useState, type KeyboardEvent } from "react";
import { useTranslations } from "next-intl";
import type { Place } from "@/lib/geocoding/photon";
import { useAddressSearch } from "./useAddressSearch";

// The address search of step 1, built as an ARIA combobox: a text box that
// owns a list of options. Keyboard use: type, press the down arrow to walk
// the list, Enter to choose. It is the full keyboard path of the step.

export function AddressSearch({
  initialText,
  onChoose,
}: {
  initialText: string;
  onChoose: (place: Place) => void;
}) {
  const t = useTranslations("location.search");
  const id = useId();
  const listId = `${id}-list`;
  const statusId = `${id}-status`;
  const helpId = `${id}-help`;

  // What is in the box, and what is being searched. They differ after a
  // choice: the box shows the chosen address, but it must not be searched
  // again and offered back as a list.
  const [text, setText] = useState(initialText);
  const [query, setQuery] = useState(initialText);
  const [open, setOpen] = useState(initialText.trim().length > 0);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [chosenLabel, setChosenLabel] = useState<string | null>(null);

  const { status, places } = useAddressSearch(query);
  const listVisible = open && places.length > 0;

  function choose(place: Place) {
    setText(place.label);
    setOpen(false);
    setActiveIndex(-1);
    setChosenLabel(place.label);
    onChoose(place);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      // Enter must never submit the flow's form from here: that would move
      // on to the next step while the user is still choosing an address.
      event.preventDefault();
      if (!listVisible) return;
      choose(places[activeIndex >= 0 ? activeIndex : 0]);
    } else if (event.key === "ArrowDown" && places.length > 0) {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((index) => (index + 1) % places.length);
    } else if (event.key === "ArrowUp" && listVisible) {
      event.preventDefault();
      setActiveIndex((index) => (index <= 0 ? places.length - 1 : index - 1));
    } else if (event.key === "Escape" && listVisible) {
      event.preventDefault();
      setOpen(false);
      setActiveIndex(-1);
    }
  }

  // One line that says what the search is doing. Screen readers hear it too.
  const statusText =
    chosenLabel !== null && !open
      ? t("chosen", { label: chosenLabel })
      : status === "searching"
        ? t("searching")
        : status === "found"
          ? t("found", { count: places.length })
          : status === "none"
            ? t("none")
            : status === "unavailable"
              ? t("unavailable")
              : "";

  return (
    <div>
      <label htmlFor={id} className="block text-[19px] font-extrabold tracking-[-0.01em]">
        {t("label")}
      </label>
      <p id={helpId} className="pt-0.5 text-sm text-soft">
        {t("help")}
      </p>

      <div className="mt-3 flex min-h-field items-stretch border-heavy border-night bg-paper text-night focus-within:outline-[3px] focus-within:outline-offset-[3px] focus-within:outline-fg">
        <input
          id={id}
          type="text"
          role="combobox"
          aria-expanded={listVisible}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={listVisible && activeIndex >= 0 ? `${id}-option-${activeIndex}` : undefined}
          aria-describedby={`${helpId} ${statusId}`}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="search"
          placeholder={t("placeholder")}
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setQuery(event.target.value);
            setOpen(true);
            setActiveIndex(-1);
            setChosenLabel(null);
          }}
          onKeyDown={handleKeyDown}
          className="min-w-0 flex-1 bg-transparent px-4 text-[17px] font-semibold placeholder:font-medium placeholder:text-ink-soft focus-visible:outline-none"
        />
      </div>

      {/* The results: full-width rows divided by hairlines, no cards. */}
      <ul
        id={listId}
        role="listbox"
        aria-label={t("results")}
        hidden={!listVisible}
        className="border-heavy border-t-0 border-night bg-paper"
      >
        {places.map((place, index) => (
          <li
            key={`${place.lat},${place.lon},${place.label}`}
            id={`${id}-option-${index}`}
            role="option"
            aria-selected={index === activeIndex}
            // mousedown, not click: the input would otherwise lose focus and
            // close the list before the click landed.
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => choose(place)}
            className={
              "flex min-h-11 cursor-pointer items-center border-t border-rule px-4 py-2 text-[16px] font-semibold first:border-t-0 " +
              (index === activeIndex ? "bg-night text-paper" : "hover:bg-sun")
            }
          >
            {place.label}
          </li>
        ))}
      </ul>

      <p id={statusId} role="status" className="mt-2.5 min-h-6 text-sm text-soft">
        {statusText}
      </p>
    </div>
  );
}
