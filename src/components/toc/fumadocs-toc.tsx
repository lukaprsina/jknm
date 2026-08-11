"use client";

// Scroll-spy primitives ported from fumadocs-core (vendor/fumadocs,
// packages/core/src/toc.tsx, pinned commit 1a50aa38a). Markdown-agnostic --
// only consumes `TOCItemType[]` and `document.getElementById`. See
// docs/research/toc-fumadocs-rewrite.md for the source citations.
import {
	type ComponentProps,
	createContext,
	type ReactNode,
	type Ref,
	type RefCallback,
	type RefObject,
	use,
	useEffect,
	useEffectEvent,
	useMemo,
	useRef,
	useState,
} from "react";
import scrollIntoView from "scroll-into-view-if-needed";

export interface TOCItemType {
	title: ReactNode;
	url: string;
	depth: number;
}

export interface TOCItemInfo {
	id: string;
	active: boolean;
	/** last time the item was updated */
	t: number;
	/** currently active but not intersecting in viewport */
	fallback: boolean;
	original: TOCItemType;
}

function mergeRefs<T>(...refs: (Ref<T> | undefined)[]): RefCallback<T> {
	return (value) => {
		for (const ref of refs) {
			if (typeof ref === "function") {
				ref(value);
			} else if (ref != null) {
				ref.current = value;
			}
		}
	};
}

function isEqualShallow(a: unknown, b: unknown): boolean {
	if (a === b) return true;

	if (Array.isArray(a) && Array.isArray(b)) {
		return b.length === a.length && a.every((v, i) => isEqualShallow(v, b[i]));
	}

	return false;
}

const ObserverContext = createContext<Observer | null>(null);
const ScrollContext = createContext<RefObject<HTMLElement | null> | null>(null);

export interface AnchorProviderProps {
	toc: TOCItemType[];
	/** Only accept one active item at most. @defaultValue false */
	single?: boolean;
	children?: ReactNode;
}

export interface ScrollProviderProps {
	/** Scroll into the view of container when active */
	containerRef: RefObject<HTMLElement | null>;
	children?: ReactNode;
}

/** Optional: add auto-scroll to TOC items. */
export function ScrollProvider({
	containerRef,
	children,
}: ScrollProviderProps) {
	return <ScrollContext value={containerRef}>{children}</ScrollContext>;
}

export function AnchorProvider({
	toc,
	single = false,
	children,
}: AnchorProviderProps) {
	// The compiler forbids mutating a value returned from a hook, so `single`
	// is passed in at construction rather than assigned onto `observer`
	// afterward -- recreating the (rarely-changing) observer on a `single`
	// flip re-triggers the effects below, which rewire it from scratch.
	const observer = useMemo(() => new Observer(single), [single]);

	useEffect(() => {
		observer.setItems(toc);
	}, [observer, toc]);

	useEffect(() => {
		observer.watch({ threshold: 0.9 });
		return () => observer.unwatch();
	}, [observer]);

	return <ObserverContext value={observer}>{children}</ObserverContext>;
}

export interface TOCItemProps extends ComponentProps<"a"> {
	autoScroll?: boolean;
	onActiveChange?: (v: boolean) => void;
}

export function TOCItem({
	ref,
	onActiveChange = () => null,
	autoScroll = true,
	...props
}: TOCItemProps) {
	const id = props.href ? getItemId(props.href) : null;
	const containerRef = use(ScrollContext);
	const anchorRef = useRef<HTMLAnchorElement>(null);
	const observer = useObserver();
	const [active, setActive] = useState(() =>
		observer.items.some((item) => item.id === id && item.active),
	);

	useTOCListener(
		(items) => {
			const itemData = id ? items.find((item) => item.id === id) : null;

			if (itemData && itemData.active !== active) {
				setActive(itemData.active);
				onActiveChange(itemData.active);
				const anchor = anchorRef.current;
				const container = containerRef?.current;

				if (autoScroll && id && anchor && container) {
					let lastActive: TOCItemInfo | undefined;
					for (const item of items) {
						if (!item.active) continue;
						if (!lastActive || lastActive.t < item.t) {
							lastActive = item;
						}
					}

					if (lastActive?.id === id) {
						scrollIntoView(anchor, {
							behavior: "instant",
							block: "center",
							inline: "center",
							scrollMode: "always",
							boundary: container,
						});
					}
				}
			}
		},
		{ initial: true },
	);

	return <a ref={mergeRefs(anchorRef, ref)} data-active={active} {...props} />;
}

function useObserver() {
	const observer = use(ObserverContext);
	if (!observer) {
		throw new Error(
			"Component must be used under the <AnchorProvider /> component.",
		);
	}
	return observer;
}

export function useTOCListener(
	listener: ChangeListener,
	options: { initial?: boolean } = {},
) {
	const { initial = false } = options;
	const observer = useObserver();
	const callback = useEffectEvent(listener);

	useEffect(() => {
		if (initial) callback(observer.items, { initial: true });
		observer.listen(callback);
		return () => observer.unlisten(callback);
	}, [observer, initial]);
}

export function useTOCSelector<T>(
	select: (items: TOCItemInfo[]) => T,
	isEqual: (a: T, b: T) => boolean = isEqualShallow,
) {
	const observer = useObserver();
	const [value, setValue] = useState<T>(() => select(observer.items));
	useTOCListener((items) => {
		const next = select(items);
		if (!isEqual(value, next)) setValue(next);
	});

	return value;
}

/** The id of visible anchors */
export function useActiveAnchors(): string[] {
	return useTOCSelector((items) => {
		const out: string[] = [];
		for (const item of items) {
			if (item.active) out.push(item.id);
		}
		return out;
	});
}

function getItemId(url: string) {
	if (url.startsWith("#")) return url.slice(1);
	return null;
}

type ChangeListener = (
	items: TOCItemInfo[],
	opts: { initial: boolean },
) => void;

class Observer {
	items: TOCItemInfo[] = [];
	private observer: IntersectionObserver | null = null;
	private listeners = new Set<ChangeListener>();

	constructor(private single: boolean) {}

	listen(listener: ChangeListener) {
		this.listeners.add(listener);
	}

	unlisten(listener: ChangeListener) {
		this.listeners.delete(listener);
	}

	setItems(newItems: TOCItemType[]) {
		const observer = this.observer;
		if (observer) {
			for (const item of this.items) {
				const element = document.getElementById(item.id);
				if (!element) continue;
				observer.unobserve(element);
			}
		}

		const next: TOCItemInfo[] = [];
		for (const item of newItems) {
			const id = getItemId(item.url);
			if (!id) continue;

			next.push({ id, active: false, fallback: false, t: 0, original: item });
		}

		this.update(next);
		this.observeItems();
	}

	watch(options?: IntersectionObserverInit) {
		if (this.observer) return;

		this.observer = new IntersectionObserver(this.callback.bind(this), options);
		this.observeItems();
	}

	unwatch() {
		this.observer?.disconnect();
		this.observer = null;
	}

	private callback(entries: IntersectionObserverEntry[]) {
		if (entries.length === 0) return;

		let hasActive = false;
		const updated = this.items.map((item) => {
			const entry = entries.find((e) => e.target.id === item.id);
			let active = entry ? entry.isIntersecting : item.active && !item.fallback;
			if (this.single && hasActive) active = false;

			if (item.active !== active) {
				item = { ...item, t: Date.now(), active, fallback: false };
			}

			if (active) hasActive = true;
			return item;
		});

		const first_entry = entries[0];
		if (!hasActive && first_entry?.rootBounds) {
			const viewTop = first_entry.rootBounds.top;
			let min = Number.MAX_VALUE;
			let fallbackIdx = -1;

			for (let i = 0; i < updated.length; i++) {
				const item = updated[i];
				if (!item) continue;
				const element = document.getElementById(item.id);
				if (!element) continue;

				const d = Math.abs(viewTop - element.getBoundingClientRect().top);
				if (d < min) {
					fallbackIdx = i;
					min = d;
				}
			}

			const fallback_item = updated[fallbackIdx];
			if (fallback_item) {
				updated[fallbackIdx] = {
					...fallback_item,
					active: true,
					fallback: true,
					t: Date.now(),
				};
			}
		}

		this.update(updated);
	}

	private observeItems() {
		if (!this.observer) return;
		for (const item of this.items) {
			const element = document.getElementById(item.id);
			if (!element) continue;
			this.observer.observe(element);
		}
	}

	private update(next: TOCItemInfo[]) {
		this.items = next;
		for (const listener of this.listeners) listener(next, { initial: false });
	}
}
