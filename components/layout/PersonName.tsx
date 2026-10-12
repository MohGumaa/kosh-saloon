/** A person's name in a table cell: the short label, with the full name on hover when shortened. */
export function PersonName({ name, label }: { name: string; label?: string }) {
  const shown = label ?? name;
  return (
    <span dir="auto" className="break-words" title={shown === name ? undefined : name}>
      {shown}
    </span>
  );
}
