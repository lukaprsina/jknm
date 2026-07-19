"use client";

import dynamic from "next/dynamic";

// @editorjs/editorjs patches `Element.prototype` at module-eval time with no
// `typeof document` guard, so it throws "Element is not defined" if the
// module is ever evaluated during SSR — must stay client-only. `ssr: false`
// is only allowed inside a Client Component, hence this wrapper.
const Editor = dynamic(() => import("./editor"), {
	ssr: false,
});

export default Editor;
