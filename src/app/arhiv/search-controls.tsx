import { TabsList, TabsTrigger } from "@radix-ui/react-tabs";
import { LayoutDashboard, TableIcon } from "lucide-react";
import {
  MySortBy,
  MyStats,
  CustomClearRefinements,
  TimelineRefinement,
  MySearchBox2,
} from "./components";

export function SearchControls({ activeTab }: { activeTab: "card" | "table" }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col items-center justify-between gap-2 sm:flex-row">
        {/* <MySearchBox /> */}
        {/* <SearchBox /> */}
        {/* <CustomSearchBox /> */}
        <MySearchBox2 />
        <div className="flex flex-col items-center justify-between gap-6 text-nowrap sm:flex-row">
          {activeTab === "card" && <MySortBy />}
          <TabsList>
            <TabsTrigger value="card">
              <LayoutDashboard />
            </TabsTrigger>
            <TabsTrigger value="table">
              <TableIcon />
            </TabsTrigger>
          </TabsList>
        </div>
      </div>
      <div className="flex w-full items-center justify-end gap-6">
        <MyStats />
        <CustomClearRefinements />
      </div>
      <div className="flex w-full items-center justify-between">
        <TimelineRefinement />
      </div>
    </div>
  );
}
