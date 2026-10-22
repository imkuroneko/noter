import { Children, isValidElement, type ReactNode } from "react";
import type { Components, ExtraProps } from "react-markdown";
import { Check } from "lucide-react";
import { openExternal } from "../../api";
import { cn } from "../../lib/cn";
import { useNotes } from "../../stores/notes";

type HastElement = NonNullable<ExtraProps["node"]>;
type HastChild = HastElement["children"][number];

function textOf(node: HastChild): string {
  if (node.type === "text") return node.value;
  if (node.type === "element") return node.children.map(textOf).join("");
  return "";
}

/** Busca el <input> de casilla que remark-gfm deja dentro del <li> (a veces dentro de un <p>). */
function findCheckbox(node: HastElement): HastElement | undefined {
  for (const child of node.children) {
    if (child.type !== "element") continue;
    if (child.tagName === "input") return child;
    if (child.tagName === "p") {
      const nested = findCheckbox(child);
      if (nested) return nested;
    }
  }
  return undefined;
}

function langOf(children: ReactNode): string | undefined {
  for (const child of Children.toArray(children)) {
    if (isValidElement<{ className?: string }>(child)) {
      const m = /language-([\w+-]+)/.exec(child.props.className ?? "");
      if (m) return m[1];
    }
  }
  return undefined;
}

// Estos componentes no dependen del texto: se definen una vez para que React no remonte la vista previa.
export const markdownComponents: Components = {
  h1: ({ children }) => (
    <h1 className="mb-3.5 text-[26px] leading-[1.2] font-bold tracking-[-.01em]">{children}</h1>
  ),
  h2: ({ children }) => <h2 className="mt-[18px] mb-2 text-base leading-[1.3] font-bold">{children}</h2>,
  h3: ({ children }) => <h3 className="mt-4 mb-1.5 text-sm leading-[1.3] font-bold">{children}</h3>,
  h4: ({ children }) => <h4 className="mt-3 mb-1 text-sm leading-[1.3] font-semibold">{children}</h4>,
  p: ({ children }) => <p className="mb-3 text-sm leading-[1.65]">{children}</p>,
  ul: ({ children, className }) => (
    <ul
      className={cn(
        "mb-1.5 list-none p-0 [&_ul]:mt-1.5 [&>li:not(.task-list-item)]:relative [&>li:not(.task-list-item)]:pl-[15px]",
        "[&>li:not(.task-list-item)]:before:absolute [&>li:not(.task-list-item)]:before:top-2.5 [&>li:not(.task-list-item)]:before:left-0",
        "[&>li:not(.task-list-item)]:before:size-[5px] [&>li:not(.task-list-item)]:before:rounded-full [&>li:not(.task-list-item)]:before:bg-accent [&>li:not(.task-list-item)]:before:content-['']",
        className,
      )}
    >
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-1.5 list-decimal pl-5 marker:text-accent [&_ol]:mt-1.5">{children}</ol>
  ),
  li: ({ children, className, node }) => {
    if (!className?.includes("task-list-item") || !node) {
      return <li className="mb-1.5 text-sm leading-[1.6]">{children}</li>;
    }
    const done = findCheckbox(node)?.properties.checked === true;
    const line = node.position?.start.line;
    return (
      <li className="mb-1.5 flex items-start gap-2.5 text-sm leading-[1.6]">
        <button
          type="button"
          role="checkbox"
          aria-checked={done}
          aria-label={textOf(node).trim() || "Tarea"}
          onClick={() => line !== undefined && useNotes.getState().toggleTask(line)}
          className={cn(
            "mt-[3px] box-border flex size-4 flex-none items-center justify-center rounded-[5px] border-[1.5px] text-onaccent",
            done ? "border-accent bg-accent" : "border-muted",
          )}
        >
          {done && <Check size={11} strokeWidth={3.5} aria-hidden="true" />}
        </button>
        <div className={cn("min-w-0 [&>p]:mb-0", done && "text-muted line-through")}>{children}</div>
      </li>
    );
  },
  // La casilla real la dibuja el <li>; aquí se descarta el input deshabilitado de remark-gfm.
  input: () => null,
  blockquote: ({ children }) => (
    <blockquote className="mt-1 mb-3.5 rounded-lg bg-soft px-3.5 py-2.5 text-sm leading-[1.6] italic [&>p]:mb-0">
      {children}
    </blockquote>
  ),
  pre: ({ children }) => {
    const lang = langOf(children);
    return (
      <div className="mt-1 mb-3.5 overflow-hidden rounded-[10px] border border-line bg-code">
        {lang && <div className="border-b border-line px-3 py-1.5 text-[11px] text-muted">{lang}</div>}
        <pre className="m-0 overflow-x-auto p-3 font-mono text-[12.5px] leading-[1.6]">{children}</pre>
      </div>
    );
  },
  code: ({ children, className }) => (
    <code
      className={cn(
        "font-mono text-[12.5px] [:not(pre)>&]:rounded-[5px] [:not(pre)>&]:border [:not(pre)>&]:border-line [:not(pre)>&]:bg-code [:not(pre)>&]:px-1.5 [:not(pre)>&]:py-px",
        className,
      )}
    >
      {children}
    </code>
  ),
  a: ({ children, href }) => (
    <a
      href={href}
      onClick={(e) => {
        e.preventDefault();
        if (href) void openExternal(href);
      }}
      className="text-accent underline underline-offset-2"
    >
      {children}
    </a>
  ),
  hr: () => <hr className="my-4 border-line" />,
  table: ({ children }) => (
    <div className="mb-3.5 overflow-x-auto">
      <table className="w-full border-collapse text-[13px]">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="border border-line bg-code px-2.5 py-1.5 text-left font-semibold">{children}</th>,
  td: ({ children }) => <td className="border border-line px-2.5 py-1.5">{children}</td>,
  img: ({ src, alt }) => <img src={src} alt={alt ?? ""} className="my-2 max-w-full rounded-lg" />,
};
