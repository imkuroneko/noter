import { memo, useDeferredValue } from "react";
import ReactMarkdown, { type Options } from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";
import { useNotes } from "../../stores/notes";
import { markdownComponents } from "./markdownComponents";

const remarkPlugins: Options["remarkPlugins"] = [remarkGfm];
// Sin rehype-raw: el HTML crudo del texto nunca se interpreta.
const rehypePlugins: Options["rehypePlugins"] = [[rehypeHighlight, { detect: false, ignoreMissing: true }]];

export const MarkdownView = memo(function MarkdownView({ text }: { text: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={remarkPlugins}
      rehypePlugins={rehypePlugins}
      components={markdownComponents}
    >
      {text}
    </ReactMarkdown>
  );
});

export function Preview() {
  const body = useNotes((s) => s.body);
  const deferred = useDeferredValue(body);
  return (
    <article
      aria-label="Vista previa"
      data-selectable
      tabIndex={-1}
      className="min-w-0 flex-1 overflow-auto px-7 pt-[22px] pb-7"
    >
      <div className="max-w-[620px]">
        {deferred.trim() === "" ? (
          <p className="text-[13px] text-muted">La vista previa aparecerá cuando escribas algo.</p>
        ) : (
          <MarkdownView text={deferred} />
        )}
      </div>
    </article>
  );
}
