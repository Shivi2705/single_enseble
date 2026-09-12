"use client";

import { useState } from "react";
import { ImageOff, ExternalLink } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { resolveBackendAsset } from "@/lib/utils";

export function PlotThumbnail({ filename, path }: { filename: string; path: string }) {
  const [errored, setErrored] = useState(false);
  const [open, setOpen] = useState(false);
  const src = resolveBackendAsset(path);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="group relative aspect-video w-full overflow-hidden rounded-lg border border-border bg-muted text-left"
      >
        {!errored ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={filename}
            onError={() => setErrored(true)}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-muted-foreground">
            <ImageOff className="h-5 w-5" />
            <span className="px-2 text-center text-[10px] leading-tight">{filename}</span>
          </div>
        )}
        <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/60 to-transparent opacity-0 transition-opacity group-hover:opacity-100">
          <span className="flex items-center gap-1 truncate p-2 text-[11px] text-white">
            <ExternalLink className="h-3 w-3 shrink-0" /> {filename}
          </span>
        </div>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogTitle className="mb-3 text-sm">{filename}</DialogTitle>
          {!errored ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt={filename} className="w-full rounded-md border border-border" />
          ) : (
            <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
              <ImageOff className="h-8 w-8" />
              <p className="text-sm">Could not load this plot image.</p>
              <p className="max-w-md break-all text-center text-xs">{path}</p>
              <p className="max-w-md text-center text-xs">
                Serve the backend&apos;s output/plots directory as static files (e.g. FastAPI
                <code className="mx-1 rounded bg-muted px-1">StaticFiles</code>
                mount) so the frontend can fetch plot images by URL.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
