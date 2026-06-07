export const CLASSES = {
  OBJECT: "_object",
  IMAGE_OBJECT: "_image_object",
  TEXT_OBJECT: "_text_object",
  SVG_OBJECT: "_svg_object",
  SVG_PATH_OBJECT: "_svg_path_object",
  // Transient image-upload states (issue #13). Purely visual — object lookups
  // still match on IMAGE_OBJECT + data-objtype, not these.
  IMAGE_UPLOADING: "_image_uploading", // the uploader's own copy, while uploading
  IMAGE_PREVIEW: "_image_preview", // other clients' blurry placeholder
};

export const INITIAL_CAMERA_Z = 10;
