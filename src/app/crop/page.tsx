import { Shell } from "~/components/shell";
import { TestCrop } from "./test-crop";
import { page_variants } from "~/lib/page-variants";

export default function Crop() {
  return (
    <Shell>
      <div className={page_variants()}>
        <p>Image selector</p>
        <TestCrop />
      </div>
    </Shell>
  );
}
