const inlined = new Map<string, Promise<string>>();

/** A texture as a data URL, which a drawing shown as an image can still use */
export function inline(href: string): Promise<string> {
  let made = inlined.get(href);
  if (!made) {
    made = fetch(href)
      .then((r) => r.blob())
      .then(
        (blob) =>
          new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
          }),
      );
    inlined.set(href, made);
  }
  return made;
}
