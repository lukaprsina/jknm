"use client";

import type { ThumbnailType } from "~/lib/validators";
import { ImageSelector } from "../uredi/[draft_id]/image-selector";
import { useState } from "react";

export function TestCrop() {
  const [image, setImage] = useState<ThumbnailType | undefined>(undefined);

  return (
    <ImageSelector
      image={image}
      setImage={(current) => {
        setImage(current);
      }}
    />
  );
}
