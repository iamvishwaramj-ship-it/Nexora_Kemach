import React, { useCallback, useState } from 'react';
import Cropper from 'react-easy-crop';
import {
  Box, Dialog, DialogTitle, DialogContent, DialogActions, Button, Slider, Typography, IconButton,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

// Reads the crop selection back out of the source image as a fixed-size
// canvas, so every signature (or logo/QR — this dialog is generic) that
// goes through it lands on disk at exactly outputWidth x outputHeight,
// regardless of what dimensions or aspect ratio the person originally
// uploaded. This is what actually prevents an oversized/odd-aspect source
// image from ever reaching a print template again — the crop box is what
// stops it, not the print CSS (which was only ever a downstream patch-up).
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function getCroppedFile(imageSrc, cropPixels, outputWidth, outputHeight, fileName, mimeType) {
  const image = await loadImage(imageSrc);
  const canvas = document.createElement('canvas');
  canvas.width = outputWidth;
  canvas.height = outputHeight;
  const ctx = canvas.getContext('2d');
  // Transparent background (not white) so a PNG/WEBP source with real
  // transparency prints the same way it would have unedited — matters for
  // a signature traced/exported with a transparent backdrop.
  ctx.clearRect(0, 0, outputWidth, outputHeight);
  ctx.drawImage(
    image,
    cropPixels.x, cropPixels.y, cropPixels.width, cropPixels.height,
    0, 0, outputWidth, outputHeight
  );
  const outType = mimeType === 'image/jpeg' || mimeType === 'image/jpg' ? 'image/jpeg' : 'image/png';
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, outType, 0.92));
  const outName = fileName.replace(/\.[^.]+$/, '') + (outType === 'image/jpeg' ? '.jpg' : '.png');
  return new File([blob], outName, { type: outType });
}

// Generic crop-in-a-fixed-box dialog. `aspect` is width/height of the crop
// box; `outputWidth`/`outputHeight` set the exact pixel size every cropped
// result is exported at (same aspect ratio as `aspect`, obviously). Calls
// back with a real File (so callers can drop it straight into the same
// FormData/upload path a directly-picked file would have gone through) plus
// a data URL for an immediate preview.
export default function ImageCropDialog({
  open, imageSrc, fileName, mimeType, aspect = 2, outputWidth = 480, outputHeight = 240,
  title = 'Adjust image', onCancel, onCropped,
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [saving, setSaving] = useState(false);

  const handleCropComplete = useCallback((_area, areaPixels) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  const handleClose = () => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    onCancel();
  };

  const handleSave = async () => {
    if (!croppedAreaPixels) return;
    setSaving(true);
    try {
      const file = await getCroppedFile(imageSrc, croppedAreaPixels, outputWidth, outputHeight, fileName || 'image', mimeType);
      const previewUrl = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(file);
      });
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCroppedAreaPixels(null);
      onCropped(file, previewUrl);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {title}
        <IconButton size="small" onClick={handleClose}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
          Drag to position, use the slider to zoom. Only what's inside the box will be used.
        </Typography>
        <Box sx={{ position: 'relative', width: '100%', height: 260, bgcolor: 'grey.900', borderRadius: 1, overflow: 'hidden' }}>
          {imageSrc && (
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={aspect}
              cropShape="rect"
              showGrid
              restrictPosition={false}
              minZoom={0.2}
              maxZoom={4}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={handleCropComplete}
            />
          )}
        </Box>
        <Box sx={{ px: 1, mt: 2 }}>
          <Typography variant="caption" color="text.secondary">Zoom</Typography>
          <Slider
            size="small"
            min={0.2}
            max={4}
            step={0.05}
            value={zoom}
            onChange={(_e, v) => setZoom(v)}
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={saving}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving || !croppedAreaPixels}>
          {saving ? 'Saving…' : 'Apply'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
