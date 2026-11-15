import type { ReactNode } from "react";
import { Label } from "@/components";

type SpecimenProps = {
  // The component's name, shown in small capitals above it.
  name: string;
  children: ReactNode;
};

// One labelled example on the review page.
export function Specimen({ name, children }: SpecimenProps) {
  return (
    <div className="mt-8 first:mt-0">
      <Label as="p" className="mb-2 text-soft">
        {name}
      </Label>
      {children}
    </div>
  );
}
