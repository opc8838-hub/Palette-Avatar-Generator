# Approved Line / Solid / Color sample assets

Four PNG source assets are copied unchanged from `E:/头像生成/style-library/line-solid-v2/assets/`. Original hashes and user acceptance scope are recorded in `source-manifest.json`.

The sample geometry and Line / Solid versions were accepted by the user on 2026-10-04. Color is a runtime extension, preserving hair, face, skin, beard and ink. `regions.json` and `makeup.json` are manually calibrated for these two portraits only. The man has no clothes; the woman has two visible garment panels. These are not automatic segmentation rules for other people.

The renderer removes only edge-connected light background to produce a transparent portrait for the studio composition pipeline. The pipeline supplies white for Line / Solid and the selected background for Color. Cheek/lip colors and clothing are composited locally, followed by shared crop, text, social, phone, motion and PNG rendering. No image generation API, model training or arbitrary photo conversion is included.
