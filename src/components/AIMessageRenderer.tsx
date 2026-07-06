import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Bot } from "lucide-react";

interface AIMessageRendererProps {
  content: string;
}

export function AIMessageRenderer({ content }: AIMessageRendererProps) {
  return (
    <div className="flex justify-start animate-in slide-in-from-bottom-2 duration-300">
      <div className="flex w-full max-w-[94%] items-start gap-2 md:max-w-[86%]">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Bot className="h-4 w-4" />
        </div>

        <div className="min-w-0 flex-1 rounded-2xl rounded-tl-md border border-border bg-card px-4 py-3 shadow-sm">
          <div
            className="
              prose prose-sm max-w-none text-foreground dark:prose-invert
              [&>*:first-child]:mt-0
              [&>*:last-child]:mb-0
              [&_p]:my-2 [&_p]:leading-relaxed
              [&_ul]:my-2 [&_ol]:my-2
              [&_li]:my-1
              [&_code]:rounded-md [&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5
              [&_pre]:rounded-lg [&_pre]:bg-muted
              [&_blockquote]:border-l-2 [&_blockquote]:border-primary/40 [&_blockquote]:pl-3
            "
          >
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          </div>
        </div>
      </div>
    </div>
  );
}

