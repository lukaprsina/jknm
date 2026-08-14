import { LayoutDashboard, TableIcon } from "lucide-react";
import { Button } from "~/components/ui/button";
import { ButtonGroup } from "~/components/ui/button-group";
import {
	ActiveFilterChips,
	AuthorRefinement,
	MySearchBox2,
	MySortBy,
	TimelineRefinement,
} from "./components";

export function SearchControls({
	activeTab,
	onTabChange,
}: {
	activeTab: "card" | "table";
	onTabChange: (tab: "card" | "table") => void;
}) {
	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
				<div className="flex items-center gap-2">
					<MySearchBox2 />
					<ButtonGroup>
						<Button
							variant={activeTab === "card" ? "default" : "outline"}
							size="icon"
							aria-label="Prikaz kartic"
							onClick={() => onTabChange("card")}
						>
							<LayoutDashboard />
						</Button>
						<Button
							variant={activeTab === "table" ? "default" : "outline"}
							size="icon"
							aria-label="Prikaz tabele"
							onClick={() => onTabChange("table")}
						>
							<TableIcon />
						</Button>
					</ButtonGroup>
				</div>
				<div className="flex items-center gap-2">
					<AuthorRefinement />
					{activeTab === "card" && <MySortBy />}
				</div>
			</div>
			<div className="flex w-full items-center justify-between gap-4">
				<TimelineRefinement />
			</div>
			<ActiveFilterChips />
		</div>
	);
}
