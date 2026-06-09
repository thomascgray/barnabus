<!-- will-change isolates the box so its per-frame transform/size rewrites during
     a drag composite over the (promoted) object scene rather than forcing a
     re-raster of the translucent rect over ~1000 images (issue #21). -->
<div
  id="selectionBox"
  style="border-width: 4px; will-change: transform;"
  class="hidden absolute pointer-events-none top-0 left-0 z-[9999] border-slate-500 bg-slate-500/10 border-dotted"
></div>
