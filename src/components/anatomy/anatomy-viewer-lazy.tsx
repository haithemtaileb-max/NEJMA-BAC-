'use client';

import dynamic from 'next/dynamic';

import type { AnatomyViewerProps } from './anatomy-viewer';

/** three.js needs `window`/WebGL: load the viewer on the client only, in its own chunk. */
const AnatomyViewer = dynamic(() => import('./anatomy-viewer'), {
  ssr: false,
  loading: () => <div className="h-[62vh] min-h-[420px] animate-pulse rounded-2xl border border-border bg-muted lg:h-[72vh]" />,
});

export function AnatomyViewerLazy(props: AnatomyViewerProps) {
  return <AnatomyViewer {...props} />;
}
