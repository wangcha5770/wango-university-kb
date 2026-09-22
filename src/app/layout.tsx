import type { ReactNode } from "react";

export const metadata = {
  title: "Wango University Knowledge Base — Vertical Slice 1",
};

const baseStyle = `
  body { font-family: -apple-system, system-ui, sans-serif; margin: 0; padding: 0; color: #1a1a1a; background: #fff; }
  main { max-width: 780px; margin: 0 auto; padding: 24px 16px 64px; }
  a { color: #0b57d0; }
  h1 { font-size: 1.4rem; }
  h2 { font-size: 1.15rem; margin-top: 1.6em; }
  table { border-collapse: collapse; width: 100%; margin: 8px 0 20px; }
  th, td { border: 1px solid #ddd; padding: 6px 10px; text-align: left; vertical-align: top; font-size: 0.92rem; }
  th { background: #f5f5f5; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 3px; font-size: 0.78rem; font-weight: 600; }
  .VERIFIED { background: #d7f2df; color: #1b6e34; }
  .NEEDS_REVIEW { background: #fff3cd; color: #7a5c00; }
  .NOT_VERIFIED { background: #eee; color: #555; }
  .CONFLICTING_SOURCES { background: #fddede; color: #a41414; }
  .CURRENT { background: #d7f2df; color: #1b6e34; }
  .POSSIBLY_OUTDATED { background: #fff3cd; color: #7a5c00; }
  .SUPERSEDED { background: #eee; color: #555; }
  .UNKNOWN { background: #eee; color: #555; }
  .crumbs { font-size: 0.85rem; color: #666; margin-bottom: 16px; }
  form.review { border: 1px solid #ccc; padding: 12px; margin-top: 12px; }
  input, select, button, textarea { font-size: 0.95rem; padding: 4px 8px; }
  .gap-note { background: #fdf2e9; border-left: 3px solid #d98324; padding: 8px 12px; margin: 8px 0; font-size: 0.9rem; }
  .simulated { background: #f0f0ff; border-left: 3px solid #6666cc; padding: 8px 12px; font-size: 0.85rem; }
`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <style dangerouslySetInnerHTML={{ __html: baseStyle }} />
      </head>
      <body>
        <main>{children}</main>
      </body>
    </html>
  );
}
