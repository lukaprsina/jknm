"use client";

import React, { useState } from "react";
import { MultiSelect } from "~/components/multi-select";
import { Cat, Dog, Fish, Rabbit, Turtle } from "lucide-react";

const frameworksList = [
  { value: "react", label: "React", icon: Turtle },
  { value: "angular", label: "Angular", icon: Cat },
  { value: "vue", label: "Vue", icon: Dog },
  { value: "svelte", label: "Svelte", icon: Rabbit },
  { value: "ember", label: "Ember", icon: Fish },
];

function Home() {
  const [selectedFrameworks, setSelectedFrameworks] = useState<string[]>([
    "react",
    "angular",
  ]);

  return (
    <div className="max-w-xl p-4">
      <h1 className="mb-4 text-2xl font-bold">Multi-Select Component</h1>
      <MultiSelect
        options={frameworksList}
        onValueChange={setSelectedFrameworks}
        defaultValue={selectedFrameworks}
        placeholder="Select frameworks"
        variant="inverted"
        animation={2}
        maxCount={3}
      />
      <div className="mt-4">
        <h2 className="text-xl font-semibold">Selected Frameworks:</h2>
        <ul className="list-inside list-disc">
          {selectedFrameworks.map((framework) => (
            <li key={framework}>{framework}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default Home;
