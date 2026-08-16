import { LayoutDashboard, TableIcon } from "lucide-react";
import { Button } from "~/components/ui/button";
import { ButtonGroup } from "~/components/ui/button-group";
import {
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
		<div className="flex flex-col gap-2">
			<div className="flex w-full items-center justify-between gap-4">
				<TimelineRefinement />
			</div>
			<div className="flex flex-col gap-2 lg:flex-row lg:items-center">
				<div className="flex items-center gap-2 lg:flex-3">
					<MySearchBox2 />
				</div>
				<div className="flex flex-col gap-2 min-[500px]:flex-row min-[500px]:items-center">
					<div className="flex flex-1 items-center gap-2">
						<AuthorRefinement />
					</div>
					<div className="flex items-center gap-2">
						<MySortBy />
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
				</div>
			</div>
		</div>
	);
}
