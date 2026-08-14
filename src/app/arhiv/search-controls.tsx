import { TabsList, TabsTrigger } from "@radix-ui/react-tabs";
import { LayoutDashboard, TableIcon } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
	AuthorRefinement,
	CustomClearRefinements,
	MySearchBox2,
	MySortBy,
	TimelineRefinement,
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
					<AuthorRefinement />
					{activeTab === "card" && <MySortBy />}
					<TabsList>
						<TabsTrigger value="card" asChild>
							<Button variant="ghost" size="icon">
								<LayoutDashboard />
							</Button>
						</TabsTrigger>
						<TabsTrigger value="table" asChild>
							<Button variant="ghost" size="icon">
								<TableIcon />
							</Button>
						</TabsTrigger>
					</TabsList>
				</div>
			</div>
			<div className="flex w-full items-center justify-end gap-6">
				<CustomClearRefinements />
			</div>
			<div className="flex w-full items-center justify-between gap-4">
				<TimelineRefinement />
			</div>
		</div>
	);
}
