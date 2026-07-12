const URL_PATTERN = /(https?:\/\/[^\s]+)/g;

export function MaterialDescription({ text }: { text: string }) {
  return (
    <p className="mt-2 whitespace-pre-wrap text-sm font-semibold text-muted-foreground">
      {text.split(URL_PATTERN).map((part, index) =>
        /^https?:\/\//.test(part) ? (
          <a
            key={`${part}-${index}`}
            href={part}
            target="_blank"
            rel="noreferrer"
            className="cursor-pointer break-all font-bold text-secondary-strong underline underline-offset-2 hover:text-foreground"
          >
            {part}
          </a>
        ) : (
          part
        ),
      )}
    </p>
  );
}
