import open from "open";

export async function openInBrowser(url: string): Promise<void> {
  await open(url);
}
