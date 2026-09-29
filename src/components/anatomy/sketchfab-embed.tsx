/**
 * Alternative integration: embed a Sketchfab model (many CC-licensed anatomy
 * models exist). Use it for an `anatomy_models` row whose model_url is
 * `sketchfab:<model id>`. Selection/isolation are then Sketchfab's own UI.
 */
export function SketchfabEmbed({ modelId, title }: { modelId: string; title: string }) {
  const src = `https://sketchfab.com/models/${encodeURIComponent(modelId)}/embed?autostart=1&ui_theme=dark&ui_infos=0&ui_watermark=0`;
  return (
    <iframe
      title={title}
      src={src}
      className="h-[62vh] min-h-[420px] w-full rounded-2xl border border-border lg:h-[72vh]"
      allow="autoplay; fullscreen; xr-spatial-tracking"
      allowFullScreen
      loading="lazy"
    />
  );
}
