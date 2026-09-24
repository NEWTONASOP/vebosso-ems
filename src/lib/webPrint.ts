// ============================================================================
// VEBOSSO EMS — Print an HTML document on web
// expo-print's printAsync on web ignores the HTML and prints the current page
// (the app itself). Instead, load the HTML into a hidden iframe and print that
// frame — the browser's dialog then shows the real document, and "Save as PDF"
// suggests the given file name.
// ============================================================================

export async function printHtmlOnWeb(html: string, fileName: string): Promise<void> {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  Object.assign(iframe.style, {
    position: 'fixed',
    right: '0',
    bottom: '0',
    width: '0',
    height: '0',
    border: '0',
    visibility: 'hidden',
  });
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
  const win = iframe.contentWindow;
  if (!doc || !win) {
    iframe.remove();
    throw new Error('Could not prepare the document for printing');
  }

  doc.open();
  doc.write(html);
  doc.close();
  // "Save as PDF" names the file after the document title.
  doc.title = fileName.replace(/\.pdf$/i, '');

  // Wait for embedded images (logo, photos) so they aren't blank in the PDF.
  const images = Array.from(doc.images);
  await Promise.all(
    images.map((img) =>
      img.complete
        ? Promise.resolve()
        : new Promise<void>((resolve) => {
            img.onload = () => resolve();
            img.onerror = () => resolve();
          })
    )
  );

  // Some browsers put the parent tab's title on the PDF; borrow it briefly.
  const parentTitle = document.title;
  document.title = doc.title;

  await new Promise<void>((resolve) => {
    let finished = false;
    const done = () => {
      if (finished) return;
      finished = true;
      document.title = parentTitle;
      // Leave the frame long enough for the print job to take its snapshot.
      setTimeout(() => iframe.remove(), 1000);
      resolve();
    };
    win.addEventListener('afterprint', done);
    win.focus();
    win.print();
    // Browsers where print() blocks have already finished by now; others
    // fire afterprint. Either way, don't leave the promise hanging.
    setTimeout(done, 60000);
  });
}
