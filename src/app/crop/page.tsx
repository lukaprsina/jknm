"use client";

import type { ThumbnailType } from "~/lib/validators";
import { ImageSelector } from "../uredi/[draft_id]/image-selector";
import { useState } from "react";

export default function Page() {
  const [image, setImage] = useState<ThumbnailType | undefined>(undefined);

  return (
    <>
      <p>Image selector</p>
      <ImageSelector
        image={image}
        setImage={(current) => {
          setImage(current);
        }}
      />
    </>
  );
}
