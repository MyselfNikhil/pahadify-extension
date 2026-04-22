"use strict";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "pahadify-parent",
    title: "Save Image With (Pahadify)",
    contexts: ["image"]
  });

  const formats = ["JPG", "PNG", "WebP"];
  formats.forEach(format => {
    chrome.contextMenus.create({
      id: `convert-${format.toLowerCase()}`,
      parentId: "pahadify-parent",
      title: `...as ${format}`,
      contexts: ["image"]
    });
  });

  chrome.contextMenus.create({
    id: "separator-1",
    parentId: "pahadify-parent",
    type: "separator",
    contexts: ["image"]
  });

  chrome.contextMenus.create({
    id: "convert-jpg-300dpi",
    parentId: "pahadify-parent",
    title: "👉 ...as JPG (300 DPI Print Ready)",
    contexts: ["image"]
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId.startsWith("convert-")) {
    
    let targetFormat = info.menuItemId.includes("jpg") ? "jpg" : 
                       info.menuItemId.includes("png") ? "png" : "webp";
                       
    let targetDpi = info.menuItemId.includes("300dpi") ? 300 : null;
    
    try {
      await convertAndDownload(info.srcUrl, targetFormat, targetDpi);
    } catch (error) {
      console.error("Pahadify Conversion Error:", error);
    }
  }
});

async function convertAndDownload(imageUrl, format, targetDpi) {
  const response = await fetch(imageUrl);
  const blob = await response.blob();
  const imageBitmap = await createImageBitmap(blob);
  const canvas = new OffscreenCanvas(imageBitmap.width, imageBitmap.height);
  const ctx = canvas.getContext("2d");

  let mimeType = format === "png" ? "image/png" : 
                 format === "webp" ? "image/webp" : "image/jpeg";

  if (format === "jpg") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  
  ctx.drawImage(imageBitmap, 0, 0, canvas.width, canvas.height);

  let convertedBlob = await canvas.convertToBlob({
    type: mimeType,
    quality: 1.0
  });

  if (format === "jpg" && targetDpi === 300) {
      const arrayBuffer = await convertedBlob.arrayBuffer();
      const view = new DataView(arrayBuffer);
      
      if (view.getUint16(0) === 0xFFD8) { 
          let offset = 2;
          while (offset < view.byteLength) {
              if (view.getUint16(offset) === 0xFFE0 && view.getUint32(offset + 4) === 0x4A464946) { 
                  view.setUint8(offset + 11, 1); 
                  view.setUint16(offset + 12, targetDpi, false); 
                  view.setUint16(offset + 14, targetDpi, false); 
                  console.log(`PAHADIFY: Patched image to ${targetDpi} DPI`);
                  break;
              }
              offset += 2 + view.getUint16(offset + 2);
          }
      }
      convertedBlob = new Blob([view], { type: mimeType });
  }

  const reader = new FileReader();
  reader.onloadend = () => {
    const timestamp = new Date().getTime();
    let filename = targetDpi ? `pahadify_${timestamp}_300dpi.${format}` : `pahadify_${timestamp}.${format}`;
    
    chrome.downloads.download({
      url: reader.result,
      filename: filename,
      saveAs: true 
    });
  };
  
  reader.readAsDataURL(convertedBlob);
}