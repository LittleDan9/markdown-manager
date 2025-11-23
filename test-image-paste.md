# Image Paste Test

This document is for testing the image paste functionality.

## Test Steps:

1. Open this document in the markdown editor
2. Copy an image to your clipboard (screenshot, copy from browser, etc.)
3. Paste it into the editor using Ctrl+V (or Cmd+V on Mac)
4. Verify that:
   - Loading placeholder appears immediately
   - Image uploads successfully
   - Preview pane shows the image correctly (not broken)
   - Markdown syntax is properly generated

## Expected Behavior:

When pasting an image, you should see:
1. Immediate loading placeholder: `![Uploading image...](data:image/svg+xml;...)`
2. After upload: `![Pasted Image](/api/images/{user_id}/{filename})`
3. Image displays properly in preview pane using blob URLs

## Test Results:

_Add your test results here..._
